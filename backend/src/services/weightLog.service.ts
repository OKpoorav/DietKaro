import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';
import { buildPaginationParams, buildPaginationMeta, buildDateFilter } from '../utils/queryFilters';
import { CreateWeightLogInput } from '../schemas/weightLog.schema';

export class WeightLogService {
    async createWeightLog(data: CreateWeightLogInput, clientId: string, orgId: string) {
        const client = await prisma.client.findFirst({ where: { id: clientId, orgId } });
        if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

        let bmi: number | null = null;
        if (client.heightCm) {
            const heightM = Number(client.heightCm) / 100;
            bmi = Math.round((data.weightKg / (heightM * heightM)) * 10) / 10;
        }

        const previousLog = await prisma.weightLog.findFirst({
            where: { clientId },
            orderBy: { logDate: 'desc' },
        });

        let weightChange: number | null = null;
        if (previousLog) {
            weightChange = Math.round((data.weightKg - Number(previousLog.weightKg)) * 100) / 100;
        }

        const isOutlier = weightChange !== null && Math.abs(weightChange) > 3;

        const weightLog = await prisma.weightLog.create({
            data: {
                orgId,
                clientId,
                logDate: new Date(data.logDate),
                logTime: data.logTime,
                weightKg: data.weightKg,
                bmi,
                weightChangeFromPrevious: weightChange,
                notes: data.notes,
                progressPhotoUrl: data.progressPhotoUrl,
                isOutlier,
            },
        });

        await prisma.client.update({
            where: { id: clientId },
            data: { currentWeightKg: data.weightKg },
        });

        logger.info('Weight log created', { weightLogId: weightLog.id, clientId, weightKg: data.weightKg });

        return {
            id: weightLog.id,
            clientId: weightLog.clientId,
            logDate: weightLog.logDate,
            logTime: weightLog.logTime,
            weightKg: Number(weightLog.weightKg),
            bmi: weightLog.bmi ? Number(weightLog.bmi) : null,
            weightChange: weightLog.weightChangeFromPrevious ? Number(weightLog.weightChangeFromPrevious) : null,
            notes: weightLog.notes,
            isOutlier: weightLog.isOutlier,
            createdAt: weightLog.createdAt,
        };
    }

    async listWeightLogs(clientId: string, orgId: string, query: any) {
        const client = await prisma.client.findFirst({ where: { id: clientId, orgId } });
        if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

        const pagination = buildPaginationParams(query.page, query.pageSize || '100');
        const dateFilter = buildDateFilter(query.dateFrom, query.dateTo);

        const where: any = { clientId, orgId };
        if (dateFilter) where.logDate = dateFilter;

        const [weightLogs, total] = await prisma.$transaction([
            prisma.weightLog.findMany({
                where,
                skip: pagination.skip,
                take: pagination.take,
                orderBy: { [String(query.sortBy || 'logDate')]: 'asc' },
            }),
            prisma.weightLog.count({ where }),
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

        return {
            data: weightLogs.map((log) => ({
                id: log.id,
                logDate: log.logDate,
                logTime: log.logTime,
                weightKg: Number(log.weightKg),
                bmi: log.bmi ? Number(log.bmi) : null,
                weightChange: log.weightChangeFromPrevious ? Number(log.weightChangeFromPrevious) : null,
                notes: log.notes,
                progressPhotoUrl: log.progressPhotoUrl,
                isOutlier: log.isOutlier,
            })),
            meta: {
                ...buildPaginationMeta(total, pagination),
                totalStartWeight,
                totalEndWeight,
                totalWeightLoss,
                averageWeightLossPerWeek,
            },
        };
    }

    async uploadProgressPhoto(weightLogId: string, fileBuffer: Buffer, fileSize: number, orgId: string) {
        const weightLog = await prisma.weightLog.findFirst({ where: { id: weightLogId, orgId } });
        if (!weightLog) throw AppError.notFound('Weight log not found', 'WEIGHT_LOG_NOT_FOUND');

        const { StorageService } = await import('./storage.service');

        const { fullUrl, thumbUrl } = await StorageService.uploadWeightPhoto(fileBuffer, orgId, weightLogId);

        const updated = await prisma.weightLog.update({
            where: { id: weightLogId },
            data: { progressPhotoUrl: fullUrl },
        });

        logger.info('Progress photo uploaded', { weightLogId, fullUrl, thumbUrl, originalSize: fileSize });

        return {
            id: updated.id,
            progressPhotoUrl: updated.progressPhotoUrl,
            progressPhotoThumbUrl: thumbUrl,
        };
    }
}

export const weightLogService = new WeightLogService();
