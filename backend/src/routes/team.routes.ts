import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { listTeamMembers, inviteMember, validateInvite, acceptInvite, removeMember } from '../controllers/team.controller';

const router = Router();


router.get('/', requireAuth, listTeamMembers);
router.post('/invite', requireAuth, requireRole('admin', 'owner'), inviteMember);
router.get('/invitation/:token', validateInvite); // Public route
// No requireAuth — acceptInvite handles Clerk auth directly via getAuth()
// because the user may not have a DB record yet (that's what this endpoint creates)
router.post('/join', acceptInvite);
router.delete('/:memberId', requireAuth, requireRole('admin', 'owner'), removeMember);

export default router;
