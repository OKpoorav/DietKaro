/**
 * Food Tagging Service
 * Auto-detects and manages food tags for validation engine
 */

import prisma from '../utils/prisma';
import logger from '../utils/logger';

// ============ DIETARY CATEGORY DETECTION ============

const NON_VEG_KEYWORDS = [
    'chicken', 'mutton', 'lamb', 'beef', 'pork', 'fish', 'prawn', 'shrimp',
    'crab', 'lobster', 'salmon', 'tuna', 'meat', 'bacon', 'ham', 'sausage',
    'turkey', 'duck', 'goat', 'keema', 'tikka', 'tandoori', 'kebab',
    'biryani chicken', 'butter chicken', 'fish curry', 'fish fry'
];

const EGG_KEYWORDS = ['egg', 'omelette', 'omelet', 'scrambled', 'boiled egg', 'fried egg'];

const DAIRY_KEYWORDS = [
    'milk', 'cheese', 'paneer', 'curd', 'yogurt', 'yoghurt', 'butter', 'ghee',
    'cream', 'kheer', 'lassi', 'raita', 'shrikhand', 'kulfi'
];

const VEGAN_INDICATORS = [
    'vegan', 'plant-based', 'dairy-free', 'no milk', 'no cheese'
];

// ============ ALLERGEN MAPPING ============

const ALLERGEN_KEYWORDS: Record<string, string[]> = {
    eggs: ['egg', 'omelette', 'omelet', 'mayonnaise', 'mayo'],
    milk: ['milk', 'cheese', 'paneer', 'curd', 'yogurt', 'cream', 'butter', 'ghee', 'kheer', 'kulfi'],
    peanuts: ['peanut', 'groundnut', 'mungfali'],
    tree_nuts: ['almond', 'cashew', 'walnut', 'pistachio', 'badam', 'kaju'],
    wheat: ['wheat', 'roti', 'chapati', 'paratha', 'naan', 'bread', 'pasta', 'maida'],
    gluten: ['wheat', 'barley', 'rye', 'bread', 'pasta', 'noodles'],
    soy: ['soy', 'soya', 'tofu', 'tempeh'],
    fish: ['fish', 'salmon', 'tuna', 'mackerel', 'sardine'],
    shellfish: ['prawn', 'shrimp', 'crab', 'lobster', 'mussel', 'oyster'],
    sesame: ['sesame', 'til', 'tahini'],
    lactose: ['milk', 'cream', 'ice cream', 'cheese'],
};

// ============ NUTRITION TAG THRESHOLDS ============

const NUTRITION_THRESHOLDS = {
    high_protein: { field: 'proteinG', min: 20 },
    low_protein: { field: 'proteinG', max: 5 },
    high_carb: { field: 'carbsG', min: 50 },
    low_carb: { field: 'carbsG', max: 10 },
    high_fat: { field: 'fatsG', min: 20 },
    low_fat: { field: 'fatsG', max: 3 },
    high_fiber: { field: 'fiberG', min: 5 },
    high_sugar: { field: 'sugarG', min: 15 },
    low_sugar: { field: 'sugarG', max: 2 },
    high_sodium: { field: 'sodiumMg', min: 500 },
    low_sodium: { field: 'sodiumMg', max: 100 },
    high_calorie: { field: 'calories', min: 400 },
    low_calorie: { field: 'calories', max: 100 },
};

// ============ HEALTH FLAGS ============

const HEALTH_FLAG_RULES: Record<string, (food: any) => boolean> = {
    diabetic_caution: (food) => (food.sugarG || 0) > 10 || (food.carbsG || 0) > 40,
    heart_caution: (food) => (food.fatsG || 0) > 15 || (food.sodiumMg || 0) > 400,
    cholesterol_caution: (food) => food.name.toLowerCase().includes('egg') || food.name.toLowerCase().includes('butter'),
    kidney_caution: (food) => (food.sodiumMg || 0) > 500 || (food.proteinG || 0) > 25,
};

// ============ SERVICE CLASS ============

export class FoodTaggingService {

    /**
     * Auto-detect dietary category from food name
     */
    detectDietaryCategory(name: string, currentCategory?: string | null): string | null {
        const nameLower = name.toLowerCase();

        // Check if explicitly marked
        if (VEGAN_INDICATORS.some(v => nameLower.includes(v))) {
            return 'vegan';
        }

        // Check for non-veg
        if (NON_VEG_KEYWORDS.some(kw => nameLower.includes(kw))) {
            return 'non_veg';
        }

        // Check for egg (veg_with_egg)
        if (EGG_KEYWORDS.some(kw => nameLower.includes(kw))) {
            return 'veg_with_egg';
        }

        // Check for dairy (vegetarian but not vegan)
        if (DAIRY_KEYWORDS.some(kw => nameLower.includes(kw))) {
            return 'vegetarian';
        }

        // Default to vegetarian for unknown Indian foods
        return currentCategory || 'vegetarian';
    }

