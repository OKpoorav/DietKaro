import { Router } from 'express';
import { createOrganization, getOrganization } from '../controllers/organization.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Public route for creating new organizations (during onboarding)
router.post('/', createOrganization);

// Protected routes
router.get('/', requireAuth, getOrganization);

export default router;
