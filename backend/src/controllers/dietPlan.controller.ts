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

    const client = await prisma.client.findFirst({
        where: { id: data.clientId, orgId: req.user.organizationId }
    });

    if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

    const dietPlan = await prisma.dietPlan.create({
        data: {
            orgId: req.user.organizationId,
            clientId: data.clientId,
            createdByUserId: req.user.id,
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
            isTemplate: data.options?.saveAsTemplate || false,
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
        } as any,
        include: {
            client: { select: { id: true, fullName: true } },
            creator: { select: { id: true, fullName: true } },
            meals: { include: { foodItems: { include: { foodItem: true } } } }
        }
    });

    logger.info('Diet plan created', { planId: dietPlan.id, clientId: data.clientId });
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

    const { clientId, status, page = '1', pageSize = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const where: any = { orgId: req.user.organizationId, isActive: true };
    if (clientId) where.clientId = String(clientId);
    if (status) where.status = String(status);

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
