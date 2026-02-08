/**
 * Validation Engine Configuration
 * Configurable thresholds for food validation rules
 */

export const VALIDATION_CONFIG = {
    /** Max times a food can appear in a week before triggering a repetition warning */
    REPETITION_THRESHOLD: Number(process.env.VALIDATION_REPETITION_THRESHOLD) || 3,

    /** Max consecutive days a food can appear before triggering a spacing warning */
    REPETITION_MAX_CONSECUTIVE_DAYS: 2,

    /** Single food providing > this % of daily calorie target triggers warning */
    SINGLE_FOOD_CALORIE_WARN_PCT: 0.50,

    /** Single food providing > this % of any macro target triggers warning */
    SINGLE_FOOD_MACRO_WARN_PCT: 0.60,

    /** How long client tags stay cached (ms) */
    CACHE_TTL_MS: Number(process.env.VALIDATION_CACHE_TTL_MS) || 5 * 60 * 1000,

    /** Maximum number of client tag entries in LRU cache */
    MAX_CACHE_SIZE: Number(process.env.VALIDATION_MAX_CACHE_SIZE) || 50,
};
