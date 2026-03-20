import { generateText } from 'ai';
import { defaultModel } from './providers';

export interface DocSummaryInput {
    reportType: string;
    summary: string;
    flags: string[];
}

/**
 * Level-2 unified cross-document summary.
 * Uses the default model (GPT-4o / GPT-5) — premium quality synthesis.
 * Runs lazily on request (GET /clients/:id/document-summary).
 *
 * Strategy: Refine (sequential integration) instead of Map-Reduce.
 * Preserves cross-document relationships and surfaces contradictions.
 */
export async function buildUnifiedClientSummary(documents: DocSummaryInput[]): Promise<string> {
    if (documents.length === 0) return '';

    // Build a single rich prompt from all document summaries
    const docsText = documents
        .map((d, i) =>
            `[Document ${i + 1}] Type: ${d.reportType}\nSummary: ${d.summary}\nFlags: ${d.flags.length > 0 ? d.flags.join(', ') : 'none'}`,
        )
        .join('\n\n');

    const { text } = await generateText({
        model: defaultModel,
        abortSignal: AbortSignal.timeout(60000),
        system: `You are a clinical dietitian AI assistant creating a unified patient health profile.

Write a concise, dense paragraph (4–6 sentences maximum) synthesising all provided document summaries into a single actionable overview for the dietitian.

Guidelines:
- Lead with the most critical diet-relevant findings: active conditions, allergies, lab values out of range, hard restrictions.
- Mention key medications only if they have direct dietary implications (e.g. warfarin → vitamin K restriction).
- If two documents contradict each other on the same fact, insert [CONFLICT: ...] inline.
- Close with 1 sentence on the overall dietary complexity or risk level.
- Do NOT use bullet points or headings — write flowing prose.
- Be concise. This paragraph appears at the top of a client's clinical profile.`,
        prompt: `Synthesise these ${documents.length} document summaries into one unified patient health profile:\n\n${docsText}`,
    });

    return text.trim();
}