    /**
     * Auto-detect allergens from food name
     */
    detectAllergens(name: string, existingAllergens: string[] = []): string[] {
        const nameLower = name.toLowerCase();
        const detected = new Set(existingAllergens.map(a => a.toLowerCase()));

        for (const [allergen, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
            if (keywords.some(kw => nameLower.includes(kw))) {
                detected.add(allergen);
            }
        }

        return Array.from(detected);
    }

    /**
     * Calculate nutrition tags from macros
     */
    calculateNutritionTags(food: {
        calories: number;
        proteinG?: number | null;
        carbsG?: number | null;
        fatsG?: number | null;
        fiberG?: number | null;
        sugarG?: number | null;
        sodiumMg?: number | null;
    }): string[] {
        const tags: string[] = [];

        for (const [tag, rule] of Object.entries(NUTRITION_THRESHOLDS)) {
            const value = (food as any)[rule.field];
            if (value == null) continue;

            if ('min' in rule && value >= rule.min) {
                tags.push(tag);
            } else if ('max' in rule && value <= rule.max) {
                tags.push(tag);
            }
        }

        return tags;
    }

    /**
     * Calculate health flags based on nutrition
     */
    calculateHealthFlags(food: any): string[] {
        const flags: string[] = [];

        for (const [flag, checker] of Object.entries(HEALTH_FLAG_RULES)) {
            if (checker(food)) {
                flags.push(flag);
            }
        }

        return flags;
    }

    /**
     * Auto-tag a single food item
     */
    async autoTagFood(foodId: string): Promise<any> {
        const food = await prisma.foodItem.findUnique({
            where: { id: foodId }
        });

        if (!food) {
            throw new Error('Food item not found');
        }

        const dietaryCategory = this.detectDietaryCategory(food.name, food.dietaryCategory);
        const allergenFlags = this.detectAllergens(food.name, food.allergenFlags);
        const nutritionTags = this.calculateNutritionTags({
            calories: food.calories,
            proteinG: food.proteinG ? Number(food.proteinG) : null,
            carbsG: food.carbsG ? Number(food.carbsG) : null,
            fatsG: food.fatsG ? Number(food.fatsG) : null,
            fiberG: food.fiberG ? Number(food.fiberG) : null,
            sugarG: food.sugarG ? Number(food.sugarG) : null,
            sodiumMg: food.sodiumMg ? Number(food.sodiumMg) : null,
        });
        const healthFlags = this.calculateHealthFlags({
            ...food,
            proteinG: food.proteinG ? Number(food.proteinG) : null,
            carbsG: food.carbsG ? Number(food.carbsG) : null,
            fatsG: food.fatsG ? Number(food.fatsG) : null,
            sugarG: food.sugarG ? Number(food.sugarG) : null,
            sodiumMg: food.sodiumMg ? Number(food.sodiumMg) : null,
        });

        const updated = await prisma.foodItem.update({
            where: { id: foodId },
            data: {
                dietaryCategory,
                allergenFlags,
                nutritionTags,
                healthFlags
            }
        });

        logger.info('Food item auto-tagged', {
            foodId,
            name: food.name,
            dietaryCategory,
            allergenFlags,
            nutritionTags: nutritionTags.length,
            healthFlags: healthFlags.length
        });

        return updated;
    }

    /**
     * Bulk auto-tag all food items (or a subset)
     */
    async bulkAutoTag(options: { orgId?: string; limit?: number } = {}): Promise<{
        processed: number;
        updated: number;
    }> {
        const where: any = {};
        if (options.orgId) {
            where.orgId = options.orgId;
        }

        const foods = await prisma.foodItem.findMany({
            where,
            take: options.limit || 1000
        });

        let updated = 0;

        for (const food of foods) {
            try {
                await this.autoTagFood(food.id);
                updated++;
            } catch (error) {
                logger.warn('Failed to auto-tag food', { foodId: food.id, error });
            }
        }

        return { processed: foods.length, updated };
    }

    /**
     * Update specific tags for a food item
     */
    async updateFoodTags(foodId: string, tags: {
        dietaryCategory?: string;
        allergenFlags?: string[];
        nutritionTags?: string[];
        healthFlags?: string[];
        cuisineTags?: string[];
        processingLevel?: string;
        mealSuitabilityTags?: string[];
    }): Promise<any> {
        const updated = await prisma.foodItem.update({
            where: { id: foodId },
            data: tags
        });

        logger.info('Food tags updated', { foodId, tags: Object.keys(tags) });

        return updated;
    }
}

// Export singleton instance
export const foodTaggingService = new FoodTaggingService();
