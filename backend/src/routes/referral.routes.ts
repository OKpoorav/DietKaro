import { Router } from 'express';
import { getReferralCode, getReferralStats, validateReferralCode } from '../controllers/referral.controller';
import { requireClientAuth } from '../middleware/clientAuth.middleware';

const router = Router();

// All routes require client authentication
router.use(requireClientAuth);

// Get or generate referral code
router.get('/code', getReferralCode);

// Get referral statistics and benefits
router.get('/stats', getReferralStats);

// Validate a referral code
router.get('/validate/:code', validateReferralCode);

export default router;
