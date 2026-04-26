import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validation.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import { subscriptionService } from '../services/subscription.service';

const router = Router({ mergeParams: true });
router.use(requireAuth);

const assignSchema = z.object({
    planId: z.string().uuid('planId must be a UUID'),
});

const pauseSchema = z.object({
    until: z.string().datetime().optional(),
});

const markActiveSchema = z.object({
    note: z.string().max(500).optional(),
});

router.get(
    '/',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const subscription = await subscriptionService.getForClient(
            req.params.clientId,
            req.user.organizationId,
        );
        res.status(200).json({ success: true, data: subscription });
    }),
);

router.post(
    '/',
    writeOperationLimiter,
    validateBody(assignSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const subscription = await subscriptionService.assignPlan(
            req.params.clientId,
            req.body.planId,
            req.user.organizationId,
            { role: req.user.role, id: req.user.id },
        );
        res.status(200).json({ success: true, data: subscription });
    }),
);

router.post(
    '/pause',
    writeOperationLimiter,
    validateBody(pauseSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const until = req.body.until ? new Date(req.body.until) : undefined;
        const subscription = await subscriptionService.pause(
            req.params.clientId,
            req.user.organizationId,
            { role: req.user.role, id: req.user.id },
            until,
        );
        res.status(200).json({ success: true, data: subscription });
    }),
);

router.post(
    '/resume',
    writeOperationLimiter,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const subscription = await subscriptionService.resume(
            req.params.clientId,
            req.user.organizationId,
            { role: req.user.role, id: req.user.id },
        );
        res.status(200).json({ success: true, data: subscription });
    }),
);

router.post(
    '/deactivate',
    writeOperationLimiter,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const subscription = await subscriptionService.deactivate(
            req.params.clientId,
            req.user.organizationId,
            { role: req.user.role, id: req.user.id },
        );
        res.status(200).json({ success: true, data: subscription });
    }),
);

router.post(
    '/mark-active',
    writeOperationLimiter,
    validateBody(markActiveSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const subscription = await subscriptionService.markActive(
            req.params.clientId,
            req.user.organizationId,
            { role: req.user.role, id: req.user.id },
            req.body.note,
        );
        res.status(200).json({ success: true, data: subscription });
    }),
);

export default router;
