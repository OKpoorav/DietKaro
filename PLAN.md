# Diet Builder Overhaul — Master Plan

## Problem Statement

The diet builder is the core feature of DietKaro. Currently it has critical bugs (date overlap, no unsaved changes protection), missing UX flows (no date selection, no meal notes UI), and lacks the polish needed for busy dietitians to work fast. This plan fixes everything and makes the builder so intuitive a caveman could use it.

---

## Phase 1: Critical Bug Fixes & Missing Foundations

### 1.1 Fix Plan Creation Date Flow (THE BIG ONE)

**Current bug**: Creating a plan auto-sets startDate to `new Date()` (today) with no picker. If dietitian creates plan on Friday for "upcoming week", Friday itself gets planned — even if an active plan already covers Friday.

**Current code** (`use-meal-builder.ts:63`):
```typescript
const [startDate, setStartDate] = useState(new Date());
```

**New flow**:

```
[Create New Plan] button
        ↓
  Client Selector (existing)
        ↓
  ┌─────────────────────────────────────────────┐
  │  NEW: Plan Setup Modal                       │
  │                                              │
  │  Client: Ravi Kumar                          │
  │                                              │
  │  ┌─ Current Plans ────────────────────────┐  │
  │  │ "Weight Loss Plan" — Active            │  │
  │  │ Apr 7 → Apr 13 (Mon-Sun)              │  │
  │  │ 3 meals/day, 1400 cal target           │  │
  │  └────────────────────────────────────────┘  │
  │                                              │
  │  Plan Name: [________________________]       │
  │  Start Date: [Apr 14] (calendar picker)      │
  │  Duration:   [7 days ▼]                      │
  │  End Date:   Apr 20 (auto-calculated)        │
  │                                              │
  │  ⚠️ Overlap Warning (if applicable):         │
  │  "Apr 14 overlaps with 'Weight Loss Plan'"   │
  │  ○ Overwrite overlapping days                │
  │  ○ Keep existing days, plan starts Apr 15    │
  │  ○ End existing plan on Apr 13, start new    │
  │                                              │
  │          [Cancel]  [Start Building →]         │
  └─────────────────────────────────────────────┘
        ↓
  Meal Builder (existing, with startDate pre-set)
```

**Implementation**:

#### Backend changes:
- **New endpoint**: `GET /api/v1/diet-plans/client/:clientId/active-range`
  - Returns: `{ plans: [{ id, name, startDate, endDate, status, mealCount, targetCalories }] }`
  - Used by frontend to show existing plans and detect overlap
  - File: `dietPlan.controller.ts` + `dietPlan.service.ts`

- **Update `createPlan()`** in `dietPlan.service.ts`:
  - Accept `overlapStrategy: 'overwrite' | 'skip' | 'end_previous'`
  - If `overwrite`: Delete meal logs for overlapping dates from old plan
  - If `skip`: Adjust startDate to day after old plan ends
  - If `end_previous`: Set old plan's endDate to day before new plan starts, cancel pending logs after that date

- **Add validation**: `startDate <= endDate`, `startDate >= today - 7 days` (allow slight backdating for corrections)

#### Frontend changes:
- **New component**: `PlanSetupModal` in `/components/diet-plan/plan-setup-modal.tsx`
  - Calendar date picker for start date
  - Duration dropdown (1-90 days)
  - Auto-calculated end date display
  - Existing plans card (fetched via new endpoint)
  - Overlap warning + strategy radio buttons
  - Smart default: startDate = day after latest active plan ends (or tomorrow if none)

- **Update `use-meal-builder.ts`**:
  - Accept `startDate` and `numDays` from modal instead of defaulting
  - Remove internal `new Date()` default
  - Add `planName` from modal

- **Update builder page** (`diet-plans/new/page.tsx`):
  - After client selected, show PlanSetupModal before entering builder
  - Pass modal results to useMealBuilder

**Files to modify**:
- `backend/src/services/dietPlan.service.ts` — add active-range query, overlap handling
- `backend/src/controllers/dietPlan.controller.ts` — new endpoint
- `backend/src/routes/dietPlan.routes.ts` — new route
- `backend/src/schemas/dietPlan.schema.ts` — new validation schema
- `frontend/src/components/diet-plan/plan-setup-modal.tsx` — NEW
- `frontend/src/lib/hooks/use-diet-plans.ts` — new query hook
- `frontend/src/lib/hooks/use-meal-builder.ts` — accept external startDate/numDays
- `frontend/src/app/dashboard/diet-plans/new/page.tsx` — add modal step
- `frontend/src/components/diet-plan/client-selector.tsx` — pass to modal

