/**
 * Diet Validation Engine
 * Real-time food compatibility checker against client restrictions
 * 
 * Performance optimizations:
 * - Set-based O(1) tag lookups
 * - LRU cache for client tags
 * - Early termination on RED rules
 * - Batch validation support
 */

import prisma from '../utils/prisma';
import logger from '../utils/logger';
import {
    ValidationSeverity,
    ValidationContext,
    ValidationResult,
    ValidationAlert,
    BatchValidationResult,
    ClientTags,
    FoodTags,
    CachedClientTags,
    AlertType,
    FoodRestriction,
    PlanTargets
} from '../types/validation.types';
import {
    matchesCategoryAvoidance,
    MEAL_SUITABILITY_CONFLICTS
} from '../utils/validation-rules';
import { VALIDATION_CONFIG } from '../config/validation-rules.config';

// Day name mapping
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// ============ LRU CACHE ============

class LRUCache<K, V> {
    private cache = new Map<K, V>();
    private maxSize: number;

    constructor(maxSize: number) {
        this.maxSize = maxSize;
    }

    get(key: K): V | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    set(key: K, value: V): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove oldest (first item)
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, value);
    }

    delete(key: K): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }
}

// ============ VALIDATION ENGINE ============

export class ValidationEngine {
    private clientTagsCache: LRUCache<string, CachedClientTags>;

    constructor() {
        this.clientTagsCache = new LRUCache(VALIDATION_CONFIG.MAX_CACHE_SIZE);
    }

    /**
     * Main validation method - validates a single food item for a client
     */
    async validate(
        clientId: string,
        foodId: string,
        context: ValidationContext
    ): Promise<ValidationResult> {
        const startTime = Date.now();

        // Load client and food tags in parallel
        const [clientTags, foodTags] = await Promise.all([
            this.getClientTags(clientId),
            this.getFoodTags(foodId)
        ]);

        if (!clientTags) {
            throw new Error(`Client not found: ${clientId}`);
        }
        if (!foodTags) {
            throw new Error(`Food item not found: ${foodId}`);
        }

        const alerts: ValidationAlert[] = [];
        let highestSeverity = ValidationSeverity.GREEN;

        // ===== RED RULES (blocking) =====
        // Check in order of severity, early terminate if blocked

        // 1. Allergy check
        const allergyAlert = this.checkAllergies(clientTags, foodTags);
        if (allergyAlert) {
            alerts.push(allergyAlert);
            highestSeverity = ValidationSeverity.RED;
            // Early return for blocking rules
            return this.buildResult(foodTags, highestSeverity, alerts, startTime);
        }

        // 2. Intolerance check
        const intoleranceAlert = this.checkIntolerances(clientTags, foodTags);
        if (intoleranceAlert) {
            alerts.push(intoleranceAlert);
            highestSeverity = ValidationSeverity.RED;
            return this.buildResult(foodTags, highestSeverity, alerts, startTime);
        }

        // 3. Diet pattern check
        const dietPatternAlert = this.checkDietPattern(clientTags, foodTags);
        if (dietPatternAlert) {
            alerts.push(dietPatternAlert);
            highestSeverity = ValidationSeverity.RED;
            return this.buildResult(foodTags, highestSeverity, alerts, startTime);
        }

        // 4. Day restriction check (e.g., no eggs on Tuesday)
        const dayRestrictionAlert = this.checkDayRestrictions(clientTags, foodTags, context);
        if (dayRestrictionAlert) {
            alerts.push(dayRestrictionAlert);
            highestSeverity = ValidationSeverity.RED;
            return this.buildResult(foodTags, highestSeverity, alerts, startTime);
        }

        // 5. Flexible food restrictions check (from foodRestrictions JSON array)
        const restrictionAlerts = this.checkFoodRestrictions(clientTags, foodTags, context);
        for (const alert of restrictionAlerts) {
            alerts.push(alert);
            if (alert.severity === ValidationSeverity.RED) {
                highestSeverity = ValidationSeverity.RED;
                return this.buildResult(foodTags, highestSeverity, alerts, startTime);
            }
            if (alert.severity === ValidationSeverity.YELLOW && highestSeverity === ValidationSeverity.GREEN) {
                highestSeverity = ValidationSeverity.YELLOW;
            }
        }

        // ===== YELLOW RULES (warnings) =====
        // Collect all warnings, don't stop on first

        // 6. Medical condition warnings
        const medicalAlerts = this.checkMedicalConditions(clientTags, foodTags);
        alerts.push(...medicalAlerts);
        if (medicalAlerts.length > 0 && highestSeverity === ValidationSeverity.GREEN) {
            highestSeverity = ValidationSeverity.YELLOW;
        }

        // 7. Lab-derived warnings
        const labAlerts = this.checkLabDerivedTags(clientTags, foodTags);
        alerts.push(...labAlerts);
        if (labAlerts.length > 0 && highestSeverity === ValidationSeverity.GREEN) {
            highestSeverity = ValidationSeverity.YELLOW;
        }

        // 8. Dislike warnings
        const dislikeAlert = this.checkDislikes(clientTags, foodTags);
        if (dislikeAlert) {
            alerts.push(dislikeAlert);
            if (highestSeverity === ValidationSeverity.GREEN) {
                highestSeverity = ValidationSeverity.YELLOW;
            }
        }

        // 9. Category avoidance warnings
        const categoryAlert = this.checkCategoryAvoidance(clientTags, foodTags);
        if (categoryAlert) {
            alerts.push(categoryAlert);
            if (highestSeverity === ValidationSeverity.GREEN) {
                highestSeverity = ValidationSeverity.YELLOW;
            }
        }

        // 10. Meal suitability warnings
        if (context.mealType) {
            const mealSuitabilityAlert = this.checkMealSuitability(foodTags, context.mealType);
            if (mealSuitabilityAlert) {
                alerts.push(mealSuitabilityAlert);
                if (highestSeverity === ValidationSeverity.GREEN) {
                    highestSeverity = ValidationSeverity.YELLOW;
                }
            }
        }

        // 11. Meal repetition check
        if (context.planId) {
            const repetitionAlerts = await this.checkRepetition(foodTags.id, context.planId);
            if (repetitionAlerts.length > 0) {
                alerts.push(...repetitionAlerts);
                if (highestSeverity === ValidationSeverity.GREEN) {
                    highestSeverity = ValidationSeverity.YELLOW;
                }
            }
        }

        // 12. Nutrition strength check
        if (context.planId) {
            const planTargets = await this.getPlanTargets(context.planId);
            if (planTargets) {
                const nutritionAlerts = this.checkNutritionStrength(foodTags, planTargets);
                alerts.push(...nutritionAlerts);
                if (nutritionAlerts.length > 0 && highestSeverity === ValidationSeverity.GREEN) {
                    highestSeverity = ValidationSeverity.YELLOW;
                }
            }
        }

        // ===== GREEN RULES (positive) =====
        // These don't change severity, just add positive indicators

        // 13. Liked foods
        const likedAlert = this.checkLikedFoods(clientTags, foodTags);
        if (likedAlert) alerts.push(likedAlert);

        // 14. Preferred cuisines
        const cuisineAlert = this.checkPreferredCuisines(clientTags, foodTags);
        if (cuisineAlert) alerts.push(cuisineAlert);

        return this.buildResult(foodTags, highestSeverity, alerts, startTime);
    }

