/**
 * Diet Validation Engine Types
 * Part of DietKaro real-time validation system
 */

// ============ ENUMS ============

export enum ValidationSeverity {
    RED = 'RED',       // Blocking - cannot add
    YELLOW = 'YELLOW', // Warning - can add with caution
    GREEN = 'GREEN'    // Positive - good match
}

export type AlertType =
    | 'allergy'
    | 'intolerance'
    | 'diet_pattern'
    | 'day_restriction'
    | 'food_restriction'
    | 'medical'
    | 'lab_derived'
    | 'dislike'
    | 'preference_match'
    | 'cuisine_match'
    | 'goal_aligned';

// ============ REQUEST/RESPONSE ============

export interface ValidationContext {
    currentDay: string;  // "monday", "tuesday", etc.
    mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
    planId?: string;
    // For repetition checks (how many times this food was used this week)
    weeklyUsage?: Record<string, number>;
}

export interface ValidationRequest {
    clientId: string;
    foodId: string;
    context: ValidationContext;
}

export interface BatchValidationRequest {
    clientId: string;
    foodIds: string[];
    context: ValidationContext;
}

export interface ValidationAlert {
    type: AlertType;
    severity: ValidationSeverity;
    message: string;
    recommendation?: string;
    icon?: string;
}

export interface ValidationResult {
    foodId: string;
    foodName: string;
    severity: ValidationSeverity;
    borderColor: 'red' | 'yellow' | 'green';
    canAdd: boolean;
    alerts: ValidationAlert[];
    confidenceScore: number;
}

export interface BatchValidationResult {
    results: ValidationResult[];
    processingTimeMs: number;
}

// ============ FOOD RESTRICTION ============

export type RestrictionType = 'day_based' | 'time_based' | 'frequency' | 'quantity' | 'always';

export interface FoodRestriction {
    // What is restricted (at least one must be specified)
    foodId?: string;          // Specific food database ID
    foodName?: string;        // Name match (e.g., "eggs", "chicken")
    foodCategory?: string;    // Category (e.g., "non_veg", "dairy", "root_vegetables")

    // Restriction type
    restrictionType: RestrictionType;

    // Day-based restrictions
    avoidDays?: string[];     // ["tuesday", "thursday"]

    // Time-based restrictions
    avoidMeals?: string[];    // ["dinner", "snack"]
    avoidAfter?: string;      // "19:00"
    avoidBefore?: string;     // "08:00"

    // Frequency-based restrictions
    maxPerWeek?: number;
    maxPerDay?: number;

    // Quantity-based restrictions
    maxGramsPerMeal?: number;

    // Exceptions - items excluded from this restriction
    excludes?: string[];      // Food IDs or names excluded
    includes?: string[];      // Specific items included in category

    // Metadata
    reason?: string;          // "religious_fasting", "medical", "personal_choice"
    severity: 'strict' | 'flexible';  // strict = RED, flexible = YELLOW
    note?: string;            // Free text explanation
}

// ============ TAG INTERFACES ============

export interface ClientTags {
    // HARD CONSTRAINTS (RED blocking)
    allergies: Set<string>;
    intolerances: Set<string>;

    // DIETARY PATTERN (RED blocking)
    dietPattern: string | null;
    eggAllowed: boolean;
    eggAvoidDays: Set<string>;

    // FLEXIBLE RESTRICTIONS (RED or YELLOW based on severity)
    foodRestrictions: FoodRestriction[];

    // SOFT CONSTRAINTS (YELLOW warning)
    dislikes: Set<string>;
    avoidCategories: Set<string>;

    // MEDICAL (YELLOW warning)
    medicalConditions: Set<string>;
    labDerivedTags: Set<string>;

    // POSITIVE (GREEN)
    likedFoods: Set<string>;
    preferredCuisines: Set<string>;
}

export interface FoodTags {
    id: string;
    name: string;

    // Safety
    allergenFlags: Set<string>;

    // Dietary
    dietaryCategory: string | null;
    cuisineTags: Set<string>;

    // Nutrition
    nutritionTags: Set<string>;

    // Medical
    healthFlags: Set<string>;

    // Processing
    processingLevel: string | null;

    // Suitability
    mealSuitabilityTags: Set<string>;
}

// ============ CACHE ENTRY ============

export interface CachedClientTags {
    tags: ClientTags;
    cachedAt: number;
}
