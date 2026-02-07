# Module 5: Food Validation Engine Completion

**Priority:** P0 (Critical)
**Effort:** 2-3 days
**Impact:** Core feature - prevents unsafe food assignments to clients with medical conditions

---

## Current State

The validation engine exists at `backend/src/services/validationEngine.service.ts` with an LRU cache and basic structure. Types exist at `backend/src/types/validation.types.ts`. A controller and route exist. However, based on the FOOD_VALIDATION_TECH_SPEC.md, several validation rules are incomplete or missing.

**Implemented:** ~75% of backend validation logic
**Missing:** Repetition checks, strength/quantity checks, some frontend integration

---

## What Needs To Be Done

### 1. Complete Missing Validation Rules

Based on `FOOD_VALIDATION_TECH_SPEC.md`, ensure all 9 rules are implemented:

| Rule # | Name | Status | Severity |
|--------|------|--------|----------|
| 1 | Allergy Blocking | Likely done | RED (blocking) |
| 2 | Medical Condition Conflict | Likely done | RED/YELLOW |
| 3 | Intolerance Warning | Likely done | YELLOW |
| 4 | Dietary Preference Violation | Likely done | YELLOW |
| 5 | Disliked Food Warning | Likely done | YELLOW |
| 6 | Medication-Food Interaction | Check | RED |
| 7 | **Meal Repetition Check** | **Missing** | YELLOW |
| 8 | **Nutrition Strength Check** | **Missing** | YELLOW |
| 9 | **Meal Suitability Check** | Check | YELLOW |

#### 1.1 Implement Meal Repetition Check (Rule 7)

**Purpose:** Warn if the same food is assigned too frequently in a week.

**Logic needed in `validationEngine.service.ts`:**
```
Input: foodId, clientId, planId, dayOfWeek
Process:
  1. Query all meals in the same plan for the same week
  2. Count how many times this food appears
  3. If count >= 3 (configurable), return YELLOW warning
  4. Message: "This food appears {count} times this week. Consider variety."
```

**Requires:** Access to the diet plan's meal data during validation. Either:
- Pass the full plan context to the validator
- Or query the plan meals within the validation service

#### 1.2 Implement Nutrition Strength Check (Rule 8)

**Purpose:** Warn if a food's nutrition values are extreme for the client's targets.

**Logic needed:**
```
Input: food nutrition values, client's daily targets
Process:
  1. If single food > 50% of daily calorie target -> YELLOW
  2. If single food > 60% of any macro target -> YELLOW
  3. If food has 0 protein but client needs high protein -> INFO
  4. Message: "This food provides {pct}% of daily calorie target in one serving."
```

**Requires:** Client's daily targets from their active diet plan.

---

### 2. Make Validation Rules Configurable

**Problem:** Thresholds and rule parameters are hardcoded in the service.

**Create:** `backend/src/config/validation-rules.config.ts`

```typescript
export const VALIDATION_CONFIG = {
  REPETITION_THRESHOLD: Number(process.env.VALIDATION_REPETITION_THRESHOLD) || 3,
  SINGLE_FOOD_CALORIE_WARN_PCT: 0.50,
  SINGLE_FOOD_MACRO_WARN_PCT: 0.60,
  CACHE_TTL_MS: Number(process.env.VALIDATION_CACHE_TTL_MS) || 5 * 60 * 1000,
  MAX_CACHE_SIZE: Number(process.env.VALIDATION_MAX_CACHE_SIZE) || 50,
};
```

Update `validationEngine.service.ts` to import from this config instead of using inline numbers.

---

### 3. Review `validation-rules.ts` Utility

**File:** `backend/src/utils/validation-rules.ts`

This file exists but needs to be reviewed for:
- Completeness against the spec's 9 rules
- Whether it's properly used by the validation engine
- Whether rule definitions are data-driven or hardcoded

---

### 4. Complete Frontend Validation Integration

#### 4.1 Review `use-validation.ts` Hook

**File:** `frontend/src/lib/hooks/use-validation.ts` (183 lines)

Existing hook has:
- Single food validation
- Batch validation
- Caching strategy
- Style helpers for severity colors

**Check/fix:**
- Cache uses `useState` (ephemeral) - loses data on remount. Use React Query cache or sessionStorage instead.
- No cache size limit - could grow unbounded. Add max entries.
- Ensure batch validation is called when loading a plan (not just on individual food add).

#### 4.2 Review `validation-alert.tsx` Component

**File:** `frontend/src/components/diet-plan/validation-alert.tsx`

Ensure it:
- Shows RED alerts as blocking (prevent save/publish)
- Shows YELLOW alerts as dismissible warnings
- Groups alerts by severity
- Shows alert count badge on the diet plan builder

#### 4.3 Wire Validation into Diet Plan Builder

In the diet plan creation flow (`diet-plans/new/page.tsx` or the extracted `useMealBuilder` hook):
- Call `validateFood()` when adding a food to any meal
- Call `validateBatch()` when loading a template or switching clients
- Show validation alerts inline next to each food item
- Block publish if any RED alerts exist

---

### 5. Add Validation Endpoint Tests

**File:** `backend/tests/validationEngine.test.ts` (exists, check completeness)

Ensure test coverage for:

| Test Case | Priority |
|-----------|----------|
| Allergy blocking returns RED | P0 |
| Medical condition conflict (e.g., diabetes + sugar) | P0 |
| Medication interaction (e.g., warfarin + vitamin K) | P0 |
| Intolerance returns YELLOW | P1 |
| Dietary preference violation (e.g., vegetarian + meat) | P1 |
| Disliked food returns YELLOW | P1 |
| Repetition check (food appears 4x in week) | P1 |
| Nutrition strength check (>50% daily calories) | P2 |
| Meal suitability (breakfast-only food at dinner) | P2 |
| Cache hit (same request returns cached result) | P1 |
| Cache invalidation (client profile update clears cache) | P1 |

---

### 6. Ensure Cache Invalidation on Profile Changes

When a client's medical profile, allergies, or preferences change, the validation cache for that client must be invalidated.

**Check:** Does `validationEngine.invalidateClientCache(clientId)` get called from:
- `client.controller.ts` on PATCH `/clients/:id`
- `onboarding.service.ts` when onboarding steps are saved
- Any medical profile update endpoint

If not, add these calls.

---

## Definition of Done

- [ ] All 9 validation rules implemented and returning correct severity levels
- [ ] Repetition check (Rule 7) working with plan context
- [ ] Nutrition strength check (Rule 8) working with client targets
- [ ] Validation thresholds configurable via config file / env vars
- [ ] Frontend hook cache uses persistent storage (not just useState)
- [ ] Frontend hook has cache size limit
- [ ] Validation alerts shown inline in diet plan builder
- [ ] RED alerts block plan publishing
- [ ] Cache invalidation triggered on client profile changes
- [ ] Test coverage for all 9 rules + cache behavior
- [ ] `validation-rules.ts` utility reviewed and aligned with spec
