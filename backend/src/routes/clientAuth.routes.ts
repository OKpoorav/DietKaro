import { Router } from 'express';
import { requestOTP, verifyOTP, getClientProfile, updateClientProfile } from '../controllers/clientAuth.controller';
import { requireClientAuth } from '../middleware/clientAuth.middleware';

const router = Router();

// Public routes
router.post('/request-otp', requestOTP);
router.post('/verify-otp', verifyOTP);

// Protected routes (require client JWT)
router.get('/me', requireClientAuth, getClientProfile);
router.patch('/me', requireClientAuth, updateClientProfile);

export default router;
