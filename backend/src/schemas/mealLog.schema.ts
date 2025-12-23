import { z } from 'zod';

export const createMealLogSchema = z.object({
    clientId: z.string().uuid('Invalid client ID'),
    mealId: z.string().uuid('Invalid meal ID'),
    scheduledDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid scheduled date'),
    scheduledTime: z.string().optional()
});

export const updateMealLogSchema = z.object({
    status: z.enum(['pending', 'eaten', 'substituted', 'skipped']).optional(),
    photoUrl: z.string().url().optional(),
    clientNotes: z.string().optional(),
    substituteDescription: z.string().optional(),
    substituteCaloriesEst: z.number().optional()
});

export const reviewMealLogSchema = z.object({
    dietitianFeedback: z.string().optional(),
    status: z.enum(['pending', 'eaten', 'substituted', 'skipped']).optional(),
    overrideCalories: z.number().optional()
});

export const mealLogQuerySchema = z.object({
    clientId: z.string().uuid().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    status: z.enum(['pending', 'eaten', 'substituted', 'skipped']).optional(),
    page: z.string().optional().default('1'),
    pageSize: z.string().optional().default('20'),
    sortBy: z.string().optional().default('scheduledDate')
});

export type CreateMealLogInput = z.infer<typeof createMealLogSchema>;
export type UpdateMealLogInput = z.infer<typeof updateMealLogSchema>;
export type ReviewMealLogInput = z.infer<typeof reviewMealLogSchema>;
