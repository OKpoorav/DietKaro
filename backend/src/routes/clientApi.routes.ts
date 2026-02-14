import { Router } from 'express';
import { requireClientAuth, ClientAuthRequest } from '../middleware/clientAuth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';
import { Response } from 'express';

const router = Router();

// All routes require client auth
router.use(requireClientAuth);

// Get today's meals for client
router.get('/meals/today', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get active diet plan for this client
    const activePlan = await prisma.dietPlan.findFirst({
        where: {
            clientId: req.client.id,
            status: 'active',
            isActive: true,
        },
        include: {
            meals: {
                include: {
                    foodItems: {
                        include: { foodItem: true },
                    },
                },
                orderBy: { mealType: 'asc' },
            },
        },
    });

    if (!activePlan) {
        return res.status(200).json({ success: true, data: [] });
    }

    // Get meal logs for today
    const mealLogs = await prisma.mealLog.findMany({
        where: {
            clientId: req.client.id,
            scheduledDate: {
                gte: today,
                lt: tomorrow,
            },
        },
    });

    // Map meals to include log status
    const todayMeals = activePlan.meals.map((meal) => {
        const log = mealLogs.find((l) => l.mealId === meal.id);

        // Group food items by optionGroup
        const foodItems = meal.foodItems || [];
        const optionGroupsMap = new Map<number, typeof foodItems>();
        foodItems.forEach((fi) => {
            const group = fi.optionGroup ?? 0;
            if (!optionGroupsMap.has(group)) optionGroupsMap.set(group, []);
            optionGroupsMap.get(group)!.push(fi);
        });

        const hasAlternatives = optionGroupsMap.size > 1;

        // Calculate macros per option group
        const calcMacros = (items: typeof foodItems) => {
            let calories = 0, protein = 0, carbs = 0, fats = 0;
            items.forEach(fi => {
                calories += fi.calories || Math.round((fi.foodItem.calories * Number(fi.quantityG)) / 100);
                protein += Number(fi.proteinG) || (Number(fi.foodItem.proteinG || 0) * Number(fi.quantityG)) / 100;
                carbs += Number(fi.carbsG) || (Number(fi.foodItem.carbsG || 0) * Number(fi.quantityG)) / 100;
                fats += Number(fi.fatsG) || (Number(fi.foodItem.fatsG || 0) * Number(fi.quantityG)) / 100;
            });
            return { calories, protein: Math.round(protein), carbs: Math.round(carbs), fats: Math.round(fats) };
        };

        // Build options array
        const options = Array.from(optionGroupsMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([group, items]) => {
                const macros = calcMacros(items);
                return {
                    optionGroup: group,
                    label: items[0]?.optionLabel || (group === 0 ? 'Default' : `Option ${group + 1}`),
                    totalCalories: macros.calories,
                    totalProteinG: macros.protein,
                    totalCarbsG: macros.carbs,
                    totalFatsG: macros.fats,
                    foodItems: items.map((fi) => ({
                        id: fi.id,
                        foodId: fi.foodId,
                        foodName: fi.foodItem.name,
                        quantityG: fi.quantityG,
                        calories: fi.calories || Math.round((fi.foodItem.calories * Number(fi.quantityG)) / 100),
                    })),
                };
            });

        // Use option 0 macros as default display values
        const defaultMacros = calcMacros(optionGroupsMap.get(0) || foodItems);

        return {
            id: log?.id || `pending-${meal.id}`,
            mealId: meal.id,
            scheduledDate: today.toISOString().split('T')[0],
            scheduledTime: meal.timeOfDay,
            status: log?.status || 'pending',
            chosenOptionGroup: log?.chosenOptionGroup ?? null,
            mealPhotoUrl: log?.mealPhotoUrl,
            clientNotes: log?.clientNotes,
            dietitianFeedback: log?.dietitianFeedback,
            dietitianFeedbackAt: log?.dietitianFeedbackAt,
            loggedAt: log?.loggedAt,
            meal: {
                id: meal.id,
                planId: meal.planId,
                mealType: meal.mealType,
                name: meal.name,
                description: meal.description,
                timeOfDay: meal.timeOfDay,
                instructions: meal.instructions,
                totalCalories: meal.totalCalories || defaultMacros.calories,
                totalProteinG: Number(meal.totalProteinG) || defaultMacros.protein,
                totalCarbsG: Number(meal.totalCarbsG) || defaultMacros.carbs,
                totalFatsG: Number(meal.totalFatsG) || defaultMacros.fats,
                hasAlternatives,
                options,
                foodItems: foodItems.map((fi) => ({
                    id: fi.id,
                    foodId: fi.foodId,
                    foodName: fi.foodItem.name,
                    quantityG: fi.quantityG,
                    calories: fi.calories || Math.round((fi.foodItem.calories * Number(fi.quantityG)) / 100),
                    optionGroup: fi.optionGroup ?? 0,
                    optionLabel: fi.optionLabel,
                })),
            },
        };
    });

    res.status(200).json({ success: true, data: todayMeals });
}));

