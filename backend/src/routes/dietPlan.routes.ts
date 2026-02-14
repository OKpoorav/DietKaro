import { Router } from 'express';
import { createDietPlan, getDietPlan, listDietPlans, updateDietPlan, publishDietPlan, assignTemplateToClient } from '../controllers/dietPlan.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireActiveSubscription } from '../middleware/subscription.middleware';

const router = Router();

router.use(requireAuth);
router.use(requireActiveSubscription);

router.post('/', createDietPlan);
router.get('/', listDietPlans);
router.get('/:id', getDietPlan);
router.patch('/:id', updateDietPlan);
router.post('/:id/publish', publishDietPlan);
router.post('/:id/assign', assignTemplateToClient);

export default router;