---

### 1.2 Add Meal Notes / Additional Info UI

**Current state**: `Meal` model has `description` and `instructions` fields. `MealFoodItem` has `notes` field. All exist in schema + API types. Zero UI.

**New UI — per-meal expandable section**:

```
┌─ Breakfast (08:00) ──────────────────── [⋮] ─┐
│ ▸ Meal Notes                                   │ ← clickable, expands below
│                                                │
│  🥚 Boiled Eggs (2 piece) ......... 140 cal   │
│  🍞 Whole Wheat Toast (2 slice) ... 160 cal   │
│  [+ Add Food]                                  │
└────────────────────────────────────────────────┘

Expanded:
┌─ Breakfast (08:00) ──────────────────── [⋮] ─┐
│ ▾ Meal Notes                                   │
│  ┌──────────────────────────────────────────┐  │
│  │ Description (visible to client):         │  │
│  │ [Light protein-rich breakfast to start   │  │
│  │  the day. Can be prepared in 10 min.]    │  │
│  │                                          │  │
│  │ Preparation Instructions:                │  │
│  │ [Boil eggs for 8 min. Toast bread        │  │
│  │  lightly. No butter.]                    │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  🥚 Boiled Eggs (2 piece) ......... 140 cal   │
│     📝 "Boil 8 min, no oil" ← food-level note │
│  🍞 Whole Wheat Toast (2 slice) ... 160 cal   │
│  [+ Add Food]                                  │
└────────────────────────────────────────────────┘
```

**Implementation**:

#### Frontend:
- **Update `MealCard`** in `meal-editor.tsx`:
  - Add collapsible "Meal Notes" section at top of card
  - Two textarea fields: `description` (client-visible) and `instructions` (preparation steps)
  - Both auto-save to local state via `onUpdateMeal()`
  - Small text indicator when notes exist but collapsed: "📝 Has notes"

- **Update `FoodItemRow`** in `meal-editor.tsx`:
  - Add small inline note icon next to each food
  - Click to expand single-line text input for `MealFoodItem.notes`
  - Placeholder: "Add prep note (e.g., 'no oil', 'boil not fry')"

- **Update `LocalMeal` type** in `use-meal-builder.ts`:
  - Ensure `description` and `instructions` are included in state
  - Ensure they're sent to API on save

#### Backend:
- Already supports these fields in create/update. No backend changes needed.
- Verify `updateMeal()` in `meal.service.ts` accepts and persists `description` and `instructions`

**Files to modify**:
- `frontend/src/components/diet-plan/meal-editor.tsx` — MealCard + FoodItemRow UI
- `frontend/src/lib/hooks/use-meal-builder.ts` — include description/instructions in state + save payload

---

### 1.3 Fix Publish Race Condition

**Current bug** (`dietPlan.service.ts:358-373`): Plan marked active in transaction A, meal logs created in transaction B. If B fails → active plan with zero logs.

**Fix**: Single transaction wrapping both operations.

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Deactivate old plans
  await tx.dietPlan.updateMany({ where: { clientId, status: 'active' }, data: { status: 'completed' } });
  
  // 2. Cancel pending logs from old plans
  await tx.mealLog.updateMany({ ... });
  
  // 3. Activate new plan
  await tx.dietPlan.update({ where: { id: planId }, data: { status: 'active' } });
  
  // 4. Create all meal logs (in batches within same tx)
  for (const batch of mealLogBatches) {
    await tx.mealLog.createMany({ data: batch });
  }
});
```

**Files to modify**:
- `backend/src/services/dietPlan.service.ts` — `publishPlan()` method

---

### 1.4 Unsaved Changes Protection

**Current bug**: No `beforeunload` handler. 10 minutes of work vanishes on accidental navigation.

**Implementation**:
- Add `isDirty` flag to `useMealBuilder` — set true on any meal/food mutation
- Add `beforeunload` event listener when `isDirty`
- Add Next.js router interception to show confirmation dialog
- Visual indicator: "Unsaved changes" badge in header

**Files to modify**:
- `frontend/src/lib/hooks/use-meal-builder.ts` — add isDirty tracking + beforeunload
- `frontend/src/app/dashboard/diet-plans/new/page.tsx` — router guard

---

### 1.5 Fix Validation Cache Invalidation

**Current bug** (`validationEngine.service.ts:39-77`): LRU cache stores client dietary tags. Never cleared when client profile updated.

**Fix**:
- Add `invalidateClientCache(clientId)` method to validation engine
- Call it from `client.service.ts` on update of allergies, intolerances, medicalConditions, dietaryPreferences
- Or: add short TTL (5 min) to cache entries

**Files to modify**:
- `backend/src/services/validationEngine.service.ts` — add invalidation method + TTL
- `backend/src/services/client.service.ts` — call invalidation on relevant updates

---

### 1.6 Implement Plan Delete

**Current state**: Delete button exists in UI with `// TODO: Add delete functionality`.

