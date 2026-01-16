import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
    downloadDietPlanPdf,
    getDietPlanPrintView,
    emailDietPlan,
    getDietPlanShareLink,
} from '../controllers/share.controller';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// PDF download
router.get('/diet-plans/:id/pdf', downloadDietPlanPdf);

// Print-friendly HTML view
router.get('/diet-plans/:id/print', getDietPlanPrintView);

// Email diet plan to client
router.post('/diet-plans/:id/email', emailDietPlan);

// Get WhatsApp share link
router.get('/diet-plans/:id/whatsapp', getDietPlanShareLink);

export default router;
