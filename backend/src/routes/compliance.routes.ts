import { Router } from 'express';
import {
    getDailyAdherence,
    getWeeklyAdherence,
    getComplianceHistory,
} from '../controllers/compliance.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/daily', getDailyAdherence);
router.get('/weekly', getWeeklyAdherence);
router.get('/history', getComplianceHistory);

export default router;