// Log a meal (update status, add photo, notes)
router.patch('/meals/:mealLogId/log', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const { mealLogId } = req.params;
    const { status, photoUrl, notes, chosenOptionGroup } = req.body;

    // Check if meal log exists, if not create it
    let mealLog = await prisma.mealLog.findUnique({ where: { id: mealLogId } });

    if (!mealLog) {
        // This might be a "pending" placeholder - need to create actual log
        // mealLogId here could be "pending-{mealId}" format
        if (mealLogId.startsWith('pending-')) {
            const mealId = mealLogId.replace('pending-', '');
            const meal = await prisma.meal.findUnique({ where: { id: mealId }, include: { dietPlan: true } });

            if (!meal || meal.dietPlan.clientId !== req.client.id) {
                throw AppError.notFound('Meal not found', 'MEAL_NOT_FOUND');
            }

            // Create today's date at start of day for proper matching
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Check if a log already exists for this meal today
            const existingLog = await prisma.mealLog.findFirst({
                where: {
                    clientId: req.client.id,
                    mealId: mealId,
                    scheduledDate: today,
                },
            });

            if (existingLog) {
                // Update existing log instead of creating duplicate
                mealLog = await prisma.mealLog.update({
                    where: { id: existingLog.id },
                    data: {
                        status: status || 'eaten',
                        mealPhotoUrl: photoUrl || existingLog.mealPhotoUrl,
                        clientNotes: notes || existingLog.clientNotes,
                        loggedAt: new Date(),
                        ...(chosenOptionGroup !== undefined && { chosenOptionGroup }),
                    },
                });
            } else {
                // Create new log
                mealLog = await prisma.mealLog.create({
                    data: {
                        orgId: req.client.orgId,
                        clientId: req.client.id,
                        mealId: mealId,
                        scheduledDate: today,
                        status: status || 'eaten',
                        mealPhotoUrl: photoUrl,
                        clientNotes: notes,
                        loggedAt: new Date(),
                        ...(chosenOptionGroup !== undefined && { chosenOptionGroup }),
                    },
                });
            }
        } else {
            throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');
        }
    } else {
        // Update existing
        if (mealLog.clientId !== req.client.id) {
            throw AppError.forbidden('Not authorized', 'FORBIDDEN');
        }

        mealLog = await prisma.mealLog.update({
            where: { id: mealLogId },
            data: {
                status: status || mealLog.status,
                mealPhotoUrl: photoUrl || mealLog.mealPhotoUrl,
                clientNotes: notes || mealLog.clientNotes,
                loggedAt: new Date(),
                ...(chosenOptionGroup !== undefined && { chosenOptionGroup }),
            },
        });
    }

    // Trigger compliance calculation after meal log update
    if (mealLog.status !== 'pending') {
        await complianceService.calculateMealCompliance(mealLog.id);
        mealLog = await prisma.mealLog.findUnique({ where: { id: mealLog.id } }) || mealLog;
    }

    res.status(200).json({ success: true, data: mealLog });
}));

// Upload meal photo
import { uploadSinglePhoto } from '../middleware/upload.middleware';
import { mealLogService } from '../services/mealLog.service';

router.post('/meals/:mealLogId/photo', uploadSinglePhoto, asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    if (!req.file) throw AppError.badRequest('No photo file provided', 'NO_FILE');

    const { mealLogId } = req.params;

    // Verify the meal log belongs to this client
    const mealLog = await prisma.mealLog.findFirst({
        where: { id: mealLogId, clientId: req.client.id },
    });
    if (!mealLog) throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');

    const result = await mealLogService.uploadMealPhoto(
        mealLogId, req.file.buffer, req.file.size, req.client.orgId
    );

    res.status(200).json({ success: true, data: result });
}));

// Get client weight logs
router.get('/weight-logs', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const limit = parseInt(req.query.limit as string) || 30;

    const logs = await prisma.weightLog.findMany({
        where: { clientId: req.client.id },
        orderBy: { logDate: 'desc' },
        take: limit,
    });

    res.status(200).json({ success: true, data: logs });
}));

