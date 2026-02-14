import prisma from '../utils/prisma';
import { MealLogStatus } from '@prisma/client';
import { AppError } from '../errors/AppError';
import { complianceService } from './compliance.service';
import { calculateWeightTrend } from '../utils/weightTrend';

// ============ HELPERS ============

function calcMacros(items: Array<{
    calories: number;
    proteinG: any;
    carbsG: any;
    fatsG: any;
    quantityG: any;
    foodItem: { calories: number; proteinG: any; carbsG: any; fatsG: any };
}>) {
    let calories = 0, protein = 0, carbs = 0, fats = 0;
    items.forEach(fi => {
        calories += fi.calories || Math.round((fi.foodItem.calories * Number(fi.quantityG)) / 100);
        protein += Number(fi.proteinG) || (Number(fi.foodItem.proteinG || 0) * Number(fi.quantityG)) / 100;
        carbs += Number(fi.carbsG) || (Number(fi.foodItem.carbsG || 0) * Number(fi.quantityG)) / 100;
        fats += Number(fi.fatsG) || (Number(fi.foodItem.fatsG || 0) * Number(fi.quantityG)) / 100;
    });
    return { calories, protein: Math.round(protein), carbs: Math.round(carbs), fats: Math.round(fats) };
}

function buildOptionGroups(foodItems: Array<any>) {
    const optionGroupsMap = new Map<number, typeof foodItems>();
    foodItems.forEach((fi: any) => {
        const group = fi.optionGroup ?? 0;
        if (!optionGroupsMap.has(group)) optionGroupsMap.set(group, []);
        optionGroupsMap.get(group)!.push(fi);
    });

    const hasAlternatives = optionGroupsMap.size > 1;

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
                foodItems: items.map((fi: any) => ({
                    id: fi.id,
                    foodId: fi.foodId,
                    foodName: fi.foodItem.name,
                    quantityG: fi.quantityG,
                    calories: fi.calories || Math.round((fi.foodItem.calories * Number(fi.quantityG)) / 100),
                })),
            };
        });

    const defaultMacros = calcMacros(optionGroupsMap.get(0) || foodItems);

    return { optionGroupsMap, hasAlternatives, options, defaultMacros };
}

// ============ SERVICE ============

export class ClientDashboardService {

