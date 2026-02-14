import { z } from 'zod';

export const createDietPlanSchema = z.object({
    clientId: z.string().uuid('Invalid client ID'),
    name: z.string().min(2, 'Plan name must be at least 2 characters'),
    description: z.string().optional(),
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid start date'),
    endDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid end date').optional(),
    targetCalories: z.number().min(500).max(10000).optional(),
    targetProteinG: z.number().min(0).max(500).optional(),
    targetCarbsG: z.number().min(0).max(1000).optional(),
    targetFatsG: z.number().min(0).max(500).optional(),
    targetFiberG: z.number().min(0).max(200).optional(),
    notesForClient: z.string().optional(),
    internalNotes: z.string().optional(),
    meals: z.array(z.object({
        dayOfWeek: z.number().min(0).max(6).optional(),
        mealDate: z.string().optional(),
        mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
        timeOfDay: z.string().optional(),
        name: z.string(),
        description: z.string().optional(),
        instructions: z.string().optional(),
        foodItems: z.array(z.object({
            foodId: z.string().uuid(),
            quantityG: z.number().min(0),
            notes: z.string().optional(),
            optionGroup: z.number().int().min(0).optional(),
            optionLabel: z.string().optional()
        })).optional()
    })).optional(),
    options: z.object({
        saveAsTemplate: z.boolean().optional(),
        templateCategory: z.string().optional()
    }).optional()
});

export const updateDietPlanSchema = createDietPlanSchema.partial().omit({ clientId: true });

export const dietPlanListQuerySchema = z.object({
    clientId: z.string().optional(),
    status: z.string().optional(),
    isTemplate: z.string().optional(),
    page: z.string().optional(),
    pageSize: z.string().optional(),
});

export const assignTemplateSchema = z.object({
    clientId: z.string().uuid('Invalid client ID'),
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid start date'),
    name: z.string().optional(),
});

export type CreateDietPlanInput = z.infer<typeof createDietPlanSchema>;
export type UpdateDietPlanInput = z.infer<typeof updateDietPlanSchema>;
export type DietPlanListQuery = z.infer<typeof dietPlanListQuerySchema>;
export type AssignTemplateInput = z.infer<typeof assignTemplateSchema>;
