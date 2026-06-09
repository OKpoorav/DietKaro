import prisma from '../utils/prisma';
import { Prisma, MealLogStatus } from '@prisma/client';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';
import { buildPaginationParams, buildPaginationMeta } from '../utils/queryFilters';
import type { CreateDietPlanInput, UpdateDietPlanInput, DietPlanListQuery, AssignTemplateInput } from '../schemas/dietPlan.schema';
import { getIO } from '../socket';
import { notificationService } from './notification.service';
import { invalidateClientCache } from '../utils/cache';

/** Strip empty/whitespace-only entries; return undefined when nothing remains. */
function normalizeDayNotes(input?: Record<string, string>): Record<string, string> | undefined {
    if (!input) return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(input)) {
        if (typeof v === 'string' && v.trim().length > 0) out[k] = v.trim();
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

export class DietPlanService {
    async createPlan(data: CreateDietPlanInput, orgId: string, userId: string) {
        const isTemplate = data.options?.saveAsTemplate || false;
        const clientId = data.clientId;

        if (!isTemplate) {
            if (!clientId) {
                throw AppError.badRequest('clientId is required for non-template diet plans', 'CLIENT_ID_REQUIRED');
            }
            const client = await prisma.client.findFirst({ where: { id: clientId, orgId } });
            if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');
        }

        // Auto-compute endDate when not explicitly provided
        let endDate: Date | null = data.endDate ? new Date(data.endDate) : null;
        if (!endDate && data.meals?.length) {
            const mealDates = data.meals.filter(m => m.mealDate).map(m => new Date(m.mealDate!));
            if (mealDates.length > 0) {
                endDate = new Date(Math.max(...mealDates.map(d => d.getTime())));
            } else {
                const maxDow = data.meals.reduce((max, m) => Math.max(max, m.dayOfWeek ?? 0), 0);
                if (maxDow > 0 && data.startDate) {
                    endDate = new Date(data.startDate);
                    endDate.setDate(endDate.getDate() + maxDow);
                }
            }
        }

        const dietPlan = await prisma.dietPlan.create({
            data: {
                organization: { connect: { id: orgId } },
                client: clientId ? { connect: { id: clientId } } : undefined,
                creator: { connect: { id: userId } },
                name: data.name,
                description: data.description,
                startDate: data.startDate ? new Date(data.startDate) : new Date(),
                endDate,
                targetCalories: data.targetCalories,
                targetProteinG: data.targetProteinG,
                targetCarbsG: data.targetCarbsG,
                targetFatsG: data.targetFatsG,
                targetFiberG: data.targetFiberG,
                notesForClient: data.notesForClient,
                internalNotes: data.internalNotes,
                dayNotes: normalizeDayNotes(data.dayNotes),
                hideCaloriesFromClient: data.hideCaloriesFromClient ?? false,
                status: isTemplate ? 'active' : 'draft',
                isTemplate,
                templateCategory: data.options?.templateCategory,
                meals: data.meals?.length
                    ? {
                          create: data.meals.map((meal, index) => ({
                              dayOfWeek: meal.dayOfWeek,
                              mealDate: meal.mealDate ? new Date(meal.mealDate) : null,
                              sequenceNumber: index,
                              mealType: meal.mealType,
                              timeOfDay: meal.timeOfDay,
                              name: meal.name,
                              description: meal.description,
                              instructions: meal.instructions,
                              foodItems: meal.foodItems?.length
                                  ? {
                                        create: meal.foodItems.map((item, sortOrder) => ({
                                            foodId: item.foodId,
                                            quantityG: item.quantityG,
                                            notes: item.notes,
                                            sortOrder,
                                            optionGroup: item.optionGroup ?? 0,
                                            optionLabel: item.optionLabel ?? null,
                                        })),
                                    }
                                  : undefined,
                          })),
                      }
                    : undefined,
            },
            select: {
                id: true,
                name: true,
                status: true,
                isTemplate: true,
                startDate: true,
                endDate: true,
            },
        });

        logger.info(isTemplate ? 'Diet plan template created' : 'Diet plan created', { planId: dietPlan.id, clientId });
        return dietPlan;
    }

    async getPlan(planId: string, orgId: string) {
        const dietPlan = await prisma.dietPlan.findFirst({
            where: { id: planId, orgId, isActive: true },
            include: {
                client: { select: { id: true, fullName: true, phone: true, currentWeightKg: true, targetWeightKg: true } },
                creator: { select: { id: true, fullName: true } },
                meals: {
                    orderBy: [{ dayOfWeek: 'asc' }, { timeOfDay: 'asc' }, { sequenceNumber: 'asc' }],
                    include: { foodItems: { orderBy: [{ optionGroup: 'asc' }, { sortOrder: 'asc' }], include: { foodItem: true } } },
                },
            },
        });

        if (!dietPlan) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');
        return dietPlan;
    }

    async listPlans(orgId: string, query: DietPlanListQuery, userRole: string = 'owner', userId: string = '') {
        const { clientId, status, isTemplate } = query;
        const pagination = buildPaginationParams(query.page, query.pageSize);

        const where: Prisma.DietPlanWhereInput = { orgId, isActive: true };
        if (clientId) where.clientId = clientId;
        if (status) where.status = status as Prisma.EnumDietPlanStatusFilter;
        if (isTemplate !== undefined) where.isTemplate = isTemplate === 'true';

        // Defensive filter: when callers ask for status='active' on real plans
        // (not templates), drop rows whose endDate has already passed. The
        // plan-expiry worker eventually demotes them to 'completed', but this
        // closes the gap between the cutoff and the next worker run.
        if (status === 'active' && isTemplate !== 'true') {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            where.OR = [
                { endDate: { gte: todayStart } },
                { endDate: null },
            ];
        }

        // Dietitians see: their assigned clients' plans + org templates they created OR that are published
        if (userRole === 'dietitian') {
            if (isTemplate === 'true') {
                // Templates: show own drafts + all published templates in the org
                where.OR = [
                    { creator: { id: userId } },
                    { status: 'active' },
                ];
            } else {
                // Client plans: only for their assigned clients
                where.client = { primaryDietitianId: userId };
            }
        }

        const [plans, total] = await prisma.$transaction([
            prisma.dietPlan.findMany({
                where,
                skip: pagination.skip,
                take: pagination.take,
                orderBy: { createdAt: 'desc' },
                include: {
                    client: { select: { id: true, fullName: true } },
                    creator: { select: { id: true, fullName: true } },
                    _count: { select: { meals: { where: { deletedAt: null } } } },
                    ...(isTemplate === 'true' && {
                        meals: { where: { deletedAt: null }, select: { name: true, dayOfWeek: true }, orderBy: [{ dayOfWeek: 'asc' }, { createdAt: 'asc' }] },
                    }),
                },
            }),
            prisma.dietPlan.count({ where }),
        ]);

        return {
            plans: plans.map((p) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const meals = (p as any).meals as { name: string; dayOfWeek: number | null }[] | undefined;
                const uniqueDays = meals ? new Set(meals.map(m => m.dayOfWeek ?? 0)).size : 0;
                const day0Names = meals ? meals.filter(m => (m.dayOfWeek ?? 0) === 0).map(m => m.name) : [];
                return { ...p, mealCount: p._count.meals, numDays: uniqueDays || undefined, day0MealNames: day0Names.length ? day0Names : undefined };
            }),
            meta: buildPaginationMeta(total, pagination),
        };
    }

    async updatePlan(planId: string, data: UpdateDietPlanInput, orgId: string) {
        const existing = await prisma.dietPlan.findFirst({ where: { id: planId, orgId, isActive: true } });
        if (!existing) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');

        // Explicit validation for required fields
        if (data.name !== undefined && data.name.trim() === '') {
            throw AppError.badRequest('Plan name cannot be empty', 'INVALID_PLAN_NAME');
        }
        if (data.startDate !== undefined && !data.startDate) {
            throw AppError.badRequest('Start date cannot be empty', 'INVALID_START_DATE');
        }

        // Consistent !== undefined guard for all fields
        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
        if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
        if (data.targetCalories !== undefined) updateData.targetCalories = data.targetCalories;
        if (data.targetProteinG !== undefined) updateData.targetProteinG = data.targetProteinG;
        if (data.targetCarbsG !== undefined) updateData.targetCarbsG = data.targetCarbsG;
        if (data.targetFatsG !== undefined) updateData.targetFatsG = data.targetFatsG;
        if (data.targetFiberG !== undefined) updateData.targetFiberG = data.targetFiberG;
        if (data.notesForClient !== undefined) updateData.notesForClient = data.notesForClient;
        if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;
        if (data.dayNotes !== undefined) updateData.dayNotes = normalizeDayNotes(data.dayNotes) ?? Prisma.JsonNull;
        if (data.hideCaloriesFromClient !== undefined) updateData.hideCaloriesFromClient = data.hideCaloriesFromClient;

        // If meals are provided, replace all existing meals atomically
        if (data.meals?.length) {
            const updated = await prisma.$transaction(async (tx) => {
                // Delete existing meals and their food items
                const existingMeals = await tx.meal.findMany({ where: { dietPlan: { id: planId } }, select: { id: true } });
                if (existingMeals.length > 0) {
                    await tx.mealFoodItem.deleteMany({ where: { mealId: { in: existingMeals.map(m => m.id) } } });
                    await tx.meal.deleteMany({ where: { dietPlan: { id: planId } } });
                }

                // Create new meals
                for (let i = 0; i < data.meals!.length; i++) {
                    const meal = data.meals![i];
                    await tx.meal.create({
                        data: {
                            dietPlan: { connect: { id: planId } },
                            dayOfWeek: meal.dayOfWeek,
                            mealDate: meal.mealDate ? new Date(meal.mealDate) : null,
                            sequenceNumber: i,
                            mealType: meal.mealType,
                            timeOfDay: meal.timeOfDay,
                            name: meal.name,
                            description: meal.description,
                            instructions: meal.instructions,
                            foodItems: meal.foodItems?.length ? {
                                create: meal.foodItems.map((fi, j) => ({
                                    foodId: fi.foodId,
                                    quantityG: fi.quantityG,
                                    notes: fi.notes,
                                    sortOrder: j,
                                    optionGroup: fi.optionGroup ?? 0,
                                    optionLabel: fi.optionLabel,
                                })),
                            } : undefined,
                        },
                    });
                }

                return tx.dietPlan.update({
                    where: { id: planId },
                    data: updateData,
                });
            });

            logger.info('Diet plan updated with meals', { planId: updated.id, mealCount: data.meals!.length });
            return updated;
        }

        const updated = await prisma.dietPlan.update({
            where: { id: planId },
            data: updateData,
        });

        logger.info('Diet plan updated', { planId: updated.id });
        return updated;
    }

    async publishPlan(planId: string, orgId: string, overlapStrategy: 'overwrite' | 'end_previous' | 'update' = 'overwrite') {
        const plan = await prisma.dietPlan.findFirst({
            where: { id: planId, orgId },
            include: {
                meals: true,
                client: { select: { id: true } },
            },
        });

        if (!plan) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');
        if (!plan.clientId) throw AppError.badRequest('Cannot publish a template');

        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const newPlanStart = new Date(plan.startDate);
        newPlanStart.setUTCHours(0, 0, 0, 0);
        const cutoffDate = newPlanStart > today ? newPlanStart : today;

        // Build meal logs
        const mealLogsToCreate: {
            orgId: string;
            clientId: string;
            mealId: string;
            scheduledDate: Date;
            scheduledTime: string | null;
            status: MealLogStatus;
        }[] = [];

        const hasDateBasedMeals = plan.meals.some((m) => m.mealDate !== null);

        if (hasDateBasedMeals) {
            for (const meal of plan.meals) {
                if (!meal.mealDate) continue;
                mealLogsToCreate.push({
                    orgId: plan.orgId,
                    clientId: plan.clientId!,
                    mealId: meal.id,
                    scheduledDate: new Date(meal.mealDate),
                    scheduledTime: meal.timeOfDay,
                    status: MealLogStatus.pending,
                });
            }
        } else {
            const startDate = new Date(plan.startDate);
            const endDate = plan.endDate ? new Date(plan.endDate) : new Date(startDate);
            if (!plan.endDate) {
                endDate.setDate(endDate.getDate() + 6);
            }

            const currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                const dayOfWeek = (currentDate.getDay() + 6) % 7;
                const todaysMeals = plan.meals.filter(
                    (m) => m.dayOfWeek === dayOfWeek || m.dayOfWeek === null
                );
                for (const meal of todaysMeals) {
                    mealLogsToCreate.push({
                        orgId: plan.orgId,
                        clientId: plan.clientId!,
                        mealId: meal.id,
                        scheduledDate: new Date(currentDate),
                        scheduledTime: meal.timeOfDay,
                        status: MealLogStatus.pending,
                    });
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        // Single transaction: overlap handling + activate plan + create all meal logs
        const newPlanEnd = plan.endDate ? new Date(plan.endDate) : new Date(newPlanStart);
        if (!plan.endDate) newPlanEnd.setDate(newPlanEnd.getDate() + 6);
        newPlanEnd.setUTCHours(23, 59, 59, 999);

        await prisma.$transaction(async (tx) => {
            // Only find plans whose date range actually overlaps with the new plan
            const oldActivePlans = await tx.dietPlan.findMany({
                where: {
                    clientId: plan.clientId!,
                    isActive: true,
                    id: { not: planId },
                    // Overlap: oldStart <= newEnd AND oldEnd >= newStart (or oldEnd is null)
                    startDate: { lte: newPlanEnd },
                    OR: [
                        { endDate: { gte: newPlanStart } },
                        { endDate: null },
                    ],
                },
                select: { id: true, meals: { select: { id: true } } },
            });

            if (oldActivePlans.length > 0) {
                const oldPlanIds = oldActivePlans.map(p => p.id);
                const oldMealIds = oldActivePlans.flatMap(p => p.meals.map(m => m.id));

                if (overlapStrategy === 'overwrite') {
                    // Delete pending logs from overlap date range, deactivate overlapping plans
                    if (oldMealIds.length > 0) {
                        await tx.mealLog.deleteMany({
                            where: {
                                mealId: { in: oldMealIds },
                                scheduledDate: { gte: cutoffDate },
                                status: MealLogStatus.pending,
                            },
                        });
                    }
                    await tx.dietPlan.updateMany({
                        where: { id: { in: oldPlanIds } },
                        data: { isActive: false, status: 'completed' },
                    });
                } else if (overlapStrategy === 'end_previous' || overlapStrategy === 'update') {
                    // End overlapping plans the day before new plan starts
                    const dayBefore = new Date(newPlanStart);
                    dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
                    if (oldMealIds.length > 0) {
                        await tx.mealLog.deleteMany({
                            where: {
                                mealId: { in: oldMealIds },
                                scheduledDate: { gte: newPlanStart },
                                status: MealLogStatus.pending,
                            },
                        });
                    }
                    await tx.dietPlan.updateMany({
                        where: { id: { in: oldPlanIds } },
                        data: { endDate: dayBefore, status: 'completed' },
                    });
                }

                logger.info('Handled overlap with old plan(s)', {
                    strategy: overlapStrategy,
                    oldPlanIds,
                });
            }

            // Activate this plan
            await tx.dietPlan.update({
                where: { id: planId },
                data: { status: 'active', publishedAt: new Date() },
            });

            // Create meal logs in one statement — skip any that already exist
            if (mealLogsToCreate.length > 0) {
                await tx.mealLog.createMany({
                    data: mealLogsToCreate,
                    skipDuplicates: true,
                });
            }
        }, { timeout: 15000 });

        logger.info('Diet plan published with meal logs', {
            planId,
            mealLogsCreated: mealLogsToCreate.length,
        });

        const clientId = plan.clientId!;
        const publishedAt = new Date();

        invalidateClientCache(clientId);

        try {
            getIO().to(`client:${clientId}`).emit('plan:published', { planId, planName: plan.name });
        } catch (err) {
            logger.warn('Socket emit for plan:published failed', { err });
        }

        notificationService.sendNotification(
            clientId,
            'client',
            plan.orgId,
            'Your diet plan is ready!',
            `"${plan.name}" has been published by your dietitian.`,
            { entityType: 'diet_plan', entityId: planId },
            'diet_plan'
        ).catch(err => logger.warn('Push notification for plan publish failed', { err }));

        return {
            planId,
            status: 'active',
            publishedAt,
            mealLogsCreated: mealLogsToCreate.length,
        };
    }

    async assignTemplateToClient(templateId: string, body: AssignTemplateInput, orgId: string, userId: string) {
        const { clientId, startDate, name } = body;

        const template = await prisma.dietPlan.findFirst({
            where: { id: templateId, orgId, isTemplate: true, isActive: true },
            include: { meals: { include: { foodItems: true } } },
        });

        if (!template) throw AppError.notFound('Template not found', 'TEMPLATE_NOT_FOUND');

        const client = await prisma.client.findFirst({ where: { id: clientId, orgId } });
        if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

        // Map template's relative dayOfWeek to actual mealDate values
        const planStartDate = new Date(startDate);
        const maxDayOfWeek = template.meals.reduce((max, m) => Math.max(max, m.dayOfWeek ?? 0), 0);
        const planEndDate = new Date(planStartDate);
        planEndDate.setDate(planEndDate.getDate() + maxDayOfWeek);

        const newPlan = await prisma.dietPlan.create({
            data: {
                organization: { connect: { id: orgId } },
                client: { connect: { id: clientId } },
                creator: { connect: { id: userId } },
                name: name || `${template.name} - ${client.fullName}`,
                description: template.description,
                startDate: planStartDate,
                endDate: planEndDate,
                targetCalories: template.targetCalories,
                targetProteinG: template.targetProteinG,
                targetCarbsG: template.targetCarbsG,
                targetFatsG: template.targetFatsG,
                targetFiberG: template.targetFiberG,
                notesForClient: template.notesForClient,
                internalNotes: template.internalNotes,
                dayNotes: template.dayNotes ?? Prisma.JsonNull,
                status: 'draft',
                isTemplate: false,
                meals: {
                    create: template.meals.map((meal, index) => {
                        // Convert relative dayOfWeek to specific mealDate
                        const mealDate = new Date(planStartDate);
                        mealDate.setDate(mealDate.getDate() + (meal.dayOfWeek ?? 0));
                        return {
                            dayOfWeek: null,
                            mealDate,
                            sequenceNumber: meal.sequenceNumber ?? index,
                            mealType: meal.mealType,
                            timeOfDay: meal.timeOfDay,
                            name: meal.name,
                            description: meal.description,
                            instructions: meal.instructions,
                            servingSizeNotes: meal.servingSizeNotes,
                            foodItems: meal.foodItems.length
                                ? {
                                      create: meal.foodItems.map((item, sortOrder) => ({
                                          foodId: item.foodId,
                                          quantityG: item.quantityG,
                                          notes: item.notes,
                                          sortOrder: item.sortOrder ?? sortOrder,
                                          optionGroup: item.optionGroup,
                                          optionLabel: item.optionLabel,
                                      })),
                                  }
                                : undefined,
                        };
                    }),
                },
            },
            include: {
                client: { select: { id: true, fullName: true } },
                creator: { select: { id: true, fullName: true } },
                meals: { include: { foodItems: { orderBy: [{ optionGroup: 'asc' }, { sortOrder: 'asc' }], include: { foodItem: true } } } },
            },
        });

        logger.info('Template assigned to client', { templateId, newPlanId: newPlan.id, clientId });
        return newPlan;
    }

    async deletePlan(planId: string, orgId: string) {
        const plan = await prisma.dietPlan.findFirst({
            where: { id: planId, orgId, isActive: true },
            include: { meals: { select: { id: true } } },
        });

        if (!plan) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');

        const mealIds = plan.meals.map(m => m.id);

        await prisma.$transaction(async (tx) => {
            // Cancel pending meal logs
            if (mealIds.length > 0) {
                await tx.mealLog.deleteMany({
                    where: {
                        mealId: { in: mealIds },
                        status: 'pending' as any,
                    },
                });
            }

            // Soft delete the plan
            await tx.dietPlan.update({
                where: { id: planId },
                data: { deletedAt: new Date(), isActive: false },
            });
        });

        logger.info('Diet plan deleted', { planId });
        return { planId, deleted: true };
    }

    async getClientActiveRange(clientId: string, orgId: string) {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);

        const plans = await prisma.dietPlan.findMany({
            where: {
                clientId,
                orgId,
                isTemplate: false,
                deletedAt: null,
                status: { in: ['active', 'draft', 'completed'] },
                OR: [
                    { endDate: { gte: today } },
                    { endDate: null },
                ],
            },
            select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                status: true,
                targetCalories: true,
                _count: { select: { meals: true } },
            },
            orderBy: { startDate: 'desc' },
        });

        return plans.map(p => ({
            id: p.id,
            name: p.name,
            startDate: p.startDate,
            endDate: p.endDate,
            status: p.status,
            targetCalories: p.targetCalories,
            mealCount: p._count.meals,
        }));
    }

    async getClientPreviousPlan(clientId: string, orgId: string, excludeId?: string) {
        return prisma.dietPlan.findFirst({
            where: {
                clientId,
                orgId,
                isTemplate: false,
                deletedAt: null,
                status: { in: ['active', 'completed'] },
                ...(excludeId ? { id: { not: excludeId } } : {}),
            },
            orderBy: { startDate: 'desc' },
            select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
                status: true,
                meals: {
                    orderBy: [{ mealDate: 'asc' }, { dayOfWeek: 'asc' }, { sequenceNumber: 'asc' }],
                    select: {
                        id: true,
                        name: true,
                        mealType: true,
                        dayOfWeek: true,
                        mealDate: true,
                        sequenceNumber: true,
                        foodItems: {
                            where: { optionGroup: 0 },
                            orderBy: { sortOrder: 'asc' },
                            select: {
                                id: true,
                                quantityG: true,
                                notes: true,
                                foodItem: { select: { id: true, name: true, calories: true, proteinG: true, carbsG: true, fatsG: true } },
                            },
                        },
                    },
                },
            },
        });
    }

    async extendPlan(planId: string, orgId: string, extensionStartDate: string) {
        const plan = await prisma.dietPlan.findFirst({
            where: { id: planId, orgId, isActive: true },
            include: {
                meals: {
                    orderBy: [{ mealDate: 'asc' }, { dayOfWeek: 'asc' }, { sequenceNumber: 'asc' }],
                    include: { foodItems: { orderBy: [{ optionGroup: 'asc' }, { sortOrder: 'asc' }] } },
                },
                client: { select: { id: true } },
            },
        });

        if (!plan) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');
        if (!plan.clientId) throw AppError.badRequest('Cannot extend a template');
        if (plan.meals.length === 0) throw AppError.badRequest('Plan has no meals to extend');

        // Build a sorted list of unique source dates (day 1, day 2, …)
        const planStart = new Date(plan.startDate);
        const sourceDates = Array.from(
            new Set(
                plan.meals.map(m => {
                    const d = m.mealDate ? new Date(m.mealDate) : (() => {
                        const base = new Date(planStart);
                        base.setUTCDate(base.getUTCDate() + (m.dayOfWeek ?? 0));
                        return base;
                    })();
                    d.setUTCHours(0, 0, 0, 0);
                    return d.toISOString().slice(0, 10);
                })
            )
        ).sort();

        const extStart = new Date(extensionStartDate);
        extStart.setUTCHours(0, 0, 0, 0);

        // Map each source date → new extension date
        const dateMapping = new Map<string, Date>();
        sourceDates.forEach((srcKey, i) => {
            const newDate = new Date(extStart);
            newDate.setUTCDate(newDate.getUTCDate() + i);
            dateMapping.set(srcKey, newDate);
        });

        const newEndDate = new Date(extStart);
        newEndDate.setUTCDate(newEndDate.getUTCDate() + sourceDates.length - 1);

        // Clone meals with new dates
        const newMealLogs: { orgId: string; clientId: string; mealId: string; scheduledDate: Date; scheduledTime: string | null; status: MealLogStatus }[] = [];

        await prisma.$transaction(async (tx) => {
            for (const meal of plan.meals) {
                const srcDate = meal.mealDate ? new Date(meal.mealDate) : (() => {
                    const base = new Date(planStart);
                    base.setUTCDate(base.getUTCDate() + (meal.dayOfWeek ?? 0));
                    return base;
                })();
                srcDate.setUTCHours(0, 0, 0, 0);
                const newMealDate = dateMapping.get(srcDate.toISOString().slice(0, 10));
                if (!newMealDate) continue;

                const newMeal = await tx.meal.create({
                    data: {
                        dietPlan: { connect: { id: planId } },
                        mealDate: newMealDate,
                        dayOfWeek: null,
                        sequenceNumber: meal.sequenceNumber,
                        mealType: meal.mealType,
                        timeOfDay: meal.timeOfDay,
                        name: meal.name,
                        description: meal.description,
                        instructions: meal.instructions,
                        servingSizeNotes: meal.servingSizeNotes,
                        foodItems: meal.foodItems.length ? {
                            create: meal.foodItems.map(fi => ({
                                foodId: fi.foodId,
                                quantityG: fi.quantityG,
                                notes: fi.notes,
                                sortOrder: fi.sortOrder,
                                optionGroup: fi.optionGroup,
                                optionLabel: fi.optionLabel,
                            })),
                        } : undefined,
                    },
                });

                newMealLogs.push({
                    orgId: plan.orgId,
                    clientId: plan.clientId!,
                    mealId: newMeal.id,
                    scheduledDate: newMealDate,
                    scheduledTime: meal.timeOfDay,
                    status: MealLogStatus.pending,
                });
            }

            // Extend the plan's end date
            await tx.dietPlan.update({
                where: { id: planId },
                data: { endDate: newEndDate },
            });
        });

        if (newMealLogs.length > 0) {
            await prisma.mealLog.createMany({
                data: newMealLogs,
                skipDuplicates: true,
            });
        }

        invalidateClientCache(plan.clientId!);

        try {
            getIO().to(`client:${plan.clientId}`).emit('plan:published', { planId, planName: plan.name });
        } catch (err) {
            logger.warn('Socket emit for plan:extended failed', { err });
        }

        logger.info('Diet plan extended', { planId, extensionStartDate, daysAdded: sourceDates.length, newEndDate });
        return { planId, extensionStartDate, daysAdded: sourceDates.length, newEndDate };
    }
}

export const dietPlanService = new DietPlanService();