    async getTodayMeals(clientId: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Calculate today's day index (0=Monday, 6=Sunday)
        const jsDay = today.getDay(); // 0=Sunday, 1=Monday...
        const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

        const activePlan = await prisma.dietPlan.findFirst({
            where: { clientId, status: 'active', isActive: true },
            include: {
                meals: {
                    where: {
                        OR: [
                            { dayOfWeek },           // Match today's day
                            { dayOfWeek: null },      // Include day-agnostic meals
                            { mealDate: { gte: today, lt: tomorrow } }, // Specific date match
                        ],
                    },
                    include: {
                        foodItems: {
                            orderBy: [{ optionGroup: 'asc' }, { sortOrder: 'asc' }],
                            include: { foodItem: true },
                        },
                    },
                    orderBy: { mealType: 'asc' },
                },
            },
        });

        if (!activePlan) return [];

        const mealLogs = await prisma.mealLog.findMany({
            where: {
                clientId,
                scheduledDate: { gte: today, lt: tomorrow },
            },
        });

        return activePlan.meals.map((meal) => {
            const log = mealLogs.find((l) => l.mealId === meal.id);
            const foodItems = meal.foodItems || [];
            const { hasAlternatives, options, defaultMacros } = buildOptionGroups(foodItems);

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
    }

    async getMealLog(clientId: string, mealLogId: string) {
        const mealLog = await prisma.mealLog.findFirst({
            where: { id: mealLogId, clientId },
            include: {
                meal: {
                    include: {
                        foodItems: { include: { foodItem: true } },
                    },
                },
            },
        });

        if (!mealLog) {
            throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');
        }

        const foodItems = mealLog.meal.foodItems || [];
        const { hasAlternatives, options } = buildOptionGroups(foodItems);

        return {
            id: mealLog.id,
            mealId: mealLog.mealId,
            scheduledDate: mealLog.scheduledDate,
            scheduledTime: mealLog.scheduledTime,
            status: mealLog.status,
            chosenOptionGroup: mealLog.chosenOptionGroup,
            mealPhotoUrl: mealLog.mealPhotoUrl,
            clientNotes: mealLog.clientNotes,
            dietitianFeedback: mealLog.dietitianFeedback,
            dietitianFeedbackAt: mealLog.dietitianFeedbackAt,
            loggedAt: mealLog.loggedAt,
            complianceScore: mealLog.complianceScore,
            complianceColor: mealLog.complianceColor,
            meal: {
                id: mealLog.meal.id,
                planId: mealLog.meal.planId,
                mealType: mealLog.meal.mealType,
                name: mealLog.meal.name,
                description: mealLog.meal.description,
                timeOfDay: mealLog.meal.timeOfDay,
                instructions: mealLog.meal.instructions,
                totalCalories: mealLog.meal.totalCalories,
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
    }

    async logMeal(
        clientId: string,
        orgId: string,
        mealLogId: string,
        input: { status?: string; photoUrl?: string; notes?: string; chosenOptionGroup?: number }
    ) {
        const { status, photoUrl, notes, chosenOptionGroup } = input;

        let mealLog = await prisma.mealLog.findUnique({ where: { id: mealLogId } });

        if (!mealLog) {
            if (mealLogId.startsWith('pending-')) {
                const mealId = mealLogId.replace('pending-', '');
                const meal = await prisma.meal.findUnique({
                    where: { id: mealId },
                    include: { dietPlan: true },
                });

                if (!meal || meal.dietPlan.clientId !== clientId) {
                    throw AppError.notFound('Meal not found', 'MEAL_NOT_FOUND');
                }

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const mealStatus = (status || 'eaten') as MealLogStatus;
                mealLog = await prisma.mealLog.upsert({
                    where: {
                        clientId_mealId_scheduledDate: {
                            clientId,
                            mealId,
                            scheduledDate: today,
                        },
                    },
                    update: {
                        status: mealStatus,
                        mealPhotoUrl: photoUrl || undefined,
                        clientNotes: notes || undefined,
                        loggedAt: new Date(),
                        ...(chosenOptionGroup !== undefined && { chosenOptionGroup }),
                    },
                    create: {
                        orgId,
                        clientId,
                        mealId,
                        scheduledDate: today,
                        status: mealStatus,
                        mealPhotoUrl: photoUrl,
                        clientNotes: notes,
                        loggedAt: new Date(),
                        ...(chosenOptionGroup !== undefined && { chosenOptionGroup }),
                    },
                });
            } else {
                throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');
            }
        } else {
            if (mealLog.clientId !== clientId) {
                throw AppError.forbidden('Not authorized', 'FORBIDDEN');
            }

            mealLog = await prisma.mealLog.update({
                where: { id: mealLogId },
                data: {
                    status: (status || mealLog.status) as MealLogStatus,
                    mealPhotoUrl: photoUrl || mealLog.mealPhotoUrl,
                    clientNotes: notes || mealLog.clientNotes,
                    loggedAt: new Date(),
                    ...(chosenOptionGroup !== undefined && { chosenOptionGroup }),
                },
            });
        }

        // Trigger compliance calculation — use returned result directly
        if (mealLog.status !== 'pending') {
            const result = await complianceService.calculateMealCompliance(mealLog.id);
            return {
                ...mealLog,
                complianceScore: result.score,
                complianceColor: result.color,
            };
        }

        return mealLog;
    }

    async getClientStats(clientId: string) {
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: { currentWeightKg: true, targetWeightKg: true },
        });

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const recentLogs = await prisma.mealLog.findMany({
            where: { clientId, scheduledDate: { gte: weekAgo } },
        });

        const totalMeals = recentLogs.length;
        const eatenMeals = recentLogs.filter((l) => l.status === 'eaten').length;
        const adherence = totalMeals > 0 ? Math.round((eatenMeals / totalMeals) * 100) : 0;

        const weightLogs = await prisma.weightLog.findMany({
            where: { clientId },
            orderBy: { logDate: 'desc' },
            take: 14,
        });

        const weightTrend = calculateWeightTrend(weightLogs);

        // Calculate actual consecutive-day streak
        const streakLogs = await prisma.mealLog.findMany({
            where: { clientId, status: 'eaten' },
            select: { scheduledDate: true },
            orderBy: { scheduledDate: 'desc' },
            take: 100,
        });

        let currentStreak = 0;
        if (streakLogs.length > 0) {
            const uniqueDates = [...new Set(
                streakLogs.map(log => log.scheduledDate.toISOString().split('T')[0])
            )].sort((a, b) => b.localeCompare(a));

            const todayDate = new Date();
            todayDate.setHours(0, 0, 0, 0);
            const todayStr = todayDate.toISOString().split('T')[0];

            const yesterday = new Date(todayDate);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            const mostRecentDate = uniqueDates[0];
            if (mostRecentDate === todayStr || mostRecentDate === yesterdayStr) {
                currentStreak = 1;
                const expectedDate = new Date(mostRecentDate);

                for (let i = 1; i < uniqueDates.length; i++) {
                    expectedDate.setDate(expectedDate.getDate() - 1);
                    const expectedStr = expectedDate.toISOString().split('T')[0];
                    if (uniqueDates[i] === expectedStr) {
                        currentStreak++;
                    } else {
                        break;
                    }
                }
            }
        }

        return {
            weeklyAdherence: adherence,
            mealCompletionRate: adherence,
            weightTrend,
            latestWeight: weightLogs.length > 0
                ? Number(weightLogs[0].weightKg)
                : (client?.currentWeightKg ? Number(client.currentWeightKg) : null),
            targetWeight: client?.targetWeightKg ? Number(client.targetWeightKg) : null,
            currentStreak,
        };
    }

    async getProgressSummary(clientId: string) {
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: { currentWeightKg: true, targetWeightKg: true },
        });

        const weightLogs = await prisma.weightLog.findMany({
            where: { clientId },
            orderBy: { logDate: 'desc' },
            take: 10,
        });

        const currentWeight = weightLogs.length > 0
            ? Number(weightLogs[0].weightKg)
            : (client?.currentWeightKg ? Number(client.currentWeightKg) : null);
        const targetWeight = client?.targetWeightKg ? Number(client.targetWeightKg) : null;
        const startWeight = weightLogs.length > 0
            ? Number(weightLogs[weightLogs.length - 1].weightKg)
            : null;

        let progressPercent = 0;
        if (startWeight && currentWeight && targetWeight && startWeight !== targetWeight) {
            const totalToChange = Math.abs(startWeight - targetWeight);
            const isLossGoal = targetWeight < startWeight;
            const moved = isLossGoal
                ? startWeight - currentWeight
                : currentWeight - startWeight;
            progressPercent = moved > 0
                ? Math.min(100, (moved / totalToChange) * 100)
                : 0;
        }

        const weightTrend = calculateWeightTrend(weightLogs);

        const chartEntries = weightLogs.slice(0, 7).reverse().map(log => ({
            date: log.logDate.toISOString().split('T')[0],
            weight: Number(log.weightKg),
        }));

        const history = weightLogs.slice(0, 5).map(log => ({
            id: log.id,
            logDate: log.logDate.toISOString().split('T')[0],
            weightKg: Number(log.weightKg),
            notes: log.notes,
            delta: log.weightChangeFromPrevious ? Number(log.weightChangeFromPrevious) : null,
        }));

        return {
            currentWeight,
            targetWeight,
            startWeight,
            progressPercent: Math.round(progressPercent * 10) / 10,
            weightTrend,
            totalChange: startWeight && currentWeight
                ? Math.round((currentWeight - startWeight) * 10) / 10
                : 0,
            goalDirection: startWeight && targetWeight
                ? (targetWeight < startWeight ? 'loss' : targetWeight > startWeight ? 'gain' : 'maintain')
                : null,
            remaining: currentWeight && targetWeight
                ? Math.round(Math.abs(currentWeight - targetWeight) * 10) / 10
                : null,
            chartEntries,
            history,
        };
    }

