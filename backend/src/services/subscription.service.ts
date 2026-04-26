import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';
import {
    Prisma,
    SubscriptionState,
    PaymentState,
    PaymentMethod,
    PaymentTxStatus,
    ClientSubscription,
    SubscriptionPlan,
} from '@prisma/client';

/**
 * Subscription lifecycle for a client.
 *
 * One ClientSubscription row per client (uniqueClientId). Plan changes update
 * the same row; payment history is kept on the Payment table.
 *
 * Lazy expiry: any read for a given org first runs a tiny updateMany to flip
 * `paymentStatus='unpaid'` on rows where `renewalDate < today AND status='active'
 * AND paymentStatus='paid'`. No background cron.
 */

// ─── Helpers ────────────────────────────────────────────────────

const startOfDay = (d: Date = new Date()): Date => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const addDays = (d: Date, days: number): Date => {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
};

/**
 * Days a client stays in "unpaid + active" before we auto-pause them.
 * Configurable via GRACE_DAYS env var. During grace, the client app surfaces a
 * Pay Now prompt; payment via webhook/manual flips back to paid + extends renewal.
 */
const GRACE_DAYS = Math.max(0, Number(process.env.GRACE_DAYS ?? 3));

async function flipUnpaidIfDue(orgId: string): Promise<void> {
    const today = startOfDay();
    const graceCutoff = new Date(today);
    graceCutoff.setDate(graceCutoff.getDate() - GRACE_DAYS);

    // 1) Active+paid rows whose renewal lapsed → unpaid (badge flip; client still has access during grace).
    await prisma.clientSubscription.updateMany({
        where: {
            client: { orgId },
            status: SubscriptionState.active,
            paymentStatus: PaymentState.paid,
            renewalDate: { lt: today },
        },
        data: { paymentStatus: PaymentState.unpaid },
    });

    // 2) Still-unpaid rows past the grace window → auto-pause.
    //    Payments (webhook/manual) flip paymentStatus back to paid before reaching this branch,
    //    so paying clients are never accidentally paused.
    if (GRACE_DAYS > 0) {
        await prisma.clientSubscription.updateMany({
            where: {
                client: { orgId },
                status: SubscriptionState.active,
                paymentStatus: PaymentState.unpaid,
                renewalDate: { lt: graceCutoff },
            },
            data: {
                status: SubscriptionState.paused,
                pausedAt: new Date(),
            },
        });
    }
}

/** How long after renewal before we auto-pause (exposed for frontends). */
export function getGraceDays(): number {
    return GRACE_DAYS;
}

