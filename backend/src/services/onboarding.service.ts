/**
 * Client Onboarding Service
 * Handles multi-step onboarding with presets for common restriction patterns
 */

import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { ActivityLevel } from '@prisma/client';

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
        completedSteps: number[];
        stepsData: Record<string, any>;
    }> {
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: {
                onboardingCompleted: true,
                heightCm: true,
                currentWeightKg: true,
                dietPattern: true,
                allergies: true,
                eggAvoidDays: true,
                dislikes: true,
            }
        });

        if (!client) throw new Error('Client not found');

        const completedSteps: number[] = [];

        // Check step 1
        if (client.heightCm && client.currentWeightKg) {
            completedSteps.push(1);
        }

        // Check step 2
        if (client.dietPattern) {
            completedSteps.push(2);
        }

        // Check step 3
        if (client.allergies && client.allergies.length > 0) {
            completedSteps.push(3);
        }

        // Check step 4
        if (client.eggAvoidDays && client.eggAvoidDays.length > 0) {
            completedSteps.push(4);
        }

        // Check step 5
        if (client.dislikes && client.dislikes.length > 0) {
            completedSteps.push(5);
        }

        return {
            isComplete: client.onboardingCompleted,
            currentStep: completedSteps.length > 0 ? Math.max(...completedSteps) + 1 : 1,
            completedSteps,
            stepsData: {}
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
                onboardingCompleted: true, // Mark complete on last step
            }
        });
        logger.info('Onboarding step 5 saved, onboarding complete', { clientId });
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
