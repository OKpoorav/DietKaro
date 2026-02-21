import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';
import { buildPaginationParams, buildPaginationMeta, safeSortBy } from '../utils/queryFilters';
import { scaleNutrition } from '../utils/nutritionCalculator';
import { CreateFoodItemInput, UpdateFoodItemInput } from '../schemas/foodItem.schema';

const DIETARY_CATEGORY_PRIORITY: Record<string, number> = {
    non_veg: 4,
    veg_with_egg: 3,
    vegetarian: 2,
    vegan: 1,
};

export class FoodItemService {
    /**
     * Derive allergenFlags and dietaryCategory from ingredient FoodItems.
     * allergenFlags = union of all ingredient allergenFlags + any manual flags.
     * dietaryCategory = highest priority among ingredients.
     */
    async deriveFromIngredients(
        ingredientIds: string[],
        manualAllergens: string[] = [],
    ): Promise<{ allergenFlags: string[]; dietaryCategory: string | null }> {
        if (ingredientIds.length === 0) {
            return { allergenFlags: manualAllergens, dietaryCategory: null };
        }

        const ingredients = await prisma.foodItem.findMany({
            where: { id: { in: ingredientIds } },
            select: { allergenFlags: true, dietaryCategory: true },
        });

        const allFlags = new Set<string>(manualAllergens);
        let maxPriority = 0;
        let derivedCategory: string | null = null;

        for (const ing of ingredients) {
            for (const flag of ing.allergenFlags) {
                allFlags.add(flag);
            }
            const priority = DIETARY_CATEGORY_PRIORITY[ing.dietaryCategory || ''] || 0;
            if (priority > maxPriority) {
                maxPriority = priority;
                derivedCategory = ing.dietaryCategory;
            }
        }

        return {
            allergenFlags: Array.from(allFlags),
            dietaryCategory: derivedCategory,
        };
    }

    /**
     * Link ingredient FoodItems to a composite food, and auto-derive allergenFlags/dietaryCategory.
     */
    private async linkIngredients(foodItemId: string, ingredientIds: string[], manualAllergens: string[] = []) {
        if (ingredientIds.length === 0) return;

        // Verify all ingredients exist and are base ingredients
        const validIngredients = await prisma.foodItem.findMany({
            where: { id: { in: ingredientIds }, isBaseIngredient: true },
            select: { id: true },
        });
        const validIds = validIngredients.map(i => i.id);

        if (validIds.length > 0) {
            await prisma.foodItemIngredient.createMany({
                data: validIds.map(ingredientId => ({ foodItemId, ingredientId })),
                skipDuplicates: true,
            });

            // Auto-derive allergens and dietary category
            const derived = await this.deriveFromIngredients(validIds, manualAllergens);
            await prisma.foodItem.update({
                where: { id: foodItemId },
                data: {
                    allergenFlags: derived.allergenFlags,
                    ...(derived.dietaryCategory && { dietaryCategory: derived.dietaryCategory }),
                },
            });
        }
    }

    async createFoodItem(data: CreateFoodItemInput, orgId: string, userId: string) {
        const { ingredientIds, isBaseIngredient, ...foodData } = data;

        const foodItem = await prisma.foodItem.create({
            data: {
                orgId,
                name: foodData.name,
                brand: foodData.brand,
                category: foodData.category,
                subCategory: foodData.subCategory,
                servingSizeG: foodData.servingSizeG || 100,
                calories: foodData.calories,
                proteinG: foodData.proteinG,
                carbsG: foodData.carbsG,
                fatsG: foodData.fatsG,
                fiberG: foodData.fiberG,
                sodiumMg: foodData.sodiumMg,
                sugarG: foodData.sugarG,
                barcode: foodData.barcode,
                allergenFlags: foodData.allergenFlags || [],
                dietaryTags: foodData.dietaryTags || [],
                isBaseIngredient: isBaseIngredient || false,
                createdByUserId: userId,
                isVerified: false,
                source: 'user_created',
            },
        });

        // Link ingredients for composite (non-base) foods
        if (!isBaseIngredient && ingredientIds && ingredientIds.length > 0) {
            await this.linkIngredients(foodItem.id, ingredientIds, foodData.allergenFlags || []);
        }

        // Re-fetch to include ingredients relation
        const result = await prisma.foodItem.findUnique({
            where: { id: foodItem.id },
            include: {
                ingredients: {
                    include: { ingredient: { select: { id: true, name: true, allergenFlags: true, dietaryCategory: true } } },
                },
            },
        });

        logger.info('Food item created', { foodItemId: foodItem.id, name: foodItem.name, isBaseIngredient });
        return result!;
    }

