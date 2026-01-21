import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { CreateMealLogInput, UpdateMealLogInput, ReviewMealLogInput } from '../schemas/mealLog.schema';
import { complianceService } from '../services/compliance.service';

export const createMealLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const data: CreateMealLogInput = req.body;

    const client = await prisma.client.findFirst({
        where: { id: data.clientId, orgId: req.user.organizationId }
    });

    if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

    const meal = await prisma.meal.findUnique({
        where: { id: data.mealId },
        include: { dietPlan: true }
    });

    if (!meal || meal.dietPlan.orgId !== req.user.organizationId) {
        throw AppError.notFound('Meal not found', 'MEAL_NOT_FOUND');
    }

    const mealLog = await prisma.mealLog.create({
        data: {
            orgId: req.user.organizationId,
            clientId: data.clientId,
            mealId: data.mealId,
            scheduledDate: new Date(data.scheduledDate),
            scheduledTime: data.scheduledTime,
            status: 'pending'
        },
        include: {
            meal: { select: { name: true, mealType: true } },
            client: { select: { id: true, fullName: true } }
        }
    });

    logger.info('Meal log created', { mealLogId: mealLog.id });
    res.status(201).json({ success: true, data: mealLog });
});

export const listMealLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId, dateFrom, dateTo, status, page = '1', pageSize = '20', sortBy = 'scheduledDate' } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const where: any = { orgId: req.user.organizationId };
    if (clientId) where.clientId = String(clientId);
    if (status) where.status = String(status);

    if (dateFrom || dateTo) {
        where.scheduledDate = {};
        if (dateFrom) where.scheduledDate.gte = new Date(String(dateFrom));
        if (dateTo) where.scheduledDate.lte = new Date(String(dateTo));
    }

    if (req.user.role === 'dietitian') {
        where.client = { primaryDietitianId: req.user.id };
    }

    const [mealLogs, total] = await prisma.$transaction([
        prisma.mealLog.findMany({
            where, skip, take,
            orderBy: { [String(sortBy)]: 'desc' },
            include: {
                meal: { select: { name: true, mealType: true, timeOfDay: true } },
                client: { select: { id: true, fullName: true } },
                reviewer: { select: { id: true, fullName: true } }
            }
        }),
        prisma.mealLog.count({ where })
    ]);

    res.status(200).json({
        success: true,
        data: mealLogs.map(log => ({
            id: log.id,
            mealId: log.mealId,
            scheduledDate: log.scheduledDate,
            scheduledTime: log.scheduledTime,
            meal: { title: log.meal.name, mealType: log.meal.mealType },
            client: log.client,
            status: log.status,
            photoUrl: log.mealPhotoUrl,
            clientNotes: log.clientNotes,
            dietitianFeedback: log.dietitianFeedback,
            reviewedByUser: log.reviewer,
            dietitianReviewedAt: log.dietitianFeedbackAt,
            loggedAt: log.loggedAt,
            createdAt: log.createdAt,
            // Compliance
            complianceScore: log.complianceScore,
            complianceColor: log.complianceColor,
            complianceIssues: log.complianceIssues
        })),
        meta: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) }
    });
});

export const getMealLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const mealLog = await prisma.mealLog.findFirst({
        where: { id: req.params.id, orgId: req.user.organizationId },
        include: {
            meal: { include: { foodItems: { include: { foodItem: true } } } },
            client: { select: { id: true, fullName: true } },
            reviewer: { select: { id: true, fullName: true } }
        }
    });

    if (!mealLog) throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');

    let totalCalories = 0, totalProteinG = 0, totalCarbsG = 0, totalFatsG = 0;

    const items = mealLog.meal.foodItems.map(mfi => {
        const food = mfi.foodItem;
        const quantity = Number(mfi.quantityG);
        const servingSize = Number(food.servingSizeG);
        const multiplier = quantity / servingSize;

        const calories = Math.round(food.calories * multiplier);
        const proteinG = food.proteinG ? Number(food.proteinG) * multiplier : 0;
        const carbsG = food.carbsG ? Number(food.carbsG) * multiplier : 0;
        const fatsG = food.fatsG ? Number(food.fatsG) * multiplier : 0;

        totalCalories += calories;
        totalProteinG += proteinG;
        totalCarbsG += carbsG;
        totalFatsG += fatsG;

        return { foodId: food.id, foodName: food.name, quantity, unit: 'g', nutrition: { calories, proteinG: Math.round(proteinG * 10) / 10, carbsG: Math.round(carbsG * 10) / 10, fatsG: Math.round(fatsG * 10) / 10 } };
    });

    res.status(200).json({
        success: true,
        data: {
            id: mealLog.id,
            organizationId: mealLog.orgId,
            client: mealLog.client,
            mealId: mealLog.mealId,
            scheduledDate: mealLog.scheduledDate,
            scheduledTime: mealLog.scheduledTime,
            meal: { title: mealLog.meal.name, mealType: mealLog.meal.mealType, instructions: mealLog.meal.instructions, items, totals: { calories: totalCalories, proteinG: Math.round(totalProteinG * 10) / 10, carbsG: Math.round(totalCarbsG * 10) / 10, fatsG: Math.round(totalFatsG * 10) / 10 } },
            status: mealLog.status,
            photoUrl: mealLog.mealPhotoUrl,
            clientNotes: mealLog.clientNotes,
            dietitianFeedback: mealLog.dietitianFeedback,
            reviewedByUser: mealLog.reviewer,
            dietitianReviewedAt: mealLog.dietitianFeedbackAt,
            loggedAt: mealLog.loggedAt,
            createdAt: mealLog.createdAt,
            updatedAt: mealLog.updatedAt,
            // Compliance
            complianceScore: mealLog.complianceScore,
            complianceColor: mealLog.complianceColor,
            complianceIssues: mealLog.complianceIssues
        }
    });
});

