import prisma from '../utils/prisma';
import {
    Prisma,
    PaymentMethod,
    PaymentTxStatus,
    PaymentState,
    SubscriptionState,
} from '@prisma/client';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';
import { createPaymentLink as razorpayCreateLink } from './razorpay.service';
import { emailService } from './email.service';
import { subscriptionService } from './subscription.service';

const MANUAL_METHODS: PaymentMethod[] = [
    PaymentMethod.manual_cash,
    PaymentMethod.manual_upi,
    PaymentMethod.manual_bank,
    PaymentMethod.manual_other,
];

interface ManualPaymentInput {
    amountInr: number;
    method: PaymentMethod;
    note?: string;
}

interface PaymentLinkInput {
    /** When omitted, defaults to the plan's cost. */
    amountInr?: number;
    /** Free-form message — first line of the WhatsApp / email body. */
    message?: string;
    /** Channels to use (server side). UI exposes as toggles. */
    channels?: { whatsapp?: boolean; email?: boolean };
    /** Optional Razorpay redirect after successful payment. */
    callbackUrl?: string;
}

export interface PaymentLinkResult {
    paymentId: string;
    razorpayLinkId: string;
    shortUrl: string;
    /** wa.me deep-link with prefilled message. UI opens this in a new tab/app. */
    whatsappUrl: string | null;
    emailSent: boolean;
}

function buildWhatsAppDeepLink(phone: string | null | undefined, message: string): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return null;
    const e164 = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

function defaultMessage(args: { clientName: string; planName: string; amountInr: number; shortUrl: string }) {
    return `Hi ${args.clientName}, here's your payment link for the ${args.planName} plan: ${args.shortUrl}. Amount: ₹${args.amountInr.toFixed(2)}.`;
}

async function ensureClientInOrg(clientId: string, orgId: string) {
    const client = await prisma.client.findFirst({
        where: { id: clientId, orgId, isActive: true },
        select: {
            id: true,
            primaryDietitianId: true,
            fullName: true,
            email: true,
            phone: true,
            organization: { select: { name: true } },
        },
    });
    if (!client) throw AppError.notFound('Client not found');
    return client;
}

function assertDietitianAccess(
    client: { primaryDietitianId: string | null },
    userRole: string,
    userId: string,
) {
    if (userRole === 'dietitian' && client.primaryDietitianId !== userId) {
        throw AppError.forbidden('You can only manage payments for your assigned clients');
    }
}