**Implementation**:
- Soft delete: set `deletedAt` + `isActive: false`
- Cancel all pending meal logs
- Confirmation modal: "Delete plan 'Weight Loss Week 3'? This will cancel X pending meal logs."

**Files to modify**:
- `backend/src/services/dietPlan.service.ts` — add `deletePlan()` method
- `backend/src/controllers/dietPlan.controller.ts` — add endpoint
- `backend/src/routes/dietPlan.routes.ts` — DELETE route
- `frontend/src/app/dashboard/diet-plans/page.tsx` — wire up delete button + confirmation modal

---

## Phase 2: Core UX Upgrades

### 2.1 Auto-Save Drafts

**Design**:
- Every 30 seconds, serialize `weeklyMeals` + metadata to `sessionStorage`
- Key: `diet-plan-draft-{clientId}`
- On builder load: check for existing draft, show "Resume draft?" banner
- On successful save/publish: clear draft
- On explicit discard: clear draft

**Files to modify**:
- `frontend/src/lib/hooks/use-meal-builder.ts` — add auto-save interval + restore logic
- `frontend/src/app/dashboard/diet-plans/new/page.tsx` — draft resume banner

---

### 2.2 Copy / Duplicate Day

**Design**:
- Each day header gets a "⋮" menu: Copy Day, Paste Day, Clear Day
- Copy stores day's meals in clipboard state
- Paste appends/replaces meals in target day
- "Duplicate to next day" shortcut button

**Files to modify**:
- `frontend/src/components/diet-plan/day-navigator.tsx` — day action menu
- `frontend/src/lib/hooks/use-meal-builder.ts` — clipboard state + copy/paste handlers

---

### 2.3 Drag-and-Drop Reordering

**Design**:
- Within a meal: reorder food items
- Within a day: reorder meals (change breakfast ↔ lunch order)
- Between days: drag meal from Day 1 to Day 3
- Library: `@dnd-kit/core` + `@dnd-kit/sortable`

**Files to modify**:
- `frontend/package.json` — add @dnd-kit dependencies
- `frontend/src/components/diet-plan/meal-editor.tsx` — wrap in DndContext, make FoodItemRow sortable
- `frontend/src/lib/hooks/use-meal-builder.ts` — reorder handlers

---

### 2.4 Undo / Redo

**Design**:
- State history stack (max 50 entries) using Immer patches
- `Cmd+Z` = undo, `Cmd+Shift+Z` = redo
- Undo button in toolbar
- Each action (add food, remove food, change quantity, etc.) pushes to history

**Files to modify**:
- `frontend/src/lib/hooks/use-meal-builder.ts` — history stack + undo/redo handlers
- `frontend/src/app/dashboard/diet-plans/new/page.tsx` — keyboard shortcut listener + undo/redo buttons

---

### 2.5 Smart Template Application with Portion Scaling

**Current bug**: Template assigned without adjusting for client's calorie target.

**New flow**:
```
Apply Template "1400 cal South Indian"
  ↓
Template target: 1400 cal
Client target: 1800 cal
  ↓
Scale factor: 1800/1400 = 1.286
  ↓
"Scale portions to match client's 1800 cal target?"
  [Apply as-is]  [Scale portions ×1.3]
```

**Implementation**:
- Calculate ratio between template's targetCalories and client's targetCalories
- If ratio > 1.1 or < 0.9, show scaling prompt
- Scale all `quantityG` values by ratio (rounded to nearest 5g)
- Recalculate per-food-item nutrition

**Files to modify**:
- `backend/src/services/dietPlan.service.ts` — `assignTemplateToClient()` accept scaleFactor
- `frontend/src/app/dashboard/diet-plans/page.tsx` — template assign modal add scaling option
- `frontend/src/components/diet-plan/template-sidebar.tsx` — scaling prompt

---

### 2.6 Bulk Portion Adjustment

**Design**:
- Toolbar button: "Adjust Portions"
- Slider: -50% to +50% in 5% increments
- Preview: shows calorie change before applying
- Scope options: "This meal only" / "This day" / "Entire plan"

