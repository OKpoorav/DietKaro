import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { foodItemService } from '../services/foodItem.service';
import { foodTaggingService } from '../services/foodTagging.service';

export const createFoodItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const foodItem = await foodItemService.createFoodItem(req.body, req.user.organizationId, req.user.id);

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
                sugarG: foodItem.sugarG ? Number(foodItem.sugarG) : null,
            },
            allergenFlags: foodItem.allergenFlags,
            dietaryTags: foodItem.dietaryTags,
            barcode: foodItem.barcode,
            createdByUserId: foodItem.createdByUserId,
            createdAt: foodItem.createdAt,
        },
    });
});

export const listFoodItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { foodItems, meta } = await foodItemService.listFoodItems(req.user.organizationId, req.query);

    res.status(200).json({
        success: true,
        data: foodItems.map((item) => ({
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
                fiberG: item.fiberG ? Number(item.fiberG) : null,
            },
            allergenFlags: item.allergenFlags,
            dietaryTags: item.dietaryTags,
            barcode: item.barcode,
            createdBy: item.creator,
        })),
        meta,
    });
});

export const getFoodItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const foodItem = await foodItemService.getFoodItem(req.params.id, req.user.organizationId);

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
                sugarG: foodItem.sugarG ? Number(foodItem.sugarG) : null,
            },
            allergenFlags: foodItem.allergenFlags,
            dietaryTags: foodItem.dietaryTags,
            barcode: foodItem.barcode,
            source: foodItem.source,
            createdBy: foodItem.creator,
            createdAt: foodItem.createdAt,
            updatedAt: foodItem.updatedAt,
        },
    });
});

export const updateFoodItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const updated = await foodItemService.updateFoodItem(req.params.id, req.body, req.user.organizationId);

    res.status(200).json({
        success: true,
        data: { id: updated.id, name: updated.name, category: updated.category, updatedAt: updated.updatedAt },
    });
});

export const deleteFoodItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await foodItemService.deleteFoodItem(req.params.id, req.user.organizationId);
    res.status(204).send();
});

export const addFoodToMeal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const mealFoodItem = await foodItemService.addFoodToMeal(req.params.mealId, req.body, req.user.organizationId);

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
                fiberG: mealFoodItem.fiberG ? Math.round(Number(mealFoodItem.fiberG) * 10) / 10 : null,
            },
            notes: mealFoodItem.notes,
            sortOrder: mealFoodItem.sortOrder,
        },
    });
});

export const updateMealFoodItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const updated = await foodItemService.updateMealFoodItem(req.params.mealId, req.params.itemId, req.body, req.user.organizationId);

    res.status(200).json({
        success: true,
        data: {
            id: updated.id,
            foodName: updated.foodItem.name,
            quantity: Number(updated.quantityG),
            nutrition: {
                calories: updated.calories,
                proteinG: updated.proteinG ? Math.round(Number(updated.proteinG) * 10) / 10 : null,
            },
        },
    });
});

export const removeFoodFromMeal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await foodItemService.removeFoodFromMeal(req.params.mealId, req.params.itemId, req.user.organizationId);
    res.status(204).send();
});

// ============ TAGGING ENDPOINTS ============

export const updateFoodTags = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await foodItemService.getFoodItem(req.params.id, req.user.organizationId);

    const updated = await foodTaggingService.updateFoodTags(req.params.id, req.body);

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
            mealSuitabilityTags: updated.mealSuitabilityTags,
        },
    });
});

export const autoTagFood = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await foodItemService.getFoodItem(req.params.id, req.user.organizationId);

    const updated = await foodTaggingService.autoTagFood(req.params.id);

    res.status(200).json({
        success: true,
        message: 'Food item auto-tagged successfully',
        data: {
            id: updated.id,
            name: updated.name,
            dietaryCategory: updated.dietaryCategory,
            allergenFlags: updated.allergenFlags,
            nutritionTags: updated.nutritionTags,
            healthFlags: updated.healthFlags,
        },
    });
});

export const bulkAutoTagFoods = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { limit = 100, includeGlobal = false } = req.body;
    const options: { orgId?: string; limit?: number } = { limit };
    if (!includeGlobal) options.orgId = req.user.organizationId;

    const result = await foodTaggingService.bulkAutoTag(options);

    res.status(200).json({
        success: true,
        message: `Processed ${result.processed} food items, updated ${result.updated}`,
        data: result,
    });
});