export const paymentService = {
    /**
     * Record a payment that already happened off-platform (cash, UPI, bank transfer).
     * Marks the subscription as paid and advances renewal.
     */
    async recordManualPayment(
        clientId: string,
        orgId: string,
        actor: { role: string; id: string },
        input: ManualPaymentInput,
    ) {
        const client = await ensureClientInOrg(clientId, orgId);
        assertDietitianAccess(client, actor.role, actor.id);

        if (!MANUAL_METHODS.includes(input.method)) {
            throw AppError.badRequest('method must be a manual payment method');
        }
        if (!Number.isFinite(input.amountInr) || input.amountInr <= 0) {
            throw AppError.badRequest('amountInr must be a positive number');
        }

        const sub = await prisma.clientSubscription.findUnique({
            where: { clientId },
            include: { plan: true },
        });
        if (!sub) throw AppError.badRequest('Client has no subscription. Assign a plan first.');

        const now = new Date();
        const payment = await prisma.payment.create({
            data: {
                orgId,
                clientId,
                clientSubscriptionId: sub.id,
                amountInr: new Prisma.Decimal(input.amountInr.toFixed(2)),
                status: PaymentTxStatus.succeeded,
                method: input.method,
                paidAt: now,
                note: input.note ?? null,
                recordedByUserId: actor.id,
            },
        });

        await subscriptionService.applyPayment(sub.id, payment.amountInr);

        logger.info('Manual payment recorded', {
            paymentId: payment.id,
            clientId,
            method: input.method,
            actorUserId: actor.id,
        });
        return payment;
    },

    /**
     * Generate a Razorpay payment link for a client. Inserts a pending Payment row,
     * stores razorpayLinkId, and (optionally) builds WhatsApp + email channels.
     */
    async createPaymentLink(
        clientId: string,
        orgId: string,
        actor: { role: string; id: string },
        input: PaymentLinkInput,
    ): Promise<PaymentLinkResult> {
        const client = await ensureClientInOrg(clientId, orgId);
        assertDietitianAccess(client, actor.role, actor.id);

        const sub = await prisma.clientSubscription.findUnique({
            where: { clientId },
            include: { plan: true },
        });
        if (!sub) throw AppError.badRequest('Client has no subscription. Assign a plan first.');

        const amountInr = input.amountInr ?? Number(sub.plan.costInr);
        if (!Number.isFinite(amountInr) || amountInr <= 0) {
            throw AppError.badRequest('amountInr must be a positive number');
        }

        // Pre-create a pending Payment row so we have an ID for Razorpay reference.
        const pending = await prisma.payment.create({
            data: {
                orgId,
                clientId,
                clientSubscriptionId: sub.id,
                amountInr: new Prisma.Decimal(amountInr.toFixed(2)),
                status: PaymentTxStatus.pending,
                method: PaymentMethod.razorpay_link,
                recordedByUserId: actor.id,
            },
        });

        let link;
        try {
            link = await razorpayCreateLink({
                amountInr,
                description: `${sub.plan.name} — ${client.fullName}`,
                customer: { name: client.fullName, email: client.email, contact: client.phone },
                referenceId: pending.id,
                callbackUrl: input.callbackUrl,
                notes: {
                    clientId,
                    clientSubscriptionId: sub.id,
                    paymentId: pending.id,
                    orgId,
                },
            });
        } catch (err) {
            // Surface Razorpay error and clean up the pending row to avoid orphans.
            await prisma.payment.update({
                where: { id: pending.id },
                data: { status: PaymentTxStatus.failed },
            });
            throw err;
        }

        const updated = await prisma.payment.update({
            where: { id: pending.id },
            data: { razorpayLinkId: link.id },
        });

        const message = input.message?.trim() || defaultMessage({
            clientName: client.fullName,
            planName: sub.plan.name,
            amountInr,
            shortUrl: link.shortUrl,
        });

        const wantWa = input.channels?.whatsapp ?? true;
        const wantEmail = input.channels?.email ?? true;

        const whatsappUrl = wantWa ? buildWhatsAppDeepLink(client.phone, message) : null;

        let emailSent = false;
        if (wantEmail && client.email) {
            try {
                await emailService.sendPaymentLink({
                    to: client.email,
                    clientName: client.fullName,
                    planName: sub.plan.name,
                    amountInr,
                    shortUrl: link.shortUrl,
                    message: input.message?.trim() || undefined,
                    orgName: client.organization?.name,
                });
                emailSent = true;
            } catch (err) {
                logger.warn('Payment-link email failed', {
                    paymentId: updated.id,
                    error: (err as Error).message,
                });
            }
        }

        return {
            paymentId: updated.id,
            razorpayLinkId: link.id,
            shortUrl: link.shortUrl,
            whatsappUrl,
            emailSent,
        };
    },

    async listForClient(clientId: string, orgId: string) {
        const client = await prisma.client.findFirst({ where: { id: clientId, orgId } });
        if (!client) throw AppError.notFound('Client not found');
        return prisma.payment.findMany({
            where: { clientId, orgId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    },

    /**
     * Idempotent webhook application. Razorpay can deliver the same event multiple
     * times; we key off `razorpayPaymentId` (unique). If the link is already
     * marked succeeded, we no-op; otherwise we promote pending → succeeded and
     * call subscriptionService.applyPayment.
     */
    async applyWebhookPaid(payload: {
        razorpayLinkId: string;
        razorpayPaymentId?: string;
        amountInrPaise?: number;
        rawPayload: unknown;
    }) {
        const existing = await prisma.payment.findFirst({
            where: { razorpayLinkId: payload.razorpayLinkId },
        });

        if (!existing) {
            // No pre-existing pending row — webhook arrived first or the row was
            // wiped. Without our reference id we can't safely link it to a sub.
            logger.warn('Razorpay webhook: no matching Payment row', {
                razorpayLinkId: payload.razorpayLinkId,
            });
            return { acknowledged: true };
        }

        if (existing.status === PaymentTxStatus.succeeded) {
            logger.info('Razorpay webhook: duplicate paid event ignored', {
                paymentId: existing.id,
                razorpayLinkId: payload.razorpayLinkId,
            });
            return { acknowledged: true };
        }

        const amountInr = payload.amountInrPaise
            ? new Prisma.Decimal((payload.amountInrPaise / 100).toFixed(2))
            : existing.amountInr;

        const now = new Date();
        await prisma.$transaction([
            prisma.payment.update({
                where: { id: existing.id },
                data: {
                    status: PaymentTxStatus.succeeded,
                    razorpayPaymentId: payload.razorpayPaymentId ?? null,
                    paidAt: now,
                    amountInr,
                    rawPayload: payload.rawPayload as Prisma.InputJsonValue,
                },
            }),
        ]);

        if (existing.clientSubscriptionId) {
            await subscriptionService.applyPayment(existing.clientSubscriptionId, amountInr);
        } else {
            // Lead-bound payments (CRM, future) skip subscription advance.
            logger.info('Webhook applied to lead-bound payment', { paymentId: existing.id });
        }

        return { acknowledged: true };
    },

    async applyWebhookExpired(payload: { razorpayLinkId: string; rawPayload: unknown }) {
        await prisma.payment.updateMany({
            where: {
                razorpayLinkId: payload.razorpayLinkId,
                status: PaymentTxStatus.pending,
            },
            data: {
                status: PaymentTxStatus.expired,
                rawPayload: payload.rawPayload as Prisma.InputJsonValue,
            },
        });
        return { acknowledged: true };
    },

    /** Invoked when admin overrides "mark active" via subscriptionService. */
    PaymentMethod, // re-export for convenience
    PaymentState,
    SubscriptionState,
};