    /**
     * Batch validation - validates multiple foods for a client in one call
     */
    async validateBatch(
        clientId: string,
        foodIds: string[],
        context: ValidationContext
    ): Promise<BatchValidationResult> {
        const startTime = Date.now();

        // Pre-load client tags once
        const clientTags = await this.getClientTags(clientId);
        if (!clientTags) {
            throw new Error(`Client not found: ${clientId}`);
        }

        // Batch load all food items
        const foods = await prisma.foodItem.findMany({
            where: { id: { in: foodIds } },
            select: {
                id: true,
                name: true,
                allergenFlags: true,
                dietaryTags: true,
                dietaryCategory: true,
                nutritionTags: true,
                healthFlags: true,
                cuisineTags: true,
                processingLevel: true,
                mealSuitabilityTags: true,
                calories: true,
                proteinG: true,
                carbsG: true,
                fatsG: true
            }
        });

        // Pre-load plan targets and repetition counts if planId is provided
        let planTargets: PlanTargets | null = null;
        let planFoodCounts: Map<string, number> | null = null;
        if (context.planId) {
            [planTargets, planFoodCounts] = await Promise.all([
                this.getPlanTargets(context.planId),
                this.getPlanFoodCounts(context.planId)
            ]);
        }

        const results: ValidationResult[] = [];

        for (const food of foods) {
            const foodTags = this.convertToFoodTags(food);
            const itemStartTime = Date.now();
            const alerts: ValidationAlert[] = [];
            let highestSeverity = ValidationSeverity.GREEN;

            // Run all checks (same logic as single validation)
            const allergyAlert = this.checkAllergies(clientTags, foodTags);
            if (allergyAlert) {
                alerts.push(allergyAlert);
                highestSeverity = ValidationSeverity.RED;
                results.push(this.buildResult(foodTags, highestSeverity, alerts, itemStartTime));
                continue;
            }

            const intoleranceAlert = this.checkIntolerances(clientTags, foodTags);
            if (intoleranceAlert) {
                alerts.push(intoleranceAlert);
                highestSeverity = ValidationSeverity.RED;
                results.push(this.buildResult(foodTags, highestSeverity, alerts, itemStartTime));
                continue;
            }

            const dietPatternAlert = this.checkDietPattern(clientTags, foodTags);
            if (dietPatternAlert) {
                alerts.push(dietPatternAlert);
                highestSeverity = ValidationSeverity.RED;
                results.push(this.buildResult(foodTags, highestSeverity, alerts, itemStartTime));
                continue;
            }

            const dayRestrictionAlert = this.checkDayRestrictions(clientTags, foodTags, context);
            if (dayRestrictionAlert) {
                alerts.push(dayRestrictionAlert);
                highestSeverity = ValidationSeverity.RED;
                results.push(this.buildResult(foodTags, highestSeverity, alerts, itemStartTime));
                continue;
            }

            // Food restrictions check (flexible rules from client profile)
            const restrictionAlerts = this.checkFoodRestrictions(clientTags, foodTags, context, planFoodCounts);
            for (const alert of restrictionAlerts) {
                alerts.push(alert);
                if (alert.severity === ValidationSeverity.RED) {
                    highestSeverity = ValidationSeverity.RED;
                    break;
                }
                if (alert.severity === ValidationSeverity.YELLOW && highestSeverity === ValidationSeverity.GREEN) {
                    highestSeverity = ValidationSeverity.YELLOW;
                }
            }
            if (highestSeverity === ValidationSeverity.RED) {
                results.push(this.buildResult(foodTags, highestSeverity, alerts, itemStartTime));
                continue;
            }

            // Yellow rules
            const medicalAlerts = this.checkMedicalConditions(clientTags, foodTags);
            alerts.push(...medicalAlerts);
            if (medicalAlerts.length > 0) highestSeverity = ValidationSeverity.YELLOW;

            const labAlerts = this.checkLabDerivedTags(clientTags, foodTags);
            alerts.push(...labAlerts);
            if (labAlerts.length > 0 && highestSeverity === ValidationSeverity.GREEN) {
                highestSeverity = ValidationSeverity.YELLOW;
            }

            const dislikeAlert = this.checkDislikes(clientTags, foodTags);
            if (dislikeAlert) {
                alerts.push(dislikeAlert);
                if (highestSeverity === ValidationSeverity.GREEN) highestSeverity = ValidationSeverity.YELLOW;
            }

            const categoryAlert = this.checkCategoryAvoidance(clientTags, foodTags);
            if (categoryAlert) {
                alerts.push(categoryAlert);
                if (highestSeverity === ValidationSeverity.GREEN) highestSeverity = ValidationSeverity.YELLOW;
            }

            if (context.mealType) {
                const mealSuitabilityAlert = this.checkMealSuitability(foodTags, context.mealType);
                if (mealSuitabilityAlert) {
                    alerts.push(mealSuitabilityAlert);
                    if (highestSeverity === ValidationSeverity.GREEN) highestSeverity = ValidationSeverity.YELLOW;
                }
            }

            // Repetition + spacing check
            if (context.planId) {
                const repetitionAlerts = await this.checkRepetition(food.id, context.planId);
                if (repetitionAlerts.length > 0) {
                    alerts.push(...repetitionAlerts);
                    if (highestSeverity === ValidationSeverity.GREEN) highestSeverity = ValidationSeverity.YELLOW;
                }
            }

            // Nutrition strength check (using pre-loaded targets)
            if (planTargets) {
                const nutritionAlerts = this.checkNutritionStrength(foodTags, planTargets);
                alerts.push(...nutritionAlerts);
                if (nutritionAlerts.length > 0 && highestSeverity === ValidationSeverity.GREEN) {
                    highestSeverity = ValidationSeverity.YELLOW;
                }
            }

            // Green rules
            const likedAlert = this.checkLikedFoods(clientTags, foodTags);
            if (likedAlert) alerts.push(likedAlert);

            const cuisineAlert = this.checkPreferredCuisines(clientTags, foodTags);
            if (cuisineAlert) alerts.push(cuisineAlert);

            results.push(this.buildResult(foodTags, highestSeverity, alerts, itemStartTime));
        }

        return {
            results,
            processingTimeMs: Date.now() - startTime
        };
    }

