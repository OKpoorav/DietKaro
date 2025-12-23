import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { CreateWeightLogInput } from '../schemas/weightLog.schema';

export const createWeightLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.params;
    const data: CreateWeightLogInput = req.body;

    const client = await prisma.client.findFirst({
        where: { id: clientId, orgId: req.user.organizationId }
    });

    if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

    let bmi: number | null = null;
    if (client.heightCm) {
        const heightM = Number(client.heightCm) / 100;
        bmi = Math.round((data.weightKg / (heightM * heightM)) * 10) / 10;
    }

    const previousLog = await prisma.weightLog.findFirst({
        where: { clientId },
        orderBy: { logDate: 'desc' }
    });

    let weightChange: number | null = null;
    if (previousLog) {
        weightChange = Math.round((data.weightKg - Number(previousLog.weightKg)) * 100) / 100;
    }

    const isOutlier = weightChange !== null && Math.abs(weightChange) > 3;

    const weightLog = await prisma.weightLog.create({
        data: {
            orgId: req.user.organizationId,
            clientId,
            logDate: new Date(data.logDate),
            logTime: data.logTime,
            weightKg: data.weightKg,
            bmi,
            weightChangeFromPrevious: weightChange,
            notes: data.notes,
            progressPhotoUrl: data.progressPhotoUrl,
            isOutlier
        }
    });

    await prisma.client.update({
        where: { id: clientId },
        data: { currentWeightKg: data.weightKg }
    });

    logger.info('Weight log created', { weightLogId: weightLog.id, clientId, weightKg: data.weightKg });

    res.status(201).json({
        success: true,
        data: {
            id: weightLog.id,
            clientId: weightLog.clientId,
            logDate: weightLog.logDate,
            logTime: weightLog.logTime,
            weightKg: Number(weightLog.weightKg),
            bmi: weightLog.bmi ? Number(weightLog.bmi) : null,
            weightChange: weightLog.weightChangeFromPrevious ? Number(weightLog.weightChangeFromPrevious) : null,
            notes: weightLog.notes,
            isOutlier: weightLog.isOutlier,
            createdAt: weightLog.createdAt
        }
    });
});

export const listWeightLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.params;
    const { dateFrom, dateTo, page = '1', pageSize = '100', sortBy = 'logDate' } = req.query;

    const client = await prisma.client.findFirst({
        where: { id: clientId, orgId: req.user.organizationId }
    });

    if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const where: any = { clientId, orgId: req.user.organizationId };
    if (dateFrom || dateTo) {
        where.logDate = {};
        if (dateFrom) where.logDate.gte = new Date(String(dateFrom));
        if (dateTo) where.logDate.lte = new Date(String(dateTo));
    }

    const [weightLogs, total] = await prisma.$transaction([
        prisma.weightLog.findMany({ where, skip, take, orderBy: { [String(sortBy)]: 'asc' } }),
        prisma.weightLog.count({ where })
    ]);

    let totalStartWeight: number | null = null;
    let totalEndWeight: number | null = null;
    let totalWeightLoss: number | null = null;
    let averageWeightLossPerWeek: number | null = null;

    if (weightLogs.length > 0) {
        totalStartWeight = Number(weightLogs[0].weightKg);
        totalEndWeight = Number(weightLogs[weightLogs.length - 1].weightKg);
        totalWeightLoss = Math.round((totalStartWeight - totalEndWeight) * 100) / 100;

        const firstDate = new Date(weightLogs[0].logDate);
        const lastDate = new Date(weightLogs[weightLogs.length - 1].logDate);
        const weeksDiff = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
        averageWeightLossPerWeek = Math.round((totalWeightLoss / weeksDiff) * 100) / 100;
    }

    res.status(200).json({
        success: true,
        data: weightLogs.map(log => ({
            id: log.id, logDate: log.logDate, logTime: log.logTime,
            weightKg: Number(log.weightKg), bmi: log.bmi ? Number(log.bmi) : null,
            weightChange: log.weightChangeFromPrevious ? Number(log.weightChangeFromPrevious) : null,
            notes: log.notes, progressPhotoUrl: log.progressPhotoUrl, isOutlier: log.isOutlier
        })),
        meta: { page: Number(page), pageSize: Number(pageSize), total, totalStartWeight, totalEndWeight, totalWeightLoss, averageWeightLossPerWeek }
    });
});

export const listAllWeightLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response, next) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.query;

    if (!clientId) {
        throw AppError.badRequest('clientId query parameter is required', 'MISSING_CLIENT_ID');
    }

    req.params.clientId = String(clientId);
    await listWeightLogs(req, res, next);
});

export const createWeightLogGeneral = asyncHandler(async (req: AuthenticatedRequest, res: Response, next) => {
    const { clientId } = req.body;

    if (!clientId) {
        throw AppError.badRequest('clientId is required', 'MISSING_CLIENT_ID');
    }

    req.params.clientId = clientId;
    await createWeightLog(req, res, next);
});

/**
 * POST /api/v1/weight-logs/:id/photo
 * Upload progress photo for weight log with compression and thumbnail
 */
export const uploadProgressPhoto = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { id } = req.params;

    // Check if file was uploaded
    if (!req.file) {
        throw AppError.badRequest('No photo file provided', 'NO_FILE');
    }

    // Verify weight log exists and belongs to org
    const weightLog = await prisma.weightLog.findFirst({
        where: { id, orgId: req.user.organizationId }
    });

    if (!weightLog) throw AppError.notFound('Weight log not found', 'WEIGHT_LOG_NOT_FOUND');

    // Import storage service
    const { StorageService } = await import('../services/storage.service');

    // Process and upload image
    const { fullUrl, thumbUrl } = await StorageService.uploadWeightPhoto(
        req.file.buffer,
        req.user.organizationId,
        id
    );

    // Update weight log with photo URL
    const updated = await prisma.weightLog.update({
        where: { id },
        data: {
            progressPhotoUrl: fullUrl
        }
    });

    logger.info('Progress photo uploaded', {
        weightLogId: id,
        fullUrl,
        thumbUrl,
        originalSize: req.file.size
    });

    res.status(200).json({
        success: true,
        data: {
            id: updated.id,
            progressPhotoUrl: updated.progressPhotoUrl,
            progressPhotoThumbUrl: thumbUrl
        }
    });
});
