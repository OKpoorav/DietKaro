import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { env } from '../../config/env';

const openaiClient = createOpenAI({ apiKey: env.OPENAI_API_KEY });
const googleClient = createGoogleGenerativeAI({ apiKey: env.GOOGLE_AI_API_KEY });

/**
 * Mini model — Gemini Flash
 * Used for per-document extraction: high volume, low cost, runs eagerly on every upload.
 */
export const miniModel = googleClient('gemini-2.0-flash');

/**
 * Default model — GPT-5
 * Used for the unified client summary: on-demand, dietitian-facing, premium quality synthesis.
 */
export const defaultModel = openaiClient('gpt-4o');

// Update model strings here when upgrading:
// miniModel  → google('gemini-2.5-flash') / google('gemini-3-flash') as they release
// defaultModel → openai('gpt-5') once available
