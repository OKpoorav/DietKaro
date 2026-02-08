/**
 * Validation Rules and Mappings
 * Centralized constants for food validation engine
 */

// ============ ALLERGEN MAPPING ============

/**
 * Maps client allergy names to food allergen flags
 * Used by ValidationEngine to check allergen matches
 */
export const ALLERGEN_MAPPING: Record<string, string> = {
    peanuts: 'peanuts',
    tree_nuts: 'tree_nuts',
    almonds: 'tree_nuts',
    cashews: 'tree_nuts',
    walnuts: 'tree_nuts',
    dairy: 'dairy',
    milk: 'dairy',
    eggs: 'eggs',
    wheat: 'wheat',
    gluten: 'gluten',
    soy: 'soy',
    fish: 'fish',
    shellfish: 'shellfish',
    shrimp: 'shellfish',
    crab: 'shellfish',
    sesame: 'sesame',
    mustard: 'mustard',
    celery: 'celery',
    sulphites: 'sulphites',
    lupin: 'lupin',
    mollusks: 'mollusks'
};

// ============ DIET PATTERN CONFLICTS ============

/**
 * Defines which food dietary categories conflict with client diet patterns
 * RED blocking rules
 */
export const DIET_CONFLICTS: Record<string, string[]> = {
    vegan: ['non_veg', 'vegetarian', 'veg_with_egg'],
    vegetarian: ['non_veg'],
    vegetarian_with_egg: ['non_veg'],
    pescatarian: ['non_veg'], // Fish is allowed, other meat is not
    jain: ['non_veg', 'veg_with_egg'] // Also blocks root vegetables (handled separately)
};

// ============ INTOLERANCE MAPPING ============

/**
 * Maps client intolerances to food allergen flags or nutrition tags
 * Used for RED blocking (similar to allergies)
 */
export const INTOLERANCE_MAPPING: Record<string, string[]> = {
    lactose: ['dairy'],
    gluten: ['wheat', 'gluten'],
    fructose: ['high_sugar'],
    histamine: ['fermented', 'aged_cheese'],
    caffeine: ['coffee', 'tea', 'chocolate']
};

// ============ MEDICAL FLAG MAPPING ============

/**
 * Maps client medical conditions to food health flags
 * Used for YELLOW warnings
 */
export const MEDICAL_FLAG_MAPPING: Record<string, string[]> = {
    // Manual conditions (from client creation)
    diabetes: ['diabetic_caution', 'high_sugar'],
    pre_diabetes: ['diabetic_caution', 'high_sugar'],
    heart_disease: ['heart_caution', 'high_saturated_fat', 'high_sodium'],
    heart_pain: ['heart_caution', 'high_saturated_fat'],
    high_cholesterol: ['cholesterol_caution', 'heart_caution'],
    hypertension: ['high_sodium'],
    kidney_disease: ['kidney_caution', 'high_protein', 'high_sodium'],
    kidney_issues: ['kidney_caution', 'high_protein'],
    pcos: ['diabetic_caution', 'high_sugar'],
    thyroid: ['iodine_caution'],
    obesity: ['diabetic_caution', 'high_fat'],
    anemia: [], // Positive matching for iron-rich foods

    // Lab-derived conditions (auto-generated from lab values)
    diabetic: ['diabetic_caution', 'high_sugar', 'high_carb'],
    pre_diabetic: ['diabetic_caution', 'high_sugar'],
    borderline_cholesterol: ['cholesterol_caution'],
    high_triglycerides: ['heart_caution', 'high_fat'],
    low_hdl: ['heart_caution'],
    hypothyroid: ['iodine_caution'],
    hyperthyroid: [],
    iron_deficiency: [], // Positive match for iron-rich foods
    b12_deficiency: [],  // Positive match for B12-rich foods
    vitamin_d_deficiency: [], // Positive match for Vit D foods
    severe_vitamin_d_deficiency: [],
    kidney_caution: ['kidney_caution', 'high_protein', 'high_sodium'],
    high_uric_acid: ['kidney_caution', 'high_protein'],
    calcium_deficiency: [],
};

// ============ NUTRITION THRESHOLDS ============

/**
 * Thresholds for auto-tagging nutrition tags based on per-serving values
 */
export const NUTRITION_THRESHOLDS = {
    high_sugar: 15, // grams per serving
    very_high_sugar: 25,
    high_protein: 20, // grams per serving
    very_high_protein: 30,
    low_carb: 10, // grams per serving
    high_carb: 50,
    high_fat: 20, // grams per serving
    high_saturated_fat: 5,
    high_sodium: 600, // mg per serving
    very_high_sodium: 1000,
    high_fiber: 5, // grams per serving
    low_calorie: 50, // kcal per serving
    high_calorie: 400
};

// ============ HEALTH FLAG THRESHOLDS ============

