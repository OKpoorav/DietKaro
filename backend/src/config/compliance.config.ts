/**
 * Compliance Engine Configuration
 * Configurable weights, penalties, and thresholds for meal compliance scoring
 */

export const COMPLIANCE_CONFIG = {
    // Scoring weights (must sum to 100)
    WEIGHTS: {
        ON_TIME: Number(process.env.COMPLIANCE_WEIGHT_ON_TIME) || 20,
        PHOTO: Number(process.env.COMPLIANCE_WEIGHT_PHOTO) || 15,
        CORRECT_FOODS: Number(process.env.COMPLIANCE_WEIGHT_CORRECT_FOODS) || 30,
        PORTION_ACCURACY: Number(process.env.COMPLIANCE_WEIGHT_PORTION) || 20,
        DIETITIAN_APPROVED: Number(process.env.COMPLIANCE_WEIGHT_DIETITIAN) || 15,
    },

    // Penalties
    PENALTIES: {
        SUBSTITUTION: Number(process.env.COMPLIANCE_PENALTY_SUBSTITUTION) || -10,
        SKIPPED_SCORE: 0,
    },

    // Color thresholds
    THRESHOLDS: {
        GREEN_MIN: Number(process.env.COMPLIANCE_THRESHOLD_GREEN) || 85,
        YELLOW_MIN: Number(process.env.COMPLIANCE_THRESHOLD_YELLOW) || 60,
        // Below YELLOW_MIN = RED
    },

    // Timing
    ON_TIME_WINDOW_MINUTES: Number(process.env.COMPLIANCE_ON_TIME_WINDOW) || 30,

    // Portion accuracy: deviation beyond this % loses points proportionally
    PORTION_TOLERANCE_PCT: 0.15,

    // Trend detection: ±threshold to determine improving/declining
    TREND_THRESHOLD: 5,
};
