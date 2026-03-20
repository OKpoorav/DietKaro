import { Router, Response } from 'express';
import { createClient, getClient, listClients, updateClient, deleteClient, getClientProgress } from '../controllers/client.controller';
import { createWeightLog, listWeightLogs } from '../controllers/weightLog.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { requireActiveSubscription, requireClientCapacity } from '../middleware/subscription.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import { clientService } from '../services/client.service';
import { labService } from '../services/lab.service';
import prisma from '../utils/prisma';
import { getPresignedUrl } from '../services/storage.service';

const router = Router();

// All client routes require authentication + active subscription
router.use(requireAuth);
router.use(requireActiveSubscription);

router.post('/', writeOperationLimiter, requireClientCapacity, createClient);
router.get('/', listClients);
router.get('/:id', getClient);
router.patch('/:id', writeOperationLimiter, updateClient);
router.delete('/:id', writeOperationLimiter, requireRole('admin', 'owner'), deleteClient);

// Client progress analytics
router.get('/:id/progress', getClientProgress);

// Client weight logs
router.post('/:clientId/weight-logs', writeOperationLimiter, createWeightLog);
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

router.put('/:clientId/lab-values', writeOperationLimiter, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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

// ============ CLIENT REPORTS (for dietitian view) ============


router.get('/:clientId/reports', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
        where: { id: req.params.clientId, orgId: req.user.organizationId, isActive: true },
        select: { id: true, primaryDietitianId: true },
    });
    if (!client) throw AppError.notFound('Client not found');

    // Dietitian scope check
    if (req.user.role === 'dietitian' && client.primaryDietitianId !== req.user.id) {
        throw AppError.forbidden('You can only access your assigned clients');
    }

    const reports = await prisma.clientReport.findMany({
        where: { clientId: req.params.clientId, orgId: req.user.organizationId },
        orderBy: { uploadedAt: 'desc' },
        take: 20,
    });

    // Generate presigned read URLs using Minio storage service
    const reportsWithUrls = await Promise.all(
        reports.map(async (r) => {
            // s3Key is the canonical key; fileUrl may be a legacy AWS URL or also the key
            const key = r.s3Key || (r.fileUrl.includes('.amazonaws.com/') ? r.fileUrl.split('.amazonaws.com/')[1] : r.fileUrl);
            const viewUrl = key ? await getPresignedUrl(key, 3600) : r.fileUrl;
            return {
                id: r.id,
                fileName: r.fileName,
                fileType: r.fileType,
                reportType: r.reportType,
                notes: r.notes,
                uploadedAt: r.uploadedAt,
                viewUrl,
            };
        })
    );

    res.status(200).json({ success: true, data: reportsWithUrls });
}));

export default router;
