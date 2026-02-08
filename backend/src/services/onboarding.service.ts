/**
 * Client Onboarding Service
 * Handles multi-step onboarding with presets for common restriction patterns
 */

import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { ActivityLevel } from '@prisma/client';
import { validationEngine } from './validationEngine.service';

// ============ ONBOARDING STEP DEFINITIONS ============

export interface OnboardingStep {
    step: number;
    name: string;
    description: string;
    isRequired: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
    { step: 1, name: 'basic_info', description: 'Height, weight, and goal', isRequired: true },
    { step: 2, name: 'diet_pattern', description: 'Dietary pattern selection', isRequired: true },
    { step: 3, name: 'allergies', description: 'Allergies and intolerances', isRequired: false },
    { step: 4, name: 'restrictions', description: 'Food restrictions and fasting days', isRequired: false },
    { step: 5, name: 'preferences', description: 'Likes, dislikes, and cuisines', isRequired: false },
    { step: 6, name: 'body_measurements', description: 'Body measurements (optional)', isRequired: false },
];

// ============ RESTRICTION PRESETS ============

export interface RestrictionPreset {
    id: string;
    name: string;
    description: string;
    restrictions: any[];
}

export const RESTRICTION_PRESETS: RestrictionPreset[] = [
    {
        id: 'hindu_fasting_no_meat',
        name: 'Hindu Fasting (No Meat on Tue/Thu)',
        description: 'No non-veg on Tuesday and Thursday',
        restrictions: [{
            foodCategory: 'non_veg',
            restrictionType: 'day_based',
            avoidDays: ['tuesday', 'thursday'],
            severity: 'strict',
            reason: 'religious_fasting'
        }]
    },
    {
        id: 'hindu_fasting_eggs_ok',
        name: 'Hindu Fasting (Eggs OK on Tue/Thu)',
        description: 'No meat but eggs allowed on Tuesday and Thursday',
        restrictions: [{
            foodCategory: 'non_veg',
            restrictionType: 'day_based',
            avoidDays: ['tuesday', 'thursday'],
            excludes: ['eggs'],
            severity: 'strict',
            reason: 'religious_fasting'
        }]
    },
    {
        id: 'catholic_friday',
        name: 'Catholic (No Meat on Friday)',
        description: 'No meat on Friday, fish allowed',
        restrictions: [{
            foodCategory: 'non_veg',
            restrictionType: 'day_based',
            avoidDays: ['friday'],
            excludes: ['fish', 'seafood'],
            severity: 'strict',
            reason: 'religious_fasting'
        }]
    },
    {
        id: 'jain_strict',
        name: 'Jain Diet (No Root Vegetables)',
        description: 'No onion, garlic, potatoes, or root vegetables',
        restrictions: [
            {
                foodCategory: 'root_vegetables',
                restrictionType: 'always',
                includes: ['onion', 'garlic', 'potato', 'carrot', 'beetroot', 'radish'],
                severity: 'strict',
                reason: 'jain_diet'
            },
            {
                foodCategory: 'non_veg',
                restrictionType: 'always',
                severity: 'strict',
                reason: 'jain_diet'
            }
        ]
    },
    {
        id: 'islamic_halal',
        name: 'Halal (No Pork)',
        description: 'No pork products',
        restrictions: [{
            foodName: 'pork',
            restrictionType: 'always',
            severity: 'strict',
            reason: 'religious_dietary_law'
        }]
    },
    {
        id: 'navratri_fasting',
        name: 'Navratri Fasting',
        description: 'Only specific foods allowed during Navratri',
        restrictions: [
            {
                foodCategory: 'non_veg',
                restrictionType: 'always',
                severity: 'strict',
                reason: 'navratri_fast'
            },
            {
                foodCategory: 'grains',
                restrictionType: 'always',
                excludes: ['kuttu', 'singhara', 'sabudana', 'amaranth'],
                severity: 'strict',
                reason: 'navratri_fast'
            }
        ]
    }
];

// ============ ONBOARDING DATA INTERFACES ============

export interface Step1Data {
    heightCm: number;
    currentWeightKg: number;
    targetWeightKg?: number;
    dateOfBirth?: string;
    gender?: 'male' | 'female' | 'other';
    activityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
}

