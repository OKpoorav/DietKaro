import { generateObject, jsonSchema } from 'ai';
import { miniModel } from './providers';

/**
 * Structured extraction from dietitian's free-form internal notes.
 *
 * Notes typically contain a chaotic mix of: referral source, anthropometrics,
 * lab values across multiple dates, body measurements across multiple dates,
 * medical complaints, family history, daily routine, food preferences.
 *
 * The model normalizes this into a flat structure that maps cleanly onto
 * existing tables (Client, MedicalProfile, BodyMeasurement) so downstream
 * apply logic can reuse existing services (labService, clientService).
 */

export interface ExtractedLabReport {
    date: string | null; // ISO YYYY-MM-DD, null if undatable
    /**
     * Lab values keyed by canonical names. The model is instructed to use the
     * canonical keys from LAB_REFERENCE_RANGES when possible
     * (e.g. "vitaminD", "hba1c", "tsh"). Unknown keys are silently dropped by
     * labService.saveLabValues.
     */
    values: Record<string, number>;
}

export interface ExtractedBodyMeasurement {
    date: string | null; // ISO YYYY-MM-DD, null if undatable
    /** Values in cm. Inches are auto-converted in the prompt. */
    chestCm: number | null;
    waistCm: number | null;
    hipsCm: number | null;
    thighsCm: number | null;
    armsCm: number | null;
    stomachCm: number | null;
    bellyAboveNavelCm: number | null;
    bellyBelowNavelCm: number | null;
    calfCm: number | null;
}

export interface ExtractedLifestyle {
    sleep: string | null;
    water: string | null;
    bowel: string | null;
    periods: string | null;
    hormonal: string | null;
    headaches: string | null;
    breakfast: string | null;
    lunch: string | null;
    dinner: string | null;
    other: string | null;
}

export interface NotesExtraction {
    age: number | null;
    heightCm: number | null;
    currentWeightKg: number | null;
    referredBy: string | null;
    location: string | null;
    bloodReports: ExtractedLabReport[];
    bodyMeasurements: ExtractedBodyMeasurement[];
    medicalIssues: string[];
    familyHistory: string[];
    allergies: string[];
    intolerances: string[];
    dislikes: string[];
    likedFoods: string[];
    lifestyle: ExtractedLifestyle;
    otherNotes: string[];
}

