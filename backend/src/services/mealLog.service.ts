import prisma from '../utils/prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';
import { buildPaginationParams, buildPaginationMeta, buildDateFilter } from '../utils/queryFilters';
import { scaleNutrition, sumNutrition } from '../utils/nutritionCalculator';
import { complianceService } from './compliance.service';
import type { CreateMealLogInput, UpdateMealLogInput, ReviewMealLogInput, MealLogListQuery } from '../schemas/mealLog.schema';

export class MealLogService {
    async createMealLog(data: CreateMealLogInput, orgId: string) {
        const client = await prisma.client.findFirst({ where: { id: data.clientId, orgId } });
        if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

        const meal = await prisma.meal.findFirst({
            where: { id: data.mealId },
            include: { dietPlan: true },
        });

        if (!meal || meal.dietPlan.orgId !== orgId || !meal.dietPlan.isActive) {
            throw AppError.notFound('Meal not found', 'MEAL_NOT_FOUND');
        }

        const mealLog = await prisma.mealLog.create({
            data: {
                orgId,
                clientId: data.clientId,
                mealId: data.mealId,
                scheduledDate: new Date(data.scheduledDate),
                scheduledTime: data.scheduledTime,
                status: 'pending',
            },
            include: {
                meal: { select: { name: true, mealType: true } },
                client: { select: { id: true, fullName: true } },
            },
        });

        logger.info('Meal log created', { mealLogId: mealLog.id });
        return mealLog;
    }

    async listMealLogs(orgId: string, query: MealLogListQuery, userRole: string, userId: string) {
        const { clientId, status, reviewStatus, sortBy = 'scheduledDate' } = query;
        const pagination = buildPaginationParams(query.page, query.pageSize);
        const dateFilter = buildDateFilter(query.dateFrom, query.dateTo);

        const where: Prisma.MealLogWhereInput = { orgId };
        if (clientId) where.clientId = clientId;

        // reviewStatus takes precedence: filters by dietitian review state
        if (reviewStatus === 'pending') {
            // Client acted on it, dietitian hasn't reviewed
            where.status = { in: ['eaten', 'skipped', 'substituted'] };
            where.reviewedByUserId = null;
        } else if (reviewStatus === 'reviewed') {
            where.reviewedByUserId = { not: null };
        } else if (status) {
            where.status = status;
        }

        if (dateFilter) where.scheduledDate = dateFilter;
        if (userRole === 'dietitian') where.client = { primaryDietitianId: userId };

        const [mealLogs, total] = await prisma.$transaction([
            prisma.mealLog.findMany({
                where,
                skip: pagination.skip,
                take: pagination.take,
                orderBy: { [String(sortBy)]: 'desc' },
                include: {
                    meal: { select: { name: true, mealType: true, timeOfDay: true } },
                    client: { select: { id: true, fullName: true } },
                    reviewer: { select: { id: true, fullName: true } },
                },
            }),
            prisma.mealLog.count({ where }),
        ]);

        const data = mealLogs.map((log) => ({
            id: log.id,
            mealId: log.mealId,
            scheduledDate: log.scheduledDate,
            scheduledTime: log.scheduledTime,
            meal: { name: log.meal.name, mealType: log.meal.mealType },
            client: log.client,
            status: log.status,
            mealPhotoUrl: log.mealPhotoUrl,
            mealPhotoSmallUrl: log.mealPhotoSmallUrl,
            clientNotes: log.clientNotes,
            dietitianFeedback: log.dietitianFeedback,
            reviewedByUser: log.reviewer,
            dietitianReviewedAt: log.dietitianFeedbackAt,
            loggedAt: log.loggedAt,
            createdAt: log.createdAt,
            complianceScore: log.complianceScore,
            complianceColor: log.complianceColor,
            complianceIssues: log.complianceIssues,
        }));

        return { data, meta: buildPaginationMeta(total, pagination) };
    }

    async getMealLog(mealLogId: string, orgId: string) {
        const mealLog = await prisma.mealLog.findFirst({
            where: { id: mealLogId, orgId },
            include: {
                meal: { include: { foodItems: { include: { foodItem: true } } } },
                client: { select: { id: true, fullName: true } },
                reviewer: { select: { id: true, fullName: true } },
            },
        });

        if (!mealLog) throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');

        // Group food items by optionGroup
        const optionGroupsMap = new Map<number, typeof mealLog.meal.foodItems>();
        mealLog.meal.foodItems.forEach((mfi) => {
            const group = mfi.optionGroup;
            if (!optionGroupsMap.has(group)) optionGroupsMap.set(group, []);
            optionGroupsMap.get(group)!.push(mfi);
        });

        const hasAlternatives = optionGroupsMap.size > 1;

        const options = Array.from(optionGroupsMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([group, groupItems]) => {
                const items = groupItems.map((mfi) => {
                    const nutrition = scaleNutrition(mfi.foodItem, Number(mfi.quantityG));
                    return {
                        foodId: mfi.foodItem.id,
                        foodName: mfi.foodItem.name,
                        quantity: Number(mfi.quantityG),
                        unit: 'g',
                        nutrition,
                    };
                });
                const totals = sumNutrition(items.map((i) => i.nutrition));
                return {
                    optionGroup: group,
                    label: groupItems[0]?.optionLabel || (group === 0 ? 'Default' : `Option ${group + 1}`),
                    items,
                    totals,
                };
            });

        // Flat items list (all options combined) for backward compatibility
        const allItems = mealLog.meal.foodItems.map((mfi) => {
            const nutrition = scaleNutrition(mfi.foodItem, Number(mfi.quantityG));
            return {
                foodId: mfi.foodItem.id,
                foodName: mfi.foodItem.name,
                quantity: Number(mfi.quantityG),
                unit: 'g',
                nutrition,
            };
        });
        const totals = sumNutrition(allItems.map((i) => i.nutrition));

        return {
            id: mealLog.id,
            organizationId: mealLog.orgId,
            client: mealLog.client,
            mealId: mealLog.mealId,
            scheduledDate: mealLog.scheduledDate,
            scheduledTime: mealLog.scheduledTime,
            meal: {
                title: mealLog.meal.name,
                mealType: mealLog.meal.mealType,
                instructions: mealLog.meal.instructions,
                items: allItems,
                totals,
                hasAlternatives,
                options,
            },
            status: mealLog.status,
            chosenOptionGroup: mealLog.chosenOptionGroup,
            photoUrl: mealLog.mealPhotoUrl,
            clientNotes: mealLog.clientNotes,
            dietitianFeedback: mealLog.dietitianFeedback,
            reviewedByUser: mealLog.reviewer,
            dietitianReviewedAt: mealLog.dietitianFeedbackAt,
            loggedAt: mealLog.loggedAt,
            createdAt: mealLog.createdAt,
            updatedAt: mealLog.updatedAt,
            complianceScore: mealLog.complianceScore,
            complianceColor: mealLog.complianceColor,
            complianceIssues: mealLog.complianceIssues,
        };
    }

