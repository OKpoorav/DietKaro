import { Router, Response } from 'express';
import { createClient, getClient, listClients, updateClient, deleteClient, getClientProgress } from '../controllers/client.controller';
import { createWeightLog, listWeightLogs } from '../controllers/weightLog.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { requireActiveSubscription, requireClientCapacity } from '../middleware/subscription.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validation.middleware';
import { createClientSchema, updateClientSchema } from '../schemas/client.schema';
import { createWeightLogSchema } from '../schemas/weightLog.schema';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import { clientService } from '../services/client.service';
import { labService } from '../services/lab.service';
import prisma from '../utils/prisma';
import { signDownloadToken } from './media.routes';
import { uploadSingleDietitianReport, validateFileContent, REPORT_MIMES } from '../middleware/upload.middleware';
import { uploadToS3, deleteFromS3 } from '../services/storage.service';
import { enqueueDocumentProcessing } from '../jobs/queue';
import logger from '../utils/logger';

const router = Router();

// All client routes require authentication + active subscription
router.use(requireAuth);
router.use(requireActiveSubscription);

router.post('/', writeOperationLimiter, requireClientCapacity, validateBody(createClientSchema), createClient);
router.get('/', listClients);
router.get('/:id', getClient);
router.patch('/:id', writeOperationLimiter, validateBody(updateClientSchema), updateClient);
router.delete('/:id', writeOperationLimiter, requireRole('admin', 'owner'), deleteClient);

// Client progress analytics
router.get('/:id/progress', getClientProgress);

// Client weight logs
router.post('/:clientId/weight-logs', writeOperationLimiter, validateBody(createWeightLogSchema), createWeightLog);
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

/**
 * Resolve the client and enforce dietitian ownership / org scope.
 * Returns the client row (id + primaryDietitianId) or throws.
 */
async function ensureDietitianOwnsClient(req: AuthenticatedRequest, clientId: string) {
    if (!req.user) throw AppError.unauthorized();

    const client = await prisma.client.findFirst({
        where: { id: clientId, orgId: req.user.organizationId, isActive: true },
        select: { id: true, primaryDietitianId: true },
    });
    if (!client) throw AppError.notFound('Client not found');

    if (req.user.role === 'dietitian' && client.primaryDietitianId !== req.user.id) {
        throw AppError.forbidden('You can only access your assigned clients');
    }
    return client;
}

router.get('/:clientId/reports', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await ensureDietitianOwnsClient(req, req.params.clientId);

    const reports = await prisma.clientReport.findMany({
        where: { clientId: req.params.clientId, orgId: req.user!.organizationId },
        orderBy: { uploadedAt: 'desc' },
        take: 20,
        include: {
            uploadedBy: { select: { id: true, fullName: true } },
        },
    });

    // Build media-proxy URLs instead of presigned S3 URLs.
    // Presigned URLs contain the internal Docker hostname (minio:9000) which is
    // unreachable from browsers and mobile devices. The /media route streams
    // the file through the backend, avoiding the internal hostname issue.
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const reportsWithUrls = reports.map((r) => {
        const key = r.s3Key || (r.fileUrl.includes('.amazonaws.com/') ? r.fileUrl.split('.amazonaws.com/')[1] : r.fileUrl);
        const token = key ? signDownloadToken(key, req.user!.organizationId) : '';
        const viewUrl = key ? `${baseUrl}/media/${key}?token=${token}` : r.fileUrl;
        return {
            id: r.id,
            fileName: r.fileName,
            fileType: r.fileType,
            reportType: r.reportType,
            notes: r.notes,
            uploadedAt: r.uploadedAt,
            uploaderRole: r.uploaderRole,
            uploadedByUserId: r.uploadedByUserId,
            uploadedByName: r.uploadedBy?.fullName ?? null,
            viewUrl,
        };
    });

    res.status(200).json({ success: true, data: reportsWithUrls });
}));

/**
 * Dietitian-side report upload — multipart, 10MB cap, PDF / JPG / PNG / WebP.
 * Reuses the existing client-app processing pipeline.
 */
router.post(
    '/:clientId/reports',
    writeOperationLimiter,
    uploadSingleDietitianReport,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        await ensureDietitianOwnsClient(req, req.params.clientId);
        if (!req.file) throw AppError.badRequest('No file provided');

        await validateFileContent(req.file.buffer, REPORT_MIMES);

        const reportType = (req.body.reportType as string) || 'other';
        const notes = req.body.notes as string | undefined;
        const originalName = req.file.originalname || 'file';
        const sanitizedFileName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const timestamp = Date.now();
        const key = `clients/${req.params.clientId}/reports/dietitian/${timestamp}-${sanitizedFileName}`;

        await uploadToS3(req.file.buffer, key, req.file.mimetype);

        const fileTypeLabel = req.file.mimetype.startsWith('image/')
            ? 'image'
            : req.file.mimetype === 'application/pdf'
            ? 'pdf'
            : 'other';

        const report = await prisma.clientReport.create({
            data: {
                orgId: req.user!.organizationId,
                clientId: req.params.clientId,
                fileName: originalName,
                fileUrl: key,
                fileType: fileTypeLabel,
                mimeType: req.file.mimetype,
                s3Key: key,
                reportType,
                notes,
                uploadedByUserId: req.user!.id,
                uploaderRole: req.user!.role === 'dietitian' ? 'dietitian' : 'admin',
            },
        });

        logger.info('Dietitian uploaded report for client', {
            clientId: req.params.clientId,
            reportId: report.id,
            uploadedByUserId: req.user!.id,
            mimeType: req.file.mimetype,
            size: req.file.size,
        });

        enqueueDocumentProcessing(report.id).catch((err) =>
            logger.error('Failed to enqueue document processing', { reportId: report.id, error: err.message }),
        );

        res.status(201).json({ success: true, data: report });
    }),
);

/**
 * Delete a report — only the user who uploaded it (dietitian/admin) may delete
 * their own dietitian-uploaded report. Client-uploaded reports are NOT deletable
 * from the dietitian side.
 */
router.delete(
    '/:clientId/reports/:reportId',
    writeOperationLimiter,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        await ensureDietitianOwnsClient(req, req.params.clientId);

        const report = await prisma.clientReport.findFirst({
            where: {
                id: req.params.reportId,
                clientId: req.params.clientId,
                orgId: req.user!.organizationId,
            },
        });
        if (!report) throw AppError.notFound('Report not found');

        if (report.uploaderRole === 'client') {
            throw AppError.forbidden('Client-uploaded reports cannot be deleted from this view');
        }

        const isOwner = report.uploadedByUserId === req.user!.id;
        const isAdmin = req.user!.role === 'admin' || req.user!.role === 'owner';
        if (!isOwner && !isAdmin) {
            throw AppError.forbidden('You can only delete reports you uploaded');
        }

        const key = report.s3Key || report.fileUrl;
        if (key) {
            try {
                await deleteFromS3(key);
            } catch (error) {
                logger.warn('Failed to delete storage object', { key, error });
            }
        }

        await prisma.clientReport.delete({ where: { id: report.id } });

        logger.info('Dietitian deleted report', {
            clientId: req.params.clientId,
            reportId: report.id,
            actorUserId: req.user!.id,
        });

        res.status(204).send();
    }),
);

export default router;