const schema = jsonSchema<NotesExtraction>({
    type: 'object',
    properties: {
        age: { type: ['number', 'null'], description: 'Age in years if explicitly stated' },
        heightCm: { type: ['number', 'null'], description: 'Height in cm. Convert from ft/in if needed (e.g. "5.3" → 160).' },
        currentWeightKg: { type: ['number', 'null'], description: 'Current weight in kg' },
        referredBy: { type: ['string', 'null'], description: 'Person who referred the client (e.g. "CL Gupta")' },
        location: { type: ['string', 'null'], description: 'Client city/country if mentioned (e.g. "Dubai")' },
        bloodReports: {
            type: 'array',
            description: 'Blood / lab reports. Each entry groups results from one report date. The notes can contain multiple dated reports — extract every dated group separately.',
            items: {
                type: 'object',
                properties: {
                    date: { type: ['string', 'null'], description: 'ISO date YYYY-MM-DD. Convert from formats like "29-11-25", "5-12-25" (assume 20YY for 2-digit years).' },
                    values: {
                        type: 'object',
                        additionalProperties: { type: 'number' },
                        description: 'Map of lab name → numeric value (strip units, H/L flags). USE THESE CANONICAL KEYS WHEN APPLICABLE: hba1c, fastingGlucose, postprandialGlucose, totalCholesterol, ldl, hdl, triglycerides, vldl, vitaminD, vitaminB12, iron, ferritin, calcium, tsh, t3, t4, creatinine, bun (blood urea), uricAcid, sgot, sgpt, hemoglobin. Map "GLYCOSYLATED" or "HBA1C" → hba1c, "Blood urea" → bun, "VIT D" → vitaminD, "VITAMIN B12" → vitaminB12, etc. Other lab names: use a camelCase guess.',
                    },
                },
                required: ['date', 'values'],
            },
        },
        bodyMeasurements: {
            type: 'array',
            description: 'Body measurements grouped by date. Convert inches → cm by multiplying by 2.54 (round to 1 decimal).',
            items: {
                type: 'object',
                properties: {
                    date: { type: ['string', 'null'], description: 'ISO date YYYY-MM-DD' },
                    chestCm: { type: ['number', 'null'] },
                    waistCm: { type: ['number', 'null'] },
                    hipsCm: { type: ['number', 'null'] },
                    thighsCm: { type: ['number', 'null'], description: 'Upper thigh in cm' },
                    armsCm: { type: ['number', 'null'], description: 'Upper arm in cm' },
                    stomachCm: { type: ['number', 'null'], description: 'Stomach around navel in cm' },
                    bellyAboveNavelCm: { type: ['number', 'null'], description: '2 inch above navel in cm' },
                    bellyBelowNavelCm: { type: ['number', 'null'], description: '2 inch below navel in cm' },
                    calfCm: { type: ['number', 'null'] },
                },
                required: ['date', 'chestCm', 'waistCm', 'hipsCm', 'thighsCm', 'armsCm', 'stomachCm', 'bellyAboveNavelCm', 'bellyBelowNavelCm', 'calfCm'],
            },
        },
        medicalIssues: {
            type: 'array',
            items: { type: 'string' },
            description: 'Symptoms, complaints, diagnoses, recurring issues (e.g. "bloating", "backache", "hormonal issues", "frequent headaches"). One short phrase per item.',
        },
        familyHistory: {
            type: 'array',
            items: { type: 'string' },
            description: 'Family medical / weight history (e.g. "mother overweight", "younger daughter overweight"). One short phrase per item.',
        },
        allergies: {
            type: 'array',
            items: { type: 'string' },
            description: 'Explicit food / drug allergies. NOT dislikes.',
        },
        intolerances: {
            type: 'array',
            items: { type: 'string' },
            description: 'Food intolerances (lactose, gluten, etc.). Do NOT include items also listed as allergies.',
        },
        dislikes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Foods the client dislikes (e.g. "curd", "raita", "buttermilk", "raw onion", "pickle", "chutney"). Normalize to singular nouns.',
        },
        likedFoods: {
            type: 'array',
            items: { type: 'string' },
            description: 'Foods the client likes (e.g. "non-veg in lunch", "chicken", "bhindi", "khichdi", "smoothie"). Normalize.',
        },
        lifestyle: {
            type: 'object',
            properties: {
                sleep: { type: ['string', 'null'], description: 'Sleep schedule (e.g. "sleeps 12am, wakes morning")' },
                water: { type: ['string', 'null'], description: 'Water intake (e.g. "1L on waking")' },
                bowel: { type: ['string', 'null'], description: 'Bowel movements (e.g. "regular now, otherwise once in 2 months")' },
                periods: { type: ['string', 'null'], description: 'Period info (e.g. "last Oct 30th, regular now")' },
                hormonal: { type: ['string', 'null'], description: 'Hormonal complaints (e.g. "body hair, heated before periods")' },
                headaches: { type: ['string', 'null'], description: 'Headache / painkiller info' },
                breakfast: { type: ['string', 'null'], description: 'Typical breakfast (e.g. "9:30am granola bar or brunch")' },
                lunch: { type: ['string', 'null'], description: 'Typical lunch (e.g. "3pm 2 roti + tea")' },
                dinner: { type: ['string', 'null'], description: 'Typical dinner (e.g. "8:30pm chicken, avoid Tuesday")' },
                other: { type: ['string', 'null'], description: 'Other lifestyle notes (e.g. "cold/cough, inhaler sometimes")' },
            },
            required: ['sleep', 'water', 'bowel', 'periods', 'hormonal', 'headaches', 'breakfast', 'lunch', 'dinner', 'other'],
        },
        otherNotes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Anything else worth preserving that does not fit above categories.',
        },
    },
    required: [
        'age', 'heightCm', 'currentWeightKg', 'referredBy', 'location',
        'bloodReports', 'bodyMeasurements', 'medicalIssues', 'familyHistory',
        'allergies', 'intolerances', 'dislikes', 'likedFoods', 'lifestyle', 'otherNotes',
    ],
});

const SYSTEM_PROMPT = `You are a clinical dietitian's assistant. Extract structured data from the dietitian's free-form internal notes about a client.

Rules:
- ONLY extract what is explicitly stated. Never infer or invent.
- Use null for missing scalar fields, [] for empty list fields.
- Dates: normalize to ISO YYYY-MM-DD. Two-digit years are 20YY. dd/mm/yy or dd-mm-yy. "Oct 30th" with no year → null (cannot determine).
- Units: lab values keep numeric only (drop H/L/HIGH/LOW flags and units). Body measurements: convert inches → cm (× 2.54, round to 1 decimal).
- Height: convert ft.in like "5.3" to cm (5 ft 3 in ≈ 160 cm). If ambiguous, leave null.
- Group results by date. If the notes list multiple dated lab reports or body measurement sessions, return one array entry per date.
- Allergies vs Dislikes vs Intolerances: an allergy is a medical condition ("peanut allergy"), an intolerance is digestive ("lactose intolerance"), a dislike is a preference ("doesn't like curd"). When unclear, prefer dislikes.
- Map lab names to canonical keys (see schema). For example: "Blood urea" → bun, "VIT D" → vitaminD, "GLYCOSYLATED" → hba1c.
- Be liberal in extraction — over-extract rather than miss data. The user will verify in a confirm step.`;

export async function extractFromNotes(notes: string): Promise<NotesExtraction> {
    const { object } = await generateObject({
        model: miniModel,
        schema,
        abortSignal: AbortSignal.timeout(45000),
        system: SYSTEM_PROMPT,
        prompt: `Notes:\n\n${notes}`,
    });
    return object;
}
