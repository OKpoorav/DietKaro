import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { CreateFoodItemInput, UpdateFoodItemInput } from '../schemas/foodItem.schema';

/**
 * POST /api/v1/food-items
 * Create a new food item in the organization's food library
 */
export const createFoodItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const data: CreateFoodItemInput = req.body;

    const foodItem = await prisma.foodItem.create({
        data: {
            orgId: req.user.organizationId,
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
            createdByUserId: req.user.id,
            isVerified: false,
            source: 'user_created'
        }
    });

    logger.info('Food item created', { foodItemId: foodItem.id, name: foodItem.name });

    res.status(201).json({
        success: true,
        data: {
            id: foodItem.id,
            organizationId: foodItem.orgId,
            name: foodItem.name,
            brand: foodItem.brand,
            category: foodItem.category,
            subCategory: foodItem.subCategory,
            servingSize: `${foodItem.servingSizeG} g`,
            isGlobal: foodItem.orgId === null,
            isVerified: foodItem.isVerified,
            nutrition: {
                calories: foodItem.calories,
                proteinG: foodItem.proteinG ? Number(foodItem.proteinG) : null,
                carbsG: foodItem.carbsG ? Number(foodItem.carbsG) : null,
                fatsG: foodItem.fatsG ? Number(foodItem.fatsG) : null,
                fiberG: foodItem.fiberG ? Number(foodItem.fiberG) : null,
                sodiumMg: foodItem.sodiumMg ? Number(foodItem.sodiumMg) : null,
                sugarG: foodItem.sugarG ? Number(foodItem.sugarG) : null
            },
            allergenFlags: foodItem.allergenFlags,
            dietaryTags: foodItem.dietaryTags,
            barcode: foodItem.barcode,
            createdByUserId: foodItem.createdByUserId,
            createdAt: foodItem.createdAt
        }
    });
});

/**
 * GET /api/v1/food-items
 * Search and list food items (global + org-specific)
 */
export const listFoodItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const {
        q,
        category,
        orgScope = 'all',
        isVerified,
        page = '1',
        pageSize = '20',
        sortBy = 'name'
    } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    // Build where clause
    const where: any = {
        OR: [
            { orgId: null }, // Global foods
            { orgId: req.user.organizationId } // Org-specific foods
        ]
    };

    // Filter by org scope
    if (orgScope === 'org_only') {
        where.OR = [{ orgId: req.user.organizationId }];
    } else if (orgScope === 'global_only') {
        where.OR = [{ orgId: null }];
    }

    // Search by name/brand
    if (q) {
        where.AND = [
            {
                OR: [
                    { name: { contains: String(q), mode: 'insensitive' } },
                    { brand: { contains: String(q), mode: 'insensitive' } }
                ]
            }
        ];
    }

    // Filter by category
    if (category) {
        where.category = String(category);
    }

    // Filter by verified status
    if (isVerified !== undefined) {
        where.isVerified = isVerified === 'true';
    }

    const [foodItems, total] = await prisma.$transaction([
        prisma.foodItem.findMany({
            where,
            skip,
            take,
            orderBy: { [String(sortBy)]: 'asc' },
            include: {
                creator: { select: { id: true, fullName: true } }
            }
        }),
        prisma.foodItem.count({ where })
    ]);

    res.status(200).json({
        success: true,
        data: foodItems.map(item => ({
            id: item.id,
            name: item.name,
            brand: item.brand,
            category: item.category,
            subCategory: item.subCategory,
            servingSize: `${item.servingSizeG} g`,
            isGlobal: item.orgId === null,
            isVerified: item.isVerified,
            nutrition: {
                calories: item.calories,
                proteinG: item.proteinG ? Number(item.proteinG) : null,
                carbsG: item.carbsG ? Number(item.carbsG) : null,
                fatsG: item.fatsG ? Number(item.fatsG) : null,
                fiberG: item.fiberG ? Number(item.fiberG) : null
            },
            allergenFlags: item.allergenFlags,
            dietaryTags: item.dietaryTags,
            barcode: item.barcode,
            createdBy: item.creator
        })),
        meta: {
            page: Number(page),
            pageSize: Number(pageSize),
            total,
            totalPages: Math.ceil(total / Number(pageSize))
        }
    });
});

