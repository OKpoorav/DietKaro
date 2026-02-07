/**
 * Shared nutrition calculation utilities
 * Eliminates duplication across controllers
 */

interface FoodNutrition {
    calories: number;
    proteinG: number | null | any;
    carbsG: number | null | any;
    fatsG: number | null | any;
    fiberG: number | null | any;
    servingSizeG: number | any;
}

export interface ScaledNutrition {
    calories: number;
    proteinG: number | null;
    carbsG: number | null;
    fatsG: number | null;
    fiberG: number | null;
}

/**
 * Scale nutrition values based on quantity vs serving size
 */
export function scaleNutrition(food: FoodNutrition, quantityG: number): ScaledNutrition {
    const servingSize = Number(food.servingSizeG) || 100;
    const multiplier = quantityG / servingSize;

    return {
        calories: Math.round(food.calories * multiplier),
        proteinG: food.proteinG != null ? Math.round(Number(food.proteinG) * multiplier * 10) / 10 : null,
        carbsG: food.carbsG != null ? Math.round(Number(food.carbsG) * multiplier * 10) / 10 : null,
        fatsG: food.fatsG != null ? Math.round(Number(food.fatsG) * multiplier * 10) / 10 : null,
        fiberG: food.fiberG != null ? Math.round(Number(food.fiberG) * multiplier * 10) / 10 : null,
    };
}

/**
 * Sum nutrition across multiple food items
 */
export function sumNutrition(items: ScaledNutrition[]): ScaledNutrition {
    return items.reduce(
        (totals, item) => ({
            calories: totals.calories + item.calories,
            proteinG: (totals.proteinG ?? 0) + (item.proteinG ?? 0),
            carbsG: (totals.carbsG ?? 0) + (item.carbsG ?? 0),
            fatsG: (totals.fatsG ?? 0) + (item.fatsG ?? 0),
            fiberG: (totals.fiberG ?? 0) + (item.fiberG ?? 0),
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatsG: 0, fiberG: 0 }
    );
}
