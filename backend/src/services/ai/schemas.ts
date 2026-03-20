import { jsonSchema } from 'ai';

/**
 * Structured medical/dietary extraction schema.
 * Used by Level-1 per-document AI call (Gemini Flash).
 * Defined as a plain JSON Schema to avoid Zod version coupling.
 */
export interface MedicalExtraction {
    diagnoses: string[];
    conditions: string[];
    medications: Array<{ name: string; dose: string | null; frequency: string | null }>;
    allergies: string[];
    intolerances: string[];
    dietary_restrictions: string[];
    lab_values: Record<string, string> | null;
    dietary_flags: string[];
    dietary_recommendations: string[];
    document_type_detected: string;
    summary: string;
}

export const medicalExtractionSchema = jsonSchema<MedicalExtraction>({
    type: 'object',
    properties: {
        diagnoses: {
            type: 'array',
            items: { type: 'string' },
            description: 'Medical diagnoses explicitly stated in the document',
        },
        conditions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Ongoing health conditions mentioned',
        },
        medications: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    dose: { type: ['string', 'null'] },
                    frequency: { type: ['string', 'null'] },
                },
                required: ['name', 'dose', 'frequency'],
            },
            description: 'Medications and supplements with dosage info',
        },
        allergies: {
            type: 'array',
            items: { type: 'string' },
            description: 'Food or drug allergies',
        },
        intolerances: {
            type: 'array',
            items: { type: 'string' },
            description: 'Food intolerances (lactose, gluten, etc.)',
        },
        dietary_restrictions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Dietary restrictions (vegetarian, no red meat, etc.)',
        },
        lab_values: {
            type: ['object', 'null'],
            additionalProperties: { type: 'string' },
            description: 'Lab test results as key-value pairs, e.g. {"HbA1c": "7.2%", "LDL": "120 mg/dL"}',
        },
        dietary_flags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Critical clinical flags for diet planning, e.g. ["diabetic", "hypertensive", "high_cholesterol", "vitamin_d_deficiency", "renal_diet_required"]',
        },
        dietary_recommendations: {
            type: 'array',
            items: { type: 'string' },
            description: 'Dietary recommendations explicitly mentioned in the document',
        },
        document_type_detected: {
            type: 'string',
            description: 'Detected document type: blood_test | lab_report | prescription | diet_history | medical_report | csv_data | other',
        },
        summary: {
            type: 'string',
            description: 'Concise 2-3 sentence summary of this document focusing on what is most relevant for a clinical dietitian',
        },
    },
    required: [
        'diagnoses', 'conditions', 'medications', 'allergies', 'intolerances',
        'dietary_restrictions', 'lab_values', 'dietary_flags',
        'dietary_recommendations', 'document_type_detected', 'summary',
    ],
});
