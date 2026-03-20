import { generateObject } from 'ai';
import { miniModel } from './providers';
import { medicalExtractionSchema, MedicalExtraction } from './schemas';
import { ExtractedContent } from '../extraction/types';

/**
 * Level-1 per-document extraction.
 * Uses the mini model (Gemini Flash) — fast and cheap.
 * Runs eagerly on every upload via BullMQ worker.
 */
export async function extractMedicalInfo(
    content: ExtractedContent,
    reportType: string,
): Promise<MedicalExtraction> {
    const inputText = content.type === 'structured'
        ? `Document format: CSV data\nReport type: ${reportType}\nParsed data (JSON):\n${JSON.stringify(content.content, null, 2)}`
        : `Document format: Text\nReport type: ${reportType}\nContent:\n${content.content}`;

    const { object } = await generateObject({
        model: miniModel,
        schema: medicalExtractionSchema,
        abortSignal: AbortSignal.timeout(60000),
        system: `You are a clinical dietitian AI assistant. Extract structured medical and dietary information from patient documents.

Rules:
- Only extract information explicitly stated in the document — never infer or hallucinate.
- Use null for missing nullable fields, empty arrays for list fields with no data.
- For CSV data, the JSON contains column headers as keys and cell values as strings. Interpret rows semantically.
- Populate dietary_flags with short machine-readable tags the dietitian needs for diet plan generation.
- The summary field should be 2-3 sentences focusing on what is most relevant for diet planning.

CRITICAL — lab_values extraction:
- Lab reports often have table rows like: "TEST NAME   VALUE   UNIT   REFERENCE RANGE"
- You MUST extract every test result into lab_values as {"Test Name": "value unit"}, e.g. {"Random Blood Sugar": "82 mg/dL", "HbA1c": "7.2%"}.
- Even if the document has only one test result, populate lab_values with that result.
- Never leave lab_values null when there are clearly numeric test results in the document.`,
        prompt: inputText,
    });

    return object;
}
