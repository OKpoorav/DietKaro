import { z } from 'zod';

// ── Device Token ─────────────────────────────────────────────────────
export const deviceTokenSchema = z.object({
    token: z.string().min(10, 'Push token too short').max(2000, 'Push token too long'),
});

// ── Onboarding Step Schemas ──────────────────────────────────────────
export const onboardingStep1Schema = z.object({
    dateOfBirth: z.string().refine((v) => !isNaN(Date.parse(v)), 'Invalid date').optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    heightCm: z.number().min(50).max(300).optional(),
    currentWeightKg: z.number().min(10).max(500).optional(),
    targetWeightKg: z.number().min(10).max(500).optional(),
}).passthrough();

export const onboardingStep2Schema = z.object({
    activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
    dietPattern: z.string().max(100).optional(),
    eggAllowed: z.boolean().optional(),
}).passthrough();

export const onboardingStep3Schema = z.object({
    allergies: z.array(z.string().max(100)).max(50).optional(),
    intolerances: z.array(z.string().max(100)).max(50).optional(),
    medicalConditions: z.array(z.string().max(100)).max(50).optional(),
}).passthrough();

export const onboardingStep4Schema = z.object({
    dislikes: z.array(z.string().max(100)).max(100).optional(),
    likedFoods: z.array(z.string().max(100)).max(100).optional(),
}).passthrough();

export const onboardingStep5Schema = z.object({
    breakfastTime: z.string().max(10).optional(),
    lunchTime: z.string().max(10).optional(),
    dinnerTime: z.string().max(10).optional(),
}).passthrough();

export const onboardingStep6Schema = z.object({}).passthrough();

export const ONBOARDING_STEP_SCHEMAS: Record<number, z.ZodSchema> = {
    1: onboardingStep1Schema,
    2: onboardingStep2Schema,
    3: onboardingStep3Schema,
    4: onboardingStep4Schema,
    5: onboardingStep5Schema,
    6: onboardingStep6Schema,
};

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
