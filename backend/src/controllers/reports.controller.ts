import { Response } from 'express';
import prisma from '../utils/prisma';
import { ClientAuthRequest } from '../middleware/clientAuth.middleware';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { getPresignedPutUrl, deleteFromS3 } from '../services/storage.service';
import { enqueueDocumentProcessing } from '../jobs/queue';

/**
 * Get list of reports for the authenticated client
 */
export const listReports = asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const { reportType, limit = '20' } = req.query;

    const where: any = {
        clientId: req.client.id
    };

    if (reportType) {
        where.reportType = String(reportType);
    }

    const reports = await prisma.clientReport.findMany({
        where,
        orderBy: { uploadedAt: 'desc' },
        take: Number(limit)
    });

    res.status(200).json({
        success: true,
        data: reports
    });
});

/**
 * Get presigned URL for uploading a report
 */
export const getUploadUrl = asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const { fileName, fileType, reportType } = req.body;

    if (!fileName || !fileType) {
        throw AppError.badRequest('fileName and fileType are required');
    }

    // Validate file type
    const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/msword',  // .doc
        'text/csv',
        'application/csv',
        'image/jpeg',
        'image/png',
        'image/webp',
    ];
    if (!allowedTypes.includes(fileType)) {
        throw AppError.badRequest('Invalid file type. Allowed: PDF, DOCX, DOC, CSV, JPEG, PNG, WEBP');
    }

    // Generate unique key
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `reports/${req.client.orgId}/${req.client.id}/${timestamp}-${sanitizedFileName}`;

    const uploadUrl = await getPresignedPutUrl(key, fileType, 3600);

    res.status(200).json({
        success: true,
        data: {
            uploadUrl,
            key,
            fileName,
            fileType,
            reportType
        }
    });
});

/**
 * Confirm upload and save report metadata
 */
export const createReport = asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const { key, fileName, fileType, reportType, notes } = req.body;

    if (!key || !fileName || !fileType) {
        throw AppError.badRequest('key, fileName, and fileType are required');
    }

    // Validate that the key belongs to this client's org and ID
    const expectedPrefix = `reports/${req.client.orgId}/${req.client.id}/`;
    if (!key.startsWith(expectedPrefix)) {
        return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid file key' } });
    }

    // Store the key as fileUrl (presigned read URLs are generated on demand)
    const fileUrl = key;

    // Derive a human-friendly fileType label
    const fileTypeLabel = fileType.startsWith('image/') ? 'image'
        : fileType === 'application/pdf' ? 'pdf'
        : fileType.includes('word') ? 'docx'
        : fileType.includes('csv') ? 'csv'
        : 'other';

    // Create report record — store s3Key and mimeType for the processing worker
    const report = await prisma.clientReport.create({
        data: {
            orgId: req.client.orgId,
            clientId: req.client.id,
            fileName,
            fileUrl,
            fileType: fileTypeLabel,
            mimeType: fileType,
            s3Key: key,
            reportType: reportType || 'other',
            notes,
        },
    });

    logger.info('Client report uploaded', {
        clientId: req.client.id,
        reportId: report.id,
        reportType,
        mimeType: fileType,
    });

    // Enqueue background processing (non-blocking — fire and forget)
    enqueueDocumentProcessing(report.id).catch((err) =>
        logger.error('Failed to enqueue document processing', { reportId: report.id, error: err.message }),
    );

    res.status(201).json({
        success: true,
        data: report,
    });
});

/**
 * Delete a report
 */
export const deleteReport = asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const { id } = req.params;

    const report = await prisma.clientReport.findFirst({
        where: { id, clientId: req.client.id }
    });

    if (!report) {
        throw AppError.notFound('Report not found');
    }

    // Use stored s3Key for deletion (fall back to fileUrl which is also the key for new records)
    const key = report.s3Key || report.fileUrl;
    if (key) {
        try {
            await deleteFromS3(key);
        } catch (error) {
            logger.warn('Failed to delete storage object', { key, error });
        }
    }

    // Delete database record
    await prisma.clientReport.delete({
        where: { id }
    });

    logger.info('Client report deleted', { clientId: req.client.id, reportId: id });

    res.status(204).send();
});
