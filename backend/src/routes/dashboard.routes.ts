import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getDashboardStats } from '../controllers/dashboard.controller';

const router = Router();

router.get('/stats', requireAuth, getDashboardStats);

export default router;
