import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

export const addMealToPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { planId, dayIndex, mealDate, mealType, timeOfDay, title, description, instructions, foodItems } = req.body;

    if (!planId || !mealType || !title) {
        throw AppError.badRequest('planId, mealType, and title are required', 'MISSING_FIELDS');
    }

    const plan = await prisma.dietPlan.findFirst({
        where: { id: planId, orgId: req.user.organizationId }
    });

    if (!plan) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');

    const meal = await prisma.meal.create({
        data: {
            planId,
            dayOfWeek: dayIndex,
            mealDate: mealDate ? new Date(mealDate) : null,
            mealType,
            timeOfDay,
            name: title,
            description,
            instructions,
            foodItems: foodItems?.length ? {
                create: foodItems.map((item: any, sortOrder: number) => ({
                    foodId: item.foodId,
                    quantityG: item.quantity,
                    notes: item.notes,
                    sortOrder
                }))
            } : undefined
        },
        include: { foodItems: { include: { foodItem: true } } }
    });

    logger.info('Meal added to plan', { mealId: meal.id, planId });
    res.status(201).json({ success: true, data: meal });
});

export const updateMeal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { title, description, instructions, timeOfDay } = req.body;

    const meal = await prisma.meal.findUnique({
        where: { id: req.params.id },
        include: { dietPlan: true }
    });

    if (!meal || meal.dietPlan.orgId !== req.user.organizationId) {
        throw AppError.notFound('Meal not found', 'MEAL_NOT_FOUND');
    }

    const updated = await prisma.meal.update({
        where: { id: req.params.id },
        data: {
            ...(title && { name: title }),
            ...(description !== undefined && { description }),
            ...(instructions !== undefined && { instructions }),
            ...(timeOfDay !== undefined && { timeOfDay })
        }
    });

    logger.info('Meal updated', { mealId: updated.id });
    res.status(200).json({ success: true, data: updated });
});

export const deleteMeal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const meal = await prisma.meal.findUnique({
        where: { id: req.params.id },
        include: { dietPlan: true }
    });

    if (!meal || meal.dietPlan.orgId !== req.user.organizationId) {
        throw AppError.notFound('Meal not found', 'MEAL_NOT_FOUND');
    }

    await prisma.meal.delete({ where: { id: req.params.id } });

    logger.info('Meal deleted', { mealId: req.params.id });
    res.status(204).send();
});