// Create weight log
router.post('/weight-logs', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const { weightKg, logDate, notes } = req.body;

    if (!weightKg || !logDate) {
        throw AppError.badRequest('weightKg and logDate required', 'MISSING_FIELDS');
    }

    const parsedDate = new Date(logDate);
    parsedDate.setHours(0, 0, 0, 0); // Normalize to start of day

    // Get previous log for delta calculation (exclude current date)
    const previousLog = await prisma.weightLog.findFirst({
        where: {
            clientId: req.client.id,
            logDate: { lt: parsedDate },
        },
        orderBy: { logDate: 'desc' },
    });

    const weightChange = previousLog ? weightKg - Number(previousLog.weightKg) : null;

    // Upsert: update if exists for same date, create if not
    const log = await prisma.weightLog.upsert({
        where: {
            clientId_logDate: {
                clientId: req.client.id,
                logDate: parsedDate,
            },
        },
        update: {
            weightKg,
            notes,
            weightChangeFromPrevious: weightChange,
        },
        create: {
            orgId: req.client.orgId,
            clientId: req.client.id,
            weightKg,
            logDate: parsedDate,
            notes,
            weightChangeFromPrevious: weightChange,
        },
    });

    // Update client's current weight
    await prisma.client.update({
        where: { id: req.client.id },
        data: { currentWeightKg: weightKg },
    });

    res.status(200).json({ success: true, data: log });
}));

// Get client stats
router.get('/stats', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const client = await prisma.client.findUnique({
        where: { id: req.client.id },
        select: { currentWeightKg: true, targetWeightKg: true },
    });

    // Get meal logs for last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentLogs = await prisma.mealLog.findMany({
        where: {
            clientId: req.client.id,
            scheduledDate: { gte: weekAgo },
        },
    });

    const totalMeals = recentLogs.length;
    const eatenMeals = recentLogs.filter((l) => l.status === 'eaten').length;
    const adherence = totalMeals > 0 ? Math.round((eatenMeals / totalMeals) * 100) : 0;

    // Get streak (consecutive days with at least one logged meal)
    // Simplified: just count recent weight logs for now
    const weightLogs = await prisma.weightLog.findMany({
        where: { clientId: req.client.id },
        orderBy: { logDate: 'desc' },
        take: 2,
    });

    let weightTrend: 'up' | 'down' | 'stable' = 'stable';
    if (weightLogs.length >= 2) {
        const diff = Number(weightLogs[0].weightKg) - Number(weightLogs[1].weightKg);
        if (diff > 0.5) weightTrend = 'up';
        else if (diff < -0.5) weightTrend = 'down';
    }

    res.status(200).json({
        success: true,
        data: {
            weeklyAdherence: adherence,
            mealCompletionRate: adherence,
            weightTrend,
            // Use latest weight log, fallback to client profile
            latestWeight: weightLogs.length > 0
                ? Number(weightLogs[0].weightKg)
                : (client?.currentWeightKg ? Number(client.currentWeightKg) : null),
            targetWeight: client?.targetWeightKg ? Number(client.targetWeightKg) : null,
            currentStreak: Math.min(eatenMeals, 7), // Simplified streak
        },
    });
}));

// Get progress summary (all weight + progress data computed server-side)
router.get('/progress-summary', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const client = await prisma.client.findUnique({
        where: { id: req.client.id },
        select: { currentWeightKg: true, targetWeightKg: true },
    });

    const weightLogs = await prisma.weightLog.findMany({
        where: { clientId: req.client.id },
        orderBy: { logDate: 'desc' },
        take: 10,
    });

    const currentWeight = weightLogs.length > 0
        ? Number(weightLogs[0].weightKg)
        : (client?.currentWeightKg ? Number(client.currentWeightKg) : null);
    const targetWeight = client?.targetWeightKg ? Number(client.targetWeightKg) : null;
    const startWeight = weightLogs.length > 0 ? Number(weightLogs[weightLogs.length - 1].weightKg) : null;

    // Compute progress percentage
    let progressPercent = 0;
    if (startWeight && currentWeight && targetWeight && startWeight !== targetWeight) {
        progressPercent = Math.min(100, Math.max(0,
            ((startWeight - currentWeight) / (startWeight - targetWeight)) * 100
        ));
    }

    // Weight trend
    let weightTrend: 'up' | 'down' | 'stable' = 'stable';
    if (weightLogs.length >= 2) {
        const diff = Number(weightLogs[0].weightKg) - Number(weightLogs[1].weightKg);
        if (diff > 0.5) weightTrend = 'up';
        else if (diff < -0.5) weightTrend = 'down';
    }

    // Chart data (oldest first)
    const chartEntries = weightLogs.slice(0, 7).reverse().map(log => ({
        date: log.logDate.toISOString().split('T')[0],
        weight: Number(log.weightKg),
    }));

    // History with backend-computed deltas
    const history = weightLogs.slice(0, 5).map(log => ({
        id: log.id,
        logDate: log.logDate.toISOString().split('T')[0],
        weightKg: Number(log.weightKg),
        notes: log.notes,
        delta: log.weightChangeFromPrevious ? Number(log.weightChangeFromPrevious) : null,
    }));

    res.status(200).json({
        success: true,
        data: {
            currentWeight,
            targetWeight,
            startWeight,
            progressPercent: Math.round(progressPercent * 10) / 10,
            weightTrend,
            totalLost: startWeight && currentWeight ? Math.round((startWeight - currentWeight) * 10) / 10 : 0,
            remaining: currentWeight && targetWeight ? Math.round(Math.abs(currentWeight - targetWeight) * 10) / 10 : null,
            chartEntries,
            history,
        },
    });
}));

