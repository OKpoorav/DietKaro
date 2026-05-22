/**
 * Meal-plan agent runner.
 *
 * Drives a generateText loop that lets the model:
 *   1. Pull client context once.
 *   2. Search the food DB for each mentioned item.
 *   3. Create new FoodItems when no good match exists.
 *   4. (Optionally) validate items mid-flight.
 *   5. Submit the final structured draft via the terminal `submit_draft` tool.
 *
 * The agent never touches the diet_plan tables — it only assembles a draft
 * which the caller persists separately. This keeps the agent reusable and
 * lets the frontend show a preview before commit.
 *
 * Failure modes worth surfacing to the caller:
 *  - `finishReason === 'error'`           model/provider crashed mid-loop
 *  - `finishReason === 'length'`          context-window exhaustion
 *  - `!ctx.draft && finishReason === 'stop'`  agent gave up without submitting
 *  - hard exception                       network / SDK / unhandled
 *
 * On a soft failure (no draft, no exception) we automatically retry ONCE with
 * a follow-up nudge containing the prior assistant text, so the model gets one
 * more shot to call `submit_draft`.
 */

import { generateText, stepCountIs } from 'ai';
import { defaultModel } from './providers';
import { buildFoodToolset, type AgentToolContext } from './tools/food-tools';
import type { AgentDraftPayload } from '../../types/aiMealPlan.types';
import logger from '../../utils/logger';
import { AppError } from '../../errors/AppError';

const MAX_STEPS = 50;

const SYSTEM_PROMPT = `You are a dietitian's meal-planning assistant. The user gives you a natural-language meal plan (multiple days, multiple meals per day, often in Hindi/English mix using Indian household units like katori, roti, cup, glass). Your job: turn this prose into a structured draft.

WORKFLOW (do these in order):
1. Call get_client_context FIRST. Read the client's allergies, intolerances, dietPattern, dislikes, eggAvoidDays. This shapes every decision below.
2. Parse the prompt day-by-day, meal-by-meal.
3. For EACH mentioned food, call search_food_items with the raw name (lowercase ok). Look at the top results.
   - Pick the best match by name similarity AND dietary fit (don't pick "chicken curry" for a vegetarian client).
   - If the top result is clearly the same food (case-insensitive, common spelling variants like bhindi/bhindee, dahi/curd) USE IT — do not create a duplicate.
   - If no good match exists, call create_food_item with your best nutrition estimate per 100g + accurate allergen flags.
4. Convert household units to grams using these defaults: katori 150g, cup 200g, glass 250g, roti 25g, tsp 5g, tbsp 15g, piece/serving 100g. If the prompt gives explicit grams or ml, use that.
5. If a food is in the client's allergies list (case-insensitive substring on the allergen name OR allergenFlags), DO NOT INCLUDE IT in the draft. The server will re-validate as ground truth.
6. Pick meal types: breakfast (before 11:00), lunch (11:00-15:00), snack (anything mid-meal), dinner (after 18:00). If user says "Meal 1 / Meal 2", default 1=breakfast, 2=lunch, 3=snack, 4=dinner.
7. Day numbers: convert weekday names (Monday → Day 1, etc.). If the prompt says "Day 1, Day 2", keep them as-is.
8. For alternatives ("dal or rajma"), give both items the same optionGroup integer (1, 2, ...).
9. Non-food lines (exercise, walks, "drink 3L water", lifestyle reminders, prep notes like "soak overnight") are NOT items. Attach them to the nearest meal's instructions field as a short sentence. Example: "do a 30-min walk after dinner" → on the dinner meal of that day, set instructions="Take a 30-min walk after this meal." Also capture meal-level prep/usage notes (e.g. "use high protein oats") on the relevant meal's instructions.
10. Also fill timeOfDay ("HH:mm" 24h) whenever the prompt gives a time ("9:00am" → "09:00", "1:30pm" → "13:30", "8pm" → "20:00"). Empty-stomach/detox → "06:30". Mid-morning → "11:00". Evening → "17:00". Pre-dinner → "19:00". Post-dinner → "21:00".
11. When done, call submit_draft EXACTLY ONCE with the full days array. Do not call submit_draft until every food in your draft has a real foodId from search_food_items or create_food_item.

RULES:
- Never invent a foodId — only use IDs returned by tools.
- quantityG must be a number in grams.
- quantityLabel is the original phrase ("1 katori", "2 roti", "1 glass") for display.
- Don't add empty meals. Don't repeat a day.
- If the prompt is too vague to parse (no days/meals detectable), call submit_draft with an empty days array — the server will surface an error.`;

export interface RunMealPlanAgentArgs {
    prompt: string;
    clientId: string;
    orgId: string;
    userId: string;
}

export interface RunMealPlanAgentResult {
    draft: AgentDraftPayload;
    createdFoodIds: string[];
    steps: number;
}

const FOLLOWUP_NUDGE =
    'You did not call submit_draft. Submit the full draft now using the tool, even if some meals are incomplete. ' +
    'Use the foodIds you already obtained from search/create. This is your final step.';

