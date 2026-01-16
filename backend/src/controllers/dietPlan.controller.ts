import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { CreateDietPlanInput, UpdateDietPlanInput } from '../schemas/dietPlan.schema';

export const createDietPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const data: CreateDietPlanInput = req.body;
    const isTemplate = data.options?.saveAsTemplate || false;

    // For templates, clientId is optional. For regular plans, it's required.
    let clientId = data.clientId;
    if (!isTemplate) {
        if (!clientId) {
            throw AppError.badRequest('clientId is required for non-template diet plans', 'CLIENT_ID_REQUIRED');
        }
        const client = await prisma.client.findFirst({
            where: { id: clientId, orgId: req.user.organizationId }
        });
        if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');
    }

    // For templates, we need a placeholder client or null clientId
    // Since schema requires clientId, we'll use a special approach:
    // For now, templates still need a clientId but we mark them as templates
    // A cleaner approach would be to make clientId nullable in schema

    const dietPlan = await prisma.dietPlan.create({
        data: {
            organization: { connect: { id: req.user.organizationId } },
            client: clientId ? { connect: { id: clientId } } : undefined,
            creator: { connect: { id: req.user.id } },
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
            isTemplate: isTemplate,
            templateCategory: data.options?.templateCategory,
            meals: data.meals?.length ? {
                create: data.meals.map((meal: any, index: number) => ({
                    dayOfWeek: meal.dayIndex,
                    mealDate: meal.mealDate ? new Date(meal.mealDate) : null,
                    sequenceNumber: index,
                    mealType: meal.mealType,
                    timeOfDay: meal.timeOfDay,
                    name: meal.title,
                    description: meal.description,
                    instructions: meal.instructions,
                    foodItems: meal.foodItems?.length ? {
                        create: meal.foodItems.map((item: any, sortOrder: number) => ({
                            foodId: item.foodId,
                            quantityG: item.quantity,
                            notes: item.notes,
                            sortOrder
                        }))
                    } : undefined
                }))
            } : undefined
        },
        include: {
            client: { select: { id: true, fullName: true } },
            creator: { select: { id: true, fullName: true } },
            meals: { include: { foodItems: { include: { foodItem: true } } } }
        }
    });

    logger.info(isTemplate ? 'Diet plan template created' : 'Diet plan created', { planId: dietPlan.id, clientId });
    res.status(201).json({ success: true, data: dietPlan });
});

export const getDietPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const dietPlan = await prisma.dietPlan.findFirst({
        where: { id: req.params.id, orgId: req.user.organizationId, isActive: true },
        include: {
            client: { select: { id: true, fullName: true, currentWeightKg: true, targetWeightKg: true } },
            creator: { select: { id: true, fullName: true } },
            meals: {
                orderBy: [{ dayOfWeek: 'asc' }, { sequenceNumber: 'asc' }],
                include: { foodItems: { orderBy: { sortOrder: 'asc' }, include: { foodItem: true } } }
            }
        }
    });

    if (!dietPlan) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');

    res.status(200).json({ success: true, data: dietPlan });
});

export const listDietPlans = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId, status, isTemplate, page = '1', pageSize = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const where: any = { orgId: req.user.organizationId, isActive: true };
    if (clientId) where.clientId = String(clientId);
    if (status) where.status = String(status);
    if (isTemplate !== undefined) where.isTemplate = isTemplate === 'true';

    const [plans, total] = await prisma.$transaction([
        prisma.dietPlan.findMany({
            where, skip, take,
            orderBy: { createdAt: 'desc' },
            include: {
                client: { select: { id: true, fullName: true } },
                creator: { select: { id: true, fullName: true } },
                _count: { select: { meals: true } }
            }
        }),
        prisma.dietPlan.count({ where })
    ]);

    res.status(200).json({
        success: true,
        data: plans.map(p => ({ ...p, mealCount: p._count.meals })),
        meta: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) }
    });
});

export const updateDietPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const data: UpdateDietPlanInput = req.body;

    const existing = await prisma.dietPlan.findFirst({
        where: { id: req.params.id, orgId: req.user.organizationId }
    });

    if (!existing) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');

    const updated = await prisma.dietPlan.update({
        where: { id: req.params.id },
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
            ...(data.internalNotes !== undefined && { internalNotes: data.internalNotes })
        }
    });

    logger.info('Diet plan updated', { planId: updated.id });
    res.status(200).json({ success: true, data: updated });
});

export const publishDietPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const plan = await prisma.dietPlan.findFirst({
        where: { id: req.params.id, orgId: req.user.organizationId },
        include: { meals: true }
    });

    if (!plan) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');

    const updated = await prisma.dietPlan.update({
        where: { id: req.params.id },
        data: { status: 'active', publishedAt: new Date() }
    });

    logger.info('Diet plan published', { planId: updated.id });
    res.status(200).json({
        success: true,
        data: { planId: updated.id, status: updated.status, publishedAt: updated.publishedAt, mealLogsCreated: plan.meals.length }
    });
});

// Assign a template to a client (clone template to create a new plan)
export const assignTemplateToClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const templateId = req.params.id;
    const { clientId, startDate, name } = req.body;

    if (!clientId) throw AppError.badRequest('clientId is required', 'CLIENT_ID_REQUIRED');
    if (!startDate) throw AppError.badRequest('startDate is required', 'START_DATE_REQUIRED');

    // Verify template exists and is actually a template
    const template = await prisma.dietPlan.findFirst({
        where: { id: templateId, orgId: req.user.organizationId, isTemplate: true, isActive: true },
        include: {
            meals: {
                include: { foodItems: true }
            }
        }
    });

    if (!template) throw AppError.notFound('Template not found', 'TEMPLATE_NOT_FOUND');

    // Verify client exists
    const client = await prisma.client.findFirst({
        where: { id: clientId, orgId: req.user.organizationId }
    });

    if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

    // Create new diet plan based on template
    const newPlan = await prisma.dietPlan.create({
        data: {
            organization: { connect: { id: req.user.organizationId } },
            client: { connect: { id: clientId } },
            creator: { connect: { id: req.user.id } },
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
            isTemplate: false, // This is a real plan, not a template
            meals: {
                create: template.meals.map((meal, index) => ({
                    dayOfWeek: meal.dayOfWeek,
                    mealDate: null, // Will be set based on startDate later
                    sequenceNumber: meal.sequenceNumber ?? index,
                    mealType: meal.mealType,
                    timeOfDay: meal.timeOfDay,
                    name: meal.name,
                    description: meal.description,
                    instructions: meal.instructions,
                    servingSizeNotes: meal.servingSizeNotes,
                    foodItems: meal.foodItems.length ? {
                        create: meal.foodItems.map((item, sortOrder) => ({
                            foodId: item.foodId,
                            quantityG: item.quantityG,
                            notes: item.notes,
                            sortOrder: item.sortOrder ?? sortOrder
                        }))
                    } : undefined
                }))
            }
        },
        include: {
            client: { select: { id: true, fullName: true } },
            creator: { select: { id: true, fullName: true } },
            meals: { include: { foodItems: { include: { foodItem: true } } } }
        }
    });

    logger.info('Template assigned to client', { templateId, newPlanId: newPlan.id, clientId });
    res.status(201).json({ success: true, data: newPlan });
});
