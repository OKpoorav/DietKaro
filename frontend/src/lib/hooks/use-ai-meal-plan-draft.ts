'use client';

import { useMutation } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export type DraftSeverity = 'RED' | 'YELLOW' | 'GREEN';

export interface DraftValidationAlert {
    type: string;
    severity: string;
    message: string;
    recommendation?: string;
}

export interface DraftItemNutrition {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatsG: number;
    fiberG: number;
}

export interface DraftFoodItem {
    foodId: string;
    foodName: string;
    quantityG: number;
    quantityLabel: string;
    notes: string | null;
    optionGroup: number;
    wasCreated: boolean;
    nutrition: DraftItemNutrition;
    validation: {
        severity: DraftSeverity;
        alerts: DraftValidationAlert[];
        blocked: boolean;
    };
}

export interface DraftMeal {
    sequenceNumber: number;
    mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
    name: string;
    timeOfDay: string | null;
    instructions: string | null;
    items: DraftFoodItem[];
}

export interface DraftDay {
    dayNumber: number;
    /** Whole-day note populated by the AI. Surfaced above the day's meals. */
    note?: string | null;
    meals: DraftMeal[];
}

export interface DraftSummary {
    totalItems: number;
    matchedItems: number;
    createdItems: number;
    blockedItems: number;
    warningItems: number;
}

export interface MealPlanDraftResult {
    days: DraftDay[];
    summary: DraftSummary;
    blocked: Array<{ name: string; reason: string }>;
    createdFoodIds: string[];
}

export function useAiMealPlanDraft() {
    const api = useApiClient();
    return useMutation({
        mutationFn: async (input: { clientId?: string | null; prompt: string; templateMode?: boolean }): Promise<MealPlanDraftResult> => {
            // Agent can run 30-90s for multi-day plans; explicit long timeout so
            // axios doesn't bail before nginx/upstream replies.
            const body: Record<string, unknown> = { prompt: input.prompt };
            if (input.clientId) body.clientId = input.clientId;
            if (input.templateMode || !input.clientId) body.templateMode = true;
            const { data } = await api.post('/diet-plans/ai-draft', body, { timeout: 180_000 });
            return data.data as MealPlanDraftResult;
        },
    });
}
