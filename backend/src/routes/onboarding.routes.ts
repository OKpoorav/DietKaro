import { Router } from 'express';
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

const router = Router({ mergeParams: true }); // mergeParams to access :clientId

router.use(requireAuth);

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
