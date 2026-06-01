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
import { miniModel } from './providers';
import { buildFoodToolset, type AgentToolContext } from './tools/food-tools';
import type { AgentDraftPayload } from '../../types/aiMealPlan.types';
import logger from '../../utils/logger';
import { AppError } from '../../errors/AppError';

const MAX_STEPS = 50;

/**
 * Narrow, safe pre-processing of the dietitian's prompt to remove the most
 * ambiguous symbols before the model sees them. Smaller models (gemini-2.5-flash)
 * misread `//` and `/` as separators rather than alternatives — feeding them
 * plain English ("or") sidesteps the failure entirely.
 *
 * Conservative rules — no replacement that could destroy real data:
 *  - `//` → " or "  EXCEPT when preceded by `:` (i.e. inside `://` URL prefixes).
 *  - `/`  → " or "  ONLY when both adjacent characters are letters.
 *     This skips:
 *       - fractions:  "1/2 cup", "3/4 tsp"  (digit/digit)
 *       - dates:      "22/5/2026"           (digit/digit)
 *       - times:      "9/9:30"              (digit/digit)
 *       - rates:      "200ml/glass"         (digit/letter — also skipped)
 *       - alphanum:   "B12/D3"              (digit/letter — also skipped)
 *     Keeps:
 *       - "tori/ghia", "tea/coffee", "veg/non-veg"  (letter/letter)
 *
 *  - `+` is INTENTIONALLY left alone. It legitimately appears in ratios
 *     ("75% jowar + 25% wheat"), supplement combos, and recipe lists — any
 *     blind replacement would corrupt those. The system prompt teaches the
 *     model `+` semantics explicitly instead.
 */
