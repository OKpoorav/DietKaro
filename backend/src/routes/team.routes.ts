import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { listTeamMembers, inviteMember, validateInvite, acceptInvite } from '../controllers/team.controller';

const router = Router();


router.get('/', requireAuth, listTeamMembers);
router.post('/invite', requireAuth, requireRole('admin', 'owner'), inviteMember);
router.get('/invitation/:token', validateInvite); // Public route
router.post('/join', acceptInvite);

export default router;
