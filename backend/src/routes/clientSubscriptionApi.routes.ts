import { Router, Response } from 'express';
import { z } from 'zod';
import { ClientAuthRequest, requireClientAuth } from '../middleware/clientAuth.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validation.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import { subscriptionService, getGraceDays } from '../services/subscription.service';
import { paymentService } from '../services/payment.service';
import prisma from '../utils/prisma';

const router = Router();
router.use(requireClientAuth);

const linkSchema = z.object({
    callbackUrl: z.string().url().optional(),
});

/**
 * Client app — view own subscription state.
 */
router.get(
    '/',
    asyncHandler(async (req: ClientAuthRequest, res: Response) => {
        if (!req.client) throw AppError.unauthorized();
        const sub = await subscriptionService.getForClient(req.client.id, req.client.orgId);
        if (!sub) {
            res.status(200).json({ success: true, data: null });
            return;
        }

        // Day-count math for UI prompts. Negative daysUntilRenewal = overdue.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const renewal = new Date(sub.renewalDate);
        renewal.setHours(0, 0, 0, 0);
        const daysUntilRenewal = Math.round((renewal.getTime() - today.getTime()) / 86_400_000);
        const graceDays = getGraceDays();
        const inGrace =
            sub.status === 'active' &&
            sub.paymentStatus === 'unpaid' &&
            daysUntilRenewal < 0 &&
            -daysUntilRenewal <= graceDays;
        const graceDaysRemaining = inGrace ? graceDays + daysUntilRenewal : 0;

        res.status(200).json({
            success: true,
            data: {
                id: sub.id,
                status: sub.status,
                paymentStatus: sub.paymentStatus,
                activeDate: sub.activeDate,
                renewalDate: sub.renewalDate,
                pausedUntil: sub.pausedUntil,
                lastPaidAt: sub.lastPaidAt,
                daysUntilRenewal,
                inGrace,
                graceDaysRemaining,
                plan: {
                    id: sub.plan.id,
                    name: sub.plan.name,
                    recurrenceUnit: sub.plan.recurrenceUnit,
                    intervalCount: sub.plan.intervalCount,
                    durationDays: sub.plan.durationDays,
                    costInr: sub.plan.costInr,
                },
            },
        });
    }),
);

/**
 * Client app — request a payment link for own renewal.
 * Always uses the assigned plan's cost. Channels stay off (this returns the link
 * for the app to open; admin-side push to WhatsApp/email is not needed here).
 */
router.post(
    '/link',
    writeOperationLimiter,
    validateBody(linkSchema),
    asyncHandler(async (req: ClientAuthRequest, res: Response) => {
        if (!req.client) throw AppError.unauthorized();
        const result = await paymentService.createPaymentLink(
            req.client.id,
            req.client.orgId,
            { role: 'client_self', id: req.client.id },
            {
                callbackUrl: req.body.callbackUrl,
                channels: { whatsapp: false, email: false },
            },
        );
        res.status(201).json({
            success: true,
            data: { shortUrl: result.shortUrl, paymentId: result.paymentId },
        });
    }),
);

/**
 * Client app — view own payment history.
 */
router.get(
    '/payments',
    asyncHandler(async (req: ClientAuthRequest, res: Response) => {
        if (!req.client) throw AppError.unauthorized();
        const payments = await prisma.payment.findMany({
            where: { clientId: req.client.id, orgId: req.client.orgId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                amountInr: true,
                status: true,
                method: true,
                paidAt: true,
                createdAt: true,
            },
        });
        res.status(200).json({ success: true, data: payments });
    }),
);

export default router;
