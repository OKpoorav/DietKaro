import { Response } from 'express';
import prisma from '../utils/prisma';
import { ClientAuthRequest } from '../middleware/clientAuth.middleware';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'dietconnect-uploads';

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
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(fileType)) {
        throw AppError.badRequest('Invalid file type. Allowed: PDF, JPEG, PNG, WEBP');
    }

    // Generate unique key for S3
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `reports/${req.client.orgId}/${req.client.id}/${timestamp}-${sanitizedFileName}`;

    // Generate presigned URL for upload
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

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

    // Construct the file URL
    const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;

    // Create report record
    const report = await prisma.clientReport.create({
        data: {
            orgId: req.client.orgId,
            clientId: req.client.id,
            fileName,
            fileUrl,
            fileType: fileType.startsWith('image/') ? 'image' : 'pdf',
            reportType: reportType || 'other',
            notes
        }
    });

    logger.info('Client report uploaded', {
        clientId: req.client.id,
        reportId: report.id,
        reportType
    });

    res.status(201).json({
        success: true,
        data: report
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

    // Extract key from URL for S3 deletion
    const urlParts = report.fileUrl.split('.amazonaws.com/');
    if (urlParts.length === 2) {
        const key = urlParts[1];
        try {
            await s3Client.send(new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key
            }));
        } catch (error) {
            logger.warn('Failed to delete S3 object', { key, error });
        }
    }

    // Delete database record
    await prisma.clientReport.delete({
        where: { id }
    });

    logger.info('Client report deleted', { clientId: req.client.id, reportId: id });

    res.status(204).send();
});
