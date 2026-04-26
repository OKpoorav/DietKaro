import { Router, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validation.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import { subscriptionPlanService } from '../services/subscriptionPlan.service';
import {
    createSubscriptionPlanSchema,
    updateSubscriptionPlanSchema,
} from '../schemas/subscriptionPlan.schema';

const router = Router();
router.use(requireAuth);

// List plans — any authed user (dietitians need to read when assigning).
router.get(
    '/',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const includeInactive =
            req.query.includeInactive === 'true' && (req.user.role === 'admin' || req.user.role === 'owner');
        const plans = await subscriptionPlanService.list(req.user.organizationId, includeInactive);
        res.status(200).json({ success: true, data: plans });
    }),
);

// Admin / owner only — write paths
router.post(
    '/',
    writeOperationLimiter,
    requireRole('admin', 'owner'),
    validateBody(createSubscriptionPlanSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const plan = await subscriptionPlanService.create(req.user.organizationId, req.user.id, req.body);
        res.status(201).json({ success: true, data: plan });
    }),
);

router.patch(
    '/:id',
    writeOperationLimiter,
    requireRole('admin', 'owner'),
    validateBody(updateSubscriptionPlanSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const plan = await subscriptionPlanService.update(
            req.params.id,
            req.user.organizationId,
            req.body,
        );
        res.status(200).json({ success: true, data: plan });
    }),
);

router.delete(
    '/:id',
    writeOperationLimiter,
    requireRole('admin', 'owner'),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        await subscriptionPlanService.softDelete(req.params.id, req.user.organizationId);
        res.status(204).send();
    }),
);

export default router;
