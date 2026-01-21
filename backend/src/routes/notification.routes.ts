import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { registerToken, listNotifications, markRead } from '../controllers/notification.controller';

const router = Router();

router.use(requireAuth);

router.post('/device-token', registerToken);
router.get('/', listNotifications);
router.patch('/:id/read', markRead);

export default router;
