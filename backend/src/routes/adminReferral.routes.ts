import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
    getOrgReferralStats,
    getClientReferrals,
    listClientsWithReferrals,
    redeemFreeBenefit,
} from '../controllers/adminReferral.controller';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Get overall referral statistics for the org
router.get('/stats', getOrgReferralStats);

// Get list of clients with their referral info
router.get('/clients', listClientsWithReferrals);

// Get referrals made by a specific client
router.get('/clients/:clientId/referrals', getClientReferrals);

// Redeem a free month for a client
router.post('/clients/:clientId/redeem', redeemFreeBenefit);

export default router;
