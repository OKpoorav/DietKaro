import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import {
    getOrCreateConversation,
    listUserConversations,
    getUserMessages,
    getUserUnreadCounts,
} from '../controllers/chat.controller';

const router = Router();

router.use(requireAuth);

router.get('/conversations', listUserConversations);
router.post('/conversations/with/:clientId', writeOperationLimiter, getOrCreateConversation);
router.get('/conversations/:conversationId/messages', getUserMessages);
router.get('/unread', getUserUnreadCounts);

export default router;
