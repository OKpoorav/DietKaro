import { z } from 'zod';

const MealTypeEnum = z.enum(['breakfast', 'lunch', 'snack', 'dinner']);

const foodItemSchema = z.object({
    foodId: z.string().uuid('foodId must be a valid UUID'),
    quantityG: z.number().positive('Quantity must be a positive number'),
    notes: z.string().max(500).optional().nullable(),
    optionGroup: z.number().int().min(0).default(0),
    optionLabel: z.string().max(100).optional().nullable(),
});

export const addMealSchema = z.object({
    planId: z.string().uuid('planId must be a valid UUID'),
    dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
    mealDate: z.string().optional().nullable(),
    mealType: MealTypeEnum,
    timeOfDay: z.string().max(20).optional().nullable(),
    name: z.string().min(1, 'Name is required').max(200),
    description: z.string().max(2000).optional().nullable(),
    instructions: z.string().max(5000).optional().nullable(),
    foodItems: z.array(foodItemSchema).optional(),
});

export const updateMealSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    instructions: z.string().max(5000).optional().nullable(),
    timeOfDay: z.string().max(20).optional().nullable(),
});

export type AddMealInput = z.infer<typeof addMealSchema>;
export type UpdateMealInput = z.infer<typeof updateMealSchema>;
