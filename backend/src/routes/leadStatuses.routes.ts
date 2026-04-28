import { Router, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import * as svc from '../services/leadStatuses.service';

const router = Router();
router.use(requireAuth, requireRole('owner', 'admin'));

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const statuses = await svc.listStatuses(req.user.organizationId);
    res.json({ success: true, data: statuses });
}));

router.post('/', writeOperationLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { name, color, sortOrder } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) throw AppError.badRequest('Name is required');
    const status = await svc.createStatus(req.user.organizationId, { name: name.trim(), color, sortOrder });
    res.status(201).json({ success: true, data: status });
}));

router.patch('/:id', writeOperationLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { name, color, sortOrder } = req.body ?? {};
    const data: { name?: string; color?: string; sortOrder?: number } = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (typeof color === 'string') data.color = color;
    if (typeof sortOrder === 'number') data.sortOrder = sortOrder;
    const status = await svc.updateStatus(req.params.id, req.user.organizationId, data);
    res.json({ success: true, data: status });
}));

router.delete('/:id', writeOperationLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await svc.deleteStatus(req.params.id, req.user.organizationId);
    res.status(204).send();
}));

export default router;