// ============ ONBOARDING ============

import { onboardingService } from '../services/onboarding.service';

// Get onboarding status
router.get('/onboarding/status', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const status = await onboardingService.getOnboardingStatus(req.client.id);
    res.status(200).json({ success: true, data: status });
}));

// Get restriction presets
router.get('/onboarding/presets', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const presets = onboardingService.getPresets();
    res.status(200).json({ success: true, data: presets });
}));

// Save onboarding step (1-6)
router.post('/onboarding/step/:step', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const step = parseInt(req.params.step);

    const handlers: Record<number, (clientId: string, data: any) => Promise<void>> = {
        1: (id, data) => onboardingService.saveStep1(id, data),
        2: (id, data) => onboardingService.saveStep2(id, data),
        3: (id, data) => onboardingService.saveStep3(id, data),
        4: (id, data) => onboardingService.saveStep4(id, data),
        5: (id, data) => onboardingService.saveStep5(id, data),
        6: (id, data) => onboardingService.saveStep6(id, data),
    };

    const handler = handlers[step];
    if (!handler) {
        throw AppError.badRequest(`Invalid step: ${step}`, 'INVALID_STEP');
    }

    await handler(req.client.id, req.body);
    res.status(200).json({ success: true, message: `Step ${step} saved successfully` });
}));

// Complete onboarding
router.post('/onboarding/complete', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    await onboardingService.completeOnboarding(req.client.id);
    res.status(200).json({ success: true, message: 'Onboarding marked as complete' });
}));

// ============ PREFERENCES ============

// Get client preferences
router.get('/preferences', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const preferences = await prisma.clientPreferences.findUnique({
        where: { clientId: req.client.id },
    });

    res.status(200).json({ success: true, data: preferences });
}));

// Update client preferences (upsert)
router.put('/preferences', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const {
        breakfastTime, lunchTime, dinnerTime, snackTime,
        canCook, kitchenAvailable, hasDietaryCook,
        weekdayActivity, weekendActivity, sportOrHobby, generalNotes,
    } = req.body;

    // Validate time format if provided
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const times: Record<string, string | undefined> = { breakfastTime, lunchTime, dinnerTime, snackTime };
    for (const [field, value] of Object.entries(times)) {
        if (value && !timeRegex.test(value)) {
            throw AppError.badRequest(`${field} must be in HH:MM format`, 'INVALID_TIME_FORMAT');
        }
    }

    const data: Record<string, any> = {
        breakfastTime, lunchTime, dinnerTime, snackTime,
        canCook, kitchenAvailable, hasDietaryCook,
        weekdayActivity, weekendActivity, sportOrHobby, generalNotes,
    };

    // Remove undefined keys so we don't overwrite existing values
    const cleanData = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
    );

    const preferences = await prisma.clientPreferences.upsert({
        where: { clientId: req.client.id },
        create: { clientId: req.client.id, ...cleanData },
        update: cleanData,
    });

    res.status(200).json({ success: true, data: preferences });
}));

// ============ ADHERENCE / COMPLIANCE ============

import { complianceService } from '../services/compliance.service';

// Get daily adherence
router.get('/adherence/daily', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    const data = await complianceService.calculateDailyAdherence(req.client.id, date);
    res.status(200).json({ success: true, data });
}));

// Get weekly adherence
router.get('/adherence/weekly', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const weekStart = req.query.weekStart ? new Date(req.query.weekStart as string) : undefined;
    const data = await complianceService.calculateWeeklyAdherence(req.client.id, weekStart);
    res.status(200).json({ success: true, data });
}));

// Get compliance history
router.get('/adherence/history', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const data = await complianceService.getClientComplianceHistory(req.client.id, days);
    res.status(200).json({ success: true, data });
}));

export default router;