    async updateMealLog(mealLogId: string, data: UpdateMealLogInput, orgId: string) {
        const mealLog = await prisma.mealLog.findFirst({
            where: { id: mealLogId, orgId },
        });

        if (!mealLog) throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');

        const updateData: Record<string, unknown> = {};
        if (data.status) updateData.status = data.status;
        if (data.clientNotes !== undefined) updateData.clientNotes = data.clientNotes;
        if (data.substituteDescription !== undefined) updateData.substituteDescription = data.substituteDescription;
        if (data.substituteCaloriesEst !== undefined) updateData.substituteCaloriesEst = data.substituteCaloriesEst;
        if (data.chosenOptionGroup !== undefined) updateData.chosenOptionGroup = data.chosenOptionGroup;
        if (data.photoUrl) {
            updateData.mealPhotoUrl = data.photoUrl;
            updateData.photoUploadedAt = new Date();
        }
        if (data.status && data.status !== 'pending') updateData.loggedAt = new Date();

        const updated = await prisma.mealLog.update({ where: { id: mealLogId }, data: updateData });

        // Use the returned ComplianceResult directly — no re-fetch needed
        let complianceScore: number | null = updated.complianceScore;
        let complianceColor: string | null = updated.complianceColor;

        if (data.status && data.status !== 'pending' && data.status !== mealLog.status) {
            const result = await complianceService.calculateMealCompliance(updated.id);
            complianceScore = result.score;
            complianceColor = result.color;
        }

        logger.info('Meal log updated', { mealLogId: updated.id });

        return {
            id: updated.id,
            status: updated.status,
            photoUrl: updated.mealPhotoUrl,
            clientNotes: updated.clientNotes,
            loggedAt: updated.loggedAt,
            complianceScore,
            complianceColor,
        };
    }

    async reviewMealLog(mealLogId: string, data: ReviewMealLogInput, orgId: string, userId: string) {
        const mealLog = await prisma.mealLog.findFirst({ where: { id: mealLogId, orgId } });
        if (!mealLog) throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');

        const updateData: Record<string, unknown> = { reviewedByUserId: userId, dietitianFeedbackAt: new Date() };
        if (data.dietitianFeedback !== undefined) updateData.dietitianFeedback = data.dietitianFeedback;
        if (data.status) updateData.status = data.status;
        if (data.overrideCalories !== undefined) updateData.substituteCaloriesEst = data.overrideCalories;

        const updated = await prisma.mealLog.update({
            where: { id: mealLogId },
            data: updateData,
            include: { reviewer: { select: { id: true, fullName: true } } },
        });

        // Use returned result directly instead of re-fetching
        const result = await complianceService.calculateMealCompliance(updated.id);

        logger.info('Meal log reviewed', { mealLogId: updated.id, reviewerId: userId });

        return {
            id: updated.id,
            status: updated.status,
            dietitianFeedback: updated.dietitianFeedback,
            reviewedByUser: updated.reviewer,
            dietitianReviewedAt: updated.dietitianFeedbackAt,
            complianceScore: result.score,
            complianceColor: result.color,
        };
    }

    async uploadMealPhoto(mealLogId: string, fileBuffer: Buffer, fileSize: number, orgId: string) {
        const mealLog = await prisma.mealLog.findFirst({ where: { id: mealLogId, orgId } });
        if (!mealLog) throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');

        const { StorageService } = await import('./storage.service');

        const { fullUrl, thumbUrl } = await StorageService.uploadMealPhoto(fileBuffer, orgId, mealLogId);

        const updated = await prisma.mealLog.update({
            where: { id: mealLogId },
            data: {
                mealPhotoUrl: fullUrl,
                mealPhotoSmallUrl: thumbUrl,
                photoUploadedAt: new Date(),
                ...(mealLog.status === 'pending' && { status: 'eaten', loggedAt: new Date() }),
            },
        });

        // Use returned result directly instead of re-fetching
        const result = await complianceService.calculateMealCompliance(updated.id);

        logger.info('Meal photo uploaded', { mealLogId, fullUrl, thumbUrl, originalSize: fileSize });

        return {
            id: updated.id,
            mealPhotoUrl: updated.mealPhotoUrl,
            mealPhotoSmallUrl: updated.mealPhotoSmallUrl,
            photoUploadedAt: updated.photoUploadedAt,
            status: updated.status,
            complianceScore: result.score,
            complianceColor: result.color,
        };
    }
}

export const mealLogService = new MealLogService();
