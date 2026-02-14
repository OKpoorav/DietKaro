import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';
import { addMealSchema } from '../schemas/meal.schema';
import type { UpdateMealInput } from '../schemas/meal.schema';

export class MealService {
    async addMealToPlan(body: unknown, orgId: string) {
        const parseResult = addMealSchema.safeParse(body);
        if (!parseResult.success) {
            const messages = parseResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
            throw AppError.badRequest(`Validation failed: ${messages}`, 'VALIDATION_ERROR');
        }

        const { planId, dayOfWeek, mealDate, mealType, timeOfDay, name, description, instructions, foodItems } = parseResult.data;

        const plan = await prisma.dietPlan.findFirst({ where: { id: planId, orgId } });
        if (!plan) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');

        const meal = await prisma.meal.create({
            data: {
                planId,
                dayOfWeek: dayOfWeek ?? null,
                mealDate: mealDate ? new Date(mealDate) : null,
                mealType,
                timeOfDay: timeOfDay ?? null,
                name,
                description: description ?? null,
                instructions: instructions ?? null,
                foodItems: foodItems?.length
                    ? {
                          create: foodItems.map((item, sortOrder) => ({
                              foodId: item.foodId,
                              quantityG: item.quantityG,
                              notes: item.notes ?? null,
                              sortOrder,
                              optionGroup: item.optionGroup,
                              optionLabel: item.optionLabel ?? null,
                          })),
                      }
                    : undefined,
            },
            include: { foodItems: { orderBy: [{ optionGroup: 'asc' }, { sortOrder: 'asc' }], include: { foodItem: true } } },
        });

        logger.info('Meal added to plan', { mealId: meal.id, planId });
        return meal;
    }

    async updateMeal(mealId: string, body: UpdateMealInput, orgId: string) {
        const { name, description, instructions, timeOfDay } = body;

        const meal = await prisma.meal.findFirst({
            where: { id: mealId },
            include: { dietPlan: true },
        });

        if (!meal || meal.dietPlan.orgId !== orgId || meal.dietPlan.deletedAt !== null) {
            throw AppError.notFound('Meal not found', 'MEAL_NOT_FOUND');
        }

        const updated = await prisma.meal.update({
            where: { id: mealId },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(instructions !== undefined && { instructions }),
                ...(timeOfDay !== undefined && { timeOfDay }),
            },
        });

        logger.info('Meal updated', { mealId: updated.id });
        return updated;
    }

    async deleteMeal(mealId: string, orgId: string) {
        const meal = await prisma.meal.findFirst({
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
