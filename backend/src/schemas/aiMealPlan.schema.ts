import { z } from 'zod';

export const aiMealPlanDraftRequestSchema = z.object({
    // Either a client (uses allergies/diet for safety) OR template mode (prompt-only).
    clientId: z.string().uuid().optional(),
    templateMode: z.boolean().optional(),
    prompt: z.string().min(10).max(8000),
}).refine(
    (v) => !!v.clientId || v.templateMode === true,
    { message: 'clientId or templateMode is required', path: ['clientId'] },
);

export type AiMealPlanDraftRequest = z.infer<typeof aiMealPlanDraftRequestSchema>;
