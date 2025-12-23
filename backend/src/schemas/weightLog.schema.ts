import { z } from 'zod';

export const createWeightLogSchema = z.object({
    logDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid log date'),
    logTime: z.string().optional(),
    weightKg: z.number().min(10, 'Weight must be at least 10kg').max(500, 'Weight must be less than 500kg'),
    notes: z.string().optional(),
    progressPhotoUrl: z.string().url().optional()
});

export const weightLogQuerySchema = z.object({
    clientId: z.string().uuid('Invalid client ID'),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    page: z.string().optional().default('1'),
    pageSize: z.string().optional().default('100')
});

export type CreateWeightLogInput = z.infer<typeof createWeightLogSchema>;
