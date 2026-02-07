import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';
import { buildPaginationParams, buildPaginationMeta } from '../utils/queryFilters';
import { CreateDietPlanInput, UpdateDietPlanInput } from '../schemas/dietPlan.schema';

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

        const dietPlan = await prisma.dietPlan.create({
            data: {
                organization: { connect: { id: orgId } },
                client: clientId ? { connect: { id: clientId } } : undefined,
                creator: { connect: { id: userId } },
                name: data.name,
                description: data.description,
                startDate: new Date(data.startDate),
                endDate: data.endDate ? new Date(data.endDate) : null,
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
                          create: data.meals.map((meal: any, index: number) => ({
                              dayOfWeek: meal.dayIndex,
                              mealDate: meal.mealDate ? new Date(meal.mealDate) : null,
                              sequenceNumber: index,
                              mealType: meal.mealType,
                              timeOfDay: meal.timeOfDay,
                              name: meal.title,
                              description: meal.description,
                              instructions: meal.instructions,
                              foodItems: meal.foodItems?.length
                                  ? {
                                        create: meal.foodItems.map((item: any, sortOrder: number) => ({
                                            foodId: item.foodId,
                                            quantityG: item.quantity,
                                            notes: item.notes,
                                            sortOrder,
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
                meals: { include: { foodItems: { include: { foodItem: true } } } },
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
                    include: { foodItems: { orderBy: { sortOrder: 'asc' }, include: { foodItem: true } } },
                },
            },
        });

        if (!dietPlan) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');
        return dietPlan;
    }

    async listPlans(orgId: string, query: any) {
        const { clientId, status, isTemplate } = query;
        const pagination = buildPaginationParams(query.page, query.pageSize);

        const where: any = { orgId, isActive: true };
        if (clientId) where.clientId = String(clientId);
        if (status) where.status = String(status);
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
        const existing = await prisma.dietPlan.findFirst({ where: { id: planId, orgId } });
        if (!existing) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');

        const updated = await prisma.dietPlan.update({
            where: { id: planId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.startDate && { startDate: new Date(data.startDate) }),
                ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
                ...(data.targetCalories !== undefined && { targetCalories: data.targetCalories }),
                ...(data.targetProteinG !== undefined && { targetProteinG: data.targetProteinG }),
                ...(data.targetCarbsG !== undefined && { targetCarbsG: data.targetCarbsG }),
                ...(data.targetFatsG !== undefined && { targetFatsG: data.targetFatsG }),
                ...(data.targetFiberG !== undefined && { targetFiberG: data.targetFiberG }),
                ...(data.notesForClient !== undefined && { notesForClient: data.notesForClient }),
                ...(data.internalNotes !== undefined && { internalNotes: data.internalNotes }),
            },
        });

        logger.info('Diet plan updated', { planId: updated.id });
        return updated;
    }

    async publishPlan(planId: string, orgId: string) {
        const plan = await prisma.dietPlan.findFirst({
            where: { id: planId, orgId },
            include: { meals: true },
        });

        if (!plan) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');

        const updated = await prisma.dietPlan.update({
            where: { id: planId },
            data: { status: 'active', publishedAt: new Date() },
        });

        logger.info('Diet plan published', { planId: updated.id });
        return {
            planId: updated.id,
            status: updated.status,
            publishedAt: updated.publishedAt,
            mealLogsCreated: plan.meals.length,
        };
    }

    async assignTemplateToClient(templateId: string, body: any, orgId: string, userId: string) {
        const { clientId, startDate, name } = body;

        if (!clientId) throw AppError.badRequest('clientId is required', 'CLIENT_ID_REQUIRED');
        if (!startDate) throw AppError.badRequest('startDate is required', 'START_DATE_REQUIRED');

        const template = await prisma.dietPlan.findFirst({
            where: { id: templateId, orgId, isTemplate: true, isActive: true },
            include: { meals: { include: { foodItems: true } } },
        });

        if (!template) throw AppError.notFound('Template not found', 'TEMPLATE_NOT_FOUND');

        const client = await prisma.client.findFirst({ where: { id: clientId, orgId } });
        if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

        const newPlan = await prisma.dietPlan.create({
            data: {
                organization: { connect: { id: orgId } },
                client: { connect: { id: clientId } },
                creator: { connect: { id: userId } },
                name: name || `${template.name} - ${client.fullName}`,
                description: template.description,
                startDate: new Date(startDate),
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
                    create: template.meals.map((meal, index) => ({
                        dayOfWeek: meal.dayOfWeek,
                        mealDate: null,
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
                                  })),
                              }
                            : undefined,
                    })),
                },
            },
            include: {
                client: { select: { id: true, fullName: true } },
                creator: { select: { id: true, fullName: true } },
                meals: { include: { foodItems: { include: { foodItem: true } } } },
            },
        });

        logger.info('Template assigned to client', { templateId, newPlanId: newPlan.id, clientId });
        return newPlan;
    }
}

export const dietPlanService = new DietPlanService();