**Files to modify**:
- `frontend/src/components/diet-plan/bulk-portion-modal.tsx` — NEW
- `frontend/src/lib/hooks/use-meal-builder.ts` — bulk adjustment handler

---


### 3.2 Per-Meal Nutrition Targets

**Design**: Instead of only daily targets, show per-meal guidance.

```
Breakfast — 350/400 cal (87%)  ████████░░
Lunch     — 520/500 cal (104%) █████████▓ ⚠️ slightly over
Snack     — 0/150 cal          ░░░░░░░░░░ (no foods yet)
Dinner    — 0/500 cal          ░░░░░░░░░░
```

**Logic**: Split daily target across meal types based on standard ratios:
- Breakfast: 25%, Lunch: 35%, Snack: 10%, Dinner: 30%
- Or custom ratios set by dietitian

**Files to modify**:
- `frontend/src/components/diet-plan/nutrition-summary.tsx` — per-meal breakdown
- `frontend/src/lib/hooks/use-meal-builder.ts` — meal-level nutrition calculation

---

### 3.3 Client Meal Time Auto-Fill

**Current state**: `ClientPreferences` has `breakfastTime`, `lunchTime`, `dinnerTime`, `snackTime`. Meal slot presets use hardcoded times.

**Fix**: When creating meals, pull times from client preferences. Fall back to presets only if not set.

**Files to modify**:
- `frontend/src/lib/hooks/use-meal-builder.ts` — `defaultMeals()` function, use client.preferences

---

### 3.4 Plan Cloning

**Design**: "Duplicate for another client" button on plan detail page.

**Flow**:
1. Click "Clone Plan" on plan detail
2. Select target client
3. Show Plan Setup Modal (from 1.1) with pre-filled data
4. Adjust portions if calorie targets differ (from 2.5)
5. Open builder with all meals pre-populated

**Files to modify**:
- `backend/src/services/dietPlan.service.ts` — `clonePlan()` method
- `frontend/src/app/dashboard/diet-plans/[id]/page.tsx` — clone button + flow

---

### 3.5 Better Validation Messages

**Current**: "This food has restrictions for this client"
**New**: "Blocked: Contains dairy. Client is lactose intolerant. Try: Tofu, Soy milk, Coconut yogurt"

**Implementation**: Enrich validation response with:
- Exact reason (which allergen/restriction)
- Client condition that triggered it
- 2-3 substitute suggestions (from 3.1)

**Files to modify**:
- `backend/src/services/validationEngine.service.ts` — enrich alert messages with specifics
- `frontend/src/components/modals/add-food-modal.tsx` — render enriched messages

---

### 3.6 Extend Plan by Weeks

**Current**: Date picker only. **New**: "Repeat for X more weeks" dropdown.

```
Extend Plan
  ○ Repeat for [1▼] more week(s)  → Apr 14 - Apr 20
  ○ Custom date range: [____] to [____]
```

**Files to modify**:
- `frontend/src/app/dashboard/diet-plans/[id]/page.tsx` — extend modal redesign

---

## Phase 4: Data Model Hardening

### 4.1 Fix Soft Delete Cascade

When `Meal.deletedAt` is set, also soft-delete related `MealFoodItem` records and cancel pending `MealLog` records.

**Files to modify**:
- `backend/src/services/meal.service.ts` — `deleteMeal()` cascade logic

---

### 4.2 Fix Extension Date Mapping

**Current bug**: Non-contiguous meal days (Mon/Wed/Fri) map incorrectly when extended.

**Fix**: Map by relative position, not by date offset. Day 1 → Extension Day 1, Day 2 → Extension Day 2, regardless of gaps.

**Files to modify**:
- `backend/src/services/dietPlan.service.ts` — `extendPlan()` date mapping logic

---

### 4.3 Add sequenceNumber Auto-Assignment

When adding a meal to a plan, auto-assign `sequenceNumber = max(existing) + 1`.

**Files to modify**:
- `backend/src/services/meal.service.ts` — `addMealToPlan()`

---

### 4.4 Compliance Score Recalculation Trigger

Recalculate compliance when meal log is updated (photo added, status changed, etc.) — not just on initial status change.

**Files to modify**:
- `backend/src/services/mealLog.service.ts` — trigger recalc on any relevant field change

---

### 4.5 Timezone-Aware Compliance Scoring

Use client's organization timezone (or future client-level timezone) for on-time calculations instead of server time.

**Files to modify**:
- `backend/src/services/compliance.service.ts` — timezone conversion in on-time check

---

### 4.6 Create Proper Migration File

The `db push` fixed the dev DB, but production deploys need a migration file. Generate one covering all schema drift.

