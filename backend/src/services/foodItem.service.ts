import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';
import { buildPaginationParams, buildPaginationMeta } from '../utils/queryFilters';
import { scaleNutrition } from '../utils/nutritionCalculator';
import { CreateFoodItemInput, UpdateFoodItemInput } from '../schemas/foodItem.schema';

export class FoodItemService {
    async createFoodItem(data: CreateFoodItemInput, orgId: string, userId: string) {
        const foodItem = await prisma.foodItem.create({
            data: {
                orgId,
                name: data.name,
                brand: data.brand,
                category: data.category,
                subCategory: data.subCategory,
                servingSizeG: data.servingSizeG || 100,
                calories: data.calories,
                proteinG: data.proteinG,
                carbsG: data.carbsG,
                fatsG: data.fatsG,
                fiberG: data.fiberG,
                sodiumMg: data.sodiumMg,
                sugarG: data.sugarG,
                barcode: data.barcode,
                allergenFlags: data.allergenFlags || [],
                dietaryTags: data.dietaryTags || [],
                createdByUserId: userId,
                isVerified: false,
                source: 'user_created',
            },
        });

        logger.info('Food item created', { foodItemId: foodItem.id, name: foodItem.name });
        return foodItem;
    }

    async listFoodItems(orgId: string, query: any) {
        const { q, category, orgScope = 'all', isVerified, sortBy = 'name' } = query;
        const pagination = buildPaginationParams(query.page, query.pageSize);

        const where: any = {
            OR: [{ orgId: null }, { orgId }],
        };

        if (orgScope === 'org_only') {
            where.OR = [{ orgId }];
        } else if (orgScope === 'global_only') {
            where.OR = [{ orgId: null }];
        }

        if (q) {
            where.AND = [
                {
                    OR: [
                        { name: { contains: String(q), mode: 'insensitive' } },
                        { brand: { contains: String(q), mode: 'insensitive' } },
                    ],
                },
            ];
        }

        if (category) where.category = String(category);
        if (isVerified !== undefined) where.isVerified = isVerified === 'true';

        const [foodItems, total] = await prisma.$transaction([
            prisma.foodItem.findMany({
                where,
                skip: pagination.skip,
                take: pagination.take,
                orderBy: { [String(sortBy)]: 'asc' },
                include: { creator: { select: { id: true, fullName: true } } },
            }),
            prisma.foodItem.count({ where }),
        ]);

        return { foodItems, meta: buildPaginationMeta(total, pagination) };
    }

    async getFoodItem(foodItemId: string, orgId: string) {
        const foodItem = await prisma.foodItem.findFirst({
            where: {
                id: foodItemId,
                OR: [{ orgId: null }, { orgId }],
            },
            include: { creator: { select: { id: true, fullName: true } } },
        });

        if (!foodItem) throw AppError.notFound('Food item not found', 'FOOD_NOT_FOUND');
        return foodItem;
    }

