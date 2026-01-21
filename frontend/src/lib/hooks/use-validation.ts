/**
 * Diet Validation Hook
 * Real-time food validation against client restrictions
 */

'use client';

import { useCallback, useState } from 'react';
import { useApiClient } from '../api/use-api-client';

// ============ TYPES ============

export type ValidationSeverity = 'RED' | 'YELLOW' | 'GREEN';
export type BorderColor = 'red' | 'yellow' | 'green';

export interface ValidationAlert {
    type: string;
    severity: ValidationSeverity;
    message: string;
    recommendation?: string;
    icon?: string;
}

export interface ValidationResult {
    foodId: string;
    foodName: string;
    severity: ValidationSeverity;
    borderColor: BorderColor;
    canAdd: boolean;
    alerts: ValidationAlert[];
    confidenceScore: number;
}

export interface BatchValidationResult {
    results: ValidationResult[];
    processingTimeMs: number;
}

export interface ValidationContext {
    currentDay: string;
    mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner';
}

export interface FoodRestriction {
    foodId?: string;
    foodName?: string;
    foodCategory?: string;
    restrictionType: 'day_based' | 'time_based' | 'frequency' | 'quantity' | 'always';
    avoidDays?: string[];
    avoidMeals?: string[];
    avoidAfter?: string;
    avoidBefore?: string;
    maxPerWeek?: number;
    maxPerDay?: number;
    maxGramsPerMeal?: number;
    excludes?: string[];
    includes?: string[];
    reason?: string;
    severity: 'strict' | 'flexible';
    note?: string;
}

// ============ HOOK ============

export function useValidation(clientId: string | null) {
    const api = useApiClient();
    const [validationCache, setValidationCache] = useState<Map<string, ValidationResult>>(new Map());
    const [isValidating, setIsValidating] = useState(false);

    /**
     * Validate multiple food items at once (batch is more efficient)
     */
    const validateFoods = useCallback(async (
        foodIds: string[],
        context: ValidationContext
    ): Promise<Map<string, ValidationResult>> => {
        if (!clientId || foodIds.length === 0) {
            return new Map();
        }

        // Filter out already cached items
        const uncachedIds = foodIds.filter(id => !validationCache.has(id));

        if (uncachedIds.length === 0) {
            // All cached, return from cache
            const results = new Map<string, ValidationResult>();
            foodIds.forEach(id => {
                const cached = validationCache.get(id);
                if (cached) results.set(id, cached);
            });
            return results;
        }

        setIsValidating(true);
        try {
            const { data } = await api.post('/diet-validation/batch', {
                clientId,
                foodIds: uncachedIds,
                context
            });

            const batchResult: BatchValidationResult = data.data;

            // Update cache with new results
            const newCache = new Map(validationCache);
            batchResult.results.forEach(result => {
                newCache.set(result.foodId, result);
            });
            setValidationCache(newCache);

            // Return all requested results (cached + new)
            const results = new Map<string, ValidationResult>();
            foodIds.forEach(id => {
                const cached = newCache.get(id);
                if (cached) results.set(id, cached);
            });

            return results;
        } catch (error) {
            console.error('Batch validation error:', error);
            return new Map();
        } finally {
            setIsValidating(false);
        }
    }, [api, clientId, validationCache]);

    /**
     * Get cached validation result for a food
     */
    const getValidation = useCallback((foodId: string): ValidationResult | undefined => {
        return validationCache.get(foodId);
    }, [validationCache]);

    /**
     * Clear validation cache (e.g., when client changes)
     */
    const clearCache = useCallback(() => {
        setValidationCache(new Map());
    }, []);

    /**
     * Get border color class for styling
     */
    const getBorderClass = useCallback((severity: ValidationSeverity | undefined): string => {
        switch (severity) {
            case 'RED':
                return 'border-red-500 bg-red-50';
            case 'YELLOW':
                return 'border-yellow-500 bg-yellow-50';
            case 'GREEN':
                return 'border-green-500 bg-green-50';
            default:
                return 'border-gray-200 hover:border-[#17cf54]';
        }
    }, []);

    /**
     * Get icon color class
     */
    const getIconClass = useCallback((severity: ValidationSeverity | undefined): string => {
        switch (severity) {
            case 'RED':
                return 'text-red-500';
            case 'YELLOW':
                return 'text-yellow-500';
            case 'GREEN':
                return 'text-green-500';
            default:
                return 'text-gray-400';
        }
    }, []);

    return {
        validateFoods,
        getValidation,
        clearCache,
        getBorderClass,
        getIconClass,
        isValidating,
        validationCache
    };
}
