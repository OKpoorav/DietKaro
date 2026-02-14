import { Router } from 'express';
import { requestOTP, verifyOTP, getClientProfile, updateClientProfile, refreshClientToken, logoutClient } from '../controllers/clientAuth.controller';
import { requireClientAuth } from '../middleware/clientAuth.middleware';
import { otpRequestLimiter, otpVerifyLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public routes
router.post('/request-otp', otpRequestLimiter, requestOTP);
router.post('/verify-otp', otpVerifyLimiter, verifyOTP);
router.post('/refresh', refreshClientToken);

// Protected routes (require client JWT)
router.get('/me', requireClientAuth, getClientProfile);
router.patch('/me', requireClientAuth, updateClientProfile);
router.post('/logout', requireClientAuth, logoutClient);

export default router;
