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

        // Calculate macros from food items if not set on meal
        const foodItems = meal.foodItems || [];
        const calculatedCalories = foodItems.reduce((sum, fi) => {
            // Calculate from food item: (calories per 100g * quantity / 100)
            const itemCalories = fi.calories ||
                Math.round((fi.foodItem.calories * Number(fi.quantityG)) / 100);
            return sum + itemCalories;
        }, 0);
        const calculatedProtein = foodItems.reduce((sum, fi) => {
            const itemProtein = Number(fi.proteinG) ||
                (Number(fi.foodItem.proteinG || 0) * Number(fi.quantityG)) / 100;
            return sum + itemProtein;
        }, 0);
        const calculatedCarbs = foodItems.reduce((sum, fi) => {
            const itemCarbs = Number(fi.carbsG) ||
                (Number(fi.foodItem.carbsG || 0) * Number(fi.quantityG)) / 100;
            return sum + itemCarbs;
        }, 0);
        const calculatedFats = foodItems.reduce((sum, fi) => {
            const itemFats = Number(fi.fatsG) ||
                (Number(fi.foodItem.fatsG || 0) * Number(fi.quantityG)) / 100;
            return sum + itemFats;
        }, 0);

        return {
            id: log?.id || `pending-${meal.id}`,
            mealId: meal.id,
            scheduledDate: today.toISOString().split('T')[0],
            scheduledTime: meal.timeOfDay,
            status: log?.status || 'pending',
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
                totalCalories: meal.totalCalories || calculatedCalories,
                totalProteinG: Number(meal.totalProteinG) || Math.round(calculatedProtein),
                totalCarbsG: Number(meal.totalCarbsG) || Math.round(calculatedCarbs),
                totalFatsG: Number(meal.totalFatsG) || Math.round(calculatedFats),
                foodItems: foodItems.map((fi) => ({
                    id: fi.id,
                    foodId: fi.foodId,
                    foodName: fi.foodItem.name,
                    quantityG: fi.quantityG,
                    calories: fi.calories || Math.round((fi.foodItem.calories * Number(fi.quantityG)) / 100),
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
    const { status, photoUrl, notes } = req.body;

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
            },
        });
    }

    res.status(200).json({ success: true, data: mealLog });
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

export default router;
