/**
 * Validation Routes
 * Diet validation API endpoints
 */

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import {
    checkValidation,
    checkBatchValidation,
    invalidateCache
} from '../controllers/validation.controller';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// POST /api/v1/diet-validation/check - Single food validation
router.post('/check', checkValidation);

// POST /api/v1/diet-validation/batch - Batch food validation
router.post('/batch', checkBatchValidation);

// POST /api/v1/diet-validation/invalidate-cache - Clear cache (admin/owner only)
router.post('/invalidate-cache', requireRole('admin', 'owner'), invalidateCache);

export default router;
