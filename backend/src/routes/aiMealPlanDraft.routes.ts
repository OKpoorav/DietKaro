import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import { aiMealPlanDraftRequestSchema } from '../schemas/aiMealPlan.schema';
import { generateAiMealPlanDraft } from '../controllers/aiMealPlanDraft.controller';

const router = Router();

router.use(requireAuth);

router.post(
    '/',
    writeOperationLimiter,
    validateBody(aiMealPlanDraftRequestSchema),
    generateAiMealPlanDraft,
);

export default router;
