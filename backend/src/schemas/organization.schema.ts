import { z } from 'zod';

export const createOrganizationSchema = z.object({
    name: z.string().min(2, 'Organization name must be at least 2 characters'),
    description: z.string().optional(),
    email: z.string().email('Invalid email format').optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().default('IN'),
    timezone: z.string().default('Asia/Kolkata')
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
