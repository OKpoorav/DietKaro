import { Router, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import * as svc from '../services/leadSources.service';

const router = Router();
router.use(requireAuth, requireRole('owner', 'admin'));

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const sources = await svc.listSources(req.user.organizationId);
    res.json({ success: true, data: sources });
}));

router.post('/', writeOperationLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { name } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) throw AppError.badRequest('Name is required');
    const source = await svc.createSource(req.user.organizationId, name.trim());
    res.status(201).json({ success: true, data: source });
}));

router.patch('/:id', writeOperationLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { name, active } = req.body ?? {};
    const data: { name?: string; active?: boolean } = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (typeof active === 'boolean') data.active = active;
    const source = await svc.updateSource(req.params.id, req.user.organizationId, data);
    res.json({ success: true, data: source });
}));

router.delete('/:id', writeOperationLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await svc.deleteSource(req.params.id, req.user.organizationId);
    res.status(204).send();
}));

export default router;
