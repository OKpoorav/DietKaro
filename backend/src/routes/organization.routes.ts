import { Router } from 'express';
import { createOrganization, getOrganization } from '../controllers/organization.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { createOrganizationSchema } from '../schemas/organization.schema';

const router = Router();

// Org creation — uses Clerk auth directly (user may not have DB record yet)
router.post('/', validateBody(createOrganizationSchema), createOrganization);

// Protected routes
router.get('/', requireAuth, getOrganization);

export default router;