    /**
     * Clear cache for a specific client (call when client tags are updated)
     */
    invalidateClientCache(clientId: string): void {
        this.clientTagsCache.delete(clientId);
        logger.debug('Invalidated client cache', { clientId });
    }

    /**
     * Clear entire cache
     */
    clearCache(): void {
        this.clientTagsCache.clear();
        logger.debug('Cleared validation engine cache');
    }

    // ============ PROTECTED: DATA LOADING ============

    protected async getClientTags(clientId: string): Promise<ClientTags | null> {
        // Check cache first
        const cached = this.clientTagsCache.get(clientId);
        if (cached && Date.now() - cached.cachedAt < VALIDATION_CONFIG.CACHE_TTL_MS) {
            return cached.tags;
        }

        // Load from database
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: {
                allergies: true,
                intolerances: true,
                dietPattern: true,
                eggAllowed: true,
                eggAvoidDays: true,
                dislikes: true,
                avoidCategories: true,
                medicalConditions: true,
                labDerivedTags: true,
                likedFoods: true,
                preferredCuisines: true,
                foodRestrictions: true
            }
        });

        if (!client) return null;

        const tags: ClientTags = {
            allergies: new Set(client.allergies.map(a => a.toLowerCase())),
            intolerances: new Set(client.intolerances.map((i: string) => i.toLowerCase())),
            dietPattern: client.dietPattern?.toLowerCase() || null,
            eggAllowed: client.eggAllowed,
            eggAvoidDays: new Set(client.eggAvoidDays.map((d: string) => d.toLowerCase())),
            foodRestrictions: (client.foodRestrictions as unknown as FoodRestriction[]) || [],
            dislikes: new Set(client.dislikes.map((d: string) => d.toLowerCase())),
            avoidCategories: new Set(client.avoidCategories.map((c: string) => c.toLowerCase())),
            medicalConditions: new Set(client.medicalConditions.map((m: string) => m.toLowerCase())),
            labDerivedTags: new Set(client.labDerivedTags.map((l: string) => l.toLowerCase())),
            likedFoods: new Set(client.likedFoods),
            preferredCuisines: new Set(client.preferredCuisines.map((c: string) => c.toLowerCase()))
        };

        // Cache for next time
        this.clientTagsCache.set(clientId, { tags, cachedAt: Date.now() });

        return tags;
    }

    protected async getFoodTags(foodId: string): Promise<FoodTags | null> {
        const food = await prisma.foodItem.findUnique({
            where: { id: foodId },
            select: {
                id: true,
                name: true,
                allergenFlags: true,
                dietaryCategory: true,
                nutritionTags: true,
                healthFlags: true,
                cuisineTags: true,
                processingLevel: true,
                mealSuitabilityTags: true,
                calories: true,
                proteinG: true,
                carbsG: true,
                fatsG: true
            }
        });

        if (!food) return null;

        return this.convertToFoodTags(food);
    }

    private convertToFoodTags(food: {
        id: string;
        name: string;
        allergenFlags: string[];
        dietaryCategory: string | null;
        nutritionTags: string[];
        healthFlags: string[];
        cuisineTags: string[];
        processingLevel: string | null;
        mealSuitabilityTags: string[];
        calories?: number | null;
        proteinG?: any;
        carbsG?: any;
        fatsG?: any;
    }): FoodTags {
        return {
            id: food.id,
            name: food.name,
            allergenFlags: new Set(food.allergenFlags.map(a => a.toLowerCase())),
            dietaryCategory: food.dietaryCategory?.toLowerCase() || null,
            nutritionTags: new Set(food.nutritionTags.map(n => n.toLowerCase())),
            healthFlags: new Set(food.healthFlags.map(h => h.toLowerCase())),
            cuisineTags: new Set(food.cuisineTags.map(c => c.toLowerCase())),
            processingLevel: food.processingLevel?.toLowerCase() || null,
            mealSuitabilityTags: new Set(food.mealSuitabilityTags.map(m => m.toLowerCase())),
            calories: food.calories ?? undefined,
            proteinG: food.proteinG ? Number(food.proteinG) : undefined,
            carbsG: food.carbsG ? Number(food.carbsG) : undefined,
            fatsG: food.fatsG ? Number(food.fatsG) : undefined
        };
    }

    // ============ PRIVATE: VALIDATION RULES ============

    private checkAllergies(client: ClientTags, food: FoodTags): ValidationAlert | null {
        for (const allergen of client.allergies) {
            if (food.allergenFlags.has(allergen)) {
                return {
                    type: 'allergy',
                    severity: ValidationSeverity.RED,
                    message: `⛔ ALLERGY: Client is allergic to ${allergen}`,
                    icon: 'alert-circle'
                };
            }
        }
        return null;
    }

    private checkIntolerances(client: ClientTags, food: FoodTags): ValidationAlert | null {
        for (const intolerance of client.intolerances) {
            if (food.allergenFlags.has(intolerance)) {
                return {
                    type: 'intolerance',
                    severity: ValidationSeverity.RED,
                    message: `⛔ INTOLERANCE: Client is intolerant to ${intolerance}`,
                    icon: 'alert-circle'
                };
            }
        }
        return null;
    }

    private checkDietPattern(client: ClientTags, food: FoodTags): ValidationAlert | null {
        if (!client.dietPattern || !food.dietaryCategory) return null;

        const clientPattern = client.dietPattern;
        const foodCategory = food.dietaryCategory;

        // Vegetarian can't eat non-veg
        if (clientPattern === 'vegetarian' && foodCategory === 'non_veg') {
            return {
                type: 'diet_pattern',
                severity: ValidationSeverity.RED,
                message: `⛔ VEGETARIAN: Client doesn't eat meat/fish`,
                icon: 'leaf'
            };
        }

        // Vegetarian can't eat foods with egg unless egg is allowed
        if (clientPattern === 'vegetarian' && foodCategory === 'veg_with_egg' && !client.eggAllowed) {
            return {
                type: 'diet_pattern',
                severity: ValidationSeverity.RED,
                message: `⛔ VEGETARIAN: Client doesn't eat eggs`,
                icon: 'leaf'
            };
        }

        // Vegan can't eat non-veg or egg-containing or anything with dairy
        if (clientPattern === 'vegan' && (foodCategory === 'non_veg' || foodCategory === 'veg_with_egg' || foodCategory === 'vegetarian')) {
            return {
                type: 'diet_pattern',
                severity: ValidationSeverity.RED,
                message: `⛔ VEGAN: Client only eats vegan food`,
                icon: 'sprout'
            };
        }

        // Pescatarian can eat fish but not other meat
        if (clientPattern === 'pescatarian' && foodCategory === 'non_veg') {
            // Check if it's fish - this would need additional tagging
            // For now, we flag non_veg as warning
            return {
                type: 'diet_pattern',
                severity: ValidationSeverity.YELLOW,
                message: `🟡 PESCATARIAN: Verify this is fish-based, not meat`,
                recommendation: 'Check if this is seafood',
                icon: 'fish'
            };
        }

        return null;
    }

    private checkDayRestrictions(
        client: ClientTags,
        food: FoodTags,
        context: ValidationContext
    ): ValidationAlert | null {
        const currentDay = context.currentDay.toLowerCase();

        // Check egg restrictions on specific days
        if (client.eggAvoidDays.has(currentDay) && food.allergenFlags.has('eggs')) {
            return {
                type: 'day_restriction',
                severity: ValidationSeverity.RED,
                message: `⛔ DAY RESTRICTION: Client avoids eggs on ${context.currentDay}`,
                icon: 'calendar-x'
            };
        }

        return null;
    }

    private checkFoodRestrictions(
        client: ClientTags,
        food: FoodTags,
        context: ValidationContext,
        planFoodCounts?: Map<string, number> | null
    ): ValidationAlert[] {
        const alerts: ValidationAlert[] = [];
        const currentDay = context.currentDay.toLowerCase();
        const currentMeal = context.mealType.toLowerCase();
        const foodNameLower = food.name.toLowerCase();

        for (const restriction of client.foodRestrictions) {
            // Step 1: Does this restriction apply to this food?
            const applies = this.doesRestrictionApply(restriction, food, foodNameLower);
            if (!applies) continue;

            // Step 2: Check for excludes - if food is in excludes, skip this restriction
            if (this.isExcludedFromRestriction(restriction, food, foodNameLower)) {
                continue;
            }

            // Step 3: Is the restriction active based on context?
            const isActive = this.isRestrictionActive(restriction, currentDay, currentMeal, context.scheduledTime);
            if (!isActive) continue;

            // Step 3b: For frequency restrictions, check actual usage count
            if (restriction.restrictionType === 'frequency' && planFoodCounts) {
                const count = planFoodCounts.get(food.id) || 0;
                if (restriction.maxPerWeek && count < restriction.maxPerWeek) continue;
                if (restriction.maxPerDay) {
                    // maxPerDay can't be checked from plan-level counts, always warn
                }
            }

            // Step 4: Add alert based on severity
            const severity = restriction.severity === 'strict'
                ? ValidationSeverity.RED
                : ValidationSeverity.YELLOW;

            const reasonText = restriction.reason
                ? ` (${restriction.reason.replace(/_/g, ' ')})`
                : '';

            const foodLabel = restriction.foodCategory || restriction.foodName || 'this food';
            let message: string;
            if (restriction.restrictionType === 'day_based') {
                message = severity === ValidationSeverity.RED
                    ? `⛔ RESTRICTED: No ${foodLabel} on ${currentDay}${reasonText}`
                    : `🟡 CAUTION: Client prefers to avoid ${foodLabel} on ${currentDay}${reasonText}`;
            } else if (restriction.restrictionType === 'always') {
                message = severity === ValidationSeverity.RED
                    ? `⛔ RESTRICTED: Client never eats ${foodLabel}${reasonText}`
                    : `🟡 CAUTION: Client prefers to avoid ${foodLabel}${reasonText}`;
            } else if (restriction.restrictionType === 'time_based') {
                message = severity === ValidationSeverity.RED
                    ? `⛔ RESTRICTED: No ${foodLabel} during ${currentMeal}${reasonText}`
                    : `🟡 CAUTION: Client prefers to avoid ${foodLabel} during ${currentMeal}${reasonText}`;
            } else if (restriction.restrictionType === 'frequency') {
                const count = planFoodCounts?.get(food.id) || 0;
                const limit = restriction.maxPerWeek || restriction.maxPerDay;
                message = `🟡 FREQUENCY: ${foodLabel} appears ${count}/${limit} times${restriction.maxPerWeek ? '/week' : '/day'}${reasonText}`;
            } else if (restriction.restrictionType === 'quantity') {
                message = `🟡 QUANTITY: Limit ${foodLabel} to ${restriction.maxGramsPerMeal}g/meal${reasonText}`;
            } else {
                message = `⚠️ RESTRICTION: ${restriction.note || 'Food has restrictions'}`;
            }

            alerts.push({
                type: 'food_restriction',
                severity,
                message,
                recommendation: restriction.note || undefined,
                icon: severity === ValidationSeverity.RED ? 'ban' : 'alert-triangle'
            });
        }

        return alerts;
    }

    private doesRestrictionApply(
        restriction: FoodRestriction,
        food: FoodTags,
        foodNameLower: string
    ): boolean {
        // Check by specific food ID
        if (restriction.foodId && restriction.foodId === food.id) {
            return true;
        }

        // Check by food category
        if (restriction.foodCategory) {
            const category = restriction.foodCategory.toLowerCase();

            // Handle common category mappings
            if (category === 'non_veg' && food.dietaryCategory === 'non_veg') {
                return true;
            }
            if (category === 'eggs' && food.allergenFlags.has('eggs')) {
                return true;
            }
            if (category === 'dairy' && (food.allergenFlags.has('milk') || food.allergenFlags.has('dairy'))) {
                return true;
            }
            if (category === 'root_vegetables') {
                // Check if food matches any items in includes list
                if (restriction.includes) {
                    for (const item of restriction.includes) {
                        if (foodNameLower.includes(item.toLowerCase())) {
                            return true;
                        }
                    }
                }
            }
            // General category check
            if (food.cuisineTags.has(category) || foodNameLower.includes(category)) {
                return true;
            }
        }

        // Check by food name
        if (restriction.foodName) {
            const restrictedName = restriction.foodName.toLowerCase();
            if (foodNameLower.includes(restrictedName) || restrictedName.includes(foodNameLower)) {
                return true;
            }
        }

        return false;
    }

    private isExcludedFromRestriction(
        restriction: FoodRestriction,
        food: FoodTags,
        foodNameLower: string
    ): boolean {
        if (!restriction.excludes || restriction.excludes.length === 0) {
            return false;
        }

        for (const exclude of restriction.excludes) {
            const excludeLower = exclude.toLowerCase();

            // Check by ID
            if (exclude === food.id) {
                return true;
            }

            // Check by name
            if (foodNameLower.includes(excludeLower)) {
                return true;
            }

            // Check by allergen flag (e.g., "eggs" excluded)
            if (food.allergenFlags.has(excludeLower)) {
                return true;
            }
        }

        return false;
    }

    private isRestrictionActive(
        restriction: FoodRestriction,
        currentDay: string,
        currentMeal: string,
        scheduledTime?: string
    ): boolean {
        switch (restriction.restrictionType) {
            case 'always':
                return true;

            case 'day_based':
                if (restriction.avoidDays) {
                    return restriction.avoidDays.some(d => d.toLowerCase() === currentDay);
                }
                return false;

            case 'time_based':
                if (restriction.avoidMeals) {
                    if (restriction.avoidMeals.some(m => m.toLowerCase() === currentMeal)) {
                        return true;
                    }
                }
                // Time window check using scheduledTime or meal-to-time fallback
                if (restriction.avoidAfter || restriction.avoidBefore) {
                    const timeStr = scheduledTime || this.mealToDefaultTime(currentMeal);
                    if (timeStr) {
                        const mins = this.timeToMinutes(timeStr);
                        if (restriction.avoidAfter) {
                            const afterMins = this.timeToMinutes(restriction.avoidAfter);
                            if (mins >= afterMins) return true;
                        }
                        if (restriction.avoidBefore) {
                            const beforeMins = this.timeToMinutes(restriction.avoidBefore);
                            if (mins <= beforeMins) return true;
                        }
                    }
                }
                return false;

            case 'frequency':
                // Always show the frequency limit reminder so dietitian is aware
                return true;

            case 'quantity':
                // Always show the limit reminder
                return true;

            default:
                return true;
        }
    }

    private timeToMinutes(time: string): number {
        const [h, m] = time.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    }

    private mealToDefaultTime(meal: string): string {
        const defaults: Record<string, string> = {
            breakfast: '08:00',
            lunch: '13:00',
            snack: '16:00',
            dinner: '20:00',
        };
        return defaults[meal] || '12:00';
    }

    private checkMedicalConditions(client: ClientTags, food: FoodTags): ValidationAlert[] {
        const alerts: ValidationAlert[] = [];

        // Pre-diabetes/diabetes + high sugar
        if (
            (client.medicalConditions.has('pre_diabetes') || client.medicalConditions.has('diabetes')) &&
            food.nutritionTags.has('high_sugar')
        ) {
            alerts.push({
                type: 'medical',
                severity: ValidationSeverity.YELLOW,
                message: `🟡 DIABETES CAUTION: This food is high in sugar`,
                recommendation: 'Consider lower-sugar alternative',
                icon: 'heart-pulse'
            });
        }

        // Heart issues + high cholesterol/saturated fat
        if (
            (client.medicalConditions.has('heart_pain') || client.medicalConditions.has('heart_disease')) &&
            (food.healthFlags.has('cholesterol_caution') || food.nutritionTags.has('high_saturated_fat'))
        ) {
            alerts.push({
                type: 'medical',
                severity: ValidationSeverity.YELLOW,
                message: `🟡 HEART CAUTION: This food may be high in cholesterol/saturated fat`,
                recommendation: 'Limit intake or choose heart-healthy alternatives',
                icon: 'heart'
            });
        }

        // Hypertension + high sodium
        if (
            client.medicalConditions.has('hypertension') &&
            food.nutritionTags.has('high_sodium')
        ) {
            alerts.push({
                type: 'medical',
                severity: ValidationSeverity.YELLOW,
                message: `🟡 HYPERTENSION CAUTION: This food is high in sodium`,
                recommendation: 'Choose low-sodium alternatives',
                icon: 'droplet'
            });
        }

        return alerts;
    }

    private checkLabDerivedTags(client: ClientTags, food: FoodTags): ValidationAlert[] {
        const alerts: ValidationAlert[] = [];

        // Diabetic / pre-diabetic + high sugar food
        if (
            (client.labDerivedTags.has('diabetic') || client.labDerivedTags.has('pre_diabetic')) &&
            (food.nutritionTags.has('high_sugar') || food.healthFlags.has('diabetic_caution'))
        ) {
            const isDiabetic = client.labDerivedTags.has('diabetic');
            alerts.push({
                type: 'lab_derived',
                severity: ValidationSeverity.YELLOW,
                message: isDiabetic
                    ? `🟡 LAB ALERT: Client is diabetic (elevated HbA1c) - avoid high-sugar foods`
                    : `🟡 LAB ALERT: Client is pre-diabetic - limit sugar intake`,
                recommendation: isDiabetic ? 'Choose sugar-free or low-GI alternatives' : 'Moderate sugar intake',
                icon: 'test-tube'
            });
        }

        // High cholesterol + cholesterol-heavy food
        if (
            (client.labDerivedTags.has('high_cholesterol') || client.labDerivedTags.has('borderline_cholesterol')) &&
            food.healthFlags.has('cholesterol_caution')
        ) {
            alerts.push({
                type: 'lab_derived',
                severity: ValidationSeverity.YELLOW,
                message: `🟡 LAB ALERT: Client's cholesterol is elevated - limit high-cholesterol foods`,
                recommendation: 'Maximum 2-3 times per week',
                icon: 'test-tube'
            });
        }

        // High triglycerides + high fat food
        if (
            client.labDerivedTags.has('high_triglycerides') &&
            (food.nutritionTags.has('high_fat') || food.healthFlags.has('heart_caution'))
        ) {
            alerts.push({
                type: 'lab_derived',
                severity: ValidationSeverity.YELLOW,
                message: `🟡 LAB ALERT: Client has high triglycerides - limit high-fat foods`,
                recommendation: 'Choose lean proteins and healthy fats',
                icon: 'test-tube'
            });
        }

        // Kidney caution / high uric acid + high protein food
        if (
            (client.labDerivedTags.has('kidney_caution') || client.labDerivedTags.has('high_uric_acid')) &&
            (food.nutritionTags.has('high_protein') || food.healthFlags.has('kidney_caution'))
        ) {
            alerts.push({
                type: 'lab_derived',
                severity: ValidationSeverity.YELLOW,
                message: `🟡 LAB ALERT: Client has elevated kidney markers - limit high-protein foods`,
                recommendation: 'Keep protein moderate, reduce red meat and organ meats',
                icon: 'test-tube'
            });
        }

        // Vitamin D deficiency - positive nudge for vitamin D rich foods
        if (
            (client.labDerivedTags.has('vitamin_d_deficiency') || client.labDerivedTags.has('severe_vitamin_d_deficiency')) &&
            food.healthFlags.has('vitamin_d_rich')
        ) {
            alerts.push({
                type: 'lab_derived',
                severity: ValidationSeverity.GREEN,
                message: `✅ NUTRIENT MATCH: Good source of Vitamin D for client`,
                icon: 'sun'
            });
        }

        // B12 deficiency - positive nudge for B12-rich foods
        if (
            client.labDerivedTags.has('b12_deficiency') &&
            food.healthFlags.has('b12_rich')
        ) {
            alerts.push({
                type: 'lab_derived',
                severity: ValidationSeverity.GREEN,
                message: `✅ NUTRIENT MATCH: Good source of Vitamin B12 for client`,
                icon: 'pill'
            });
        }

        // Iron deficiency / anemia - positive nudge for iron-rich foods
        if (
            (client.labDerivedTags.has('iron_deficiency') || client.labDerivedTags.has('anemia')) &&
            food.healthFlags.has('iron_rich')
        ) {
            alerts.push({
                type: 'lab_derived',
                severity: ValidationSeverity.GREEN,
                message: `✅ NUTRIENT MATCH: Good source of Iron for client with low iron/hemoglobin`,
                icon: 'heart-pulse'
            });
        }

        return alerts;
    }

    /**
     * Word-level matching with plural normalization.
     * "egg" matches "eggs" or "egg curry" but NOT "eggplant".
     * "bitter gourd" matches "bitter gourd curry".
     */
    private wordMatch(foodName: string, keyword: string): boolean {
        const foodWords = foodName.split(/\s+/);
        const keyWords = keyword.split(/\s+/);

        // Multi-word keyword (e.g. "bitter gourd"): check contiguous word sequence
        if (keyWords.length > 1) {
            for (let i = 0; i <= foodWords.length - keyWords.length; i++) {
                const allMatch = keyWords.every((kw, j) => this.pluralMatch(foodWords[i + j], kw));
                if (allMatch) return true;
            }
            return false;
        }

        // Single-word keyword: check if any food word matches
        return foodWords.some(fw => this.pluralMatch(fw, keyWords[0]));
    }

    /** Two words match if identical, or one is the other + 's'/'es' */
    private pluralMatch(a: string, b: string): boolean {
        if (a === b) return true;
        if (a + 's' === b || b + 's' === a) return true;
        if (a + 'es' === b || b + 'es' === a) return true;
        return false;
    }

    private checkDislikes(client: ClientTags, food: FoodTags): ValidationAlert | null {
        const foodNameLower = food.name.toLowerCase();

        for (const dislike of client.dislikes) {
            if (this.wordMatch(foodNameLower, dislike)) {
                const displayName = dislike.charAt(0).toUpperCase() + dislike.slice(1);
                return {
                    type: 'dislike',
                    severity: ValidationSeverity.YELLOW,
                    message: `🟡 DISLIKE: Client has indicated they dislike ${displayName}`,
                    recommendation: 'Consider alternative options',
                    icon: 'thumb-down'
                };
            }
        }

        return null;
    }

    private checkLikedFoods(client: ClientTags, food: FoodTags): ValidationAlert | null {
        const foodNameLower = food.name.toLowerCase();

        for (const liked of client.likedFoods) {
            const likedLower = liked.toLowerCase();
            if (this.wordMatch(foodNameLower, likedLower)) {
                const displayName = liked.charAt(0).toUpperCase() + liked.slice(1);
                return {
                    type: 'preference_match',
                    severity: ValidationSeverity.GREEN,
                    message: `✅ CLIENT FAVORITE: Client likes ${displayName}`,
                    icon: 'heart'
                };
            }
        }
        return null;
    }

    private checkPreferredCuisines(client: ClientTags, food: FoodTags): ValidationAlert | null {
        for (const cuisine of client.preferredCuisines) {
            if (food.cuisineTags.has(cuisine)) {
                return {
                    type: 'cuisine_match',
                    severity: ValidationSeverity.GREEN,
                    message: `✅ PREFERRED CUISINE: Client likes ${cuisine} food`,
                    icon: 'utensils'
                };
            }
        }
        return null;
    }

    private checkCategoryAvoidance(client: ClientTags, food: FoodTags): ValidationAlert | null {
        if (client.avoidCategories.size === 0) return null;

        for (const category of client.avoidCategories) {
            const matches = matchesCategoryAvoidance(category, {
                category: food.name,
                processingLevel: food.processingLevel || undefined,
                cuisineTags: Array.from(food.cuisineTags)
            });

            if (matches) {
                return {
                    type: 'dislike',
                    severity: ValidationSeverity.YELLOW,
                    message: `🟡 AVOID CATEGORY: Client prefers to avoid ${category.replace(/_/g, ' ')}`,
                    recommendation: 'Consider alternatives from preferred categories',
                    icon: 'x-circle'
                };
            }
        }

        return null;
    }

    private checkMealSuitability(food: FoodTags, mealType: string): ValidationAlert | null {
        if (food.mealSuitabilityTags.size === 0) return null;

        const mealTypeLower = mealType.toLowerCase();

        for (const tag of food.mealSuitabilityTags) {
            const conflicts = MEAL_SUITABILITY_CONFLICTS[tag];
            if (conflicts && conflicts.includes(mealTypeLower)) {
                const tagDisplay = tag.replace(/_/g, ' ');
                return {
                    type: 'dislike',
                    severity: ValidationSeverity.YELLOW,
                    message: `ℹ️ MEAL TIMING: This food is ${tagDisplay}`,
                    recommendation: `Consider alternatives better suited for ${mealType}`,
                    icon: 'clock'
                };
            }
        }

        return null;
    }

    // ============ PRIVATE: PLAN-CONTEXT RULES ============

    protected async getPlanTargets(planId: string): Promise<PlanTargets | null> {
        const plan = await prisma.dietPlan.findUnique({
            where: { id: planId },
            select: {
                targetCalories: true,
                targetProteinG: true,
                targetCarbsG: true,
                targetFatsG: true
            }
        });
        if (!plan) return null;
        return {
            targetCalories: plan.targetCalories,
            targetProteinG: plan.targetProteinG ? Number(plan.targetProteinG) : null,
            targetCarbsG: plan.targetCarbsG ? Number(plan.targetCarbsG) : null,
            targetFatsG: plan.targetFatsG ? Number(plan.targetFatsG) : null
        };
    }

    protected async getPlanFoodCounts(planId: string): Promise<Map<string, number>> {
        const items = await prisma.mealFoodItem.findMany({
            where: { meal: { planId } },
            select: { foodId: true }
        });
        const counts = new Map<string, number>();
        for (const item of items) {
            counts.set(item.foodId, (counts.get(item.foodId) || 0) + 1);
        }
        return counts;
    }

    protected async checkRepetition(foodId: string, planId: string): Promise<ValidationAlert[]> {
        const items = await prisma.mealFoodItem.findMany({
            where: { foodId, meal: { planId } },
            select: { meal: { select: { dayOfWeek: true } } }
        });

        const alerts: ValidationAlert[] = [];
        const count = items.length;

        // Total count check
        if (count >= VALIDATION_CONFIG.REPETITION_THRESHOLD) {
            alerts.push({
                type: 'repetition',
                severity: ValidationSeverity.YELLOW,
                message: `🟡 REPETITION: This food appears ${count} times this week. Consider variety.`,
                recommendation: 'Try different foods for nutritional variety',
                icon: 'repeat'
            });
        }

        // Consecutive days check
        if (count >= 2) {
            const days = [...new Set(items.map(i => i.meal.dayOfWeek).filter((d): d is number => d !== null))].sort();
            const maxConsecutive = this.longestConsecutiveRun(days);
            if (maxConsecutive > VALIDATION_CONFIG.REPETITION_MAX_CONSECUTIVE_DAYS) {
                alerts.push({
                    type: 'repetition',
                    severity: ValidationSeverity.YELLOW,
                    message: `🟡 SPACING: This food appears on ${maxConsecutive} consecutive days. Spread it out for variety.`,
                    recommendation: 'Leave at least a day gap between servings of the same food',
                    icon: 'calendar'
                });
            }
        }

        return alerts;
    }

    private longestConsecutiveRun(sortedDays: number[]): number {
        if (sortedDays.length <= 1) return sortedDays.length;
        let maxRun = 1;
        let currentRun = 1;
        for (let i = 1; i < sortedDays.length; i++) {
            if (sortedDays[i] === sortedDays[i - 1] + 1) {
                currentRun++;
                maxRun = Math.max(maxRun, currentRun);
            } else if (sortedDays[i] !== sortedDays[i - 1]) {
                currentRun = 1;
            }
        }
        return maxRun;
    }

    private checkNutritionStrength(food: FoodTags, targets: PlanTargets): ValidationAlert[] {
        const alerts: ValidationAlert[] = [];
        const calWarnPct = VALIDATION_CONFIG.SINGLE_FOOD_CALORIE_WARN_PCT;
        const macroWarnPct = VALIDATION_CONFIG.SINGLE_FOOD_MACRO_WARN_PCT;

        if (food.calories && targets.targetCalories) {
            const pct = food.calories / targets.targetCalories;
            if (pct > calWarnPct) {
                alerts.push({
                    type: 'nutrition_strength',
                    severity: ValidationSeverity.YELLOW,
                    message: `🟡 HIGH CALORIE: This food provides ${Math.round(pct * 100)}% of the daily calorie target in one serving`,
                    recommendation: 'Consider a smaller portion or lower-calorie alternative',
                    icon: 'flame'
                });
            }
        }

        if (food.proteinG && targets.targetProteinG) {
            const pct = food.proteinG / targets.targetProteinG;
            if (pct > macroWarnPct) {
                alerts.push({
                    type: 'nutrition_strength',
                    severity: ValidationSeverity.YELLOW,
                    message: `🟡 HIGH PROTEIN: This food provides ${Math.round(pct * 100)}% of the daily protein target`,
                    icon: 'beef'
                });
            }
        }

        if (food.carbsG && targets.targetCarbsG) {
            const pct = food.carbsG / targets.targetCarbsG;
            if (pct > macroWarnPct) {
                alerts.push({
                    type: 'nutrition_strength',
                    severity: ValidationSeverity.YELLOW,
                    message: `🟡 HIGH CARBS: This food provides ${Math.round(pct * 100)}% of the daily carb target`,
                    icon: 'wheat'
                });
            }
        }

        if (food.fatsG && targets.targetFatsG) {
            const pct = food.fatsG / targets.targetFatsG;
            if (pct > macroWarnPct) {
                alerts.push({
                    type: 'nutrition_strength',
                    severity: ValidationSeverity.YELLOW,
                    message: `🟡 HIGH FAT: This food provides ${Math.round(pct * 100)}% of the daily fat target`,
                    icon: 'droplets'
                });
            }
        }

        return alerts;
    }

    // ============ PRIVATE: RESULT BUILDING ============

    private buildResult(
        food: FoodTags,
        severity: ValidationSeverity,
        alerts: ValidationAlert[],
        startTime: number
    ): ValidationResult {
        return {
            foodId: food.id,
            foodName: food.name,
            severity,
            borderColor: severity === ValidationSeverity.RED ? 'red'
                : severity === ValidationSeverity.YELLOW ? 'yellow'
                    : 'green',
            canAdd: severity !== ValidationSeverity.RED,
            alerts,
            confidenceScore: 0.95 // Could be dynamic based on tag confidence
        };
    }
}

// Singleton instance
export const validationEngine = new ValidationEngine();