**Files to create**:
- `backend/prisma/migrations/YYYYMMDD_sync_schema_drift/migration.sql`

---

## Implementation Order (Recommended)

```
Week 1: Phase 1 (Critical fixes)
  ├── 1.1 Plan creation date flow (3-4 days) ← HIGHEST PRIORITY
  ├── 1.2 Meal notes UI (1 day)
  ├── 1.3 Publish race condition fix (0.5 day)
  ├── 1.4 Unsaved changes protection (0.5 day)
  ├── 1.5 Validation cache fix (0.5 day)
  └── 1.6 Plan delete (0.5 day)

Week 2: Phase 2 (Core UX)
  ├── 2.1 Auto-save drafts (1 day)
  ├── 2.2 Copy/duplicate day (1 day)
  ├── 2.3 Drag-and-drop (2 days)
  ├── 2.4 Undo/redo (1 day)
  └── 2.5 Smart template scaling (1 day)

Week 3: Phase 3 (Intelligence)
  ├── 3.1 Substitute suggestions (1.5 days)
  ├── 3.2 Per-meal nutrition targets (1 day)
  ├── 3.3 Client meal time auto-fill (0.5 day)
  ├── 3.4 Plan cloning (1 day)
  ├── 3.5 Better validation messages (1 day)
  └── 3.6 Extend by weeks (0.5 day)

Week 4: Phase 4 (Hardening)
  ├── 4.1-4.5 Backend fixes (3 days)
  ├── 4.6 Migration file (0.5 day)
  └── Testing + polish (1.5 days)
```

---

## Key Files Reference

### Backend (to modify)
| File | Changes |
|------|---------|
| `src/services/dietPlan.service.ts` | Overlap handling, publishPlan tx, extendPlan fix, clonePlan, active-range query |
| `src/controllers/dietPlan.controller.ts` | New endpoints (active-range, clone) |
| `src/routes/dietPlan.routes.ts` | New routes |
| `src/schemas/dietPlan.schema.ts` | New validation schemas |
| `src/services/meal.service.ts` | Soft delete cascade, sequenceNumber |
| `src/services/foodItem.service.ts` | Substitute suggestions |
| `src/services/mealLog.service.ts` | Compliance recalc trigger |
| `src/services/compliance.service.ts` | Timezone fix, chosenOptionGroup validation |
| `src/services/validationEngine.service.ts` | Cache invalidation, enriched messages |
| `src/services/client.service.ts` | Trigger cache invalidation on update |

### Frontend (to modify)
| File | Changes |
|------|---------|
| `src/app/dashboard/diet-plans/new/page.tsx` | Plan setup modal step, keyboard shortcuts, undo/redo buttons, draft resume |
| `src/lib/hooks/use-meal-builder.ts` | External startDate, isDirty, auto-save, history stack, clipboard, bulk adjust |
| `src/components/diet-plan/meal-editor.tsx` | Meal notes UI, food notes, drag-and-drop, reorder |
| `src/components/diet-plan/day-navigator.tsx` | Copy/paste/clear day menu |
| `src/components/diet-plan/nutrition-summary.tsx` | Per-meal targets |
| `src/components/diet-plan/template-sidebar.tsx` | Scaling prompt |
| `src/components/diet-plan/client-selector.tsx` | Pass to plan setup modal |
| `src/app/dashboard/diet-plans/page.tsx` | Delete wiring, template scaling |
| `src/app/dashboard/diet-plans/[id]/page.tsx` | Clone button, extend by weeks |
| `src/lib/hooks/use-diet-plans.ts` | New query hooks (active-range, clone) |

### Frontend (new files)
| File | Purpose |
|------|---------|
| `src/components/diet-plan/plan-setup-modal.tsx` | Date selection + overlap handling modal |
| `src/components/diet-plan/bulk-portion-modal.tsx` | Bulk portion adjustment slider |

---

## Success Criteria

After all phases:
- [ ] Dietitian can create plan with explicit date range, seeing existing plan context
- [ ] Overlap with existing plans is detected and handled (overwrite/skip/end previous)
- [ ] Every meal has editable notes (description + instructions + per-food notes)
- [ ] No data loss: auto-save + unsaved changes warning + undo/redo
- [ ] Fast workflow: copy days, drag-and-drop, bulk portions, keyboard shortcuts
- [ ] Smart: auto-scale templates, suggest substitutes, per-meal targets
- [ ] Reliable: publish is atomic, compliance scores correct, validation cache fresh
- [ ] So intuitive a caveman can use it
