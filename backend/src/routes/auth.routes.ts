import { Router } from 'express';
import { register, syncUser, getMe, updateMe } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { registerSchema, updateMeSchema } from '../schemas/auth.schema';

const router = Router();

// Public route - called after Clerk signup
router.post('/register', validateBody(registerSchema), register);

// Protected routes - require valid Clerk token
router.post('/sync', requireAuth, syncUser);
router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, validateBody(updateMeSchema), updateMe);

export default router;
