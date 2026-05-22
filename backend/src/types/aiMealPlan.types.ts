import type { ValidationSeverity, ValidationAlert } from './validation.types';

/**
 * Types for the AI Meal Plan Draft feature.
 *
 * Flow: the agent ingests natural-language meal-plan prose, calls tools to
 * search/create food items + validate them, then submits a normalized draft
 * via the `submit_draft` tool. The server re-validates ground-truth before
 * returning to the frontend.
 */

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export interface DraftFoodItem {
    /** UUID of a FoodItem the agent matched or created. */
    foodId: string;
    /** Display name as the agent resolved it (post-match). */
    foodName: string;
    /** Quantity in grams — already converted from household units by the agent. */
    quantityG: number;
    /** Original household quantity string ("1 katori", "2 roti") for UI display. */
    quantityLabel: string;
    /** Free-form notes from the dietitian prompt ("without oil"). */
    notes: string | null;
    /** 0 = primary, 1+ = alternatives in same meal. */
    optionGroup: number;
    /** True when the agent created this FoodItem mid-run (vs matched an existing one). */
    wasCreated: boolean;
}

/** Nutrition for a drafted item, scaled to its quantityG. Filled server-side. */
export interface ItemNutrition {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatsG: number;
    fiberG: number;
}

export interface DraftMeal {
    /** 1-indexed sequence within the day. */
    sequenceNumber: number;
    mealType: MealType;
    /** Display name ("Breakfast", "Mid-Morning Snack"). */
    name: string;
    /** "HH:mm" 24h or null when not mentioned. */
    timeOfDay: string | null;
    instructions: string | null;
    items: DraftFoodItem[];
}

export interface DraftDay {
    /** 1-indexed day number from the prompt. */
    dayNumber: number;
    meals: DraftMeal[];
}

/** Shape the agent emits via the submit_draft tool — before server-side re-validation. */
export interface AgentDraftPayload {
    days: DraftDay[];
}

/** Result of running validationEngine against a single drafted item. */
export interface ItemValidation {
    severity: ValidationSeverity;
    alerts: ValidationAlert[];
    /**
     * True when severity = RED and the alert is a hard block (allergy / diet pattern).
     * Frontend skips these on apply.
     */
    blocked: boolean;
}

/** A drafted item enriched with server-side validation result + scaled nutrition. */
export interface ResolvedFoodItem extends DraftFoodItem {
    validation: ItemValidation;
    nutrition: ItemNutrition;
}

export interface ResolvedMeal extends Omit<DraftMeal, 'items'> {
    items: ResolvedFoodItem[];
}

export interface ResolvedDay extends Omit<DraftDay, 'meals'> {
    meals: ResolvedMeal[];
}

export interface DraftSummary {
    totalItems: number;
    matchedItems: number;
    createdItems: number;
    blockedItems: number;
    warningItems: number;
}

/** Final payload returned to the frontend. */
export interface MealPlanDraftResult {
    days: ResolvedDay[];
    summary: DraftSummary;
    /** Items blocked due to hard restrictions — shown in toast. */
    blocked: Array<{ name: string; reason: string }>;
    /** New FoodItems the agent created during the run (for "added to library" toast). */
    createdFoodIds: string[];
}
