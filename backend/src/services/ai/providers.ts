import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "../../config/env";

const openaiClient = createOpenAI({ apiKey: env.OPENAI_API_KEY });
const googleClient = createGoogleGenerativeAI({
  apiKey: env.GOOGLE_AI_API_KEY,
});

/**
 * Mini model — Gemini 2.5 Flash
 * Used for per-document extraction: high volume, low cost, runs eagerly on every upload.
 */
export const miniModel = googleClient("gemini-2.5-flash");

/**
 * Agent model — Gemini 3.5 Flash (GA May 19, 2026).
 * Used for tool-use heavy agentic flows (meal-plan drafter). Faster + cheaper
 * than gpt-4o while matching its tool-use quality for structured agents.
 */
export const agentModel = googleClient("gemini-3.5-flash");

/**
 * Default model — GPT-4o
 * Used for the unified client summary: on-demand, dietitian-facing, premium quality synthesis.
 */
export const defaultModel = openaiClient("gpt-4o");

// Update model strings here when upgrading:
// miniModel  → google('gemini-2.5-flash') / google('gemini-3-flash') as they release
// defaultModel → openai('gpt-5') once available
