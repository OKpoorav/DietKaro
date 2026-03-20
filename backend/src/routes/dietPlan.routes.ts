import { Router } from 'express';
import { createDietPlan, getDietPlan, listDietPlans, updateDietPlan, publishDietPlan, assignTemplateToClient } from '../controllers/dietPlan.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireActiveSubscription } from '../middleware/subscription.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(requireAuth);
router.use(requireActiveSubscription);

router.post('/', writeOperationLimiter, createDietPlan);
router.get('/', listDietPlans);
router.get('/:id', getDietPlan);
router.patch('/:id', writeOperationLimiter, updateDietPlan);
router.post('/:id/publish', writeOperationLimiter, publishDietPlan);
router.post('/:id/assign', writeOperationLimiter, assignTemplateToClient);

export default router;