export const updateMealLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const data: UpdateMealLogInput = req.body;

    const mealLog = await prisma.mealLog.findFirst({
        where: { id: req.params.id, orgId: req.user.organizationId },
        include: { meal: { include: { foodItems: { include: { foodItem: true } } } } }
    });

    if (!mealLog) throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');

    const updateData: any = {};
    if (data.status) updateData.status = data.status;
    if (data.clientNotes !== undefined) updateData.clientNotes = data.clientNotes;
    if (data.substituteDescription !== undefined) updateData.substituteDescription = data.substituteDescription;
    if (data.substituteCaloriesEst !== undefined) updateData.substituteCaloriesEst = data.substituteCaloriesEst;
    if (data.photoUrl) { updateData.mealPhotoUrl = data.photoUrl; updateData.photoUploadedAt = new Date(); }
    if (data.status && data.status !== 'pending') updateData.loggedAt = new Date();

    const updated = await prisma.mealLog.update({ where: { id: req.params.id }, data: updateData });

    // Trigger compliance calculation if eaten
    if ((data.status === 'eaten' && mealLog.status !== 'eaten') || data.substituteCaloriesEst) {
        // Calculate planned calories
        let plannedCalories = 0;
        mealLog.meal.foodItems.forEach(fi => {
            const multiplier = Number(fi.quantityG) / Number(fi.foodItem.servingSizeG);
            plannedCalories += Math.round(fi.foodItem.calories * multiplier);
        });

        // Use substitute calories if provided, else planned
        const actualCalories = data.substituteCaloriesEst || plannedCalories;
        const onTime = true; // Simplified for now

        await complianceService.calculateCompliance(
            updated.id,
            actualCalories,
            plannedCalories,
            onTime
        );
    }

    // Re-fetch to get compliance data
    const finalLog = await prisma.mealLog.findUnique({ where: { id: updated.id } });

    logger.info('Meal log updated', { mealLogId: updated.id });
    res.status(200).json({
        success: true, data: {
            id: finalLog!.id,
            status: finalLog!.status,
            photoUrl: finalLog!.mealPhotoUrl,
            clientNotes: finalLog!.clientNotes,
            loggedAt: finalLog!.loggedAt,
            complianceScore: finalLog!.complianceScore,
            complianceColor: finalLog!.complianceColor
        }
    });
});

export const reviewMealLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const data: ReviewMealLogInput = req.body;

    const mealLog = await prisma.mealLog.findFirst({
        where: { id: req.params.id, orgId: req.user.organizationId }
    });

    if (!mealLog) throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');

    const updateData: any = { reviewedByUserId: req.user.id, dietitianFeedbackAt: new Date() };
    if (data.dietitianFeedback !== undefined) updateData.dietitianFeedback = data.dietitianFeedback;
    if (data.status) updateData.status = data.status;
    if (data.overrideCalories !== undefined) updateData.substituteCaloriesEst = data.overrideCalories;

    const updated = await prisma.mealLog.update({
        where: { id: req.params.id },
        data: updateData,
        include: { reviewer: { select: { id: true, fullName: true } } }
    });

    logger.info('Meal log reviewed', { mealLogId: updated.id, reviewerId: req.user.id });
    res.status(200).json({ success: true, data: { id: updated.id, status: updated.status, dietitianFeedback: updated.dietitianFeedback, reviewedByUser: updated.reviewer, dietitianReviewedAt: updated.dietitianFeedbackAt } });
});

/**
 * POST /api/v1/meal-logs/:id/photo
 * Upload meal photo with compression and thumbnail
 */
export const uploadMealPhoto = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { id } = req.params;

    // Check if file was uploaded
    if (!req.file) {
        throw AppError.badRequest('No photo file provided', 'NO_FILE');
    }

    // Verify meal log exists and belongs to org
    const mealLog = await prisma.mealLog.findFirst({
        where: { id, orgId: req.user.organizationId }
    });

    if (!mealLog) throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');

    // Import storage service
    const { StorageService } = await import('../services/storage.service');

    // Process and upload image
    const { fullUrl, thumbUrl } = await StorageService.uploadMealPhoto(
        req.file.buffer,
        req.user.organizationId,
        id
    );

    // Update meal log with photo URLs
    const updated = await prisma.mealLog.update({
        where: { id },
        data: {
            mealPhotoUrl: fullUrl,
            mealPhotoSmallUrl: thumbUrl,
            photoUploadedAt: new Date(),
            // Auto-set status to 'eaten' if pending
            ...(mealLog.status === 'pending' && { status: 'eaten', loggedAt: new Date() })
        }
    });

    logger.info('Meal photo uploaded', {
        mealLogId: id,
        fullUrl,
        thumbUrl,
        originalSize: req.file.size
    });

    res.status(200).json({
        success: true,
        data: {
            id: updated.id,
            mealPhotoUrl: updated.mealPhotoUrl,
            mealPhotoSmallUrl: updated.mealPhotoSmallUrl,
            photoUploadedAt: updated.photoUploadedAt,
            status: updated.status
        }
    });
});
