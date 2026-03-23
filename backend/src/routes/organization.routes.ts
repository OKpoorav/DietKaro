import { Router } from 'express';
import { createOrganization, getOrganization } from '../controllers/organization.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { createOrganizationSchema } from '../schemas/organization.schema';

const router = Router();

// Protected route for creating new organizations (during onboarding)
router.post('/', requireAuth, validateBody(createOrganizationSchema), createOrganization);

// Protected routes
router.get('/', requireAuth, getOrganization);

export default router;