/**
 * GET /api/v1/food-items/:id
 * Get single food item details
 */
export const getFoodItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { id } = req.params;

    const foodItem = await prisma.foodItem.findFirst({
        where: {
            id,
            OR: [
                { orgId: null },
                { orgId: req.user.organizationId }
            ]
        },
        include: {
            creator: { select: { id: true, fullName: true } }
        }
    });

    if (!foodItem) throw AppError.notFound('Food item not found', 'FOOD_NOT_FOUND');

    res.status(200).json({
        success: true,
        data: {
            id: foodItem.id,
            organizationId: foodItem.orgId,
            name: foodItem.name,
            brand: foodItem.brand,
            category: foodItem.category,
            subCategory: foodItem.subCategory,
            servingSize: `${foodItem.servingSizeG} g`,
            servingSizeG: Number(foodItem.servingSizeG),
            isGlobal: foodItem.orgId === null,
            isVerified: foodItem.isVerified,
            nutrition: {
                calories: foodItem.calories,
                proteinG: foodItem.proteinG ? Number(foodItem.proteinG) : null,
                carbsG: foodItem.carbsG ? Number(foodItem.carbsG) : null,
                fatsG: foodItem.fatsG ? Number(foodItem.fatsG) : null,
                fiberG: foodItem.fiberG ? Number(foodItem.fiberG) : null,
                sodiumMg: foodItem.sodiumMg ? Number(foodItem.sodiumMg) : null,
                sugarG: foodItem.sugarG ? Number(foodItem.sugarG) : null
            },
            allergenFlags: foodItem.allergenFlags,
            dietaryTags: foodItem.dietaryTags,
            barcode: foodItem.barcode,
            source: foodItem.source,
            createdBy: foodItem.creator,
            createdAt: foodItem.createdAt,
            updatedAt: foodItem.updatedAt
        }
    });
});

/**
 * PATCH /api/v1/food-items/:id
 * Update food item (org-specific only)
 */
export const updateFoodItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { id } = req.params;
    const data: UpdateFoodItemInput = req.body;

    // Only allow updating org-specific foods
    const existingFood = await prisma.foodItem.findFirst({
        where: { id, orgId: req.user.organizationId }
    });

    if (!existingFood) {
        throw AppError.notFound('Food item not found or cannot be edited', 'FOOD_NOT_FOUND');
    }

    const updated = await prisma.foodItem.update({
        where: { id },
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
            ...(data.dietaryTags && { dietaryTags: data.dietaryTags })
        }
    });

    logger.info('Food item updated', { foodItemId: updated.id });

    res.status(200).json({
        success: true,
        data: {
            id: updated.id,
            name: updated.name,
            category: updated.category,
            updatedAt: updated.updatedAt
        }
    });
});

/**
 * DELETE /api/v1/food-items/:id
 * Delete org-specific food (soft delete via removing)
 */
export const deleteFoodItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { id } = req.params;

    // Only allow deleting org-specific foods
    const existingFood = await prisma.foodItem.findFirst({
        where: { id, orgId: req.user.organizationId }
    });

    if (!existingFood) {
        throw AppError.notFound('Food item not found or cannot be deleted', 'FOOD_NOT_FOUND');
    }

    // Check if food is used in any meals
    const usageCount = await prisma.mealFoodItem.count({
        where: { foodId: id }
    });

    if (usageCount > 0) {
        throw AppError.conflict(
            `Cannot delete: food item is used in ${usageCount} meal(s)`,
            'FOOD_IN_USE'
        );
    }

    await prisma.foodItem.delete({ where: { id } });

    logger.info('Food item deleted', { foodItemId: id });

    res.status(204).send();
});

/**
 * POST /api/v1/meals/:mealId/food-items
 * Add a food item to a meal
 */
