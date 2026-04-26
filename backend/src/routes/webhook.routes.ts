import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { verifyWebhookSignature } from '../services/razorpay.service';
import { paymentService } from '../services/payment.service';

const router = Router();

interface RazorpayPaymentLinkEntity {
    id: string;
    status: string;
    amount?: number; // paise
    amount_paid?: number;
}

interface RazorpayPaymentEntity {
    id: string;
    amount?: number;
    status?: string;
}

interface RazorpayWebhookPayload {
    event: string;
    payload?: {
        payment_link?: { entity?: RazorpayPaymentLinkEntity };
        payment?: { entity?: RazorpayPaymentEntity };
    };
}

/**
 * Razorpay webhook endpoint.
 *
 * Always returns 200 unless the signature is invalid (401). Razorpay retries
 * non-2xx responses; our handlers are idempotent so redelivery is safe.
 */
router.post(
    '/razorpay',
    asyncHandler(async (req: Request, res: Response) => {
        const signature = req.header('x-razorpay-signature');
        const rawBody = req.rawBody;

        if (!rawBody) {
            logger.warn('Razorpay webhook: missing raw body');
            return res.status(400).json({ success: false, error: 'Missing body' });
        }
        if (!verifyWebhookSignature(rawBody, signature)) {
            logger.warn('Razorpay webhook: signature verification failed');
            return res.status(401).json({ success: false, error: 'Invalid signature' });
        }

        const payload = req.body as RazorpayWebhookPayload;
        const event = payload?.event;
        const linkEntity = payload?.payload?.payment_link?.entity;
        const paymentEntity = payload?.payload?.payment?.entity;

        try {
            switch (event) {
                case 'payment_link.paid':
                case 'payment_link.partially_paid': {
                    if (!linkEntity?.id) break;
                    await paymentService.applyWebhookPaid({
                        razorpayLinkId: linkEntity.id,
                        razorpayPaymentId: paymentEntity?.id,
                        amountInrPaise: linkEntity.amount_paid ?? paymentEntity?.amount,
                        rawPayload: payload,
                    });
                    break;
                }
                case 'payment_link.expired':
                case 'payment_link.cancelled': {
                    if (!linkEntity?.id) break;
                    await paymentService.applyWebhookExpired({
                        razorpayLinkId: linkEntity.id,
                        rawPayload: payload,
                    });
                    break;
                }
                default:
                    logger.info('Razorpay webhook: unhandled event', { event });
            }
        } catch (err: unknown) {
            // Log but still return 200 — bug-fixing later via reconciliation.
            const message = err instanceof Error ? err.message : 'unknown';
            logger.error('Razorpay webhook handler error', { event, error: message });
        }

        return res.status(200).json({ success: true });
    }),
);

export default router;
