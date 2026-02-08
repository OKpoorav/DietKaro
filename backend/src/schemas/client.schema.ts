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
    activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
    primaryDietitianId: z.string().uuid().optional(),
    dietaryPreferences: z.array(z.string().min(1).max(100)).max(30).optional().default([]),
    allergies: z.array(z.string().min(1).max(100)).max(20).optional().default([]),
    medicalConditions: z.array(z.string().min(1).max(100)).max(20).optional().default([]),
    medications: z.array(z.string().min(1).max(100)).max(30).optional().default([]),
    healthNotes: z.string().optional()
});

export const updateClientSchema = createClientSchema.partial();

export const clientIdParamSchema = z.object({
    id: z.string().uuid('Invalid client ID')
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
