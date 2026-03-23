import { z } from 'zod';

export const registerSchema = z.object({
    email: z.string().email('Invalid email format'),
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    role: z.enum(['dietitian', 'admin']).default('dietitian'),
    orgId: z.string().uuid('Invalid organization ID'),
    phone: z.string().optional(),
    licenseNumber: z.string().optional(),
    specialization: z.string().optional(),
});

export const updateMeSchema = z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
    phone: z.string().optional(),
    specialization: z.string().optional(),
    bio: z.string().max(1000).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
