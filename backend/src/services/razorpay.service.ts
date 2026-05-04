import Razorpay from 'razorpay';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';

/**
 * Razorpay integration — wraps the official SDK.
 *
 * Env vars (read lazily so the server can boot without Razorpay configured;
 * only attempts to make a payment fail until creds are present):
 *  - RAZORPAY_KEY_ID
 *  - RAZORPAY_KEY_SECRET
 *  - RAZORPAY_WEBHOOK_SECRET
 */

let cachedClient: Razorpay | null = null;
let cachedKeyId: string | null = null;
let cachedKeySecret: string | null = null;

function getClient(): Razorpay {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        throw AppError.serviceUnavailable(
            'Payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
            'RAZORPAY_NOT_CONFIGURED',
        );
    }
    if (!cachedClient || cachedKeyId !== keyId || cachedKeySecret !== keySecret) {
        cachedClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
        cachedKeyId = keyId;
        cachedKeySecret = keySecret;
    }
    return cachedClient;
}

interface PaymentLinkArgs {
    /** Amount in INR (Decimal/number). Internally multiplied by 100 for paise. */
    amountInr: number;
    description: string;
    customer: {
        name: string;
        email?: string | null;
        contact?: string | null;
    };
    /** External reference id we control — e.g. our Payment.id. */
    referenceId: string;
    /** Optional URL Razorpay redirects to on completion. */
    callbackUrl?: string;
    /** Hours until link expiry. Defaults to 7 days. */
    expiryHours?: number;
    /** Auto-notification by Razorpay (SMS/email). Defaults to true for both. */
    notify?: { sms?: boolean; email?: boolean };
    notes?: Record<string, string>;
}

export interface CreatedPaymentLink {
    id: string;
    shortUrl: string;
    status: string;
}

export async function createPaymentLink(args: PaymentLinkArgs): Promise<CreatedPaymentLink> {
    const client = getClient();
    const amountPaise = Math.round(args.amountInr * 100);
    if (!Number.isFinite(amountPaise) || amountPaise < 100) {
        throw AppError.badRequest('Payment amount must be at least ₹1.');
    }
    const expiryHours = args.expiryHours ?? 24 * 7;
    const expireBy = Math.floor(Date.now() / 1000) + expiryHours * 60 * 60;

    try {
        const link = await client.paymentLink.create({
            amount: amountPaise,
            currency: 'INR',
            accept_partial: false,
            description: args.description,
            customer: {
                name: args.customer.name,
                email: args.customer.email ?? undefined,
                contact: args.customer.contact ?? undefined,
            },
            notify: {
                sms: args.notify?.sms ?? true,
                email: args.notify?.email ?? true,
            },
            reminder_enable: true,
            reference_id: args.referenceId,
            expire_by: expireBy,
            ...(args.callbackUrl
                ? { callback_url: args.callbackUrl, callback_method: 'get' }
                : {}),
            notes: args.notes,
        });

        return {
            id: link.id,
            shortUrl: link.short_url,
            status: link.status,
        };
    } catch (err: unknown) {
        const message = extractRazorpayError(err);
        logger.error('Razorpay createPaymentLink failed', {
            error: message,
            referenceId: args.referenceId,
            raw: err,
        });
        throw AppError.badGateway(`Payment link creation failed: ${message}`, 'RAZORPAY_LINK_FAILED');
    }
}

function extractRazorpayError(err: unknown): string {
    if (!err) return 'Unknown Razorpay error';
    if (typeof err === 'string') return err;
    if (err instanceof Error && err.message) return err.message;
    const e = err as { error?: { description?: string; code?: string; reason?: string }; message?: string; statusCode?: number };
    if (e.error?.description) return `${e.error.code ?? 'ERR'}: ${e.error.description}`;
    if (e.message) return e.message;
    try { return JSON.stringify(err); } catch { return 'Unknown Razorpay error'; }
}

/**
 * Cancel a still-pending payment link. Idempotent — Razorpay returns the same
 * link object regardless of whether it was already cancelled.
 */
export async function cancelPaymentLink(linkId: string): Promise<void> {
    const client = getClient();
    try {
        await client.paymentLink.cancel(linkId);
    } catch (err: unknown) {
        const message = extractRazorpayError(err);
        logger.warn('Razorpay cancelPaymentLink failed', { error: message, linkId });
    }
}

/**
 * Verify webhook signature. Returns true on match.
 * The body MUST be the raw request body (string), not parsed JSON.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
        logger.warn('RAZORPAY_WEBHOOK_SECRET not configured — rejecting webhook');
        return false;
    }
    if (!signature) return false;
    try {
        return Razorpay.validateWebhookSignature(rawBody, signature, secret);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'unknown';
        logger.warn('Razorpay webhook signature verification threw', { error: message });
        return false;
    }
}

export function isConfigured(): boolean {
    return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}