    async updateFoodItem(foodItemId: string, data: UpdateFoodItemInput, orgId: string) {
        const existing = await prisma.foodItem.findFirst({ where: { id: foodItemId, orgId } });
        if (!existing) throw AppError.notFound('Food item not found or cannot be edited', 'FOOD_NOT_FOUND');

        const updated = await prisma.foodItem.update({
            where: { id: foodItemId },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.brand !== undefined && { brand: data.brand }),
                ...(data.category && { category: data.category }),
                ...(data.subCategory !== undefined && { subCategory: data.subCategory }),
                ...(data.servingSizeG && { servingSizeG: data.servingSizeG }),
                ...(data.calories !== undefined && { calories: data.calories }),
                ...(data.proteinG !== undefined && { proteinG: data.proteinG }),
                ...(data.carbsG !== undefined && { carbsG: data.carbsG }),
                ...(data.fatsG !== undefined && { fatsG: data.fatsG }),
                ...(data.fiberG !== undefined && { fiberG: data.fiberG }),
                ...(data.sodiumMg !== undefined && { sodiumMg: data.sodiumMg }),
                ...(data.sugarG !== undefined && { sugarG: data.sugarG }),
                ...(data.barcode !== undefined && { barcode: data.barcode }),
                ...(data.allergenFlags && { allergenFlags: data.allergenFlags }),
                ...(data.dietaryTags && { dietaryTags: data.dietaryTags }),
            },
        });

        logger.info('Food item updated', { foodItemId: updated.id });
        return updated;
    }

    async deleteFoodItem(foodItemId: string, orgId: string) {
        const existing = await prisma.foodItem.findFirst({ where: { id: foodItemId, orgId } });
        if (!existing) throw AppError.notFound('Food item not found or cannot be deleted', 'FOOD_NOT_FOUND');

        const usageCount = await prisma.mealFoodItem.count({ where: { foodId: foodItemId } });
        if (usageCount > 0) {
            throw AppError.conflict(`Cannot delete: food item is used in ${usageCount} meal(s)`, 'FOOD_IN_USE');
        }

        await prisma.foodItem.delete({ where: { id: foodItemId } });
        logger.info('Food item deleted', { foodItemId });
    }

    async addFoodToMeal(mealId: string, body: any, orgId: string) {
        const { foodId, quantityG, notes } = body;

        const meal = await prisma.meal.findFirst({
            where: { id: mealId },
            include: { dietPlan: true },
        });

        if (!meal || meal.dietPlan.orgId !== orgId) {
            throw AppError.notFound('Meal not found', 'MEAL_NOT_FOUND');
        }

        const foodItem = await prisma.foodItem.findFirst({
            where: { id: foodId, OR: [{ orgId: null }, { orgId }] },
        });

        if (!foodItem) throw AppError.notFound('Food item not found', 'FOOD_NOT_FOUND');

        const nutrition = scaleNutrition(foodItem, quantityG);

        const maxSortOrder = await prisma.mealFoodItem.aggregate({
            where: { mealId },
            _max: { sortOrder: true },
        });

        const mealFoodItem = await prisma.mealFoodItem.create({
            data: {
                mealId,
                foodId,
                quantityG,
                calories: nutrition.calories,
                proteinG: nutrition.proteinG,
                carbsG: nutrition.carbsG,
                fatsG: nutrition.fatsG,
                fiberG: nutrition.fiberG,
                notes,
                sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
            },
            include: { foodItem: true },
        });

        logger.info('Food added to meal', { mealId, foodId, mealFoodItemId: mealFoodItem.id });
        return mealFoodItem;
    }

    async updateMealFoodItem(mealId: string, itemId: string, body: any, orgId: string) {
        const { quantityG, notes } = body;

        const existing = await prisma.mealFoodItem.findFirst({
            where: { id: itemId, mealId },
            include: { meal: { include: { dietPlan: true } }, foodItem: true },
        });

        if (!existing || existing.meal.dietPlan.orgId !== orgId) {
            throw AppError.notFound('Meal food item not found', 'ITEM_NOT_FOUND');
        }

        let updateData: any = {};
        if (notes !== undefined) updateData.notes = notes;

        if (quantityG) {
            const nutrition = scaleNutrition(existing.foodItem, quantityG);
            updateData = {
                ...updateData,
                quantityG,
                calories: nutrition.calories,
                proteinG: nutrition.proteinG,
                carbsG: nutrition.carbsG,
                fatsG: nutrition.fatsG,
                fiberG: nutrition.fiberG,
            };
        }

        const updated = await prisma.mealFoodItem.update({
            where: { id: itemId },
            data: updateData,
            include: { foodItem: true },
        });

        logger.info('Meal food item updated', { itemId });
        return updated;
    }

    async removeFoodFromMeal(mealId: string, itemId: string, orgId: string) {
        const existing = await prisma.mealFoodItem.findFirst({
            where: { id: itemId, mealId },
            include: { meal: { include: { dietPlan: true } } },
        });

        if (!existing || existing.meal.dietPlan.orgId !== orgId) {
            throw AppError.notFound('Meal food item not found', 'ITEM_NOT_FOUND');
        }

        await prisma.mealFoodItem.delete({ where: { id: itemId } });
        logger.info('Food removed from meal', { mealId, itemId });
    }
}

export const foodItemService = new FoodItemService();
