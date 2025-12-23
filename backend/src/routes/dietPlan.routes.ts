import { Router } from 'express';
import { createDietPlan, getDietPlan, listDietPlans, updateDietPlan, publishDietPlan } from '../controllers/dietPlan.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.post('/', createDietPlan);
router.get('/', listDietPlans);
router.get('/:id', getDietPlan);
router.patch('/:id', updateDietPlan);
router.post('/:id/publish', publishDietPlan);

export default router;