export const addFoodToMeal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { mealId } = req.params;
    const { foodId, quantityG, notes } = req.body;

    // Verify meal exists and belongs to org
    const meal = await prisma.meal.findFirst({
        where: { id: mealId },
        include: { dietPlan: true }
    });

    if (!meal || meal.dietPlan.orgId !== req.user.organizationId) {
        throw AppError.notFound('Meal not found', 'MEAL_NOT_FOUND');
    }

    // Verify food exists
    const foodItem = await prisma.foodItem.findFirst({
        where: {
            id: foodId,
            OR: [
                { orgId: null },
                { orgId: req.user.organizationId }
            ]
        }
    });

    if (!foodItem) throw AppError.notFound('Food item not found', 'FOOD_NOT_FOUND');

    // Calculate nutrition based on quantity
    const multiplier = quantityG / Number(foodItem.servingSizeG);
    const calculatedCalories = Math.round(foodItem.calories * multiplier);
    const calculatedProtein = foodItem.proteinG ? Number(foodItem.proteinG) * multiplier : null;
    const calculatedCarbs = foodItem.carbsG ? Number(foodItem.carbsG) * multiplier : null;
    const calculatedFats = foodItem.fatsG ? Number(foodItem.fatsG) * multiplier : null;
    const calculatedFiber = foodItem.fiberG ? Number(foodItem.fiberG) * multiplier : null;

    // Get current max sortOrder
    const maxSortOrder = await prisma.mealFoodItem.aggregate({
        where: { mealId },
        _max: { sortOrder: true }
    });

    const mealFoodItem = await prisma.mealFoodItem.create({
        data: {
            mealId,
            foodId,
            quantityG,
            calories: calculatedCalories,
            proteinG: calculatedProtein,
            carbsG: calculatedCarbs,
            fatsG: calculatedFats,
            fiberG: calculatedFiber,
            notes,
            sortOrder: (maxSortOrder._max.sortOrder || 0) + 1
        },
        include: {
            foodItem: true
        }
    });

    logger.info('Food added to meal', { mealId, foodId, mealFoodItemId: mealFoodItem.id });

    res.status(201).json({
        success: true,
        data: {
            id: mealFoodItem.id,
            mealId: mealFoodItem.mealId,
            foodId: mealFoodItem.foodId,
            foodName: mealFoodItem.foodItem.name,
            quantity: Number(mealFoodItem.quantityG),
            unit: 'g',
            nutrition: {
                calories: mealFoodItem.calories,
                proteinG: mealFoodItem.proteinG ? Math.round(Number(mealFoodItem.proteinG) * 10) / 10 : null,
                carbsG: mealFoodItem.carbsG ? Math.round(Number(mealFoodItem.carbsG) * 10) / 10 : null,
                fatsG: mealFoodItem.fatsG ? Math.round(Number(mealFoodItem.fatsG) * 10) / 10 : null,
                fiberG: mealFoodItem.fiberG ? Math.round(Number(mealFoodItem.fiberG) * 10) / 10 : null
            },
            notes: mealFoodItem.notes,
            sortOrder: mealFoodItem.sortOrder
        }
    });
});

/**
 * PATCH /api/v1/meals/:mealId/food-items/:itemId
 * Update quantity of a food in a meal
 */
export const updateMealFoodItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { mealId, itemId } = req.params;
    const { quantityG, notes } = req.body;

    // Verify meal food item exists
    const existing = await prisma.mealFoodItem.findFirst({
        where: { id: itemId, mealId },
        include: {
            meal: { include: { dietPlan: true } },
            foodItem: true
        }
    });

    if (!existing || existing.meal.dietPlan.orgId !== req.user.organizationId) {
        throw AppError.notFound('Meal food item not found', 'ITEM_NOT_FOUND');
    }

    // Recalculate nutrition if quantity changed
    let updateData: any = {};
    if (notes !== undefined) updateData.notes = notes;

    if (quantityG) {
        const multiplier = quantityG / Number(existing.foodItem.servingSizeG);
        updateData = {
            ...updateData,
            quantityG,
            calories: Math.round(existing.foodItem.calories * multiplier),
            proteinG: existing.foodItem.proteinG ? Number(existing.foodItem.proteinG) * multiplier : null,
            carbsG: existing.foodItem.carbsG ? Number(existing.foodItem.carbsG) * multiplier : null,
            fatsG: existing.foodItem.fatsG ? Number(existing.foodItem.fatsG) * multiplier : null,
            fiberG: existing.foodItem.fiberG ? Number(existing.foodItem.fiberG) * multiplier : null
        };
    }

    const updated = await prisma.mealFoodItem.update({
        where: { id: itemId },
        data: updateData,
        include: { foodItem: true }
    });

    logger.info('Meal food item updated', { itemId });

    res.status(200).json({
        success: true,
        data: {
            id: updated.id,
            foodName: updated.foodItem.name,
            quantity: Number(updated.quantityG),
            nutrition: {
                calories: updated.calories,
                proteinG: updated.proteinG ? Math.round(Number(updated.proteinG) * 10) / 10 : null
            }
        }
    });
});

