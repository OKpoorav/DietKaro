import { z } from 'zod';

export const logMealSchema = z.object({
    status: z.enum(['eaten', 'skipped', 'substituted']).optional(),
    photoUrl: z.string().url().optional(),
    notes: z.string().max(1000).optional(),
    chosenOptionGroup: z.number().int().min(0).max(10).optional(),
});

export const createWeightLogSchema = z.object({
    weightKg: z.number().min(10).max(500),
    logDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
    notes: z.string().max(500).optional(),
});

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const updatePreferencesSchema = z.object({
    breakfastTime: z.string().regex(timeRegex, 'Must be HH:MM format').optional(),
    lunchTime: z.string().regex(timeRegex, 'Must be HH:MM format').optional(),
    dinnerTime: z.string().regex(timeRegex, 'Must be HH:MM format').optional(),
    snackTime: z.string().regex(timeRegex, 'Must be HH:MM format').optional(),
    canCook: z.boolean().optional(),
    kitchenAvailable: z.boolean().optional(),
    hasDietaryCook: z.boolean().optional(),
    weekdayActivity: z.string().max(200).optional(),
    weekendActivity: z.string().max(200).optional(),
    sportOrHobby: z.string().max(200).optional(),
    generalNotes: z.string().max(1000).optional(),
});
