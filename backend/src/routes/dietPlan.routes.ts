import { Router } from 'express';
import { createDietPlan, getDietPlan, listDietPlans, updateDietPlan, publishDietPlan, assignTemplateToClient, extendDietPlan } from '../controllers/dietPlan.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireActiveSubscription } from '../middleware/subscription.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validation.middleware';
import { createDietPlanSchema, updateDietPlanSchema, assignTemplateSchema } from '../schemas/dietPlan.schema';

const router = Router();

router.use(requireAuth);
router.use(requireActiveSubscription);

router.post('/', writeOperationLimiter, validateBody(createDietPlanSchema), createDietPlan);
router.get('/', listDietPlans);
router.get('/:id', getDietPlan);
router.patch('/:id', writeOperationLimiter, validateBody(updateDietPlanSchema), updateDietPlan);
router.post('/:id/publish', writeOperationLimiter, publishDietPlan);
router.post('/:id/assign', writeOperationLimiter, validateBody(assignTemplateSchema), assignTemplateToClient);
router.post('/:id/extend', writeOperationLimiter, extendDietPlan);

export default router;
