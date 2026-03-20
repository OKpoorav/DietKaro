import { Router } from 'express';
import { createOrganization, getOrganization } from '../controllers/organization.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Protected route for creating new organizations (during onboarding)
router.post('/', requireAuth, createOrganization);

// Protected routes
router.get('/', requireAuth, getOrganization);

export default router;
