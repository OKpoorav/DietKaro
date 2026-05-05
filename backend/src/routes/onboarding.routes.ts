import { Router, Response } from 'express';
import {
    getOnboardingSteps,
    getRestrictionPresets,
    getOnboardingStatus,
    saveStep1,
    saveStep2,
    saveStep3,
    saveStep4,
    saveStep5,
    saveStep6,
    completeOnboarding
} from '../controllers/onboarding.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import { AuthenticatedRequest } from '../types/auth.types';
import * as inviteService from '../services/onboardingInvite.service';
import { env } from '../config/env';

const router = Router({ mergeParams: true }); // mergeParams to access :clientId

router.use(requireAuth);

// ── Invite endpoints (must be before generic /status to avoid conflicts) ──
router.get('/invite/status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const status = await inviteService.getInviteStatus(req.params.clientId, req.user.organizationId);
    res.json({ success: true, data: status });
}));

router.post('/invite', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const token = await inviteService.generateInvite(req.params.clientId, req.user.organizationId);
    const link = `${env.FRONTEND_URL}/onboarding?token=${token}`;
    res.status(201).json({ success: true, data: { link, expiresInDays: 3 } });
}));

router.post('/invite/resend', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const token = await inviteService.generateInvite(req.params.clientId, req.user.organizationId);
    const link = `${env.FRONTEND_URL}/onboarding?token=${token}`;
    res.status(201).json({ success: true, data: { link, expiresInDays: 3 } });
}));

// Get onboarding info
router.get('/steps', getOnboardingSteps);
router.get('/presets', getRestrictionPresets);
router.get('/status', getOnboardingStatus);

// Save individual steps
router.post('/step/1', saveStep1);
router.post('/step/2', saveStep2);
router.post('/step/3', saveStep3);
router.post('/step/4', saveStep4);
router.post('/step/5', saveStep5);
router.post('/step/6', saveStep6);

// Complete manually
router.post('/complete', completeOnboarding);

export default router;
