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
    FoodRestriction
} from '../types/validation.types';

// ============ CONSTANTS ============

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50;

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
        this.clientTagsCache = new LRUCache(MAX_CACHE_SIZE);
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
        if (medicalAlerts.length > 0 && highestSeverity !== ValidationSeverity.RED) {
            highestSeverity = ValidationSeverity.YELLOW;
        }

        // 7. Lab-derived warnings
        const labAlerts = this.checkLabDerivedTags(clientTags, foodTags);
        alerts.push(...labAlerts);
        if (labAlerts.length > 0 && highestSeverity !== ValidationSeverity.RED) {
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

        // ===== GREEN RULES (positive) =====
        // These don't change severity, just add positive indicators

        // 9. Liked foods
        const likedAlert = this.checkLikedFoods(clientTags, foodTags);
        if (likedAlert) alerts.push(likedAlert);

        // 10. Preferred cuisines
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
                mealSuitabilityTags: true
            }
        });

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
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
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
                mealSuitabilityTags: true
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
            mealSuitabilityTags: new Set(food.mealSuitabilityTags.map(m => m.toLowerCase()))
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

        // Vegan can't eat non-veg or egg-containing
        if (clientPattern === 'vegan' && (foodCategory === 'non_veg' || foodCategory === 'veg_with_egg' || foodCategory === 'vegetarian')) {
            // Vegan can only eat vegan foods
            if (foodCategory !== 'vegan') {
                return {
                    type: 'diet_pattern',
                    severity: ValidationSeverity.RED,
                    message: `⛔ VEGAN: Client only eats vegan food`,
                    icon: 'sprout'
                };
            }
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
        context: ValidationContext
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
            const isActive = this.isRestrictionActive(restriction, currentDay, currentMeal);
            if (!isActive) continue;

            // Step 4: Add alert based on severity
            const severity = restriction.severity === 'strict'
                ? ValidationSeverity.RED
                : ValidationSeverity.YELLOW;

            const reasonText = restriction.reason
                ? ` (${restriction.reason.replace(/_/g, ' ')})`
                : '';

            let message: string;
            if (restriction.restrictionType === 'day_based') {
                message = severity === ValidationSeverity.RED
                    ? `⛔ RESTRICTED: No ${restriction.foodCategory || restriction.foodName || 'this food'} on ${currentDay}${reasonText}`
                    : `🟡 CAUTION: Client prefers to avoid ${restriction.foodCategory || restriction.foodName || 'this food'} on ${currentDay}${reasonText}`;
            } else if (restriction.restrictionType === 'always') {
                message = severity === ValidationSeverity.RED
                    ? `⛔ RESTRICTED: Client never eats ${restriction.foodCategory || restriction.foodName || 'this food'}${reasonText}`
                    : `🟡 CAUTION: Client prefers to avoid ${restriction.foodCategory || restriction.foodName || 'this food'}${reasonText}`;
            } else if (restriction.restrictionType === 'time_based') {
                message = severity === ValidationSeverity.RED
                    ? `⛔ RESTRICTED: No ${restriction.foodCategory || restriction.foodName || 'this food'} during ${currentMeal}${reasonText}`
                    : `🟡 CAUTION: Client prefers to avoid ${restriction.foodCategory || restriction.foodName || 'this food'} during ${currentMeal}${reasonText}`;
            } else if (restriction.restrictionType === 'frequency') {
                message = `🟡 FREQUENCY: Limit ${restriction.foodCategory || restriction.foodName || 'this food'} to ${restriction.maxPerWeek || restriction.maxPerDay}/week${reasonText}`;
            } else if (restriction.restrictionType === 'quantity') {
                message = `🟡 QUANTITY: Limit ${restriction.foodCategory || restriction.foodName || 'this food'} to ${restriction.maxGramsPerMeal}g/meal${reasonText}`;
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
        currentMeal: string
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
                    return restriction.avoidMeals.some(m => m.toLowerCase() === currentMeal);
                }
                // Could add avoidAfter/avoidBefore logic here with time comparison
                return true;

            case 'frequency':
                // For now, always show warning (would need weekly usage tracking)
                return true;

            case 'quantity':
                // Always show the limit reminder
                return true;

            default:
                return true;
        }
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

        // High cholesterol + cholesterol-heavy food
        if (
            client.labDerivedTags.has('high_cholesterol') &&
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

        // Vitamin D deficiency - could add positive nudge for vitamin D rich foods
        if (
            client.labDerivedTags.has('vitamin_d_deficiency') &&
            food.healthFlags.has('vitamin_d_rich')
        ) {
            alerts.push({
                type: 'lab_derived',
                severity: ValidationSeverity.GREEN,
                message: `✅ NUTRIENT MATCH: Good source of Vitamin D for client`,
                icon: 'sun'
            });
        }

        return alerts;
    }

    private checkDislikes(client: ClientTags, food: FoodTags): ValidationAlert | null {
        const foodNameLower = food.name.toLowerCase();

        if (client.dislikes.has(foodNameLower)) {
            return {
                type: 'dislike',
                severity: ValidationSeverity.YELLOW,
                message: `🟡 DISLIKE: Client has indicated they dislike ${food.name}`,
                recommendation: 'Consider alternative options',
                icon: 'thumb-down'
            };
        }

        return null;
    }

    private checkLikedFoods(client: ClientTags, food: FoodTags): ValidationAlert | null {
        if (client.likedFoods.has(food.id)) {
            return {
                type: 'preference_match',
                severity: ValidationSeverity.GREEN,
                message: `✅ CLIENT FAVORITE: Client likes ${food.name}`,
                icon: 'heart'
            };
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
