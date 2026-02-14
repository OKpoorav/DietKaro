import type { Client } from '@/lib/hooks/use-clients';

/**
 * Shared types for diet plan builder and related components.
 * ClientData is derived from the canonical Client type to stay in sync.
 */
export type ClientData = Partial<Pick<Client,
    | 'fullName' | 'targetWeightKg' | 'dateOfBirth' | 'heightCm'
    | 'currentWeightKg' | 'email' | 'phone' | 'gender'
    | 'medicalProfile' | 'allergies' | 'intolerances' | 'dietPattern'
    | 'medicalConditions' | 'foodRestrictions' | 'dislikes' | 'likedFoods'
    | 'targetCalories' | 'targetProteinG' | 'targetCarbsG' | 'targetFatsG'
>>;

export interface FoodItemData {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    validationSeverity?: 'RED' | 'YELLOW' | 'GREEN';
    validationAlerts?: Array<{ type: string; severity: string; message: string; recommendation?: string }>;
}

export interface NutritionTargets {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

export interface DayNutrition {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

export interface LocalFoodItem {
    id: string; // db food id
    tempId: string; // unique local id
    name: string;
    quantity: string;
    quantityValue: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    hasWarning: boolean;
    validationSeverity?: 'RED' | 'YELLOW' | 'GREEN';
    validationAlerts?: Array<{ type: string; severity: string; message: string; recommendation?: string }>;
    optionGroup: number; // 0 = default, 1+ = alternatives
    optionLabel?: string; // e.g. "Oatmeal Bowl", "Egg Plate"
}

export interface LocalMeal {
    id: string;
    name: string;
    type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    time: string;
    foods: LocalFoodItem[];
}

export interface TemplateData {
    id: string;
    name?: string;
    checkInFrequency?: string;
}
