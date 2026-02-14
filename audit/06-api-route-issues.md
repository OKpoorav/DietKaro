# 06 - API & Route Issues

**Audit Area:** Backend route architecture, API design, response consistency
**Primary File:** `backend/src/routes/clientApi.routes.ts` (587 lines)
**Severity Range:** HIGH to LOW

---

## Table of Contents

- [6.1 HIGH: Inline Business Logic in Route Files](#61-high-inline-business-logic-in-route-files)
- [6.2 HIGH: Import Ordering Issue](#62-high-import-ordering-issue)
- [6.3 MEDIUM: Missing GET /client/meals/:mealLogId Route](#63-medium-missing-get-clientmealsmeallogid-route)
- [6.4 MEDIUM: Inconsistent Response Shapes](#64-medium-inconsistent-response-shapes)
- [6.5 LOW: No API Versioning Strategy](#65-low-no-api-versioning-strategy)

---

## 6.1 HIGH: Inline Business Logic in Route Files

### The Problem

`backend/src/routes/clientApi.routes.ts` is a 587-line file that contains approximately 400 lines of raw business logic written directly inside Express route handlers. Rather than delegating to service classes, the route handlers contain Prisma queries, data transformation logic, macro calculations, and complex object mapping.

The following routes all have their business logic inlined:

| Route | Lines | Logic |
|-------|-------|-------|
| `GET /meals/today` | 14-148 | Fetches active diet plan, meal logs, computes macros per option group, maps food items |
| `PATCH /meals/:mealLogId/log` | 151-240 | Handles pending-to-real ID resolution, upserts meal logs, triggers compliance |
| `GET /weight-logs` | 266-278 | Queries weight logs with pagination |
| `POST /weight-logs` | 281-334 | Computes weight delta, upserts weight log, updates client profile |
| `GET /stats` | 337-389 | Computes weekly adherence, weight trend, streak |
| `GET /progress-summary` | 392-457 | Computes progress percentage, weight trend, chart data, history with deltas |
| `GET /preferences` | 510-518 | Direct Prisma query |
| `PUT /preferences` | 521-557 | Time validation, field cleanup, upsert |

The worst offender is `GET /meals/today` (lines 14-148), which contains a nested macro calculator function, option-group mapping, and meal-log status merging -- all inside the route handler:

```typescript
// backend/src/routes/clientApi.routes.ts, lines 14-148
router.get('/meals/today', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // ~130 lines of Prisma queries, macro calculations, option-group
    // mapping, and response shaping all inside this handler

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

    const mealLogs = await prisma.mealLog.findMany({
        where: {
            clientId: req.client.id,
            scheduledDate: { gte: today, lt: tomorrow },
        },
    });

    // Inline macro calculator function defined inside the route handler
    const todayMeals = activePlan.meals.map((meal) => {
        const log = mealLogs.find((l) => l.mealId === meal.id);

        const foodItems = meal.foodItems || [];
        const optionGroupsMap = new Map<number, typeof foodItems>();
        foodItems.forEach((fi) => {
            const group = fi.optionGroup ?? 0;
            if (!optionGroupsMap.has(group)) optionGroupsMap.set(group, []);
            optionGroupsMap.get(group)!.push(fi);
        });

        // Nested function definition inside route handler
        const calcMacros = (items: typeof foodItems) => {
            let calories = 0, protein = 0, carbs = 0, fats = 0;
            items.forEach(fi => {
                calories += fi.calories || Math.round(
                    (fi.foodItem.calories * Number(fi.quantityG)) / 100
                );
                protein += Number(fi.proteinG) ||
                    (Number(fi.foodItem.proteinG || 0) * Number(fi.quantityG)) / 100;
                // ... carbs, fats similar
            });
            return { calories, protein: Math.round(protein), /* ... */ };
        };

        // ... ~60 more lines of option building, default macro fallback,
        // response object construction
        return { /* large response object */ };
    });

    res.status(200).json({ success: true, data: todayMeals });
}));
```

Similarly, `GET /stats` (lines 337-389) performs adherence calculation, weight trend detection, and streak counting inline:

```typescript
// backend/src/routes/clientApi.routes.ts, lines 337-389
router.get('/stats', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const client = await prisma.client.findUnique({
        where: { id: req.client.id },
        select: { currentWeightKg: true, targetWeightKg: true },
    });

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

    // Streak, weight trend logic inline...
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
            latestWeight: weightLogs.length > 0
                ? Number(weightLogs[0].weightKg)
                : (client?.currentWeightKg ? Number(client.currentWeightKg) : null),
            targetWeight: client?.targetWeightKg ? Number(client.targetWeightKg) : null,
            currentStreak: Math.min(eatenMeals, 7),
        },
    });
}));
```

And `GET /progress-summary` (lines 392-457) duplicates the weight trend logic from `/stats` and adds progress percentage and chart data computation:

```typescript
// backend/src/routes/clientApi.routes.ts, lines 392-457
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
    const startWeight = weightLogs.length > 0
        ? Number(weightLogs[weightLogs.length - 1].weightKg) : null;

    let progressPercent = 0;
    if (startWeight && currentWeight && targetWeight && startWeight !== targetWeight) {
        progressPercent = Math.min(100, Math.max(0,
            ((startWeight - currentWeight) / (startWeight - targetWeight)) * 100
        ));
    }

    // Duplicated weight trend logic from /stats
    let weightTrend: 'up' | 'down' | 'stable' = 'stable';
    if (weightLogs.length >= 2) {
        const diff = Number(weightLogs[0].weightKg) - Number(weightLogs[1].weightKg);
        if (diff > 0.5) weightTrend = 'up';
        else if (diff < -0.5) weightTrend = 'down';
    }

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

    res.status(200).json({ success: true, data: { /* ... */ } });
}));
```

### Impact

- **Untestable.** Business logic bound to `req`/`res` objects cannot be unit tested without standing up an entire Express server or mocking HTTP primitives.
- **Duplicated logic.** Weight trend calculation (the `> 0.5` / `< -0.5` threshold) is copy-pasted across both `/stats` and `/progress-summary`. A threshold change requires finding every copy.
- **Macro calculation is duplicated between the route handler and `MealLogService.getMealLog`.** The route handler in `clientApi.routes.ts` uses its own `calcMacros` inline function, while `mealLog.service.ts` uses `scaleNutrition` / `sumNutrition` from the nutrition calculator utility. These two implementations can drift apart and produce different calorie numbers for the same meal.
- **Violates separation of concerns.** Route files should only: validate input, call a service, and format the response. This file does all three plus data transformation.
- **Difficult to maintain.** At 587 lines the file is too large for a route file. Express route files in the rest of the codebase (e.g., `mealLog.routes.ts` at 24 lines) follow the thin-controller pattern properly.

### The Fix

Extract all business logic into a new `clientDashboard.service.ts` service. The route file should become a thin delegation layer, consistent with how the rest of the codebase is structured (see `mealLog.routes.ts` which delegates to `mealLog.controller.ts` which delegates to `mealLog.service.ts`).

**New service: `backend/src/services/clientDashboard.service.ts`**

```typescript
// backend/src/services/clientDashboard.service.ts

import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';
import { scaleNutrition, sumNutrition } from '../utils/nutritionCalculator';
import { complianceService } from './compliance.service';

// ============ TYPES ============

interface MealOptionResponse {
    optionGroup: number;
    label: string;
    totalCalories: number;
    totalProteinG: number;
    totalCarbsG: number;
    totalFatsG: number;
    foodItems: {
        id: string;
        foodId: string;
        foodName: string;
        quantityG: number;
        calories: number;
    }[];
}

interface TodayMealResponse {
    id: string;
    mealId: string;
    scheduledDate: string;
    scheduledTime: string | null;
    status: string;
    chosenOptionGroup: number | null;
    mealPhotoUrl: string | null | undefined;
    clientNotes: string | null | undefined;
    dietitianFeedback: string | null | undefined;
    dietitianFeedbackAt: Date | null | undefined;
    loggedAt: Date | null | undefined;
    meal: {
        id: string;
        planId: string;
        mealType: string;
        name: string;
        description: string | null;
        timeOfDay: string | null;
        instructions: string | null;
        totalCalories: number;
        totalProteinG: number;
        totalCarbsG: number;
        totalFatsG: number;
        hasAlternatives: boolean;
        options: MealOptionResponse[];
        foodItems: {
            id: string;
            foodId: string;
            foodName: string;
            quantityG: number;
            calories: number;
            optionGroup: number;
            optionLabel: string | null;
        }[];
    };
}

interface ClientStatsResponse {
    weeklyAdherence: number;
    mealCompletionRate: number;
    weightTrend: 'up' | 'down' | 'stable';
    latestWeight: number | null;
    targetWeight: number | null;
    currentStreak: number;
}

interface ProgressSummaryResponse {
    currentWeight: number | null;
    targetWeight: number | null;
    startWeight: number | null;
    progressPercent: number;
    weightTrend: 'up' | 'down' | 'stable';
    totalLost: number;
    remaining: number | null;
    chartEntries: { date: string; weight: number }[];
    history: {
        id: string;
        logDate: string;
        weightKg: number;
        notes: string | null;
        delta: number | null;
    }[];
}

// ============ HELPERS ============

/**
 * Calculate weight trend from the two most recent weight logs.
 * Extracted to eliminate duplication between /stats and /progress-summary.
 */
function calculateWeightTrend(
    weightLogs: { weightKg: any }[]
): 'up' | 'down' | 'stable' {
    if (weightLogs.length < 2) return 'stable';
    const diff = Number(weightLogs[0].weightKg) - Number(weightLogs[1].weightKg);
    if (diff > 0.5) return 'up';
    if (diff < -0.5) return 'down';
    return 'stable';
}

/**
 * Calculate macros for a group of food items.
 * Uses the same logic as the nutrition calculator utilities.
 */
function calculateGroupMacros(items: any[]) {
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fats = 0;

    items.forEach((fi) => {
        const qty = Number(fi.quantityG);
        calories += fi.calories || Math.round((fi.foodItem.calories * qty) / 100);
        protein +=
            Number(fi.proteinG) ||
            (Number(fi.foodItem.proteinG || 0) * qty) / 100;
        carbs +=
            Number(fi.carbsG) ||
            (Number(fi.foodItem.carbsG || 0) * qty) / 100;
        fats +=
            Number(fi.fatsG) ||
            (Number(fi.foodItem.fatsG || 0) * qty) / 100;
    });

    return {
        calories,
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fats: Math.round(fats),
    };
}

// ============ SERVICE ============

export class ClientDashboardService {
    /**
     * Get today's meals for a client, merging diet plan meals with meal logs.
     */
    async getTodayMeals(clientId: string): Promise<TodayMealResponse[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const activePlan = await prisma.dietPlan.findFirst({
            where: { clientId, status: 'active', isActive: true },
            include: {
                meals: {
                    include: {
                        foodItems: { include: { foodItem: true } },
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

            // Group food items by optionGroup
            const optionGroupsMap = new Map<number, typeof foodItems>();
            foodItems.forEach((fi) => {
                const group = fi.optionGroup ?? 0;
                if (!optionGroupsMap.has(group)) optionGroupsMap.set(group, []);
                optionGroupsMap.get(group)!.push(fi);
            });

            const hasAlternatives = optionGroupsMap.size > 1;

            const options: MealOptionResponse[] = Array.from(
                optionGroupsMap.entries()
            )
                .sort(([a], [b]) => a - b)
                .map(([group, items]) => {
                    const macros = calculateGroupMacros(items);
                    return {
                        optionGroup: group,
                        label:
                            items[0]?.optionLabel ||
                            (group === 0
                                ? 'Default'
                                : `Option ${group + 1}`),
                        totalCalories: macros.calories,
                        totalProteinG: macros.protein,
                        totalCarbsG: macros.carbs,
                        totalFatsG: macros.fats,
                        foodItems: items.map((fi) => ({
                            id: fi.id,
                            foodId: fi.foodId,
                            foodName: fi.foodItem.name,
                            quantityG: fi.quantityG,
                            calories:
                                fi.calories ||
                                Math.round(
                                    (fi.foodItem.calories *
                                        Number(fi.quantityG)) /
                                        100
                                ),
                        })),
                    };
                });

            const defaultMacros = calculateGroupMacros(
                optionGroupsMap.get(0) || foodItems
            );

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
                    totalCalories:
                        meal.totalCalories || defaultMacros.calories,
                    totalProteinG:
                        Number(meal.totalProteinG) || defaultMacros.protein,
                    totalCarbsG:
                        Number(meal.totalCarbsG) || defaultMacros.carbs,
                    totalFatsG:
                        Number(meal.totalFatsG) || defaultMacros.fats,
                    hasAlternatives,
                    options,
                    foodItems: foodItems.map((fi) => ({
                        id: fi.id,
                        foodId: fi.foodId,
                        foodName: fi.foodItem.name,
                        quantityG: fi.quantityG,
                        calories:
                            fi.calories ||
                            Math.round(
                                (fi.foodItem.calories *
                                    Number(fi.quantityG)) /
                                    100
                            ),
                        optionGroup: fi.optionGroup ?? 0,
                        optionLabel: fi.optionLabel,
                    })),
                },
            };
        });
    }

    /**
     * Log or update a meal (handles pending-* IDs, upsert, compliance trigger).
     */
    async logMeal(
        clientId: string,
        orgId: string,
        mealLogId: string,
        input: {
            status?: string;
            photoUrl?: string;
            notes?: string;
            chosenOptionGroup?: number;
        }
    ) {
        const { status, photoUrl, notes, chosenOptionGroup } = input;

        let mealLog = await prisma.mealLog.findUnique({
            where: { id: mealLogId },
        });

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

                const existingLog = await prisma.mealLog.findFirst({
                    where: { clientId, mealId, scheduledDate: today },
                });

                if (existingLog) {
                    mealLog = await prisma.mealLog.update({
                        where: { id: existingLog.id },
                        data: {
                            status: status || 'eaten',
                            mealPhotoUrl: photoUrl || existingLog.mealPhotoUrl,
                            clientNotes: notes || existingLog.clientNotes,
                            loggedAt: new Date(),
                            ...(chosenOptionGroup !== undefined && {
                                chosenOptionGroup,
                            }),
                        },
                    });
                } else {
                    mealLog = await prisma.mealLog.create({
                        data: {
                            orgId,
                            clientId,
                            mealId,
                            scheduledDate: today,
                            status: status || 'eaten',
                            mealPhotoUrl: photoUrl,
                            clientNotes: notes,
                            loggedAt: new Date(),
                            ...(chosenOptionGroup !== undefined && {
                                chosenOptionGroup,
                            }),
                        },
                    });
                }
            } else {
                throw AppError.notFound(
                    'Meal log not found',
                    'MEAL_LOG_NOT_FOUND'
                );
            }
        } else {
            if (mealLog.clientId !== clientId) {
                throw AppError.forbidden('Not authorized', 'FORBIDDEN');
            }

            mealLog = await prisma.mealLog.update({
                where: { id: mealLogId },
                data: {
                    status: status || mealLog.status,
                    mealPhotoUrl: photoUrl || mealLog.mealPhotoUrl,
                    clientNotes: notes || mealLog.clientNotes,
                    loggedAt: new Date(),
                    ...(chosenOptionGroup !== undefined && {
                        chosenOptionGroup,
                    }),
                },
            });
        }

        // Trigger compliance calculation after meal log update
        if (mealLog.status !== 'pending') {
            await complianceService.calculateMealCompliance(mealLog.id);
            mealLog =
                (await prisma.mealLog.findUnique({
                    where: { id: mealLog.id },
                })) || mealLog;
        }

        return mealLog;
    }

    /**
     * Get client stats: weekly adherence, weight trend, streak.
     */
    async getClientStats(clientId: string): Promise<ClientStatsResponse> {
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
        const eatenMeals = recentLogs.filter(
            (l) => l.status === 'eaten'
        ).length;
        const adherence =
            totalMeals > 0
                ? Math.round((eatenMeals / totalMeals) * 100)
                : 0;

        const weightLogs = await prisma.weightLog.findMany({
            where: { clientId },
            orderBy: { logDate: 'desc' },
            take: 2,
        });

        const weightTrend = calculateWeightTrend(weightLogs);

        return {
            weeklyAdherence: adherence,
            mealCompletionRate: adherence,
            weightTrend,
            latestWeight:
                weightLogs.length > 0
                    ? Number(weightLogs[0].weightKg)
                    : client?.currentWeightKg
                      ? Number(client.currentWeightKg)
                      : null,
            targetWeight: client?.targetWeightKg
                ? Number(client.targetWeightKg)
                : null,
            currentStreak: Math.min(eatenMeals, 7),
        };
    }

    /**
     * Get progress summary: weight chart, history, progress percent.
     */
    async getProgressSummary(
        clientId: string
    ): Promise<ProgressSummaryResponse> {
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: { currentWeightKg: true, targetWeightKg: true },
        });

        const weightLogs = await prisma.weightLog.findMany({
            where: { clientId },
            orderBy: { logDate: 'desc' },
            take: 10,
        });

        const currentWeight =
            weightLogs.length > 0
                ? Number(weightLogs[0].weightKg)
                : client?.currentWeightKg
                  ? Number(client.currentWeightKg)
                  : null;
        const targetWeight = client?.targetWeightKg
            ? Number(client.targetWeightKg)
            : null;
        const startWeight =
            weightLogs.length > 0
                ? Number(weightLogs[weightLogs.length - 1].weightKg)
                : null;

        let progressPercent = 0;
        if (
            startWeight &&
            currentWeight &&
            targetWeight &&
            startWeight !== targetWeight
        ) {
            progressPercent = Math.min(
                100,
                Math.max(
                    0,
                    ((startWeight - currentWeight) /
                        (startWeight - targetWeight)) *
                        100
                )
            );
        }

        const weightTrend = calculateWeightTrend(weightLogs);

        const chartEntries = weightLogs
            .slice(0, 7)
            .reverse()
            .map((log) => ({
                date: log.logDate.toISOString().split('T')[0],
                weight: Number(log.weightKg),
            }));

        const history = weightLogs.slice(0, 5).map((log) => ({
            id: log.id,
            logDate: log.logDate.toISOString().split('T')[0],
            weightKg: Number(log.weightKg),
            notes: log.notes,
            delta: log.weightChangeFromPrevious
                ? Number(log.weightChangeFromPrevious)
                : null,
        }));

        return {
            currentWeight,
            targetWeight,
            startWeight,
            progressPercent:
                Math.round(progressPercent * 10) / 10,
            weightTrend,
            totalLost:
                startWeight && currentWeight
                    ? Math.round((startWeight - currentWeight) * 10) / 10
                    : 0,
            remaining:
                currentWeight && targetWeight
                    ? Math.round(
                          Math.abs(currentWeight - targetWeight) * 10
                      ) / 10
                    : null,
            chartEntries,
            history,
        };
    }

    /**
     * Create or update a weight log, computing delta from previous entry.
     */
    async createWeightLog(
        clientId: string,
        orgId: string,
        input: { weightKg: number; logDate: string; notes?: string }
    ) {
        const { weightKg, logDate, notes } = input;

        if (!weightKg || !logDate) {
            throw AppError.badRequest(
                'weightKg and logDate required',
                'MISSING_FIELDS'
            );
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

    /**
     * Get weight logs for a client.
     */
    async getWeightLogs(clientId: string, limit: number = 30) {
        return prisma.weightLog.findMany({
            where: { clientId },
            orderBy: { logDate: 'desc' },
            take: limit,
        });
    }
}

export const clientDashboardService = new ClientDashboardService();
```

**Refactored route file: `backend/src/routes/clientApi.routes.ts`**

```typescript
// backend/src/routes/clientApi.routes.ts
// REFACTORED: thin route file -- all business logic extracted to services

import { Router, Response } from 'express';
import { requireClientAuth, ClientAuthRequest } from '../middleware/clientAuth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import { uploadSinglePhoto } from '../middleware/upload.middleware';
import { mealLogService } from '../services/mealLog.service';
import { onboardingService } from '../services/onboarding.service';
import { complianceService } from '../services/compliance.service';
import { clientDashboardService } from '../services/clientDashboard.service';
import prisma from '../utils/prisma';

const router = Router();
router.use(requireClientAuth);

// ============ MEALS ============

router.get('/meals/today', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = await clientDashboardService.getTodayMeals(req.client.id);
    res.status(200).json({ success: true, data });
}));

router.patch('/meals/:mealLogId/log', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = await clientDashboardService.logMeal(
        req.client.id,
        req.client.orgId,
        req.params.mealLogId,
        req.body
    );
    res.status(200).json({ success: true, data });
}));

router.post('/meals/:mealLogId/photo', uploadSinglePhoto, asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    if (!req.file) throw AppError.badRequest('No photo file provided', 'NO_FILE');
    const mealLog = await prisma.mealLog.findFirst({
        where: { id: req.params.mealLogId, clientId: req.client.id },
    });
    if (!mealLog) throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');
    const data = await mealLogService.uploadMealPhoto(
        req.params.mealLogId, req.file.buffer, req.file.size, req.client.orgId
    );
    res.status(200).json({ success: true, data });
}));

// ============ WEIGHT LOGS ============

router.get('/weight-logs', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const limit = parseInt(req.query.limit as string) || 30;
    const data = await clientDashboardService.getWeightLogs(req.client.id, limit);
    res.status(200).json({ success: true, data });
}));

router.post('/weight-logs', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = await clientDashboardService.createWeightLog(
        req.client.id, req.client.orgId, req.body
    );
    res.status(200).json({ success: true, data });
}));

// ============ STATS & PROGRESS ============

router.get('/stats', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = await clientDashboardService.getClientStats(req.client.id);
    res.status(200).json({ success: true, data });
}));

router.get('/progress-summary', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = await clientDashboardService.getProgressSummary(req.client.id);
    res.status(200).json({ success: true, data });
}));

// ============ ONBOARDING ============

router.get('/onboarding/status', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = await onboardingService.getOnboardingStatus(req.client.id);
    res.status(200).json({ success: true, data });
}));

router.get('/onboarding/presets', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = onboardingService.getPresets();
    res.status(200).json({ success: true, data });
}));

router.post('/onboarding/step/:step', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const step = parseInt(req.params.step);
    const handlers: Record<number, (id: string, data: any) => Promise<void>> = {
        1: (id, d) => onboardingService.saveStep1(id, d),
        2: (id, d) => onboardingService.saveStep2(id, d),
        3: (id, d) => onboardingService.saveStep3(id, d),
        4: (id, d) => onboardingService.saveStep4(id, d),
        5: (id, d) => onboardingService.saveStep5(id, d),
        6: (id, d) => onboardingService.saveStep6(id, d),
    };
    const handler = handlers[step];
    if (!handler) throw AppError.badRequest(`Invalid step: ${step}`, 'INVALID_STEP');
    await handler(req.client.id, req.body);
    res.status(200).json({ success: true, message: `Step ${step} saved successfully` });
}));

router.post('/onboarding/complete', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    await onboardingService.completeOnboarding(req.client.id);
    res.status(200).json({ success: true, message: 'Onboarding marked as complete' });
}));

// ============ PREFERENCES ============

router.get('/preferences', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = await prisma.clientPreferences.findUnique({
        where: { clientId: req.client.id },
    });
    res.status(200).json({ success: true, data });
}));

router.put('/preferences', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const {
        breakfastTime, lunchTime, dinnerTime, snackTime,
        canCook, kitchenAvailable, hasDietaryCook,
        weekdayActivity, weekendActivity, sportOrHobby, generalNotes,
    } = req.body;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const times: Record<string, string | undefined> = {
        breakfastTime, lunchTime, dinnerTime, snackTime,
    };
    for (const [field, value] of Object.entries(times)) {
        if (value && !timeRegex.test(value)) {
            throw AppError.badRequest(
                `${field} must be in HH:MM format`, 'INVALID_TIME_FORMAT'
            );
        }
    }
    const rawData: Record<string, any> = {
        breakfastTime, lunchTime, dinnerTime, snackTime,
        canCook, kitchenAvailable, hasDietaryCook,
        weekdayActivity, weekendActivity, sportOrHobby, generalNotes,
    };
    const cleanData = Object.fromEntries(
        Object.entries(rawData).filter(([, v]) => v !== undefined)
    );
    const data = await prisma.clientPreferences.upsert({
        where: { clientId: req.client.id },
        create: { clientId: req.client.id, ...cleanData },
        update: cleanData,
    });
    res.status(200).json({ success: true, data });
}));

// ============ ADHERENCE / COMPLIANCE ============

router.get('/adherence/daily', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    const data = await complianceService.calculateDailyAdherence(req.client.id, date);
    res.status(200).json({ success: true, data });
}));

router.get('/adherence/weekly', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const weekStart = req.query.weekStart
        ? new Date(req.query.weekStart as string) : undefined;
    const data = await complianceService.calculateWeeklyAdherence(
        req.client.id, weekStart
    );
    res.status(200).json({ success: true, data });
}));

router.get('/adherence/history', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const data = await complianceService.getClientComplianceHistory(
        req.client.id, days
    );
    res.status(200).json({ success: true, data });
}));

export default router;
```

**Result:** The route file drops from ~587 lines to ~160 lines. Every route handler follows the same three-line pattern: authenticate, call service, respond. All business logic is testable in isolation.

---

## 6.2 HIGH: Import Ordering Issue

### The Problem

In `backend/src/routes/clientApi.routes.ts`, three `import` statements appear in the middle of the file, after route handler definitions, rather than at the top with the other imports:

```typescript
// Line 243 -- after the /meals/:mealLogId/log handler on line 151-240
import { uploadSinglePhoto } from '../middleware/upload.middleware';
import { mealLogService } from '../services/mealLog.service';

// Line 461 -- after the /progress-summary handler on line 392-457
import { onboardingService } from '../services/onboarding.service';

// Line 561 -- after the /preferences PUT handler on line 521-557
import { complianceService } from '../services/compliance.service';
```

The file structure currently looks like this:

```
Lines   1-6     Imports (Router, requireClientAuth, asyncHandler, prisma, AppError, Response)
Lines   8-11    Router setup
Lines  14-148   GET /meals/today handler
Lines 151-240   PATCH /meals/:mealLogId/log handler
Line  243-244   import { uploadSinglePhoto } ... import { mealLogService } ...   <-- MID-FILE
Lines 246-263   POST /meals/:mealLogId/photo handler
Lines 266-334   Weight log handlers
Lines 337-457   Stats + Progress handlers
Line  461       import { onboardingService } ...                                  <-- MID-FILE
Lines 464-505   Onboarding handlers
Lines 510-557   Preferences handlers
Line  561       import { complianceService } ...                                  <-- MID-FILE
Lines 564-585   Adherence handlers
Line  587       export default router
```

### Impact

- **Confusing for developers.** When scanning the file, mid-file imports suggest those modules are only needed below that point. In reality, `complianceService` is used on line 235 (inside the PATCH handler), 77 lines *before* its import on line 561. This works only because ES module `import` statements are hoisted by the JavaScript engine regardless of their position in the source file.
- **Violates every major style guide.** ESLint's `import/first` rule, the Airbnb style guide, and the TypeScript coding conventions all require imports at the top of the file before any other statements.
- **Masks dependency problems.** When imports are scattered, it is harder to see the full dependency graph of a module at a glance. A developer may not realize that this route file imports from five different services.
- **Will break if migrated to CommonJS `require()`.** Unlike ES `import`, `require()` is not hoisted. If this file were ever transpiled differently, the mid-file requires would cause runtime errors.

### The Fix

Move all imports to the top of the file, grouped by category.

```typescript
// backend/src/routes/clientApi.routes.ts -- top of file

// Framework
import { Router, Response } from 'express';

// Middleware
import { requireClientAuth, ClientAuthRequest } from '../middleware/clientAuth.middleware';
import { uploadSinglePhoto } from '../middleware/upload.middleware';

// Utilities
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import prisma from '../utils/prisma';

// Services
import { mealLogService } from '../services/mealLog.service';
import { onboardingService } from '../services/onboarding.service';
import { complianceService } from '../services/compliance.service';
// (After 6.1 fix, also add:)
// import { clientDashboardService } from '../services/clientDashboard.service';

const router = Router();
// ... all route handlers below, with zero import statements
```

Enforce this going forward with an ESLint rule:

```json
// .eslintrc.json (add to rules)
{
    "rules": {
        "import/first": "error",
        "import/order": [
            "error",
            {
                "groups": [
                    "builtin",
                    "external",
                    "internal",
                    "parent",
                    "sibling",
                    "index"
                ],
                "newlines-between": "always"
            }
        ]
    }
}
```

---

## 6.3 MEDIUM: Missing GET /client/meals/:mealLogId Route

### The Problem

The client mobile app's `useMealLog` hook (in `client-app/hooks/useMealLog.ts`) makes a `GET` request to fetch individual meal log details:

```typescript
// client-app/hooks/useMealLog.ts, lines 4-16
export function useMealLog(mealLogId: string) {
    const isPending = mealLogId?.startsWith('pending-');

    return useQuery({
        queryKey: ['meal-log', mealLogId],
        queryFn: async () => {
            const { data } = await mealLogsApi.getMealLog(mealLogId);
            return data.data;
        },
        enabled: !!mealLogId && !isPending,
        staleTime: 30 * 1000,
    });
}
```

The API client defines this call as:

```typescript
// client-app/services/api.ts, lines 77-78
export const mealLogsApi = {
    getMealLog: (mealLogId: string) =>
        api.get<ApiResponse<MealLog>>(`/client/meals/${mealLogId}`),
    // ...
};
```

This resolves to `GET /api/v1/client/meals/:mealLogId`.

However, looking at all the routes registered in `clientApi.routes.ts`, there is **no** `GET /meals/:mealLogId` route:

```typescript
// clientApi.routes.ts -- complete list of meal-related routes
router.get('/meals/today', ...);              // GET  /client/meals/today
router.patch('/meals/:mealLogId/log', ...);   // PATCH /client/meals/:mealLogId/log
router.post('/meals/:mealLogId/photo', ...);  // POST /client/meals/:mealLogId/photo
// No GET /meals/:mealLogId exists!
```

The `mealLog.routes.ts` file does have `router.get('/:id', getMealLog)`, but that is mounted at `/api/v1/meal-logs/:id` and uses `requireAuth` (admin/dietitian authentication via Clerk), not `requireClientAuth` (client JWT authentication). A client token cannot authenticate against that route.

### Impact

- **Meal detail screen fails for non-pending meals.** When a client taps on an already-logged meal (status is `eaten`, `skipped`, or `substituted`), the `useMealLog` hook fires (because `isPending` is `false`). The `GET /client/meals/:mealLogId` request hits Express and:
  - If Express cannot match it to any route under `/api/v1/client`, it falls through to the 404 handler.
  - The client app shows a loading state that never resolves, or an error.
- **The meal detail screen partially works by accident.** For pending meals (`id` starts with `pending-`), the hook is disabled (`enabled: false`), so no API call is made and the screen renders using route params passed from the home screen. This masks the bug during casual testing.
- **The meal detail screen for logged meals (`[id].tsx`) expects `mealLog.meal.options`, `mealLog.meal.hasAlternatives`, `mealLog.dietitianFeedback`, etc.** Without the `GET` endpoint, none of these fields are available, and the screen renders empty cards.

### The Fix

Add a `GET /meals/:mealLogId` route to `clientApi.routes.ts` that uses client auth. This route should delegate to the service layer, either reusing `mealLogService.getMealLog` with a client-scoped lookup, or adding a new method to `clientDashboardService`.

```typescript
// Add to backend/src/routes/clientApi.routes.ts (after the GET /meals/today route)

router.get('/meals/:mealLogId', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const { mealLogId } = req.params;

    const mealLog = await prisma.mealLog.findFirst({
        where: {
            id: mealLogId,
            clientId: req.client.id,   // Scoped to the authenticated client
        },
        include: {
            meal: {
                include: {
                    foodItems: {
                        include: { foodItem: true },
                    },
                },
            },
        },
    });

    if (!mealLog) {
        throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');
    }

    // Group food items by optionGroup (same logic as getTodayMeals)
    const foodItems = mealLog.meal.foodItems || [];
    const optionGroupsMap = new Map<number, typeof foodItems>();
    foodItems.forEach((fi) => {
        const group = fi.optionGroup ?? 0;
        if (!optionGroupsMap.has(group)) optionGroupsMap.set(group, []);
        optionGroupsMap.get(group)!.push(fi);
    });

    const hasAlternatives = optionGroupsMap.size > 1;

    const options = Array.from(optionGroupsMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([group, items]) => {
            let totalCalories = 0;
            items.forEach(fi => {
                totalCalories += fi.calories ||
                    Math.round((fi.foodItem.calories * Number(fi.quantityG)) / 100);
            });
            return {
                optionGroup: group,
                label: items[0]?.optionLabel ||
                    (group === 0 ? 'Default' : `Option ${group + 1}`),
                totalCalories,
                foodItems: items.map(fi => ({
                    id: fi.id,
                    foodId: fi.foodId,
                    foodName: fi.foodItem.name,
                    quantityG: fi.quantityG,
                    calories: fi.calories ||
                        Math.round((fi.foodItem.calories * Number(fi.quantityG)) / 100),
                })),
            };
        });

    const data = {
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
            foodItems: foodItems.map(fi => ({
                id: fi.id,
                foodId: fi.foodId,
                foodName: fi.foodItem.name,
                quantityG: fi.quantityG,
                calories: fi.calories ||
                    Math.round((fi.foodItem.calories * Number(fi.quantityG)) / 100),
                optionGroup: fi.optionGroup ?? 0,
                optionLabel: fi.optionLabel,
            })),
        },
    };

    res.status(200).json({ success: true, data });
}));
```

**Important: Route ordering matters.** The new `GET /meals/:mealLogId` route must be registered **after** `GET /meals/today`. Otherwise, Express would match the literal string `"today"` as the `:mealLogId` parameter. The current ordering of `GET /meals/today` first already avoids this.

If applying the 6.1 fix simultaneously, this logic should be extracted into `clientDashboardService.getMealLog(clientId, mealLogId)` instead:

```typescript
// In the refactored clientApi.routes.ts
router.get('/meals/:mealLogId', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = await clientDashboardService.getMealLog(
        req.client.id, req.params.mealLogId
    );
    res.status(200).json({ success: true, data });
}));
```

---

## 6.4 MEDIUM: Inconsistent Response Shapes

### The Problem

The backend API uses at least three different response envelope patterns across its endpoints:

**Pattern A: `{ success, data }` (most endpoints)**

```typescript
// clientApi.routes.ts, line 147
res.status(200).json({ success: true, data: todayMeals });

// clientApi.routes.ts, line 262
res.status(200).json({ success: true, data: result });

// mealLog.controller.ts, line 22
res.status(200).json({ success: true, data });
```

**Pattern B: `{ success, message }` (onboarding endpoints, no `data` field)**

```typescript
// clientApi.routes.ts, line 497
res.status(200).json({ success: true, message: `Step ${step} saved successfully` });

// clientApi.routes.ts, line 504
res.status(200).json({ success: true, message: 'Onboarding marked as complete' });
```

**Pattern C: `{ success, ...spread }` (weight log list -- `data` and `meta` at top level)**

```typescript
// weightLog.controller.ts, line 16
const result = await weightLogService.listWeightLogs(...);
res.status(200).json({ success: true, ...result });
// Result is { data: [...], meta: { total, page, pageSize } }
// So final shape is: { success: true, data: [...], meta: {...} }
```

The client app's TypeScript types assume Pattern A consistently:

```typescript
// client-app/types/index.ts, lines 4-7
export interface ApiResponse<T> {
    success: boolean;
    data: T;        // <-- always expects 'data'
}
```

But the hooks access nested data:

```typescript
// client-app/hooks/useMealLog.ts, line 10-11
const { data } = await mealLogsApi.getMealLog(mealLogId);
return data.data;    // axios.data (response body) -> .data (envelope)
```

For Pattern B endpoints (onboarding steps), accessing `data.data` would return `undefined` because the response has `message` instead of `data`. The frontend currently does not consume the response body for these endpoints (fire-and-forget `POST`), but if it ever needed to, the inconsistency would cause bugs.

**Additional inconsistency in error responses:**

```typescript
// media.routes.ts, line 52 -- uses { success, error: { code, message } }
res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Image not found' }
});

// AppError middleware (typical) -- uses { success, error: { code, message, details } }
// But some places just throw, and the global error handler formats it differently
```

### Impact

- **Fragile frontend parsing.** The client app must handle both `response.data.data` and `response.data.message` patterns, leading to defensive code or silent `undefined` values.
- **TypeScript lies.** The `ApiResponse<T>` type claims every response has a `data: T` field. For Pattern B responses, TypeScript provides false type safety -- no compile-time error, but `data` is `undefined` at runtime.
- **Pagination metadata location varies.** Some endpoints put `meta` alongside `data` in the envelope (Pattern C), others would put it inside `data`. The frontend cannot rely on a single pattern for paginated responses.
- **Makes API documentation unreliable.** Any generated OpenAPI/Swagger docs would show inconsistent schemas per endpoint.

### The Fix

Create a response helper utility and use it everywhere. All successful responses should follow `{ success: true, data: T, message?: string, meta?: PaginationMeta }`.

**New utility: `backend/src/utils/apiResponse.ts`**

```typescript
// backend/src/utils/apiResponse.ts

import { Response } from 'express';

interface PaginationMeta {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

interface ApiSuccessOptions<T> {
    res: Response;
    data?: T;
    message?: string;
    meta?: PaginationMeta;
    statusCode?: number;
}

/**
 * Send a standardized success response.
 *
 * Shape: { success: true, data?: T, message?: string, meta?: PaginationMeta }
 *
 * Examples:
 *   sendSuccess({ res, data: user })
 *   sendSuccess({ res, data: users, meta: { total: 100, page: 1, ... } })
 *   sendSuccess({ res, message: 'Step saved', statusCode: 200 })
 *   sendSuccess({ res, data: plan, statusCode: 201 })
 */
export function sendSuccess<T>({
    res,
    data,
    message,
    meta,
    statusCode = 200,
}: ApiSuccessOptions<T>): void {
    const body: Record<string, any> = { success: true };

    if (data !== undefined) body.data = data;
    if (message) body.message = message;
    if (meta) body.meta = meta;

    res.status(statusCode).json(body);
}

/**
 * Send a standardized error response (for use in controllers, not the
 * global error handler which already follows its own format).
 */
export function sendError(
    res: Response,
    statusCode: number,
    code: string,
    message: string,
    details?: any
): void {
    res.status(statusCode).json({
        success: false,
        error: { code, message, ...(details && { details }) },
    });
}
```

**Usage in refactored routes:**

```typescript
// Before (inconsistent)
res.status(200).json({ success: true, data: todayMeals });
res.status(200).json({ success: true, message: 'Step saved' });
res.status(200).json({ success: true, ...result }); // spreads data+meta

// After (consistent)
import { sendSuccess } from '../utils/apiResponse';

sendSuccess({ res, data: todayMeals });
sendSuccess({ res, message: 'Step saved' });
sendSuccess({ res, data: result.data, meta: result.meta });
```

**Update the client-side type to match:**

```typescript
// client-app/types/index.ts

/** Standard API response envelope */
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
    meta?: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
}
```

**Migrate endpoints incrementally.** Since this is a response shape change, migrate one endpoint group at a time and update the corresponding frontend consumer in the same PR to avoid breaking changes.

---

## 6.5 LOW: No API Versioning Strategy

### The Problem

All routes are mounted under `/api/v1`:

```typescript
// backend/src/app.ts, lines 49-71
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/diet-plans', dietPlanRoutes);
app.use('/api/v1/meals', mealRoutes);
app.use('/api/v1/meal-logs', mealLogRoutes);
app.use('/api/v1/weight-logs', weightLogRoutes);
app.use('/api/v1/food-items', foodItemRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/team', teamRoutes);
app.use('/api/v1/share', shareRoutes);
app.use('/api/v1/referrals', adminReferralRoutes);
app.use('/api/v1/diet-validation', validationRoutes);
app.use('/api/v1/client-auth', clientAuthRoutes);
app.use('/api/v1/client', clientApiRoutes);
app.use('/api/v1/client/referral', referralRoutes);
app.use('/api/v1/client/reports', reportsRoutes);
```

The client app hardcodes the base URL:

```typescript
// client-app/services/api.ts, line 23
const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl
    || 'http://localhost:3000/api/v1';
```

While `v1` is in the URL, there is:

1. No mechanism or documented plan for introducing `v2` endpoints alongside `v1`.
2. No route-level middleware to detect or negotiate API versions.
3. No deprecation headers or sunset dates for eventual `v1` retirement.
4. No strategy for mobile clients that might be running an older app version against a newer API.

### Impact

- **Breaking changes are all-or-nothing.** If a response shape changes (e.g., fixing issue 6.4), every frontend consumer must update simultaneously. There is no way to run old and new shapes side by side.
- **Mobile app version skew.** Unlike the Next.js frontend (which deploys with the backend), the React Native client app is distributed through app stores. Users may run v1.0 of the app against a v2 API if the API changes without a versioning strategy.
- **Low urgency for now.** The product is in early stages with a small user base. This becomes critical when the mobile app is published to app stores.

### The Fix

Document a versioning strategy and put the infrastructure in place, but do not build `v2` routes until needed.

**Step 1: Create a versioned router factory**

```typescript
// backend/src/utils/versionedRouter.ts

import { Router } from 'express';

/**
 * Create a versioned API router. This is a thin wrapper that makes it
 * easy to mount the same route module under multiple version prefixes
 * if needed during a migration period.
 *
 * Usage:
 *   const v1 = createVersionRouter('v1');
 *   v1.use('/auth', authRoutes);
 *   app.use('/api', v1);
 *
 *   // When v2 is needed:
 *   const v2 = createVersionRouter('v2');
 *   v2.use('/auth', authRoutesV2);
 *   app.use('/api', v2);
 */
export function createVersionRouter(version: string): Router {
    const router = Router();

    // Inject version into request for downstream middleware/logging
    router.use((req, _res, next) => {
        (req as any).apiVersion = version;
        next();
    });

    return router;
}
```

**Step 2: Refactor `app.ts` to use the factory**

```typescript
// backend/src/app.ts

import { createVersionRouter } from './utils/versionedRouter';

const v1 = createVersionRouter('v1');

// Admin / Dashboard routes
v1.use('/auth', authRoutes);
v1.use('/organizations', organizationRoutes);
v1.use('/clients', clientRoutes);
v1.use('/diet-plans', dietPlanRoutes);
v1.use('/meals', mealRoutes);
v1.use('/meal-logs', mealLogRoutes);
v1.use('/weight-logs', weightLogRoutes);
v1.use('/food-items', foodItemRoutes);
v1.use('/dashboard', dashboardRoutes);
v1.use('/team', teamRoutes);
v1.use('/share', shareRoutes);
v1.use('/referrals', adminReferralRoutes);
v1.use('/diet-validation', validationRoutes);
v1.use('/notifications', notificationRoutes);
v1.use('/clients/:clientId/onboarding', onboardingRoutes);
v1.use('/clients/:clientId/adherence', complianceRoutes);

// Client Mobile App routes
v1.use('/client-auth', clientAuthRoutes);
v1.use('/client', clientApiRoutes);
v1.use('/client/referral', referralRoutes);
v1.use('/client/reports', reportsRoutes);

app.use('/api/v1', v1);

// When v2 is needed:
// const v2 = createVersionRouter('v2');
// v2.use('/auth', authRoutesV2);
// // For routes unchanged in v2, reuse the v1 module:
// v2.use('/organizations', organizationRoutes);
// app.use('/api/v2', v2);
```

**Step 3: Add deprecation response headers**

When `v2` is eventually introduced and `v1` is being sunset, add a middleware to `v1` that warns clients:

```typescript
// backend/src/middleware/deprecation.middleware.ts

import { Request, Response, NextFunction } from 'express';

/**
 * Add deprecation headers to v1 responses once v2 is available.
 * Follows the IETF "Deprecation" header draft standard.
 */
export function deprecationWarning(sunsetDate: string) {
    return (_req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', sunsetDate);       // e.g. "2027-01-01"
        res.setHeader(
            'Link',
            '</api/v2>; rel="successor-version"'
        );
        next();
    };
}

// Usage (when ready to sunset v1):
// v1.use(deprecationWarning('2027-06-01'));
```

**Step 4: Client app version negotiation**

Ensure the client app sends its version in headers so the server can detect outdated clients:

```typescript
// client-app/services/api.ts -- add to the axios instance config
import Constants from 'expo-constants';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
        'X-App-Version': Constants.expoConfig?.version || '1.0.0',
        'X-Platform': Platform.OS,
    },
});
```

The server can then use the `X-App-Version` header to detect clients that need force-update prompts when a minimum version is required.

---

## Summary

| Issue | Severity | Effort | Priority |
|-------|----------|--------|----------|
| 6.1 Inline business logic in routes | HIGH | Medium (new service file + refactor routes) | P1 |
| 6.2 Mid-file imports | HIGH | Low (move 4 lines, add ESLint rule) | P1 |
| 6.3 Missing GET /client/meals/:mealLogId | MEDIUM | Low (add one route + handler) | P1 |
| 6.4 Inconsistent response shapes | MEDIUM | Medium (create helper, migrate incrementally) | P2 |
| 6.5 No API versioning strategy | LOW | Low (document + infrastructure, no migration yet) | P3 |

**Recommended order of implementation:**

1. **6.2** first -- it is a two-minute fix with zero risk.
2. **6.3** next -- it fixes an active bug where the meal detail screen fails for logged meals.
3. **6.1** next -- extract the service and thin out the route file, which also makes 6.3 cleaner (the new route handler can delegate to the service).
4. **6.4** incrementally alongside other changes -- each PR that touches a response can migrate to the helper.
5. **6.5** when the mobile app is preparing for app store release.
