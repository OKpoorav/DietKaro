import { Router, Response } from 'express';
import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';
import { requireAuth } from '../middleware/auth.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validation.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import { paymentService } from '../services/payment.service';

const router = Router({ mergeParams: true });
router.use(requireAuth);

const manualPaymentSchema = z.object({
    amountInr: z.number().positive(),
    method: z.enum([
        PaymentMethod.manual_cash,
        PaymentMethod.manual_upi,
        PaymentMethod.manual_bank,
        PaymentMethod.manual_other,
    ]),
    note: z.string().max(500).optional(),
});

const linkSchema = z.object({
    amountInr: z.number().positive().optional(),
    message: z.string().max(1000).optional(),
    channels: z
        .object({
            whatsapp: z.boolean().optional(),
            email: z.boolean().optional(),
        })
        .optional(),
    callbackUrl: z.string().url().optional(),
});

router.get(
    '/',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const payments = await paymentService.listForClient(
            req.params.clientId,
            req.user.organizationId,
        );
        res.status(200).json({ success: true, data: payments });
    }),
);

router.post(
    '/manual',
    writeOperationLimiter,
    validateBody(manualPaymentSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const payment = await paymentService.recordManualPayment(
            req.params.clientId,
            req.user.organizationId,
            { role: req.user.role, id: req.user.id },
            req.body,
        );
        res.status(201).json({ success: true, data: payment });
    }),
);

router.post(
    '/link',
    writeOperationLimiter,
    validateBody(linkSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const result = await paymentService.createPaymentLink(
            req.params.clientId,
            req.user.organizationId,
            { role: req.user.role, id: req.user.id },
            req.body,
        );
        res.status(201).json({ success: true, data: result });
    }),
);

export default router;
