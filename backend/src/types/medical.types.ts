/**
 * Medical & Lab Values Types
 * Used by lab service, medical summary, and validation engine
 */

// ============ LAB VALUES ============

export interface LabValues {
    // Diabetes markers
    hba1c?: number;
    fastingGlucose?: number;
    postprandialGlucose?: number;

    // Lipid profile
    totalCholesterol?: number;
    ldl?: number;
    hdl?: number;
    triglycerides?: number;
    vldl?: number;

    // Vitamins & minerals
    vitaminD?: number;
    vitaminB12?: number;
    iron?: number;
    ferritin?: number;
    calcium?: number;

    // Thyroid
    tsh?: number;
    t3?: number;
    t4?: number;

    // Kidney function
    creatinine?: number;
    bun?: number;
    uricAcid?: number;

    // Liver function
    sgot?: number;
    sgpt?: number;

    // Blood
    hemoglobin?: number;
}

// ============ LAB ALERT ============

export interface LabAlert {
    name: string;
    value: number;
    unit: string;
    status: 'critical' | 'warning' | 'normal' | 'optimal';
    normalRange: string;
    derivedTag?: string;
}

// ============ MEDICAL SUMMARY ============

export interface MedicalSummary {
    // From Client table
    allergies: string[];
    intolerances: string[];
    dietPattern: string | null;
    eggAllowed: boolean;
    eggAvoidDays: string[];
    medicalConditions: string[];
    dislikes: string[];
    likedFoods: string[];
    avoidCategories: string[];

    // From MedicalProfile table
    diagnoses: string[];
    medications: string[];
    supplements: string[];
    surgeries: string[];
    familyHistory: string | null;
    healthNotes: string | null;

    // Lab data
    labAlerts: LabAlert[];
    labDate: string | null;
    labDerivedTags: string[];

    // Computed
    criticalCount: number;
    warningCount: number;
    lastUpdated: string;
}

// ============ LAB REFERENCE RANGE ============

export interface LabRange {
    name: string;
    unit: string;
    optimal?: [number, number];
    normal: [number, number];
    warningLow?: [number, number];
    warningHigh?: [number, number];
    criticalLow?: [number, number];
    criticalHigh?: [number, number];
    derivedTags: {
        condition: (value: number) => boolean;
        tag: string;
    }[];
}
