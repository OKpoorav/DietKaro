/**
 * Lab Reference Ranges and Risk Flag Derivation Rules
 * Used by LabService to auto-derive health risk tags from lab values
 */

import { LabRange } from '../types/medical.types';

export const LAB_REFERENCE_RANGES: Record<string, LabRange> = {
    // ============ DIABETES MARKERS ============

    hba1c: {
        name: 'HbA1c',
        unit: '%',
        normal: [0, 5.6],
        warningHigh: [5.7, 6.4],
        criticalHigh: [6.5, 20],
        derivedTags: [
            { condition: (v) => v >= 6.5, tag: 'diabetic' },
            { condition: (v) => v >= 5.7 && v < 6.5, tag: 'pre_diabetic' },
        ],
    },
    fastingGlucose: {
        name: 'Fasting Glucose',
        unit: 'mg/dL',
        normal: [70, 99],
        warningHigh: [100, 125],
        criticalHigh: [126, 500],
        criticalLow: [0, 54],
        derivedTags: [
            { condition: (v) => v >= 126, tag: 'diabetic' },
            { condition: (v) => v >= 100 && v < 126, tag: 'pre_diabetic' },
        ],
    },
    postprandialGlucose: {
        name: 'PP Glucose',
        unit: 'mg/dL',
        normal: [70, 139],
        warningHigh: [140, 199],
        criticalHigh: [200, 600],
        derivedTags: [
            { condition: (v) => v >= 200, tag: 'diabetic' },
            { condition: (v) => v >= 140 && v < 200, tag: 'pre_diabetic' },
        ],
    },

    // ============ LIPID PROFILE ============

    totalCholesterol: {
        name: 'Total Cholesterol',
        unit: 'mg/dL',
        normal: [0, 199],
        warningHigh: [200, 239],
        criticalHigh: [240, 500],
        derivedTags: [
            { condition: (v) => v >= 240, tag: 'high_cholesterol' },
            { condition: (v) => v >= 200 && v < 240, tag: 'borderline_cholesterol' },
        ],
    },
    ldl: {
        name: 'LDL Cholesterol',
        unit: 'mg/dL',
        normal: [0, 99],
        warningHigh: [100, 159],
        criticalHigh: [160, 500],
        derivedTags: [
            { condition: (v) => v >= 160, tag: 'high_cholesterol' },
        ],
    },
    hdl: {
        name: 'HDL Cholesterol',
        unit: 'mg/dL',
        optimal: [60, 200],
        normal: [40, 200],
        warningLow: [30, 39],
        criticalLow: [0, 29],
        derivedTags: [
            { condition: (v) => v < 40, tag: 'low_hdl' },
        ],
    },
    triglycerides: {
        name: 'Triglycerides',
        unit: 'mg/dL',
        normal: [0, 149],
        warningHigh: [150, 199],
        criticalHigh: [200, 2000],
        derivedTags: [
            { condition: (v) => v >= 200, tag: 'high_triglycerides' },
        ],
    },
    vldl: {
        name: 'VLDL',
        unit: 'mg/dL',
        normal: [5, 30],
        warningHigh: [31, 40],
        criticalHigh: [41, 200],
        derivedTags: [],
    },

    // ============ VITAMINS & MINERALS ============

    vitaminD: {
        name: 'Vitamin D',
        unit: 'ng/mL',
        optimal: [40, 100],
        normal: [30, 100],
        warningLow: [20, 29],
        criticalLow: [0, 19],
        derivedTags: [
            { condition: (v) => v < 20, tag: 'severe_vitamin_d_deficiency' },
            { condition: (v) => v < 30, tag: 'vitamin_d_deficiency' },
        ],
    },
    vitaminB12: {
        name: 'Vitamin B12',
        unit: 'pg/mL',
        normal: [200, 900],
        warningLow: [150, 199],
        criticalLow: [0, 149],
        derivedTags: [
            { condition: (v) => v < 200, tag: 'b12_deficiency' },
        ],
    },
    iron: {
        name: 'Iron',
        unit: 'mcg/dL',
        normal: [60, 170],
        warningLow: [40, 59],
        criticalLow: [0, 39],
        derivedTags: [
            { condition: (v) => v < 60, tag: 'iron_deficiency' },
        ],
    },
    ferritin: {
        name: 'Ferritin',
        unit: 'ng/mL',
        normal: [12, 300],
        warningLow: [8, 11],
        criticalLow: [0, 7],
        derivedTags: [
            { condition: (v) => v < 12, tag: 'iron_deficiency' },
        ],
    },
    calcium: {
        name: 'Calcium',
        unit: 'mg/dL',
        normal: [8.5, 10.5],
        warningLow: [7.5, 8.4],
        criticalLow: [0, 7.4],
        warningHigh: [10.6, 12.0],
        criticalHigh: [12.1, 20],
        derivedTags: [
            { condition: (v) => v < 8.5, tag: 'calcium_deficiency' },
        ],
    },

    // ============ THYROID ============

    tsh: {
        name: 'TSH',
        unit: 'mIU/L',
        normal: [0.4, 4.0],
        warningHigh: [4.1, 10.0],
        criticalHigh: [10.1, 100],
        warningLow: [0.1, 0.39],
        criticalLow: [0, 0.09],
        derivedTags: [
            { condition: (v) => v > 4.0, tag: 'hypothyroid' },
            { condition: (v) => v < 0.4, tag: 'hyperthyroid' },
        ],
    },
    t3: {
        name: 'T3',
        unit: 'ng/dL',
        normal: [80, 200],
        warningLow: [60, 79],
        criticalLow: [0, 59],
        derivedTags: [],
    },
    t4: {
        name: 'T4',
        unit: 'mcg/dL',
        normal: [5.0, 12.0],
        warningLow: [3.5, 4.9],
        criticalLow: [0, 3.4],
        derivedTags: [],
    },

    // ============ KIDNEY FUNCTION ============

    creatinine: {
        name: 'Creatinine',
        unit: 'mg/dL',
        normal: [0.6, 1.2],
        warningHigh: [1.3, 1.9],
        criticalHigh: [2.0, 20],
        derivedTags: [
            { condition: (v) => v > 1.2, tag: 'kidney_caution' },
        ],
    },
    bun: {
        name: 'BUN',
        unit: 'mg/dL',
        normal: [7, 20],
        warningHigh: [21, 30],
        criticalHigh: [31, 200],
        derivedTags: [],
    },
    uricAcid: {
        name: 'Uric Acid',
        unit: 'mg/dL',
        normal: [3.5, 7.2],
        warningHigh: [7.3, 9.0],
        criticalHigh: [9.1, 20],
        derivedTags: [
            { condition: (v) => v > 7.2, tag: 'high_uric_acid' },
        ],
    },

    // ============ LIVER FUNCTION ============

    sgot: {
        name: 'SGOT (AST)',
        unit: 'U/L',
        normal: [8, 45],
        warningHigh: [46, 100],
        criticalHigh: [101, 1000],
        derivedTags: [],
    },
    sgpt: {
        name: 'SGPT (ALT)',
        unit: 'U/L',
        normal: [7, 56],
        warningHigh: [57, 120],
        criticalHigh: [121, 1000],
        derivedTags: [],
    },

    // ============ BLOOD ============

    hemoglobin: {
        name: 'Hemoglobin',
        unit: 'g/dL',
        normal: [12, 17.5],
        warningLow: [10, 11.9],
        criticalLow: [0, 9.9],
        derivedTags: [
            { condition: (v) => v < 12, tag: 'anemia' },
        ],
    },
};

/**
 * Valid lab value keys for input validation
 */
export const VALID_LAB_KEYS = Object.keys(LAB_REFERENCE_RANGES);
