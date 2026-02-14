# 03 - Data Integrity Bugs

**Audit Date:** 2026-02-14
**Scope:** Backend client API routes, frontend meal builder, schema field mappings
**Severity Range:** HIGH to MEDIUM
**Total Issues:** 6

---

## Table of Contents

- [3.1 HIGH: Progress Calculation Only Works for Weight Loss](#31-high-progress-calculation-only-works-for-weight-loss)
- [3.2 HIGH: Nutrition Field Mismatch Between Frontend and Backend](#32-high-nutrition-field-mismatch-between-frontend-and-backend)
- [3.3 HIGH: quantity Field Ambiguity](#33-high-quantity-field-ambiguity)
- [3.4 MEDIUM: Duplicate MealLog Prevention Is Weak](#34-medium-duplicate-meallog-prevention-is-weak)
- [3.5 MEDIUM: Weight Trend Only Uses Last 2 Entries](#35-medium-weight-trend-only-uses-last-2-entries)
- [3.6 MEDIUM: currentStreak Calculation Is Fake](#36-medium-currentstreak-calculation-is-fake)

---

## 3.1 HIGH: Progress Calculation Only Works for Weight Loss

**File:** `backend/src/routes/clientApi.routes.ts`, lines 412-418

### The Problem

The `/progress-summary` endpoint computes the client's progress toward their weight goal using a formula that assumes the client is always trying to lose weight:

```typescript
// backend/src/routes/clientApi.routes.ts:412-418
let progressPercent = 0;
if (startWeight && currentWeight && targetWeight && startWeight !== targetWeight) {
    progressPercent = Math.min(100, Math.max(0,
        ((startWeight - currentWeight) / (startWeight - targetWeight)) * 100
    ));
}
```

For a **weight-gain** client (e.g., start=50kg, target=60kg, current=55kg):
- Numerator: `50 - 55 = -5`
- Denominator: `50 - 60 = -10`
- Result: `(-5 / -10) * 100 = 50%`

This happens to work mathematically because both terms are negative, but there is a deeper problem: the `totalLost` field on line 451 is always computed as `startWeight - currentWeight`, which becomes negative for weight-gain clients, and the response label "totalLost" is semantically misleading.

More critically, if a weight-gain client overshoots their target (e.g., current=65kg, target=60kg):
- Numerator: `50 - 65 = -15`
- Denominator: `50 - 60 = -10`
- Result: `(-15 / -10) * 100 = 150%`, clamped to 100%

Meanwhile, `totalLost` would be `-15`, which is nonsensical when displayed to a client.

The backend `ClientService.getClientProgress` method already handles bidirectional goals correctly:

```typescript
// backend/src/services/client.service.ts:224-239
// Progress to goal -- handles both weight loss AND weight gain
if (targetWeight && startWeight && currentWeight) {
    const totalToChange = Math.abs(startWeight - targetWeight);
    if (totalToChange > 0) {
        const isLossGoal = targetWeight < startWeight;
        const moved = isLossGoal
            ? startWeight - currentWeight   // positive = good for loss
            : currentWeight - startWeight;  // positive = good for gain
        progressToGoal = moved > 0
            ? Math.min(100, Math.round((moved / totalToChange) * 100))
            : 0;
    } else {
        progressToGoal = 100; // Already at target
    }
}
```

### Root Cause Analysis

The `/progress-summary` route was written as a quick client-facing endpoint and duplicated the progress logic inline rather than reusing `ClientService.getClientProgress`. The inline version only considered weight-loss scenarios, and the `totalLost` field name was hardcoded under that assumption.

### Impact

- **Weight-gain clients** see a negative "totalLost" value in the progress summary, which is confusing.
- If a weight-gain client has not yet started (current equals start), `totalLost` is 0 and `progressPercent` is 0, which is correct but the "lost" label is misleading.
- The response field `remaining` correctly uses `Math.abs`, so it works for both directions, but the overall response is inconsistent.
- The mobile app's progress screen displays incorrect or confusing data for any client whose goal is not weight loss.

### The Fix

Port the bidirectional logic from `ClientService.getClientProgress` into the `/progress-summary` route and rename `totalLost` to `totalChange` with directional awareness:

```typescript
// backend/src/routes/clientApi.routes.ts -- replace lines 412-418 and update line 451

// Compute progress percentage (handles both weight loss and weight gain)
let progressPercent = 0;
if (startWeight && currentWeight && targetWeight && startWeight !== targetWeight) {
    const totalToChange = Math.abs(startWeight - targetWeight);
    const isLossGoal = targetWeight < startWeight;
    const moved = isLossGoal
        ? startWeight - currentWeight   // positive = good for loss
        : currentWeight - startWeight;  // positive = good for gain
    progressPercent = moved > 0
        ? Math.min(100, (moved / totalToChange) * 100)
        : 0;
}

// ... later in the response object, replace totalLost:

// Old:
// totalLost: startWeight && currentWeight ? Math.round((startWeight - currentWeight) * 10) / 10 : 0,

// New:
totalChange: startWeight && currentWeight
    ? Math.round((currentWeight - startWeight) * 10) / 10
    : 0,
// Positive totalChange = gained weight, Negative totalChange = lost weight.
// The client app should format this based on the goal direction:
//   if targetWeight < startWeight (loss goal): show "Lost X kg"
//   if targetWeight > startWeight (gain goal): show "Gained X kg"
goalDirection: startWeight && targetWeight
    ? (targetWeight < startWeight ? 'loss' : targetWeight > startWeight ? 'gain' : 'maintain')
    : null,
```

The full corrected response block:

```typescript
res.status(200).json({
    success: true,
    data: {
        currentWeight,
        targetWeight,
        startWeight,
        progressPercent: Math.round(progressPercent * 10) / 10,
        weightTrend,
        totalChange: startWeight && currentWeight
            ? Math.round((currentWeight - startWeight) * 10) / 10
            : 0,
        goalDirection: startWeight && targetWeight
            ? (targetWeight < startWeight ? 'loss' : targetWeight > startWeight ? 'gain' : 'maintain')
            : null,
        remaining: currentWeight && targetWeight
            ? Math.round(Math.abs(currentWeight - targetWeight) * 10) / 10
            : null,
        chartEntries,
        history,
    },
});
```

### Verification Steps

1. Create a test client with a weight-gain goal (start=50kg, target=60kg).
2. Log weight entries: 50, 52, 55.
3. Call `GET /client-api/progress-summary` and verify:
   - `progressPercent` is 50 (not negative or clamped oddly).
   - `totalChange` is 5 (positive, indicating gain).
   - `goalDirection` is `"gain"`.
4. Create a test client with a weight-loss goal (start=80kg, target=70kg).
5. Log weight entries: 80, 77, 75.
6. Call the same endpoint and verify:
   - `progressPercent` is 50.
   - `totalChange` is -5 (negative, indicating loss).
   - `goalDirection` is `"loss"`.
7. Test edge case: client already at target (`startWeight === targetWeight`): `progressPercent` should be 0 and `goalDirection` should be `"maintain"`.
8. Update the client-app to read `totalChange` and `goalDirection` instead of the old `totalLost` field.

---

## 3.2 HIGH: Nutrition Field Mismatch Between Frontend and Backend

**File:** `frontend/src/lib/hooks/use-meal-builder.ts`, lines 286-289

### The Problem

When applying a template, the `applyTemplate` function reads nutrition fields from the backend `FoodItem` object using frontend-style field names that do not exist on the backend model:

```typescript
// frontend/src/lib/hooks/use-meal-builder.ts:286-289
calories: f.foodItem.calories * ratio,
protein: f.foodItem.protein * ratio,    // WRONG: backend field is proteinG
carbs: f.foodItem.carbs * ratio,        // WRONG: backend field is carbsG
fat: f.foodItem.fat * ratio,            // WRONG: backend field is fatsG
```

The backend `FoodItem` Prisma model has these fields:

```prisma
// backend/prisma/schema.prisma (FoodItem model)
proteinG   Decimal? @db.Decimal(5, 1)
carbsG     Decimal? @db.Decimal(5, 1)
fatsG      Decimal? @db.Decimal(5, 1)
```

The backend API for fetching a diet plan (used by the template flow via `api.get(/diet-plans/${templateId})`) returns `MealFoodItem` records with an included `foodItem` relation. These `foodItem` objects have fields named `proteinG`, `carbsG`, and `fatsG` -- not `protein`, `carbs`, and `fat`.

Meanwhile, the `AddFoodModal` correctly maps these fields when adding food interactively:

```typescript
// frontend/src/components/modals/add-food-modal.tsx:144-147
protein: food.nutrition.proteinG || 0,
carbs: food.nutrition.carbsG || 0,
fat: food.nutrition.fatsG || 0,
```

### Root Cause Analysis

Two different code paths build `LocalFoodItem` objects:

1. **Interactive add** (via `AddFoodModal`): Uses the food-items API which wraps values in a `nutrition` sub-object with `proteinG`, `carbsG`, `fatsG`. The modal correctly reads these.
2. **Template apply** (via `applyTemplate` in `use-meal-builder.ts`): Uses the diet-plan detail API which returns the raw Prisma `foodItem` relation. This path reads `f.foodItem.protein`, `f.foodItem.carbs`, `f.foodItem.fat` -- fields that do not exist on the raw Prisma object.

Since `f.foodItem.protein` is `undefined`, the expression `undefined * ratio` evaluates to `NaN`. The `LocalFoodItem` ends up with `protein: NaN`, `carbs: NaN`, `fat: NaN`.

### Impact

- Applying a template silently fills all meals with `NaN` for protein, carbs, and fat.
- The day nutrition summary at the top of the meal builder shows `NaN` for macros.
- Saving the plan still works (the backend only stores `foodId` and `quantityG`, not macros), but the dietitian cannot verify macro targets before publishing.
- If the dietitian does not notice the NaN values and publishes anyway, the client-facing app receives plans with no macro data (the backend recalculates from the food database, so runtime behavior is fine, but the builder UX is broken).

### The Fix

Map the backend field names to the frontend `LocalFoodItem` field names in the `applyTemplate` function:

```typescript
// frontend/src/lib/hooks/use-meal-builder.ts -- inside applyTemplate, replace lines 286-289
const localFoods: LocalFoodItem[] = tm.foodItems?.map((f: any) => {
    const ratio = (f.quantityG || 100) / 100;

    // Map backend field names (proteinG, carbsG, fatsG) to frontend names (protein, carbs, fat)
    const proteinPer100 = Number(f.foodItem.proteinG) || 0;
    const carbsPer100 = Number(f.foodItem.carbsG) || 0;
    const fatPer100 = Number(f.foodItem.fatsG) || 0;

    return {
        id: f.foodItem.id,
        tempId: Math.random().toString(36).substr(2, 9),
        name: f.foodItem.name,
        quantity: f.notes || `${f.quantityG}g`,
        quantityValue: f.quantityG || 100,
        calories: f.foodItem.calories * ratio,
        protein: proteinPer100 * ratio,
        carbs: carbsPer100 * ratio,
        fat: fatPer100 * ratio,
        hasWarning: client?.medicalProfile?.allergies?.some(
            (a: string) => f.foodItem.name.toLowerCase().includes(a.toLowerCase())
        ) || false,
        optionGroup: f.optionGroup ?? 0,
        optionLabel: f.optionLabel ?? undefined,
    };
}) || [];
```

Key changes:
- `f.foodItem.protein` becomes `Number(f.foodItem.proteinG) || 0`
- `f.foodItem.carbs` becomes `Number(f.foodItem.carbsG) || 0`
- `f.foodItem.fat` becomes `Number(f.foodItem.fatsG) || 0`
- Added `Number()` wrapper because Prisma Decimal fields are returned as strings in JSON.

### Verification Steps

1. Create a template diet plan with at least one meal containing food items that have non-zero protein, carbs, and fat values.
2. Navigate to "New Diet Plan" in the frontend.
3. Click "Apply Template" and select the template.
4. Verify that the meal builder shows correct numeric values for protein, carbs, and fat (not `NaN`).
5. Check the day nutrition summary bar at the top -- all four macro values should be numbers.
6. Save the plan and verify it saves without errors.

---

## 3.3 HIGH: quantity Field Ambiguity

**File:** `frontend/src/lib/hooks/use-meal-builder.ts` (multiple locations), `frontend/src/lib/types/diet-plan.types.ts`

### The Problem

The `LocalFoodItem` type has two quantity fields with different purposes:

```typescript
// frontend/src/lib/types/diet-plan.types.ts:58-73
export interface LocalFoodItem {
    // ...
    quantity: string;        // Display text, e.g. "1 serving", "2 chapatis"
    quantityValue: number;   // Numeric value in grams for backend
    // ...
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    // ...
}
```

When saving, the mapping is:

```typescript
// frontend/src/lib/hooks/use-meal-builder.ts:335-340
foodItems: m.foods.map(f => ({
    foodId: f.id,
    quantity: f.quantityValue,    // numeric grams -> backend quantity (number)
    notes: f.quantity,            // display string -> backend notes (string)
    optionGroup: f.optionGroup,
    optionLabel: f.optionLabel,
}))
```

The backend schema expects `quantity` as a number (grams):

```typescript
// backend/src/schemas/dietPlan.schema.ts:24-29
foodItems: z.array(z.object({
    foodId: z.string().uuid(),
    quantity: z.number().min(0),    // grams
    notes: z.string().optional(),
    // ...
}))
```

The `updateFoodQuantity` function only updates the display string, never the numeric value or nutrition:

```typescript
// frontend/src/lib/hooks/use-meal-builder.ts:129-139
const updateFoodQuantity = useCallback((mealId: string, tempId: string, val: string) => {
    setWeeklyMeals(prev => ({
        ...prev,
        [selectedDayIndex]: (prev[selectedDayIndex] || []).map(m => {
            if (m.id === mealId) {
                return { ...m, foods: m.foods.map(f =>
                    f.tempId === tempId ? { ...f, quantity: val } : f
                )};
            }
            return m;
        })
    }));
}, [selectedDayIndex]);
```

This means:
1. When a dietitian types "200g" in the quantity field, only `quantity` (the display string) changes.
2. `quantityValue` stays at the original value (e.g., 100), so the backend saves the wrong gram amount.
3. `calories`, `protein`, `carbs`, `fat` are never recalculated, so the nutrition display is stale.

### Root Cause Analysis

The two-field design (`quantity` for display, `quantityValue` for computation) was intended to let dietitians enter human-friendly descriptions like "1 serving" or "2 chapatis" while keeping a numeric gram value for the backend. However:

- There is no mechanism to parse a numeric gram value out of the display string.
- When the quantity text changes, the numeric value and nutrition are not updated.
- The initial `quantityValue` is set to 100 when adding food interactively (line 93: `quantityValue: 100`), and this value never changes unless the entire food item is re-added.

### Impact

- Nutrition totals in the meal builder are always based on the initial 100g portion, regardless of what the dietitian types in the quantity field.
- The backend receives the stale `quantityValue` as the `quantity` parameter, so the stored `MealFoodItem.quantityG` is wrong.
- Compliance calculations that compare logged food against planned portions use the wrong gram values.
- Dietitians believe they are adjusting portions but the system ignores their changes.

### The Fix

Separate the concern into three clear parts: a numeric gram input, a display notes field, and automatic nutrition recalculation.

**Step 1:** Add a `updateFoodQuantityValue` function that updates the numeric value and recalculates nutrition:

```typescript
// frontend/src/lib/hooks/use-meal-builder.ts -- add new function

const updateFoodQuantityValue = useCallback((mealId: string, tempId: string, newGrams: number) => {
    setWeeklyMeals(prev => ({
        ...prev,
        [selectedDayIndex]: (prev[selectedDayIndex] || []).map(m => {
            if (m.id !== mealId) return m;
            return {
                ...m,
                foods: m.foods.map(f => {
                    if (f.tempId !== tempId) return f;
                    const oldGrams = f.quantityValue || 100;
                    if (oldGrams === 0 || newGrams === oldGrams) return f;
                    const ratio = newGrams / oldGrams;
                    return {
                        ...f,
                        quantityValue: newGrams,
                        calories: Math.round(f.calories * ratio),
                        protein: Math.round(f.protein * ratio * 10) / 10,
                        carbs: Math.round(f.carbs * ratio * 10) / 10,
                        fat: Math.round(f.fat * ratio * 10) / 10,
                    };
                })
            };
        })
    }));
}, [selectedDayIndex]);
```

**Step 2:** Rename the existing `updateFoodQuantity` to `updateFoodNotes` for clarity (it updates the display text / notes only):

```typescript
const updateFoodNotes = useCallback((mealId: string, tempId: string, val: string) => {
    setWeeklyMeals(prev => ({
        ...prev,
        [selectedDayIndex]: (prev[selectedDayIndex] || []).map(m => {
            if (m.id === mealId) {
                return { ...m, foods: m.foods.map(f =>
                    f.tempId === tempId ? { ...f, quantity: val } : f
                )};
            }
            return m;
        })
    }));
}, [selectedDayIndex]);
```

**Step 3:** Update the meal editor UI to show two fields:
- A numeric input for grams (bound to `quantityValue`, calls `updateFoodQuantityValue` on change)
- A text input for display notes (bound to `quantity`, calls `updateFoodNotes` on change)

**Step 4:** Export both functions from the hook:

```typescript
return {
    // ... existing exports ...
    updateFoodQuantityValue,    // NEW: updates grams + recalculates nutrition
    updateFoodNotes,            // RENAMED from updateFoodQuantity: updates display text only
    // Keep old name as alias for backward compatibility during migration:
    updateFoodQuantity: updateFoodNotes,
};
```

### Verification Steps

1. Add a food item to a meal (e.g., Rice, 100g, 130 cal).
2. Change the gram value from 100 to 200 using the numeric input.
3. Verify that `calories` doubles to 260, and `protein`, `carbs`, `fat` scale accordingly.
4. Verify the day nutrition summary updates immediately.
5. Save the plan and inspect the API request payload: `quantity` should be `200` (number), `notes` should be whatever display text was entered.
6. Verify the saved `MealFoodItem.quantityG` in the database is `200.00`.

---

## 3.4 MEDIUM: Duplicate MealLog Prevention Is Weak

**File:** `backend/src/routes/clientApi.routes.ts`, lines 176-211

### The Problem

The meal logging endpoint uses a check-then-create pattern that is vulnerable to race conditions:

```typescript
// backend/src/routes/clientApi.routes.ts:176-211
// Check if a log already exists for this meal today
const existingLog = await prisma.mealLog.findFirst({
    where: {
        clientId: req.client.id,
        mealId: mealId,
        scheduledDate: today,
    },
});

if (existingLog) {
    // Update existing log instead of creating duplicate
    mealLog = await prisma.mealLog.update({
        where: { id: existingLog.id },
        data: {
            status: status || 'eaten',
            mealPhotoUrl: photoUrl || existingLog.mealPhotoUrl,
            clientNotes: notes || existingLog.clientNotes,
            loggedAt: new Date(),
            ...(chosenOptionGroup !== undefined && { chosenOptionGroup }),
        },
    });
} else {
    // Create new log
    mealLog = await prisma.mealLog.create({
        data: {
            orgId: req.client.orgId,
            clientId: req.client.id,
            mealId: mealId,
            scheduledDate: today,
            status: status || 'eaten',
            mealPhotoUrl: photoUrl,
            clientNotes: notes,
            loggedAt: new Date(),
            ...(chosenOptionGroup !== undefined && { chosenOptionGroup }),
        },
    });
}
```

The database does have a unique constraint:

```prisma
// backend/prisma/schema.prisma (MealLog model)
@@unique([clientId, mealId, scheduledDate])
```

However, two concurrent requests can both pass the `findFirst` check (both see no existing log), and then both attempt `create`. The second one hits the unique constraint and throws an unhandled Prisma error (`P2002`), which propagates as a 500 Internal Server Error to the client.

### Root Cause Analysis

The check-then-create pattern is inherently non-atomic. Between the `findFirst` and the `create`, another request can insert the same record. This is a classic TOCTOU (Time of Check, Time of Use) race condition.

The unique constraint at the database level is correct and prevents actual duplicate data, but the application code does not handle the constraint violation error, so the user sees a 500 error instead of a graceful response.

### Impact

- When a client double-taps the "Log Meal" button on a slow connection, the second request fails with an unhandled Prisma unique constraint error.
- The client app receives a 500 error and may show a generic "Something went wrong" message.
- No data corruption occurs (the DB constraint prevents it), but the user experience is poor.
- In the worst case, the client may think the meal was not logged and try again, creating a frustrating loop.

### The Fix

Replace the check-then-create pattern with Prisma's `upsert`, which is atomic:

```typescript
// backend/src/routes/clientApi.routes.ts -- replace lines 176-211

// Atomically create or update the meal log for this meal+date
mealLog = await prisma.mealLog.upsert({
    where: {
        clientId_mealId_scheduledDate: {
            clientId: req.client.id,
            mealId: mealId,
            scheduledDate: today,
        },
    },
    update: {
        status: status || 'eaten',
        mealPhotoUrl: photoUrl || undefined,
        clientNotes: notes || undefined,
        loggedAt: new Date(),
        ...(chosenOptionGroup !== undefined && { chosenOptionGroup }),
    },
    create: {
        orgId: req.client.orgId,
        clientId: req.client.id,
        mealId: mealId,
        scheduledDate: today,
        status: status || 'eaten',
        mealPhotoUrl: photoUrl,
        clientNotes: notes,
        loggedAt: new Date(),
        ...(chosenOptionGroup !== undefined && { chosenOptionGroup }),
    },
});
```

**Alternative approach** -- if you cannot use `upsert` (e.g., the update logic needs the previous values for conditional merging), catch the unique constraint error:

```typescript
try {
    mealLog = await prisma.mealLog.create({
        data: {
            orgId: req.client.orgId,
            clientId: req.client.id,
            mealId: mealId,
            scheduledDate: today,
            status: status || 'eaten',
            mealPhotoUrl: photoUrl,
            clientNotes: notes,
            loggedAt: new Date(),
            ...(chosenOptionGroup !== undefined && { chosenOptionGroup }),
        },
    });
} catch (error: any) {
    // P2002 = Unique constraint violation
    if (error.code === 'P2002') {
        // Another request already created the log; fetch and update it
        const existingLog = await prisma.mealLog.findFirstOrThrow({
            where: {
                clientId: req.client.id,
                mealId: mealId,
                scheduledDate: today,
            },
        });
        mealLog = await prisma.mealLog.update({
            where: { id: existingLog.id },
            data: {
                status: status || 'eaten',
                mealPhotoUrl: photoUrl || existingLog.mealPhotoUrl,
                clientNotes: notes || existingLog.clientNotes,
                loggedAt: new Date(),
                ...(chosenOptionGroup !== undefined && { chosenOptionGroup }),
            },
        });
    } else {
        throw error; // Re-throw non-duplicate errors
    }
}
```

The `upsert` approach is preferred because it is simpler and fully atomic.

### Verification Steps

1. Set up a test client with an active diet plan containing at least one meal.
2. Using a tool like `curl` or Postman, fire two simultaneous `PATCH /client-api/meals/pending-{mealId}/log` requests with `{ "status": "eaten" }`.
3. Before the fix: one request returns 200, the other returns 500 with a Prisma P2002 error.
4. After the fix: both requests return 200, and only one `MealLog` record exists in the database.
5. Verify the `MealLog` record has the correct `status`, `loggedAt`, and other fields from the last request to complete.
6. Check the database: `SELECT COUNT(*) FROM "MealLog" WHERE "clientId" = ? AND "mealId" = ? AND "scheduledDate" = ?` should return exactly 1.

---

## 3.5 MEDIUM: Weight Trend Only Uses Last 2 Entries

**File:** `backend/src/routes/clientApi.routes.ts`, lines 368-373

### The Problem

The weight trend calculation in both the `/stats` and `/progress-summary` endpoints uses only the last two weight log entries:

```typescript
// backend/src/routes/clientApi.routes.ts:368-373
let weightTrend: 'up' | 'down' | 'stable' = 'stable';
if (weightLogs.length >= 2) {
    const diff = Number(weightLogs[0].weightKg) - Number(weightLogs[1].weightKg);
    if (diff > 0.5) weightTrend = 'up';
    else if (diff < -0.5) weightTrend = 'down';
}
```

The same logic is duplicated in the `/progress-summary` route (lines 421-426):

```typescript
// backend/src/routes/clientApi.routes.ts:421-426
let weightTrend: 'up' | 'down' | 'stable' = 'stable';
if (weightLogs.length >= 2) {
    const diff = Number(weightLogs[0].weightKg) - Number(weightLogs[1].weightKg);
    if (diff > 0.5) weightTrend = 'up';
    else if (diff < -0.5) weightTrend = 'down';
}
```

A single day's water retention, post-meal weigh-in, or scale calibration difference can flip the trend indicator. For example:

| Day | Weight | Trend shown |
|-----|--------|-------------|
| Mon | 75.0   | -           |
| Tue | 74.2   | down        |
| Wed | 74.8   | up          |  <-- misleading: overall still trending down
| Thu | 74.0   | down        |
| Fri | 74.6   | up          |  <-- misleading again

The trend flips every day even though the overall trajectory is downward.

### Root Cause Analysis

Using only two data points for trend detection provides no smoothing. Day-to-day weight fluctuations of 0.5-1.5kg are normal due to hydration, meals, and other factors. A proper trend indicator needs a wider window to be meaningful.

### Impact

- Clients and dietitians see a volatile trend indicator that changes direction frequently.
- A client on a successful weight-loss journey may see "up" on a high-water day, which is discouraging.
- A dietitian reviewing client stats may make unnecessary plan adjustments based on noisy trend data.

### The Fix

Use a 7-day rolling average comparison. Compare the average of the most recent 3-4 entries against the average of the preceding 3-4 entries. This requires fetching more weight logs.

For the `/stats` endpoint, change the weight log query from `take: 2` to `take: 14` (two weeks of daily entries):

```typescript
// backend/src/routes/clientApi.routes.ts -- /stats endpoint

// Fetch more weight logs for trend calculation
const weightLogs = await prisma.weightLog.findMany({
    where: { clientId: req.client.id },
    orderBy: { logDate: 'desc' },
    take: 14, // Up to 2 weeks of data
});

// Calculate weight trend using rolling averages
let weightTrend: 'up' | 'down' | 'stable' = 'stable';
if (weightLogs.length >= 4) {
    // Split into recent half and older half
    const midpoint = Math.floor(weightLogs.length / 2);
    const recentEntries = weightLogs.slice(0, midpoint);
    const olderEntries = weightLogs.slice(midpoint);

    const recentAvg = recentEntries.reduce((sum, l) => sum + Number(l.weightKg), 0) / recentEntries.length;
    const olderAvg = olderEntries.reduce((sum, l) => sum + Number(l.weightKg), 0) / olderEntries.length;

    const avgDiff = recentAvg - olderAvg;
    if (avgDiff > 0.3) weightTrend = 'up';
    else if (avgDiff < -0.3) weightTrend = 'down';
} else if (weightLogs.length >= 2) {
    // Fallback for very few entries: use first and last
    const diff = Number(weightLogs[0].weightKg) - Number(weightLogs[weightLogs.length - 1].weightKg);
    if (diff > 0.5) weightTrend = 'up';
    else if (diff < -0.5) weightTrend = 'down';
}
```

Apply the same logic to the `/progress-summary` endpoint (which already fetches 10 entries via `take: 10`):

```typescript
// backend/src/routes/clientApi.routes.ts -- /progress-summary endpoint

// Weight trend (using rolling averages for stability)
let weightTrend: 'up' | 'down' | 'stable' = 'stable';
if (weightLogs.length >= 4) {
    const midpoint = Math.floor(weightLogs.length / 2);
    // weightLogs are ordered desc, so index 0 is most recent
    const recentEntries = weightLogs.slice(0, midpoint);
    const olderEntries = weightLogs.slice(midpoint);

    const recentAvg = recentEntries.reduce((sum, l) => sum + Number(l.weightKg), 0) / recentEntries.length;
    const olderAvg = olderEntries.reduce((sum, l) => sum + Number(l.weightKg), 0) / olderEntries.length;

    const avgDiff = recentAvg - olderAvg;
    if (avgDiff > 0.3) weightTrend = 'up';
    else if (avgDiff < -0.3) weightTrend = 'down';
} else if (weightLogs.length >= 2) {
    const diff = Number(weightLogs[0].weightKg) - Number(weightLogs[weightLogs.length - 1].weightKg);
    if (diff > 0.5) weightTrend = 'up';
    else if (diff < -0.5) weightTrend = 'down';
}
```

**Recommended refactor:** Extract the trend calculation into a shared utility function to avoid duplication:

```typescript
// backend/src/utils/weightTrend.ts

interface WeightEntry {
    weightKg: number | string | { toString(): string };
}

export function calculateWeightTrend(
    weightLogs: WeightEntry[]
): 'up' | 'down' | 'stable' {
    if (weightLogs.length >= 4) {
        const midpoint = Math.floor(weightLogs.length / 2);
        const recentEntries = weightLogs.slice(0, midpoint);
        const olderEntries = weightLogs.slice(midpoint);

        const avg = (entries: WeightEntry[]) =>
            entries.reduce((sum, l) => sum + Number(l.weightKg), 0) / entries.length;

        const diff = avg(recentEntries) - avg(olderEntries);
        if (diff > 0.3) return 'up';
        if (diff < -0.3) return 'down';
        return 'stable';
    }

    if (weightLogs.length >= 2) {
        const diff = Number(weightLogs[0].weightKg) - Number(weightLogs[weightLogs.length - 1].weightKg);
        if (diff > 0.5) return 'up';
        if (diff < -0.5) return 'down';
    }

    return 'stable';
}
```

### Verification Steps

1. Create a client and log the following weights over 8 days (oldest first): 75.0, 74.5, 75.2, 74.8, 74.3, 74.9, 74.1, 73.8.
2. **Before fix:** The trend is determined only by the last two entries (73.8 vs 74.1), showing "down".
3. **After fix:** Recent average (73.8, 74.1, 74.9, 74.3) = 74.275. Older average (74.8, 75.2, 74.5, 75.0) = 74.875. Diff = -0.6, so trend is "down" -- same result but for the right reason.
4. Now change the last entry to 75.5 (a spike). Before fix: trend flips to "up" (75.5 vs 74.1). After fix: recent average = (75.5+74.1+74.9+74.3)/4 = 74.7, older average = 74.875, diff = -0.175, trend = "stable". The spike is absorbed.
5. Verify both `/stats` and `/progress-summary` endpoints return consistent trend values.

---

## 3.6 MEDIUM: currentStreak Calculation Is Fake

**File:** `backend/src/routes/clientApi.routes.ts`, line 386

### The Problem

The `currentStreak` field in the `/stats` endpoint response is not a real streak calculation:

```typescript
// backend/src/routes/clientApi.routes.ts:386
currentStreak: Math.min(eatenMeals, 7), // Simplified streak
```

Where `eatenMeals` is:

```typescript
// backend/src/routes/clientApi.routes.ts:357
const eatenMeals = recentLogs.filter((l) => l.status === 'eaten').length;
```

This returns the total number of meals eaten in the last 7 days, capped at 7. It is not a streak (consecutive days) at all. For example:

- Client eats 4 meals on Monday and nothing the rest of the week: `currentStreak: 4` (should be 1 day).
- Client eats 1 meal every day for 5 days, then skips 2 days: `currentStreak: 5` (should be 0 -- the streak was broken).
- Client eats all 3 meals for 7 straight days: `currentStreak: 7` (coincidentally correct, but `eatenMeals` would be 21, clamped to 7).

### Root Cause Analysis

The comment `// Simplified streak` indicates this was a placeholder implementation that was never replaced with real logic. The developer intended to come back and implement actual consecutive-day tracking, but the code shipped as-is.

### Impact

- The streak displayed to the client is meaningless and does not incentivize daily adherence.
- A client could eat many meals in one day and see a high "streak," breaking the psychological model of streaks.
- The gamification value of the streak feature is completely lost.

### The Fix

Calculate the actual consecutive days with at least one logged meal, counting backward from today:

```typescript
// backend/src/routes/clientApi.routes.ts -- replace the streak calculation

// Calculate actual consecutive-day streak
// Query meal logs ordered by date descending
const streakLogs = await prisma.mealLog.findMany({
    where: {
        clientId: req.client.id,
        status: 'eaten',
    },
    select: {
        scheduledDate: true,
    },
    orderBy: { scheduledDate: 'desc' },
    take: 100, // Look back up to ~100 entries (covers ~30 days with 3 meals/day)
});

let currentStreak = 0;
if (streakLogs.length > 0) {
    // Get unique dates (as YYYY-MM-DD strings) in descending order
    const uniqueDates = [...new Set(
        streakLogs.map(log => log.scheduledDate.toISOString().split('T')[0])
    )].sort((a, b) => b.localeCompare(a)); // Descending

    // Check if the most recent logged date is today or yesterday
    // (if the client hasn't logged today yet, their streak from yesterday still counts)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const mostRecentDate = uniqueDates[0];
    if (mostRecentDate === todayStr || mostRecentDate === yesterdayStr) {
        // Start counting the streak
        currentStreak = 1;
        let expectedDate = new Date(mostRecentDate);

        for (let i = 1; i < uniqueDates.length; i++) {
            // The previous day we expect in the streak
            expectedDate.setDate(expectedDate.getDate() - 1);
            const expectedStr = expectedDate.toISOString().split('T')[0];

            if (uniqueDates[i] === expectedStr) {
                currentStreak++;
            } else {
                break; // Streak broken
            }
        }
    }
    // If mostRecentDate is older than yesterday, streak is 0
}
```

Then use `currentStreak` in the response as before:

```typescript
res.status(200).json({
    success: true,
    data: {
        weeklyAdherence: adherence,
        mealCompletionRate: adherence,
        weightTrend,
        latestWeight: weightLogs.length > 0
            ? Number(weightLogs[0].weightKg)
            : (client?.currentWeightKg ? Number(client.currentWeightKg) : null),
        targetWeight: client?.targetWeightKg ? Number(client.targetWeightKg) : null,
        currentStreak,
    },
});
```

**Performance note:** The additional query for streak logs adds one DB round-trip. If performance is a concern, the streak logs query can be combined with the existing `recentLogs` query by removing the date filter and adding a wider window, then computing both adherence and streak from the same dataset:

```typescript
// Optimized: single query for both adherence and streak
const allRecentLogs = await prisma.mealLog.findMany({
    where: {
        clientId: req.client.id,
        scheduledDate: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days back
        },
    },
    orderBy: { scheduledDate: 'desc' },
});

// Use last 7 days for adherence
const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);
const recentLogs = allRecentLogs.filter(l => l.scheduledDate >= weekAgo);
const totalMeals = recentLogs.length;
const eatenMeals = recentLogs.filter(l => l.status === 'eaten').length;
const adherence = totalMeals > 0 ? Math.round((eatenMeals / totalMeals) * 100) : 0;

// Use eaten logs from the full 30-day window for streak
const eatenLogs = allRecentLogs.filter(l => l.status === 'eaten');
// ... then apply the streak calculation above using eatenLogs
```

### Verification Steps

1. Create a test client with an active diet plan (3 meals per day).
2. Log meals for 5 consecutive days (at least 1 meal per day).
3. Call `GET /client-api/stats` and verify `currentStreak` is `5` (or `6` if today is included).
4. Skip a day (no meals logged), then log a meal.
5. Verify `currentStreak` is now `1` (the gap broke the streak).
6. Test edge case: no meals logged at all. Verify `currentStreak` is `0`.
7. Test edge case: meals logged only today. Verify `currentStreak` is `1`.
8. Test edge case: meals logged yesterday but not today. Verify `currentStreak` still counts the streak (client may not have eaten today yet).
9. Test edge case: last meal logged 3 days ago. Verify `currentStreak` is `0` (streak broken by more than 1 day gap).

---

## Summary

| ID  | Severity | Issue | Status |
|-----|----------|-------|--------|
| 3.1 | HIGH     | Progress calculation only works for weight loss | Open |
| 3.2 | HIGH     | Nutrition field mismatch (NaN on template apply) | Open |
| 3.3 | HIGH     | quantity field ambiguity (nutrition never recalculates) | Open |
| 3.4 | MEDIUM   | Duplicate MealLog race condition (unhandled P2002) | Open |
| 3.5 | MEDIUM   | Weight trend based on only 2 entries (volatile) | Open |
| 3.6 | MEDIUM   | currentStreak is not a real streak calculation | Open |

### Files Affected

| File | Issues |
|------|--------|
| `backend/src/routes/clientApi.routes.ts` | 3.1, 3.4, 3.5, 3.6 |
| `frontend/src/lib/hooks/use-meal-builder.ts` | 3.2, 3.3 |
| `frontend/src/lib/types/diet-plan.types.ts` | 3.3 |
| `backend/src/schemas/dietPlan.schema.ts` | 3.3 (reference) |
| `backend/prisma/schema.prisma` | 3.4 (reference) |
| `backend/src/services/client.service.ts` | 3.1 (reference -- correct implementation exists) |
