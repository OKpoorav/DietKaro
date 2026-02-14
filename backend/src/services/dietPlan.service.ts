import prisma from '../utils/prisma';
import { Prisma, MealLogStatus } from '@prisma/client';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';
import { buildPaginationParams, buildPaginationMeta } from '../utils/queryFilters';
import type { CreateDietPlanInput, UpdateDietPlanInput, DietPlanListQuery, AssignTemplateInput } from '../schemas/dietPlan.schema';

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
                if (maxDow > 0) {
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
                startDate: new Date(data.startDate),
                endDate,
                targetCalories: data.targetCalories,
                targetProteinG: data.targetProteinG,
                targetCarbsG: data.targetCarbsG,
                targetFatsG: data.targetFatsG,
                targetFiberG: data.targetFiberG,
                notesForClient: data.notesForClient,
                internalNotes: data.internalNotes,
                status: 'draft',
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
            include: {
                client: { select: { id: true, fullName: true } },
                creator: { select: { id: true, fullName: true } },
                meals: { include: { foodItems: { orderBy: [{ optionGroup: 'asc' }, { sortOrder: 'asc' }], include: { foodItem: true } } } },
            },
        });

        logger.info(isTemplate ? 'Diet plan template created' : 'Diet plan created', { planId: dietPlan.id, clientId });
        return dietPlan;
    }

    async getPlan(planId: string, orgId: string) {
        const dietPlan = await prisma.dietPlan.findFirst({
            where: { id: planId, orgId, isActive: true },
            include: {
                client: { select: { id: true, fullName: true, currentWeightKg: true, targetWeightKg: true } },
                creator: { select: { id: true, fullName: true } },
                meals: {
                    orderBy: [{ dayOfWeek: 'asc' }, { sequenceNumber: 'asc' }],
                    include: { foodItems: { orderBy: [{ optionGroup: 'asc' }, { sortOrder: 'asc' }], include: { foodItem: true } } },
                },
            },
        });

        if (!dietPlan) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');
        return dietPlan;
    }

    async listPlans(orgId: string, query: DietPlanListQuery) {
        const { clientId, status, isTemplate } = query;
        const pagination = buildPaginationParams(query.page, query.pageSize);

        const where: Prisma.DietPlanWhereInput = { orgId, isActive: true };
        if (clientId) where.clientId = clientId;
        if (status) where.status = status as Prisma.EnumDietPlanStatusFilter;
        if (isTemplate !== undefined) where.isTemplate = isTemplate === 'true';

        const [plans, total] = await prisma.$transaction([
            prisma.dietPlan.findMany({
                where,
                skip: pagination.skip,
                take: pagination.take,
                orderBy: { createdAt: 'desc' },
                include: {
                    client: { select: { id: true, fullName: true } },
                    creator: { select: { id: true, fullName: true } },
                    _count: { select: { meals: true } },
                },
            }),
            prisma.dietPlan.count({ where }),
        ]);

        return {
            plans: plans.map((p) => ({ ...p, mealCount: p._count.meals })),
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

        const updated = await prisma.dietPlan.update({
            where: { id: planId },
            data: updateData,
        });

        logger.info('Diet plan updated', { planId: updated.id });
        return updated;
    }

    async publishPlan(planId: string, orgId: string) {
        const plan = await prisma.dietPlan.findFirst({
            where: { id: planId, orgId },
            include: {
                meals: true,
                client: { select: { id: true } },
            },
        });

        if (!plan) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');
        if (!plan.clientId) throw AppError.badRequest('Cannot publish a template');

        // Build meal logs
        const mealLogsToCreate: {
            orgId: string;
            clientId: string;
            mealId: string;
            scheduledDate: Date;
            scheduledTime: string | null;
            status: MealLogStatus;
        }[] = [];

        // Check if meals use mealDate (date-based plan) vs dayOfWeek (legacy)
        const hasDateBasedMeals = plan.meals.some((m) => m.mealDate !== null);

        if (hasDateBasedMeals) {
            // Date-based path: each meal has a specific mealDate
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
            // Legacy dayOfWeek path: iterate date range and match meals by dayOfWeek
            const startDate = new Date(plan.startDate);
            const endDate = plan.endDate ? new Date(plan.endDate) : new Date(startDate);
            if (!plan.endDate) {
                endDate.setDate(endDate.getDate() + 6); // Default to 7 days
            }

            const currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                const dayOfWeek = (currentDate.getDay() + 6) % 7; // Monday = 0

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

        // Batch create with conflict handling
        await prisma.$transaction([
            prisma.dietPlan.update({
                where: { id: planId },
                data: { status: 'active', publishedAt: new Date() },
            }),
            ...mealLogsToCreate.map((log) =>
                prisma.mealLog.upsert({
                    where: {
                        clientId_mealId_scheduledDate: {
                            clientId: log.clientId,
                            mealId: log.mealId,
                            scheduledDate: log.scheduledDate,
                        },
                    },
                    create: log,
                    update: {},
                })
            ),
        ]);

        logger.info('Diet plan published with meal logs', {
            planId,
            mealLogsCreated: mealLogsToCreate.length,
        });

        return {
            planId,
            status: 'active',
            publishedAt: new Date(),
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
}

export const dietPlanService = new DietPlanService();