/**
 * Thresholds for auto-generating health flags
 */
export const HEALTH_FLAG_THRESHOLDS = {
    diabetic_caution: {
        sugarG: 20,
        carbsG: 60
    },
    heart_caution: {
        sodiumMg: 600,
        saturatedFatG: 5
    },
    kidney_caution: {
        proteinG: 30,
        sodiumMg: 800
    }
};

// ============ PROCESSING LEVEL CLASSIFICATION ============

/**
 * Keywords for classifying food processing levels
 */
export const PROCESSING_KEYWORDS = {
    raw: ['raw', 'fresh', 'unprocessed'],
    minimally_processed: ['boiled', 'steamed', 'grilled', 'baked', 'roasted'],
    processed: ['canned', 'packaged', 'preserved', 'smoked'],
    ultra_processed: ['fried', 'deep_fried', 'instant', 'ready_to_eat', 'frozen_meal']
};

// ============ MEAL SUITABILITY RULES ============

/**
 * Maps meal suitability tags to meal types they conflict with
 */
export const MEAL_SUITABILITY_CONFLICTS: Record<string, string[]> = {
    too_heavy_for_night: ['dinner'],
    too_heavy_for_breakfast: ['breakfast'],
    too_light_for_lunch: ['lunch'],
    avoid_before_workout: ['pre_workout'],
    avoid_after_workout: ['post_workout']
};

// ============ CATEGORY MAPPING ============

/**
 * Maps avoidCategory values to what they should match against
 */
export const CATEGORY_MAPPING: Record<string, {
    processingLevels?: string[];
    categories?: string[];
    cuisineTags?: string[];
}> = {
    fried_foods: {
        processingLevels: ['fried', 'ultra_processed'],
        categories: ['Fried']
    },
    processed_foods: {
        processingLevels: ['processed', 'ultra_processed']
    },
    ultra_processed: {
        processingLevels: ['ultra_processed']
    },
    red_meat: {
        categories: ['Meat'],
        cuisineTags: ['mutton', 'beef', 'pork', 'lamb']
    },
    sweets: {
        categories: ['Sweets', 'Desserts']
    },
    fast_food: {
        cuisineTags: ['fast_food']
    },
    canned_foods: {
        processingLevels: ['processed', 'canned']
    },
    sugary_drinks: {
        categories: ['Beverages'],
        cuisineTags: ['sugary']
    }
};

// ============ INDIAN-SPECIFIC RESTRICTIONS ============

/**
 * Common Indian dietary restrictions
 */
export const INDIAN_RESTRICTIONS = {
    jain_vegetables: [
        'onion', 'garlic', 'potato', 'carrot', 'radish', 'beetroot',
        'ginger', 'turmeric', 'leek', 'scallion'
    ],
    sattvic_avoid: [
        'onion', 'garlic', 'mushroom', 'eggs', 'meat', 'fish',
        'alcohol', 'caffeine'
    ],
    navratri_avoid: [
        'grains', 'regular_salt', 'onion', 'garlic', 'non_veg'
    ]
};

// ============ HELPER FUNCTIONS ============

/**
 * Get allergen flag from client allergy name
 */
export function getAllergenFlag(allergen: string): string | undefined {
    return ALLERGEN_MAPPING[allergen.toLowerCase()];
}

/**
 * Check if diet pattern conflicts with food category
 */
export function hasDietConflict(dietPattern: string, foodCategory: string): boolean {
    const conflicts = DIET_CONFLICTS[dietPattern.toLowerCase()];
    if (!conflicts) return false;
    return conflicts.includes(foodCategory.toLowerCase());
}

/**
 * Get health flags that should trigger for a medical condition
 */
export function getMedicalFlags(condition: string): string[] {
    return MEDICAL_FLAG_MAPPING[condition.toLowerCase()] || [];
}

/**
 * Check if a food should be flagged for a category avoidance
 */
export function matchesCategoryAvoidance(
    categoryToAvoid: string,
    food: {
        category?: string;
        processingLevel?: string;
        cuisineTags?: string[];
    }
): boolean {
    const mapping = CATEGORY_MAPPING[categoryToAvoid.toLowerCase()];
    if (!mapping) return false;

    // Check processing levels
    if (mapping.processingLevels && food.processingLevel) {
        if (mapping.processingLevels.includes(food.processingLevel.toLowerCase())) {
            return true;
        }
    }

    // Check categories
    if (mapping.categories && food.category) {
        if (mapping.categories.some(cat =>
            food.category?.toLowerCase().includes(cat.toLowerCase())
        )) {
            return true;
        }
    }

    // Check cuisine tags
    if (mapping.cuisineTags && food.cuisineTags) {
        if (food.cuisineTags.some(tag =>
            mapping.cuisineTags?.includes(tag.toLowerCase())
        )) {
            return true;
        }
    }

    return false;
}