export interface Step2Data {
    dietPattern: 'vegetarian' | 'vegan' | 'non_veg' | 'pescatarian' | 'eggetarian';
    eggAllowed: boolean;
}

export interface Step3Data {
    allergies: string[];
    intolerances: string[];
}

export interface Step4Data {
    presetId?: string;
    customRestrictions?: any[];
    eggAvoidDays?: string[];
}

export interface Step5Data {
    dislikes: string[];
    likedFoods: string[];
    preferredCuisines: string[];
}

export interface Step6Data {
    chestCm?: number;
    waistCm?: number;
    hipsCm?: number;
    thighsCm?: number;
    armsCm?: number;
    bodyFatPercentage?: number;
}

// ============ SERVICE ============

export class OnboardingService {

    /**
     * Get all onboarding steps
     */
    getSteps(): OnboardingStep[] {
        return ONBOARDING_STEPS;
    }

    /**
     * Get all restriction presets
     */
    getPresets(): RestrictionPreset[] {
        return RESTRICTION_PRESETS;
    }

    /**
     * Get current onboarding status for a client
     */
    async getOnboardingStatus(clientId: string): Promise<{
        isComplete: boolean;
        currentStep: number;
        totalSteps: number;
        completedSteps: number[];
        percentComplete: number;
        stepsData: Record<string, any>;
    }> {
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: {
                onboardingCompleted: true,
                heightCm: true,
                currentWeightKg: true,
                targetWeightKg: true,
                gender: true,
                activityLevel: true,
                dietPattern: true,
                eggAllowed: true,
                allergies: true,
                intolerances: true,
                foodRestrictions: true,
                eggAvoidDays: true,
                dislikes: true,
                likedFoods: true,
                preferredCuisines: true,
            }
        });

        if (!client) throw new Error('Client not found');

        const completedSteps: number[] = [];
        const stepsData: Record<string, any> = {};

        // Check step 1
        if (client.heightCm && client.currentWeightKg) {
            completedSteps.push(1);
        }
        stepsData.step1 = {
            heightCm: client.heightCm ? Number(client.heightCm) : null,
            currentWeightKg: client.currentWeightKg ? Number(client.currentWeightKg) : null,
            targetWeightKg: client.targetWeightKg ? Number(client.targetWeightKg) : null,
            gender: client.gender,
            activityLevel: client.activityLevel,
        };

        // Check step 2
        if (client.dietPattern) {
            completedSteps.push(2);
        }
        stepsData.step2 = {
            dietPattern: client.dietPattern,
            eggAllowed: client.eggAllowed,
        };

        // Check step 3 (optional — completed if allergies were explicitly set, even empty)
        if (client.allergies && client.allergies.length > 0) {
            completedSteps.push(3);
        }
        stepsData.step3 = {
            allergies: client.allergies || [],
            intolerances: client.intolerances || [],
        };

        // Check step 4 (optional)
        if (client.foodRestrictions && (client.foodRestrictions as any[]).length > 0) {
            completedSteps.push(4);
        }
        stepsData.step4 = {
            foodRestrictions: client.foodRestrictions || [],
            eggAvoidDays: client.eggAvoidDays || [],
        };

        // Check step 5 (optional)
        if (client.dislikes && client.dislikes.length > 0) {
            completedSteps.push(5);
        }
        stepsData.step5 = {
            dislikes: client.dislikes || [],
            likedFoods: client.likedFoods || [],
            preferredCuisines: client.preferredCuisines || [],
        };

        // Check step 6 — body measurements
        const bodyMeasurement = await prisma.bodyMeasurement.findFirst({
            where: { clientId },
            orderBy: { logDate: 'desc' },
        });
        if (bodyMeasurement) {
            completedSteps.push(6);
        }
        stepsData.step6 = bodyMeasurement ? {
            chestCm: bodyMeasurement.chestCm ? Number(bodyMeasurement.chestCm) : null,
            waistCm: bodyMeasurement.waistCm ? Number(bodyMeasurement.waistCm) : null,
            hipsCm: bodyMeasurement.hipsCm ? Number(bodyMeasurement.hipsCm) : null,
            thighsCm: bodyMeasurement.thighsCm ? Number(bodyMeasurement.thighsCm) : null,
            armsCm: bodyMeasurement.armsCm ? Number(bodyMeasurement.armsCm) : null,
            bodyFatPercentage: bodyMeasurement.bodyFatPercentage ? Number(bodyMeasurement.bodyFatPercentage) : null,
        } : null;

        const totalSteps = ONBOARDING_STEPS.length;

        return {
            isComplete: client.onboardingCompleted,
            currentStep: completedSteps.length > 0 ? Math.max(...completedSteps) + 1 : 1,
            totalSteps,
            completedSteps,
            percentComplete: Math.round((completedSteps.length / totalSteps) * 100),
            stepsData,
        };
    }

    /**
     * Save Step 1: Basic Info
     */
    async saveStep1(clientId: string, data: Step1Data): Promise<void> {
        await prisma.client.update({
            where: { id: clientId },
            data: {
                heightCm: data.heightCm,
                currentWeightKg: data.currentWeightKg,
                targetWeightKg: data.targetWeightKg,
                dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
                gender: data.gender,
                activityLevel: data.activityLevel as ActivityLevel,
            }
        });
        logger.info('Onboarding step 1 saved', { clientId });
    }

    /**
     * Save Step 2: Diet Pattern
     */
    async saveStep2(clientId: string, data: Step2Data): Promise<void> {
        await prisma.client.update({
            where: { id: clientId },
            data: {
                dietPattern: data.dietPattern,
                eggAllowed: data.eggAllowed,
            }
        });
        validationEngine.invalidateClientCache(clientId);
        logger.info('Onboarding step 2 saved', { clientId });
    }

    /**
     * Save Step 3: Allergies
     */
    async saveStep3(clientId: string, data: Step3Data): Promise<void> {
        await prisma.client.update({
            where: { id: clientId },
            data: {
                allergies: data.allergies,
                intolerances: data.intolerances,
            }
        });
        validationEngine.invalidateClientCache(clientId);
        logger.info('Onboarding step 3 saved', { clientId });
    }

    /**
     * Save Step 4: Restrictions
     */
    async saveStep4(clientId: string, data: Step4Data): Promise<void> {
        // Get restrictions from preset or custom
        let restrictions: any[] = [];

        if (data.presetId) {
            const preset = RESTRICTION_PRESETS.find(p => p.id === data.presetId);
            if (preset) {
                restrictions = preset.restrictions;
            }
        }

        if (data.customRestrictions) {
            restrictions = [...restrictions, ...data.customRestrictions];
        }

        await prisma.client.update({
            where: { id: clientId },
            data: {
                foodRestrictions: restrictions,
                eggAvoidDays: data.eggAvoidDays || [],
            }
        });
        validationEngine.invalidateClientCache(clientId);
        logger.info('Onboarding step 4 saved', { clientId, restrictionCount: restrictions.length });
    }

    /**
     * Save Step 5: Preferences
     */
    async saveStep5(clientId: string, data: Step5Data): Promise<void> {
        await prisma.client.update({
            where: { id: clientId },
            data: {
                dislikes: data.dislikes,
                likedFoods: data.likedFoods,
                preferredCuisines: data.preferredCuisines,
            }
        });
        validationEngine.invalidateClientCache(clientId);
        logger.info('Onboarding step 5 saved', { clientId });
    }

    /**
     * Save Step 6: Body Measurements (optional)
     */
    async saveStep6(clientId: string, data: Step6Data): Promise<void> {
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: { orgId: true },
        });
        if (!client) throw new Error('Client not found');

        await prisma.bodyMeasurement.create({
            data: {
                clientId,
                orgId: client.orgId,
                logDate: new Date(),
                chestCm: data.chestCm,
                waistCm: data.waistCm,
                hipsCm: data.hipsCm,
                thighsCm: data.thighsCm,
                armsCm: data.armsCm,
                bodyFatPercentage: data.bodyFatPercentage,
            }
        });
        logger.info('Onboarding step 6 saved', { clientId });
    }

    /**
     * Complete onboarding (can be called manually)
     */
    async completeOnboarding(clientId: string): Promise<void> {
        await prisma.client.update({
            where: { id: clientId },
            data: { onboardingCompleted: true }
        });
        logger.info('Onboarding marked complete', { clientId });
    }
}

export const onboardingService = new OnboardingService();
