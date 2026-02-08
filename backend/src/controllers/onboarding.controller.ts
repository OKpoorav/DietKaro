/**
 * Onboarding Controller
 * Handles client onboarding flow API endpoints
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { onboardingService } from '../services/onboarding.service';

/**
 * GET /api/v1/clients/:clientId/onboarding/steps
 * Get all onboarding steps
 */
export const getOnboardingSteps = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const steps = onboardingService.getSteps();

    res.status(200).json({
        success: true,
        data: steps
    });
});

/**
 * GET /api/v1/clients/:clientId/onboarding/presets
 * Get all restriction presets
 */
export const getRestrictionPresets = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const presets = onboardingService.getPresets();

    res.status(200).json({
        success: true,
        data: presets
    });
});

/**
 * GET /api/v1/clients/:clientId/onboarding/status
 * Get onboarding status for a client
 */
export const getOnboardingStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.params;

    const status = await onboardingService.getOnboardingStatus(clientId);

    res.status(200).json({
        success: true,
        data: status
    });
});

/**
 * POST /api/v1/clients/:clientId/onboarding/step/1
 * Save Step 1: Basic Info
 */
export const saveStep1 = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.params;
    const { heightCm, currentWeightKg, targetWeightKg, dateOfBirth, gender, activityLevel } = req.body;

    await onboardingService.saveStep1(clientId, {
        heightCm,
        currentWeightKg,
        targetWeightKg,
        dateOfBirth,
        gender,
        activityLevel
    });

    res.status(200).json({
        success: true,
        message: 'Step 1 saved successfully'
    });
});

/**
 * POST /api/v1/clients/:clientId/onboarding/step/2
 * Save Step 2: Diet Pattern
 */
export const saveStep2 = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.params;
    const { dietPattern, eggAllowed } = req.body;

    await onboardingService.saveStep2(clientId, {
        dietPattern,
        eggAllowed
    });

    res.status(200).json({
        success: true,
        message: 'Step 2 saved successfully'
    });
});

/**
 * POST /api/v1/clients/:clientId/onboarding/step/3
 * Save Step 3: Allergies
 */
export const saveStep3 = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.params;
    const { allergies, intolerances } = req.body;

    await onboardingService.saveStep3(clientId, {
        allergies: allergies || [],
        intolerances: intolerances || []
    });

    res.status(200).json({
        success: true,
        message: 'Step 3 saved successfully'
    });
});

/**
 * POST /api/v1/clients/:clientId/onboarding/step/4
 * Save Step 4: Restrictions
 */
export const saveStep4 = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.params;
    const { presetId, customRestrictions, eggAvoidDays } = req.body;

    await onboardingService.saveStep4(clientId, {
        presetId,
        customRestrictions,
        eggAvoidDays
    });

    res.status(200).json({
        success: true,
        message: 'Step 4 saved successfully'
    });
});

/**
 * POST /api/v1/clients/:clientId/onboarding/step/5
 * Save Step 5: Preferences
 */
export const saveStep5 = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.params;
    const { dislikes, likedFoods, preferredCuisines } = req.body;

    await onboardingService.saveStep5(clientId, {
        dislikes: dislikes || [],
        likedFoods: likedFoods || [],
        preferredCuisines: preferredCuisines || []
    });

    res.status(200).json({
        success: true,
        message: 'Step 5 saved successfully'
    });
});

/**
 * POST /api/v1/clients/:clientId/onboarding/step/6
 * Save Step 6: Body Measurements
 */
export const saveStep6 = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.params;
    const { chestCm, waistCm, hipsCm, thighsCm, armsCm, bodyFatPercentage } = req.body;

    await onboardingService.saveStep6(clientId, {
        chestCm,
        waistCm,
        hipsCm,
        thighsCm,
        armsCm,
        bodyFatPercentage
    });

    res.status(200).json({
        success: true,
        message: 'Step 6 saved successfully'
    });
});

/**
 * POST /api/v1/clients/:clientId/onboarding/complete
 * Manually mark onboarding as complete
 */
export const completeOnboarding = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.params;

    await onboardingService.completeOnboarding(clientId);

    res.status(200).json({
        success: true,
        message: 'Onboarding marked as complete'
    });
});