async function ensureClientInOrg(clientId: string, orgId: string) {
    const client = await prisma.client.findFirst({
        where: { id: clientId, orgId, isActive: true },
        select: { id: true, primaryDietitianId: true, fullName: true, email: true, phone: true },
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
        throw AppError.forbidden('You can only manage subscriptions for your assigned clients');
    }
}

// ─── Service ───────────────────────────────────────────────────

export type SubscriptionWithPlan = ClientSubscription & { plan: SubscriptionPlan };

export const subscriptionService = {
    flipUnpaidIfDue,

    async getForClient(clientId: string, orgId: string): Promise<SubscriptionWithPlan | null> {
        await flipUnpaidIfDue(orgId);
        return prisma.clientSubscription.findFirst({
            where: { clientId, client: { orgId } },
            include: { plan: true },
        });
    },

    async assignPlan(
        clientId: string,
        planId: string,
        orgId: string,
        actor: { role: string; id: string },
    ): Promise<SubscriptionWithPlan> {
        const client = await ensureClientInOrg(clientId, orgId);
        assertDietitianAccess(client, actor.role, actor.id);

        const plan = await prisma.subscriptionPlan.findFirst({
            where: { id: planId, orgId, deletedAt: null, active: true },
        });
        if (!plan) throw AppError.notFound('Plan not found or inactive');

        const today = startOfDay();
        const renewal = addDays(today, plan.durationDays);

        const upserted = await prisma.clientSubscription.upsert({
            where: { clientId },
            create: {
                clientId,
                planId: plan.id,
                activeDate: today,
                renewalDate: renewal,
                status: SubscriptionState.active,
                paymentStatus: PaymentState.unpaid,
                assignedByUserId: actor.id,
            },
            update: {
                planId: plan.id,
                activeDate: today,
                renewalDate: renewal,
                status: SubscriptionState.active,
                paymentStatus: PaymentState.unpaid,
                pausedAt: null,
                pausedUntil: null,
                deactivatedAt: null,
                assignedByUserId: actor.id,
            },
            include: { plan: true },
        });

        logger.info('Subscription assigned', {
            clientId,
            planId: plan.id,
            actorUserId: actor.id,
        });
        return upserted;
    },

    async pause(
        clientId: string,
        orgId: string,
        actor: { role: string; id: string },
        until?: Date,
    ): Promise<SubscriptionWithPlan> {
        const client = await ensureClientInOrg(clientId, orgId);
        assertDietitianAccess(client, actor.role, actor.id);

        const sub = await prisma.clientSubscription.findUnique({ where: { clientId } });
        if (!sub) throw AppError.notFound('Client has no active subscription');

        return prisma.clientSubscription.update({
            where: { clientId },
            data: {
                status: SubscriptionState.paused,
                pausedAt: new Date(),
                pausedUntil: until ?? null,
            },
            include: { plan: true },
        });
    },

    async resume(
        clientId: string,
        orgId: string,
        actor: { role: string; id: string },
    ): Promise<SubscriptionWithPlan> {
        const client = await ensureClientInOrg(clientId, orgId);
        assertDietitianAccess(client, actor.role, actor.id);

        const sub = await prisma.clientSubscription.findUnique({ where: { clientId } });
        if (!sub) throw AppError.notFound('Client has no subscription');

        return prisma.clientSubscription.update({
            where: { clientId },
            data: {
                status: SubscriptionState.active,
                pausedAt: null,
                pausedUntil: null,
            },
            include: { plan: true },
        });
    },

    async deactivate(
        clientId: string,
        orgId: string,
        actor: { role: string; id: string },
    ): Promise<SubscriptionWithPlan> {
        const client = await ensureClientInOrg(clientId, orgId);
        assertDietitianAccess(client, actor.role, actor.id);

        const sub = await prisma.clientSubscription.findUnique({ where: { clientId } });
        if (!sub) throw AppError.notFound('Client has no subscription');

        return prisma.clientSubscription.update({
            where: { clientId },
            data: {
                status: SubscriptionState.deactivated,
                deactivatedAt: new Date(),
            },
            include: { plan: true },
        });
    },

    /**
     * Admin override — mark the current subscription as paid without recording a
     * real money transaction. A Payment audit row is still inserted (method=mark_active)
     * so we have a trail.
     */
    async markActive(
        clientId: string,
        orgId: string,
        actor: { role: string; id: string },
        note?: string,
    ): Promise<SubscriptionWithPlan> {
        const client = await ensureClientInOrg(clientId, orgId);
        assertDietitianAccess(client, actor.role, actor.id);

        const sub = await prisma.clientSubscription.findUnique({
            where: { clientId },
            include: { plan: true },
        });
        if (!sub) throw AppError.notFound('Client has no subscription');

        const now = new Date();
        const today = startOfDay(now);
        const nextRenewal = addDays(today, sub.plan.durationDays);

        const [, updated] = await prisma.$transaction([
            prisma.payment.create({
                data: {
                    orgId,
                    clientId,
                    clientSubscriptionId: sub.id,
                    amountInr: sub.plan.costInr,
                    status: PaymentTxStatus.succeeded,
                    method: PaymentMethod.mark_active,
                    paidAt: now,
                    note: note ?? null,
                    recordedByUserId: actor.id,
                },
            }),
            prisma.clientSubscription.update({
                where: { clientId },
                data: {
                    status: SubscriptionState.active,
                    paymentStatus: PaymentState.paid,
                    lastPaidAt: now,
                    activeDate: sub.status === SubscriptionState.active ? sub.activeDate : today,
                    renewalDate: nextRenewal,
                    pausedAt: null,
                    pausedUntil: null,
                    deactivatedAt: null,
                },
                include: { plan: true },
            }),
        ]);

        logger.info('Subscription marked active by admin override', {
            clientId,
            actorUserId: actor.id,
        });
        return updated;
    },

    /**
     * Internal: advance renewal + flip to paid after a successful payment.
     * Idempotent — caller must have verified payment is succeeded.
     */
    async applyPayment(
        clientSubscriptionId: string,
        amountInr: Prisma.Decimal | number,
    ): Promise<void> {
        const sub = await prisma.clientSubscription.findUnique({
            where: { id: clientSubscriptionId },
            include: { plan: true },
        });
        if (!sub) {
            logger.warn('applyPayment: subscription not found', { clientSubscriptionId });
            return;
        }

        const now = new Date();
        const today = startOfDay(now);
        // If renewal already in the future (multiple successful charges in a window),
        // extend from current renewal; else from today.
        const base = sub.renewalDate > today ? sub.renewalDate : today;
        const nextRenewal = addDays(base, sub.plan.durationDays);

        await prisma.clientSubscription.update({
            where: { id: clientSubscriptionId },
            data: {
                paymentStatus: PaymentState.paid,
                status: SubscriptionState.active,
                lastPaidAt: now,
                renewalDate: nextRenewal,
                pausedAt: null,
                pausedUntil: null,
                deactivatedAt: null,
            },
        });

        // Suppress unused warning when caller just wants the side-effect
        void amountInr;
    },
};
