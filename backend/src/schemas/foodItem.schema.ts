import { z } from 'zod';

// Create Food Item
export const createFoodItemSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    brand: z.string().max(100).optional(),
    category: z.string().min(1, 'Category is required'),
    subCategory: z.string().optional(),
    servingSizeG: z.number().positive().default(100),
    calories: z.number().int().min(0),
    proteinG: z.number().min(0).optional(),
    carbsG: z.number().min(0).optional(),
    fatsG: z.number().min(0).optional(),
    fiberG: z.number().min(0).optional(),
    sodiumMg: z.number().min(0).optional(),
    sugarG: z.number().min(0).optional(),
    barcode: z.string().optional(),
    allergenFlags: z.array(z.string()).default([]),
    dietaryTags: z.array(z.string()).default([])
});

export type CreateFoodItemInput = z.infer<typeof createFoodItemSchema>;

// Update Food Item
export const updateFoodItemSchema = createFoodItemSchema.partial();

export type UpdateFoodItemInput = z.infer<typeof updateFoodItemSchema>;

// Add Food to Meal
export const addFoodToMealSchema = z.object({
    foodId: z.string().uuid(),
    quantityG: z.number().positive(),
    notes: z.string().optional()
});

export type AddFoodToMealInput = z.infer<typeof addFoodToMealSchema>;

// Update Food in Meal
export const updateMealFoodItemSchema = z.object({
    quantityG: z.number().positive().optional(),
    notes: z.string().optional()
});

export type UpdateMealFoodItemInput = z.infer<typeof updateMealFoodItemSchema>;