    private static FOOD_SORT_FIELDS = new Set(['name', 'calories', 'createdAt', 'category']);

    async listFoodItems(orgId: string, query: any) {
        const { q, category, orgScope = 'all', isVerified, isBaseIngredient, sortBy = 'name' } = query;
        const pagination = buildPaginationParams(query.page, query.pageSize);
        const validSortBy = safeSortBy(sortBy, FoodItemService.FOOD_SORT_FIELDS, 'name');

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
        if (isBaseIngredient !== undefined) where.isBaseIngredient = isBaseIngredient === 'true';

        const [foodItems, total] = await prisma.$transaction([
            prisma.foodItem.findMany({
                where,
                skip: pagination.skip,
                take: pagination.take,
                orderBy: { [validSortBy]: 'asc' },
                include: { creator: { select: { id: true, fullName: true } } },
            }),
            prisma.foodItem.count({ where }),
        ]);

        return { foodItems, meta: buildPaginationMeta(total, pagination) };
    }

    async listBaseIngredients(orgId: string, query: any) {
        const { q } = query;
        const pagination = buildPaginationParams(query.page, query.pageSize || 50);

        const where: any = {
            isBaseIngredient: true,
            OR: [{ orgId: null }, { orgId }],
        };

        if (q) {
            where.name = { contains: String(q), mode: 'insensitive' };
        }

        const [items, total] = await prisma.$transaction([
            prisma.foodItem.findMany({
                where,
                skip: pagination.skip,
                take: pagination.take,
                orderBy: { name: 'asc' },
                select: { id: true, name: true, allergenFlags: true, dietaryCategory: true, category: true },
            }),
            prisma.foodItem.count({ where }),
        ]);

        return { items, meta: buildPaginationMeta(total, pagination) };
    }

    async getFoodItem(foodItemId: string, orgId: string) {
        const foodItem = await prisma.foodItem.findFirst({
            where: {
                id: foodItemId,
                OR: [{ orgId: null }, { orgId }],
            },
            include: {
                creator: { select: { id: true, fullName: true } },
                ingredients: {
                    include: { ingredient: { select: { id: true, name: true, allergenFlags: true, dietaryCategory: true } } },
                },
            },
        });

        if (!foodItem) throw AppError.notFound('Food item not found', 'FOOD_NOT_FOUND');
        return foodItem;
    }

    async updateFoodItem(foodItemId: string, data: UpdateFoodItemInput, orgId: string) {
        const existing = await prisma.foodItem.findFirst({ where: { id: foodItemId, orgId } });
        if (!existing) throw AppError.notFound('Food item not found or cannot be edited', 'FOOD_NOT_FOUND');

        const { ingredientIds, isBaseIngredient, ...foodData } = data;

        const updated = await prisma.foodItem.update({
            where: { id: foodItemId },
            data: {
                ...(foodData.name && { name: foodData.name }),
                ...(foodData.brand !== undefined && { brand: foodData.brand }),
                ...(foodData.category && { category: foodData.category }),
                ...(foodData.subCategory !== undefined && { subCategory: foodData.subCategory }),
                ...(foodData.servingSizeG && { servingSizeG: foodData.servingSizeG }),
                ...(foodData.calories !== undefined && { calories: foodData.calories }),
                ...(foodData.proteinG !== undefined && { proteinG: foodData.proteinG }),
                ...(foodData.carbsG !== undefined && { carbsG: foodData.carbsG }),
                ...(foodData.fatsG !== undefined && { fatsG: foodData.fatsG }),
                ...(foodData.fiberG !== undefined && { fiberG: foodData.fiberG }),
                ...(foodData.sodiumMg !== undefined && { sodiumMg: foodData.sodiumMg }),
                ...(foodData.sugarG !== undefined && { sugarG: foodData.sugarG }),
                ...(foodData.barcode !== undefined && { barcode: foodData.barcode }),
                ...(foodData.allergenFlags && { allergenFlags: foodData.allergenFlags }),
                ...(foodData.dietaryTags && { dietaryTags: foodData.dietaryTags }),
                ...(isBaseIngredient !== undefined && { isBaseIngredient }),
            },
        });

        // Re-link ingredients if provided
        if (ingredientIds !== undefined) {
            // Delete old links
            await prisma.foodItemIngredient.deleteMany({ where: { foodItemId } });
            // Create new links and derive allergens
            if (ingredientIds.length > 0) {
                await this.linkIngredients(foodItemId, ingredientIds, foodData.allergenFlags || updated.allergenFlags);
            }
        }

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
