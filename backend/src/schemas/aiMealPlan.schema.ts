import { z } from 'zod';

export const aiMealPlanDraftRequestSchema = z.object({
    clientId: z.string().uuid(),
    prompt: z.string().min(10).max(8000),
});

export type AiMealPlanDraftRequest = z.infer<typeof aiMealPlanDraftRequestSchema>;
