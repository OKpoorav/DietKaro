import { Router } from 'express';
import { register, syncUser, getMe, updateMe } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Public route - called after Clerk signup
router.post('/register', register);

// Protected routes - require valid Clerk token
router.post('/sync', requireAuth, syncUser);
router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, updateMe);

export default router;
