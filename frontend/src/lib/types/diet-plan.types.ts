import type { FoodRestriction } from '@/lib/hooks/use-validation';

/**
 * Shared types for diet plan builder and related components
 */

export interface ClientData {
    fullName?: string;
    targetWeightKg?: number;
    dateOfBirth?: string;
    heightCm?: number;
    currentWeightKg?: number;
    email?: string;
    phone?: string;
    gender?: string;
    medicalProfile?: {
        allergies?: string[];
        conditions?: string[];
    };
    allergies?: string[];
    intolerances?: string[];
    dietPattern?: string;
    medicalConditions?: string[];
    foodRestrictions?: FoodRestriction[];
    dislikes?: string[];
    likedFoods?: string[];
}

export interface FoodItemData {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
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
