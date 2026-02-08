import { Router, Response } from 'express';
import { createClient, getClient, listClients, updateClient, deleteClient, getClientProgress } from '../controllers/client.controller';
import { createWeightLog, listWeightLogs } from '../controllers/weightLog.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import { clientService } from '../services/client.service';
import { labService } from '../services/lab.service';

const router = Router();

// All client routes require authentication
router.use(requireAuth);

router.post('/', createClient);
router.get('/', listClients);
router.get('/:id', getClient);
router.patch('/:id', updateClient);
router.delete('/:id', requireRole('admin', 'owner'), deleteClient);

// Client progress analytics
router.get('/:id/progress', getClientProgress);

// Client weight logs
router.post('/:clientId/weight-logs', createWeightLog);
router.get('/:clientId/weight-logs', listWeightLogs);

// ============ MEDICAL SUMMARY ============

router.get('/:clientId/medical-summary', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const summary = await clientService.getMedicalSummary(req.params.clientId, req.user.organizationId);
    res.status(200).json({ success: true, data: summary });
}));

// ============ LAB VALUES ============

router.get('/:clientId/lab-values', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await labService.getLabValues(req.params.clientId, req.user.organizationId);
    res.status(200).json({ success: true, data });
}));

router.put('/:clientId/lab-values', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { labValues, labDate } = req.body;

    if (!labValues || typeof labValues !== 'object') {
        throw AppError.badRequest('labValues must be an object with numeric values');
    }
    if (!labDate || isNaN(Date.parse(labDate))) {
        throw AppError.badRequest('labDate must be a valid date string');
    }

    const result = await labService.saveLabValues({
        clientId: req.params.clientId,
        orgId: req.user.organizationId,
        userId: req.user.id,
        labValues,
        labDate,
    });

    res.status(200).json({ success: true, data: result });
}));

export default router;
