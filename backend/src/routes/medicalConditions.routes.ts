import { Router, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import * as svc from '../services/medicalConditions.service';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const search = typeof req.query.q === 'string' ? req.query.q : undefined;
    const conditions = await svc.listConditions(req.user.organizationId, search);
    res.json({ success: true, data: conditions });
}));

router.post('/', requireRole('owner', 'admin'), writeOperationLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { name } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) throw AppError.badRequest('Name is required');
    const condition = await svc.createCondition(req.user.organizationId, name.trim());
    res.status(201).json({ success: true, data: condition });
}));

router.patch('/:id', requireRole('owner', 'admin'), writeOperationLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { name, active } = req.body ?? {};
    const data: { name?: string; active?: boolean } = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (typeof active === 'boolean') data.active = active;
    const condition = await svc.updateCondition(req.params.id, req.user.organizationId, data);
    res.json({ success: true, data: condition });
}));

router.delete('/:id', requireRole('owner', 'admin'), writeOperationLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await svc.deleteCondition(req.params.id, req.user.organizationId);
    res.status(204).send();
}));

export default router;
