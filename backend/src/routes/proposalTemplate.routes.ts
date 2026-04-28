import { Router, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import * as svc from '../services/proposalTemplate.service';

const router = Router();
router.use(requireAuth, requireRole('owner', 'admin'));

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const template = await svc.getTemplate(req.user.organizationId);
    res.json({ success: true, data: template });
}));

router.put('/', writeOperationLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { headerCopy, logoUrl, footerNote, signatureLine, customFields } = req.body ?? {};
    const template = await svc.upsertTemplate(req.user.organizationId, {
        headerCopy, logoUrl, footerNote, signatureLine,
        customFields: Array.isArray(customFields) ? customFields : undefined,
    });
    res.json({ success: true, data: template });
}));

export default router;