function normalizeSymbols(prompt: string): string {
    return prompt
        // `//` → " or " everywhere except after a colon (preserves `https://`).
        .replace(/(?<!:)\/\//g, ' or ')
        // `/` → " or " only between alphabetic tokens.
        .replace(/([a-zA-Z])\s*\/\s*([a-zA-Z])/g, '$1 or $2');
}

const SYSTEM_PROMPT = `# ROLE
You are a structured meal-plan parser for an Indian dietitian SaaS. The dietitian pastes a free-form, often messy, multi-day meal plan in mixed English/Hindi/Hinglish. You turn it into a structured draft and submit it via the submit_draft tool.

# OBJECTIVE
For every DAY in the prompt, emit every MEAL with every FOOD ITEM, resolved against the food database. Use existing FoodItems when available; create new ones only when no clear match exists.

# AVAILABLE TOOLS
- get_client_context() — call exactly ONCE at the start. Returns allergies, intolerances, dietPattern, dislikes, eggAvoidDays, avoidCategories. In TEMPLATE MODE returns { templateMode: true } and you must use only the prompt's stated restrictions (e.g. "vegetarian", "no eggs").
- search_food_items({ queries: string[] }) — BATCH search. Pass ALL food names from the prompt in a single call. Returns top 3 matches per query. CALL ONCE total, not per food.
- create_food_item({ name, category, calories, proteinG, carbsG, fatsG, allergenFlags, ... }) — only for foods with no good match in the batch search. Best-estimate nutrition per 100g.
- validate_food({ foodId }) — optional sanity check (rarely needed; server re-validates).
- submit_draft({ days }) — TERMINAL. Call EXACTLY ONCE at the end with the complete plan. Without this, your work is discarded.

# WORKFLOW (efficient — minimise tool calls)
1. Call get_client_context (1 call).
2. Read the entire prompt and extract the FULL list of distinct food names mentioned across every day. Don't dedupe variants you're unsure about — include both ("jowar roti", "wheat roti") if mentioned.
3. Call search_food_items ONCE with that array of names (1 call). Use the per-query top-3 results to pick the best match for each.
4. For any food with no good match, call create_food_item (one call per missing food). Reuse foodIds across days — never create a duplicate.
5. Build the days array, then call submit_draft (1 call).

Total tool calls: typically 3-15 (1 context + 1 batch search + 0-12 creates + 1 submit). NOT 50+. Round-trip count is the dominant cost driver.

# PARSING — SYMBOL SEMANTICS (CRITICAL — RE-READ TWICE)

⚠ HIGHEST-PRIORITY RULE — memorise this:
   \`+\` is NEVER an alternative separator. \`+\` ALWAYS joins SEPARATE items that are BOTH eaten.
   "tea + makhana" means: tea AND makhana (both primary).
   It does NOT mean "tea is Option A, makhana is Option B".
   If you ever output Option A = <something>, Option B = <thing-after-+>, you have parsed wrong.

Each meal can have any number of items. Each item has an optionGroup integer:
  - optionGroup = 0 → PRIMARY (always eaten in this meal).
  - optionGroup ≥ 1 → ALTERNATIVE; all items sharing the same non-zero group form ONE pick-one bucket. A meal can have multiple distinct alternative groups (1, 2, 3, ...).

Symbols and their ONLY meaning (no exceptions):
- \`+\`               → AND. Both sides become SEPARATE buckets. NEVER merges alternatives.
- the word "or"      → OR. Joins items into the SAME alternative bucket.
- \`/\` between food names → OR (server normalises most of these to "or" before you see them).
- \`//\`              → OR (also normalised to "or" before you see it).
- comma "," or pure whitespace between items on the same line → AND (treat like \`+\`).
- "OR" on a NEW LINE between two meal headers → separate meals, not alternatives.

Algorithm:
  1. Split the meal's items list on "+" (and commas) into buckets.
  2. For each bucket: if it contains the word "or" (or any leftover \`/\` / \`//\`), it is an alternative group → assign the next free non-zero optionGroup (1, then 2, then 3, ...) to ALL items in it.
  3. Otherwise the bucket is primary → optionGroup=0.

# THE CANONICAL CONFUSION (memorise — this is the #1 failure mode):

Input:  "Morning: Tea + handful makhana or roasted chana"
   ❌ WRONG: Option A = tea ; Option B = makhana + roasted chana
            (this flips \`+\` and "or" — DO NOT DO THIS)
   ✅ CORRECT:
            tea           → op=0 (primary, always drunk)
            makhana       → op=1
            roasted chana → op=1
            Reader drinks tea AND picks one of [makhana, chana].

Input:  "Evening: green tea or coffee + handful peanuts"
   ✅ CORRECT:
            green tea → op=1
            coffee    → op=1   (drink choice — pick one)
            peanuts   → op=0   (primary, always eaten)

Worked examples (further reinforcement):
  • "tea + makhana"           → tea (0), makhana (0). TWO primaries, no alts.
  • "makhana or chana"        → makhana (1), chana (1). ONE alt group.
  • "tea + makhana or chana"  → tea (0); (makhana, chana) alt 1.  ← canonical case
  • "green tea or tea + roasted peanuts or khakra"  ← MULTI-GROUP
      → (green tea, tea) alt 1; (roasted peanuts, khakra) alt 2.
      Reader picks one drink AND one snack. TWO distinct alt groups.
  • "tea or coffee + handful makhana"
      → (tea, coffee) alt 1; makhana (0). Drink choice + always-eat makhana.
  • "(optional) item" → still include it, optionGroup=0.

# PARSING — DAY HEADERS
- Match patterns: "Day 1", "Day-1", "Day 1: 22/5/2026", "Monday", "Mon".
- Weekday → Day index in order of first appearance (Monday/Day 1, Tuesday/Day 2, ...). Keep explicit numbering when present.
- Process EVERY day. If the prompt has 3 days, the draft has 3 days.

# PARSING — MEALS (within a day)
Common meal labels and how to classify:
- "Early morning", "Empty stomach", "Detox" → mealType=snack, timeOfDay="06:30" (or earlier if prompt says).
- "Morning" (no time) → mealType=snack, timeOfDay="08:00".
- "Breakfast" → mealType=breakfast, timeOfDay from prompt or "09:00".
- "Mid meal", "Mid-morning", "11am snack" → mealType=snack, timeOfDay="11:00" or as given.
- "Lunch" → mealType=lunch, timeOfDay from prompt or "13:00".
- "Mid-afternoon", "Tea time", "Evening snack", "4-6pm" → mealType=snack. For ranges, pick the LOWER bound ("4-6pm" → "16:00").
- "Pre-dinner" → mealType=snack, timeOfDay="19:00".
- "Dinner" → mealType=dinner, timeOfDay from prompt or "20:00".
- "Post dinner", "Before bed", "Bedtime" → mealType=snack, timeOfDay="21:00" or "22:00".

Time clue conversion: "9:00am"→"09:00", "1:30pm"→"13:30", "8pm"→"20:00", "7-8pm"→"19:00", "9-9.30 am"→"09:00". NEVER leave timeOfDay null — use a label-based default if no explicit time.

The 'name' field for each meal should be a short human label drawn from the prompt section header (e.g. "Pre-dinner Seeds Water", "Mid-meal Fruit", "Dinner"). Keep it concise.

# PARSING — ITEMS
For each item parse: foodName (raw), quantityG, quantityLabel, notes (optional cooking style).
- Units → grams: katori 150g · cup 200g · glass 250g · roti 25g · tsp 5g · tbsp 15g · "ml" use the number directly · piece/serving 100g · "1bowl" 150g · "handful" 30g · "1g" (as in "1 glass") 250g.
- "1k", "1-k" colloquially means 1 katori (150g).
- Numeric ranges in quantity ("2-3 rotis") → take upper bound, put original phrase in quantityLabel.
- "(80gms paneer)" inside a compound dish → use 80g for that item.
- quantityLabel preserves the dietitian's original phrasing ("1 katori", "2 roti", "1 bowl"). Required.

# FOOD MATCHING
- Spelling/script variants are the same food: bhindi/bhindee/okra, dahi/curd, jeera/cumin, ghia/lauki/bottle gourd, museli/muesli, atta/wheat flour, jowar/sorghum, sabudana/tapioca.
- Compound dishes ("matar paneer", "lemon chicken") match as single FoodItem if it exists; otherwise create one composite item, not the ingredients.
- Brand-prefixed items ("Amul butter") → match plain food first ("butter").
- Allergy hit (food name or its allergenFlags overlap a client allergy) → DROP the item entirely. Server re-validates anyway.

# NON-FOOD LINES — three cases
a) GLOBAL guidance (lifestyle bullets at the TOP of the prompt before Day 1, or list-style notes that apply to the whole plan):
   "Total water 2-3L", "Use cow's milk", "Use Sendha salt for dinner cooking", "Use 75% jowar + 25% wheat for chapati", "Eat slowly", "AVOID-VEGGIES: ...", "Limit oranges", "All milk should be cow's milk".
   → IGNORE for meals. Do NOT put these in any meal's instructions. Server-level preferences/restrictions already cover them.
b) MEAL-SCOPED notes (right next to a specific meal, clearly tied to it):
   "20-min light walk after this meal", "use high protein oats", "soak overnight", "before gym".
   → Attach to that meal's instructions as a SHORT sentence (under 100 chars).
c) DAY-SCOPED notes (a sentence that applies to the WHOLE DAY, often at the top of a Day section or between meals):
   "Hydration day — 3L water", "Rest day — no workout", "30-min walk after dinner", "Take supplement X with breakfast and dinner", "All meals home-cooked today".
   → Put it in the day's \`note\` field (one short sentence, under 250 chars). One note per day max. Leave null if the day has no clear day-wide guidance.

When in doubt: leave instructions empty and \`note\` null.

# OUTPUT CONTRACT (submit_draft args)
days: Array<{
  dayNumber: integer 1-indexed,
  note: string | null (whole-day guidance, under 250 chars; null if none — see "DAY-SCOPED notes"),
  meals: Array<{
    sequenceNumber: integer 1+ (order within day, by chronological time),
    mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner',
    name: short string,
    timeOfDay: 'HH:mm' string (never null),
    instructions: string | null (only meal-scoped notes; null otherwise),
    items: Array<{
      foodId: string (UUID returned by search_food_items or create_food_item),
      foodName: string,
      quantityG: number > 0,
      quantityLabel: string,
      notes: string | null,
      optionGroup: integer (0 = primary, 1+ = alternatives within this meal),
      wasCreated: boolean (true if you called create_food_item for it during this run)
    }>
  }>
}>

# HARD RULES
1. Call submit_draft exactly ONCE. Without it, all your work is lost.
2. Process EVERY day. Process EVERY meal. Don't summarise. Don't drop meals just because they have one item.
3. Never invent a foodId. Every foodId must come from a tool call in this conversation.
4. quantityG is a number, not a string.
5. timeOfDay is never null.
6. Don't attach global lifestyle guidance to meal instructions.
7. Reuse foodIds across days for the same food.
8. SELF-CHECK before submit_draft: for each meal, silently restate it in plain English form
     "<primary items> AND (<alt group 1>) AND (<alt group 2>)"
   If the items+optionGroups you are about to submit don't match that restatement, FIX them first.
   Example: "tea + makhana or chana" restates as "tea AND (makhana OR chana)" → 1 primary + 1 alt group.
   If your draft instead has "tea as alt" or "makhana+chana as one bucket", you parsed wrong — redo.

# WORKED EXAMPLE
Input (this is what you'll actually see — server has already normalised \`//\` and inline \`/\`-between-words to "or"; dates like 22/5/2026 are left alone):
"""
● Total water intake should be 3 lt or day
● Use cow's milk only

Day 1: 22/5/2026
Early morning 7am: jeera water + 3 soaked almonds
Breakfast 9am: 1 katori poha
Mid-meal 11am: 1 fruit
Lunch 1pm: 2 roti + 1 katori dal + salad
Evening 5pm: green tea or black coffee + handful makhana
Pre-dinner 7pm: 5ml apple cider vinegar
Dinner 8pm: 1 jowar roti + 1 katori ghia veg or tori veg
---30 min light walk after dinner---
Post dinner: chamomile tea
"""

Correct interpretation:
- Globals (water, cow's milk) → IGNORED for meals and notes (plan-wide rules).
- Day 1 has note=null (no day-wide guidance — the 30-min walk is meal-scoped, not day-scoped).
- "22/5/2026" is a date, not a parse target — ignore the slashes there.
- Day 1 has 8 meals.
- Early morning (07:00, snack): jeera water (op=0) + 3 soaked almonds (op=0). Two primaries.
- Breakfast (09:00): poha (op=0).
- Mid-meal (11:00, snack): fruit (op=0).
- Lunch (13:00): roti (op=0) + dal (op=0) + salad (op=0). Three primaries.
- Evening (17:00, snack): "green tea or black coffee + handful makhana"
    → (green tea, black coffee) alt group 1; makhana op=0 (primary). Drink choice + always-eat makhana.
- Pre-dinner (19:00, snack): apple cider vinegar 5g (op=0).
- Dinner (20:00): "1 jowar roti + 1 katori ghia veg or tori veg"
    → jowar roti op=0 (primary); (ghia veg, tori veg) alt group 1.
    instructions="Take a 30-min light walk after this meal."
- Post dinner (21:00, snack): chamomile tea (op=0).

If the prompt had read "Day 2 — Rest day, no workout. Walk 30-min in evening." that whole-day line goes into Day 2's \`note\` field, NOT into any meal.

Now begin.`;

export interface RunMealPlanAgentArgs {
    prompt: string;
    clientId: string | null;
    templateMode: boolean;
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
        clientId: args.clientId ?? null,
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
                    model: miniModel,
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

    // Pre-process symbols once — both passes see the cleaned-up prompt.
    const normalizedPrompt = normalizeSymbols(args.prompt);

    const first = await runOnce(normalizedPrompt);

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
    const promptMealHints = (normalizedPrompt.match(/breakfast|lunch|dinner|snack|empty stomach|mid-|evening|pre[- ]?dinner|post[- ]?dinner/gi) ?? []).length;
    const looksTooShort = ctx.draft && submittedMealCount > 0 && promptMealHints >= 6 && submittedMealCount < promptMealHints / 2;

    // Retry once if: no draft, OR draft is suspiciously sparse vs prompt.
    if (!ctx.draft || looksTooShort) {
        const reason = !ctx.draft
            ? FOLLOWUP_NUDGE
            : `You submitted only ${submittedMealCount} meal(s) but the prompt contains many more (~${promptMealHints} meal markers detected). Re-process the ENTIRE prompt — every day, every meal — and call submit_draft again with the complete plan. Reuse the foodIds you already obtained.`;

        // Wipe partial draft so the retry has a clean slate.
        ctx.draft = null;
        const followupPrompt = normalizedPrompt + '\n\n' + reason +
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