/**
 * DELETE /api/v1/meals/:mealId/food-items/:itemId
 * Remove a food item from a meal
 */
export const removeFoodFromMeal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { mealId, itemId } = req.params;

    // Verify meal food item exists
    const existing = await prisma.mealFoodItem.findFirst({
        where: { id: itemId, mealId },
        include: { meal: { include: { dietPlan: true } } }
    });

    if (!existing || existing.meal.dietPlan.orgId !== req.user.organizationId) {
        throw AppError.notFound('Meal food item not found', 'ITEM_NOT_FOUND');
    }

    await prisma.mealFoodItem.delete({ where: { id: itemId } });

    logger.info('Food removed from meal', { mealId, itemId });

    res.status(204).send();
});

// ============ TAGGING ENDPOINTS ============

import { foodTaggingService } from '../services/foodTagging.service';

/**
 * PATCH /api/v1/food-items/:id/tags
 * Manually update tags for a food item
 */
export const updateFoodTags = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { id } = req.params;
    const { dietaryCategory, allergenFlags, nutritionTags, healthFlags, cuisineTags, processingLevel, mealSuitabilityTags } = req.body;

    // Verify food exists and is accessible
    const existingFood = await prisma.foodItem.findFirst({
        where: {
            id,
            OR: [
                { orgId: null }, // Global foods can be tagged
                { orgId: req.user.organizationId }
            ]
        }
    });

    if (!existingFood) {
        throw AppError.notFound('Food item not found', 'FOOD_NOT_FOUND');
    }

    const updated = await foodTaggingService.updateFoodTags(id, {
        dietaryCategory,
        allergenFlags,
        nutritionTags,
        healthFlags,
        cuisineTags,
        processingLevel,
        mealSuitabilityTags
    });

    res.status(200).json({
        success: true,
        data: {
            id: updated.id,
            name: updated.name,
            dietaryCategory: updated.dietaryCategory,
            allergenFlags: updated.allergenFlags,
            nutritionTags: updated.nutritionTags,
            healthFlags: updated.healthFlags,
            cuisineTags: updated.cuisineTags,
            processingLevel: updated.processingLevel,
            mealSuitabilityTags: updated.mealSuitabilityTags
        }
    });
});

/**
 * POST /api/v1/food-items/:id/auto-tag
 * Automatically tag a food item based on name and nutrition
 */
export const autoTagFood = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { id } = req.params;

    // Verify food exists
    const existingFood = await prisma.foodItem.findFirst({
        where: {
            id,
            OR: [
                { orgId: null },
                { orgId: req.user.organizationId }
            ]
        }
    });

    if (!existingFood) {
        throw AppError.notFound('Food item not found', 'FOOD_NOT_FOUND');
    }

    const updated = await foodTaggingService.autoTagFood(id);

    res.status(200).json({
        success: true,
        message: 'Food item auto-tagged successfully',
        data: {
            id: updated.id,
            name: updated.name,
            dietaryCategory: updated.dietaryCategory,
            allergenFlags: updated.allergenFlags,
            nutritionTags: updated.nutritionTags,
            healthFlags: updated.healthFlags
        }
    });
});

/**
 * POST /api/v1/food-items/bulk-auto-tag
 * Bulk auto-tag all food items in the organization
 */
export const bulkAutoTagFoods = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { limit = 100, includeGlobal = false } = req.body;

    const options: { orgId?: string; limit?: number } = { limit };

    // Only include org foods by default, or all if includeGlobal
    if (!includeGlobal) {
        options.orgId = req.user.organizationId;
    }

    const result = await foodTaggingService.bulkAutoTag(options);

    res.status(200).json({
        success: true,
        message: `Processed ${result.processed} food items, updated ${result.updated}`,
        data: result
    });
});

