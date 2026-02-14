import { z } from 'zod';

export const createClientSchema = z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Invalid email format'),
    phone: z.string().min(10, 'Phone must be at least 10 characters'),
    dateOfBirth: z.string().optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    heightCm: z.number().min(50).max(300).optional(),
    currentWeightKg: z.number().min(10).max(500).optional(),
    targetWeightKg: z.number().min(10).max(500).optional(),
    targetCalories: z.number().min(500).max(10000).optional().nullable(),
    targetProteinG: z.number().min(0).max(500).optional().nullable(),
    targetCarbsG: z.number().min(0).max(1000).optional().nullable(),
    targetFatsG: z.number().min(0).max(500).optional().nullable(),
    activityLevel: z.enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active']).optional(),
    primaryDietitianId: z.string().uuid().optional(),
    dietaryPreferences: z.array(z.string().min(1).max(100)).max(30).optional().default([]),
    allergies: z.array(z.string().min(1).max(100)).max(20).optional().default([]),
    medicalConditions: z.array(z.string().min(1).max(100)).max(20).optional().default([]),
    medications: z.array(z.string().min(1).max(100)).max(30).optional().default([]),
    healthNotes: z.string().optional(),
    referralCode: z.string().optional(),
    referralSource: z.enum(['doctor', 'dietitian', 'client_referral', 'social_media', 'website', 'other']).optional(),
    referralSourceName: z.string().optional(),
    referralSourcePhone: z.string().optional(),
});

export const foodRestrictionSchema = z.object({
    foodId: z.string().uuid().optional(),
    foodName: z.string().optional(),
    foodCategory: z.string().optional(),
    restrictionType: z.enum(['day_based', 'time_based', 'frequency', 'quantity', 'always']),
    avoidDays: z.array(z.string()).optional(),
    avoidMeals: z.array(z.string()).optional(),
    avoidAfter: z.string().optional(),
    avoidBefore: z.string().optional(),
    maxPerWeek: z.number().int().min(0).optional(),
    maxPerDay: z.number().int().min(0).optional(),
    maxGramsPerMeal: z.number().min(0).optional(),
    excludes: z.array(z.string()).optional(),
    includes: z.array(z.string()).optional(),
    reason: z.string().optional(),
    severity: z.enum(['strict', 'flexible']),
    note: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial().extend({
    intolerances: z.array(z.string()).optional(),
    dietPattern: z.string().optional(),
    eggAllowed: z.boolean().optional(),
    eggAvoidDays: z.array(z.string()).optional(),
    dislikes: z.array(z.string()).optional(),
    avoidCategories: z.array(z.string()).optional(),
    likedFoods: z.array(z.string()).optional(),
    preferredCuisines: z.array(z.string()).optional(),
    foodRestrictions: z.array(foodRestrictionSchema).optional(),
});

export const clientIdParamSchema = z.object({
    id: z.string().uuid('Invalid client ID')
});

export const clientListQuerySchema = z.object({
    search: z.string().optional(),
    status: z.string().optional(),
    primaryDietitianId: z.string().optional(),
    sortBy: z.string().optional(),
    page: z.string().optional(),
    pageSize: z.string().optional(),
});

export const clientProgressQuerySchema = z.object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
});

export const foodRestrictionsArraySchema = z.array(foodRestrictionSchema);

export type FoodRestrictionInput = z.infer<typeof foodRestrictionSchema>;

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
export type ClientProgressQuery = z.infer<typeof clientProgressQuerySchema>;
