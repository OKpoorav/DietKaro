import { Router } from 'express';
import { checkClientEmail, clerkLogin, getClientProfile, updateClientProfile, refreshClientToken, logoutClient } from '../controllers/clientAuth.controller';
import { requireClientAuth } from '../middleware/clientAuth.middleware';

// TODO: Re-enable OTP rate limiters when SMS delivery is set up
// import { otpRequestLimiter, otpVerifyLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public routes
// TODO: Re-enable phone OTP routes when SMS delivery is configured
// router.post('/request-otp', otpRequestLimiter, requestOTP);
// router.post('/verify-otp', otpVerifyLimiter, verifyOTP);

router.post('/check-email', checkClientEmail);
router.post('/clerk-login', clerkLogin);
router.post('/refresh', refreshClientToken);

// Protected routes (require client JWT)
router.get('/me', requireClientAuth, getClientProfile);
router.patch('/me', requireClientAuth, updateClientProfile);
router.post('/logout', requireClientAuth, logoutClient);

export default router;
