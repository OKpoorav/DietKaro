import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';

export class MealService {
    async addMealToPlan(body: any, orgId: string) {
        const { planId, dayIndex, mealDate, mealType, timeOfDay, title, description, instructions, foodItems } = body;

        if (!planId || !mealType || !title) {
            throw AppError.badRequest('planId, mealType, and title are required', 'MISSING_FIELDS');
        }

        const plan = await prisma.dietPlan.findFirst({ where: { id: planId, orgId } });
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
                foodItems: foodItems?.length
                    ? {
                          create: foodItems.map((item: any, sortOrder: number) => ({
                              foodId: item.foodId,
                              quantityG: item.quantity,
                              notes: item.notes,
                              sortOrder,
                          })),
                      }
                    : undefined,
            },
            include: { foodItems: { include: { foodItem: true } } },
        });

        logger.info('Meal added to plan', { mealId: meal.id, planId });
        return meal;
    }

    async updateMeal(mealId: string, body: any, orgId: string) {
        const { title, description, instructions, timeOfDay } = body;

        const meal = await prisma.meal.findUnique({
            where: { id: mealId },
            include: { dietPlan: true },
        });

        if (!meal || meal.dietPlan.orgId !== orgId) {
            throw AppError.notFound('Meal not found', 'MEAL_NOT_FOUND');
        }

        const updated = await prisma.meal.update({
            where: { id: mealId },
            data: {
                ...(title && { name: title }),
                ...(description !== undefined && { description }),
                ...(instructions !== undefined && { instructions }),
                ...(timeOfDay !== undefined && { timeOfDay }),
            },
        });

        logger.info('Meal updated', { mealId: updated.id });
        return updated;
    }

    async deleteMeal(mealId: string, orgId: string) {
        const meal = await prisma.meal.findUnique({
            where: { id: mealId },
            include: { dietPlan: true },
        });

        if (!meal || meal.dietPlan.orgId !== orgId) {
            throw AppError.notFound('Meal not found', 'MEAL_NOT_FOUND');
        }

        await prisma.meal.delete({ where: { id: mealId } });
        logger.info('Meal deleted', { mealId });
    }
}

export const mealService = new MealService();