    async getWeightLogs(clientId: string, limit: number = 30) {
        return prisma.weightLog.findMany({
            where: { clientId },
            orderBy: { logDate: 'desc' },
            take: limit,
        });
    }

    async createWeightLog(
        clientId: string,
        orgId: string,
        input: { weightKg: number; logDate: string; notes?: string }
    ) {
        const { weightKg, logDate, notes } = input;

        if (!weightKg || !logDate) {
            throw AppError.badRequest('weightKg and logDate required', 'MISSING_FIELDS');
        }

        const parsedDate = new Date(logDate);
        parsedDate.setHours(0, 0, 0, 0);

        const previousLog = await prisma.weightLog.findFirst({
            where: { clientId, logDate: { lt: parsedDate } },
            orderBy: { logDate: 'desc' },
        });

        const weightChange = previousLog
            ? weightKg - Number(previousLog.weightKg)
            : null;

        const log = await prisma.weightLog.upsert({
            where: {
                clientId_logDate: { clientId, logDate: parsedDate },
            },
            update: { weightKg, notes, weightChangeFromPrevious: weightChange },
            create: {
                orgId,
                clientId,
                weightKg,
                logDate: parsedDate,
                notes,
                weightChangeFromPrevious: weightChange,
            },
        });

        await prisma.client.update({
            where: { id: clientId },
            data: { currentWeightKg: weightKg },
        });

        return log;
    }

    async updatePreferences(
        clientId: string,
        body: Record<string, any>
    ) {
        const {
            breakfastTime, lunchTime, dinnerTime, snackTime,
            canCook, kitchenAvailable, hasDietaryCook,
            weekdayActivity, weekendActivity, sportOrHobby, generalNotes,
        } = body;

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

        const cleanData = Object.fromEntries(
            Object.entries(data).filter(([, v]) => v !== undefined)
        );

        return prisma.clientPreferences.upsert({
            where: { clientId },
            create: { clientId, ...cleanData },
            update: cleanData,
        });
    }
}

export const clientDashboardService = new ClientDashboardService();