export async function runMealPlanAgent(args: RunMealPlanAgentArgs): Promise<RunMealPlanAgentResult> {
    const ctx: AgentToolContext = {
        clientId: args.clientId,
        orgId: args.orgId,
        userId: args.userId,
        draft: null,
        createdFoodIds: new Set<string>(),
    };

    const tools = buildFoodToolset(ctx);
    const startedAt = Date.now();
    let totalSteps = 0;

    // Classify OpenAI / network errors: 429, 5xx, ECONN*, timeouts are retryable.
    const isTransient = (err: unknown): boolean => {
        if (!(err instanceof Error)) return false;
        const msg = err.message.toLowerCase();
        const status = (err as { status?: number; statusCode?: number }).status
            ?? (err as { status?: number; statusCode?: number }).statusCode;
        if (status === 429 || (status !== undefined && status >= 500 && status < 600)) return true;
        return /econn|etimedout|timeout|rate.?limit|overloaded|temporarily unavailable|fetch failed|socket hang up|aborted/.test(msg);
    };

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const runOnce = async (prompt: string) => {
        const RETRIES = 2;             // total = 1 + 2 = 3 attempts
        const BASE_DELAY_MS = 800;
        let lastErr: unknown = null;

        for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
            try {
                return await generateText({
                    model: defaultModel,
                    tools,
                    system: SYSTEM_PROMPT,
                    prompt,
                    stopWhen: stepCountIs(MAX_STEPS),
                    onStepFinish: () => { totalSteps += 1; },
                });
            } catch (err) {
                lastErr = err;
                const transient = isTransient(err);
                logger.warn('Meal-plan agent attempt failed', {
                    clientId: args.clientId,
                    attempt,
                    transient,
                    steps: totalSteps,
                    error: err instanceof Error ? err.message : String(err),
                    status: (err as { status?: number })?.status,
                });
                if (!transient || attempt === RETRIES) break;
                await sleep(BASE_DELAY_MS * Math.pow(2, attempt)); // 800ms, 1600ms
            }
        }

        // All attempts failed — surface the underlying message so frontend can show it.
        const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
        logger.error('Meal-plan agent gave up after retries', {
            clientId: args.clientId,
            steps: totalSteps,
            error: msg,
        });
        throw AppError.badGateway(
            `AI service error: ${msg.slice(0, 200)}. Please retry.`,
            'AI_AGENT_FAILED',
        );
    };

    const first = await runOnce(args.prompt);

    logger.info('Meal-plan agent pass 1 done', {
        clientId: args.clientId,
        steps: totalSteps,
        finishReason: first.finishReason,
        warnings: first.warnings?.length ?? 0,
        warningsSample: first.warnings?.slice(0, 3),
        createdFoods: ctx.createdFoodIds.size,
        submittedDraft: !!ctx.draft,
    });

    // Detect "lazy" submissions — model dropped most of the plan after finding
    // a few early matches. Count meals across the submitted draft and compare
    // against a rough heuristic from the prompt.
    const submittedMealCount = ctx.draft
        ? ctx.draft.days.reduce((acc, d) => acc + d.meals.length, 0)
        : 0;
    const promptMealHints = (args.prompt.match(/breakfast|lunch|dinner|snack|empty stomach|mid-|evening|pre[- ]?dinner|post[- ]?dinner/gi) ?? []).length;
    const looksTooShort = ctx.draft && submittedMealCount > 0 && promptMealHints >= 6 && submittedMealCount < promptMealHints / 2;

    // Retry once if: no draft, OR draft is suspiciously sparse vs prompt.
    if (!ctx.draft || looksTooShort) {
        const reason = !ctx.draft
            ? FOLLOWUP_NUDGE
            : `You submitted only ${submittedMealCount} meal(s) but the prompt contains many more (~${promptMealHints} meal markers detected). Re-process the ENTIRE prompt — every day, every meal — and call submit_draft again with the complete plan. Reuse the foodIds you already obtained.`;

        // Wipe partial draft so the retry has a clean slate.
        ctx.draft = null;
        const followupPrompt = args.prompt + '\n\n' + reason +
            (first.text ? `\n\nYour previous notes: ${first.text.slice(0, 500)}` : '');
        const second = await runOnce(followupPrompt);
        logger.info('Meal-plan agent pass 2 done', {
            clientId: args.clientId,
            steps: totalSteps,
            finishReason: second.finishReason,
            submittedDraft: !!ctx.draft,
            mealsAfterRetry: ctx.draft
                ? (ctx.draft as AgentDraftPayload).days.reduce((a, d) => a + d.meals.length, 0)
                : 0,
            reason: !ctx.draft ? 'no_draft' : 'too_short',
            originalMealCount: submittedMealCount,
            promptMealHints,
        });
    }

    if (!ctx.draft) {
        logger.error('Meal-plan agent never submitted a draft', {
            clientId: args.clientId,
            steps: totalSteps,
            durationMs: Date.now() - startedAt,
            createdFoodIds: Array.from(ctx.createdFoodIds),
        });
        throw AppError.badGateway(
            'The AI created food items but did not finalise the plan. ' +
            `${ctx.createdFoodIds.size} new food item(s) were added to your library. ` +
            'Please try a shorter prompt or retry.',
            'AI_DRAFT_INCOMPLETE',
        );
    }

    logger.info('Meal-plan agent finished', {
        clientId: args.clientId,
        steps: totalSteps,
        durationMs: Date.now() - startedAt,
        createdFoods: ctx.createdFoodIds.size,
        days: ctx.draft.days.length,
    });

    return {
        draft: ctx.draft,
        createdFoodIds: Array.from(ctx.createdFoodIds),
        steps: totalSteps,
    };
}
