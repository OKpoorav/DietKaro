import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { getDashboardStats, getDietitianAnalytics } from '../controllers/dashboard.controller';

const router = Router();

router.get('/stats', requireAuth, getDashboardStats);
router.get('/dietitian-analytics', requireAuth, requireRole('admin', 'owner'), getDietitianAnalytics);

export default router;
