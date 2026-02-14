# 7. Frontend (Next.js) Issues

This document covers all identified frontend issues in the DietKaro Next.js dashboard application.
Each issue includes the exact problematic code, its impact on users, and the recommended fix with
complete code.

---

## 7.1 HIGH: `title` / `name` Field Confusion

**File:** `frontend/src/lib/hooks/use-diet-plans.ts` (lines 28-52, 73-105, 141-144)

### The Problem

The frontend uses `title` as the internal field name for a diet plan's display name, while the
backend Prisma schema and API exclusively use `name`. This mismatch is papered over with a manual
mapping in the create mutation, but the `DietPlan` type carries **both** fields as optional,
creating ambiguity throughout the codebase.

**The type definition carries both fields:**

```typescript
// frontend/src/lib/hooks/use-diet-plans.ts:28-52
export interface DietPlan {
    id: string;
    clientId?: string;
    name?: string;   // Backend returns name
    title?: string;  // Keep for backwards compatibility  <-- WHY IS THIS HERE?
    description?: string;
    startDate: string;
    // ...
}
```

**The create input uses `title`:**

```typescript
// frontend/src/lib/hooks/use-diet-plans.ts:73-105
export interface CreateDietPlanInput {
    clientId?: string;
    title: string; // 'name' in backend schema mapped to 'title'
    // ...
    meals?: {
        // ...
        title: string;  // Also 'title' here, mapped to 'name' in backend
        // ...
    }[];
}
```

**The mutation manually maps `title` -> `name`:**

```typescript
// frontend/src/lib/hooks/use-diet-plans.ts:141-144
mutationFn: async (planData: CreateDietPlanInput) => {
    // Map 'title' to 'name' as expected by backend
    const { title, ...rest } = planData;
    const payload = { ...rest, name: title };
    const { data } = await api.post('/diet-plans', payload);
    return data.data;
},
```

**Consumer code has to hedge with fallbacks:**

```typescript
// frontend/src/app/dashboard/diet-plans/page.tsx:189
{plan.name || plan.title || 'Untitled Plan'}
```

Meanwhile, the detail page only uses `plan.name`:

```typescript
// frontend/src/app/dashboard/diet-plans/[id]/page.tsx:140
{plan.name || 'Diet Plan'}
```

### Impact on Users

- **Inconsistent display:** If for any reason `name` is not populated but `title` is (or vice
  versa), different pages show different names for the same plan. The listing page falls back to
  `plan.title`, but the detail page does not.
- **Developer confusion:** Any new developer looking at the `DietPlan` type sees two optional
  name-like fields and has no clear guidance on which to use, leading to further inconsistency.
- **Fragile mapping:** The destructure-and-remap in the mutation is easy to miss. If someone adds
  an update flow and forgets the mapping, the backend will receive `title` (which it ignores)
  and `name` will be undefined, silently creating unnamed plans.

### The Fix

Standardize entirely on `name` to match the backend. Remove `title` from all types and update
the create input and mutation to use `name` directly.

**Step 1: Fix the `DietPlan` interface -- remove `title`:**

```typescript
// frontend/src/lib/hooks/use-diet-plans.ts
export interface DietPlan {
    id: string;
    clientId?: string;
    name: string;        // Required, matches backend schema
    description?: string;
    startDate: string;
    endDate?: string;
    status?: string;
    isPublished?: boolean;
    isTemplate?: boolean;
    templateCategory?: string;
    publishedAt?: string;
    targetCalories?: number;
    targetProteinG?: number;
    targetCarbsG?: number;
    targetFatsG?: number;
    createdAt: string;
    updatedAt: string;
    client?: {
        id: string;
        fullName: string;
    };
    meals?: Meal[];
}
```

**Step 2: Fix the `CreateDietPlanInput` -- rename `title` to `name`:**

```typescript
// frontend/src/lib/hooks/use-diet-plans.ts
export interface CreateDietPlanInput {
    clientId?: string;
    name: string;        // Matches backend field directly
    description?: string;
    startDate: string;
    endDate?: string;
    targetCalories?: number;
    targetProteinG?: number;
    targetCarbsG?: number;
    targetFatsG?: number;
    notesForClient?: string;
    internalNotes?: string;
    meals?: {
        dayIndex?: number;
        mealDate?: string;
        mealType: string;
        timeOfDay?: string;
        name: string;        // Was 'title', now matches backend
        description?: string;
        instructions?: string;
        foodItems?: {
            foodId: string;
            quantity: number;
            notes?: string;
            optionGroup?: number;
            optionLabel?: string;
        }[];
    }[];
    options?: {
        saveAsTemplate?: boolean;
        templateCategory?: string;
    };
}
```

**Step 3: Simplify the mutation -- no more mapping:**

```typescript
// frontend/src/lib/hooks/use-diet-plans.ts
export function useCreateDietPlan() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (planData: CreateDietPlanInput) => {
            // No mapping needed -- field names match backend directly
            const { data } = await api.post('/diet-plans', planData);
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diet-plans'] });
        },
    });
}
```

**Step 4: Update the listing page -- remove `plan.title` fallback:**

```typescript
// frontend/src/app/dashboard/diet-plans/page.tsx
// Before:
{plan.name || plan.title || 'Untitled Plan'}

// After:
{plan.name || 'Untitled Plan'}
```

**Step 5: Update `use-meal-builder.ts` save function** to pass `name` instead of `title` in the
`CreateDietPlanInput` payload (anywhere `title: planName` or `title: meal.name` appears, change
to `name: planName` and `name: meal.name`).

---

## 7.2 HIGH: `MealFoodItem` Type Mismatch

**File:** `frontend/src/lib/hooks/use-diet-plans.ts` (lines 15-26)

### The Problem

The `MealFoodItem` interface declares nutrition fields with `Per100g` suffixes, but the backend
Prisma schema uses entirely different field names. The type compiles fine but gives false
confidence -- runtime access to these properties returns `undefined`.

**Frontend type (WRONG):**

```typescript
// frontend/src/lib/hooks/use-diet-plans.ts:15-26
export interface MealFoodItem {
    id: string;
    foodItem: {
        id: string;
        name: string;
        caloriesPer100g: number;   // WRONG: backend sends 'calories'
        proteinPer100g: number;    // WRONG: backend sends 'proteinG'
        carbsPer100g: number;      // WRONG: backend sends 'carbsG'
        fatsPer100g: number;       // WRONG: backend sends 'fatsG'
    };
    quantityG: number;
}
```

**Backend Prisma schema (actual field names):**

```prisma
// backend/prisma/schema.prisma:362-404
model FoodItem {
  id              String   @id @default(uuid())
  name            String
  calories        Int              // <-- 'calories', NOT 'caloriesPer100g'
  proteinG        Decimal?         // <-- 'proteinG', NOT 'proteinPer100g'
  carbsG          Decimal?         // <-- 'carbsG', NOT 'carbsPer100g'
  fatsG           Decimal?         // <-- 'fatsG', NOT 'fatsPer100g'
  // ...
}
```

**The backend returns the data with Prisma's field names via `include: { foodItem: true }`:**

```typescript
// backend/src/services/dietPlan.service.ts:69
meals: {
    include: {
        foodItems: {
            orderBy: [{ optionGroup: 'asc' }, { sortOrder: 'asc' }],
            include: { foodItem: true }   // Returns raw Prisma fields
        }
    }
}
```

So the API response contains `food.foodItem.calories`, `food.foodItem.proteinG`, etc., but
TypeScript thinks the fields are `food.foodItem.caloriesPer100g`, `food.foodItem.proteinPer100g`,
etc.

**Evidence the mismatch causes issues:** In `use-meal-builder.ts`, the template application code
accesses the correct field names directly using `any` types to bypass TypeScript:

```typescript
// frontend/src/lib/hooks/use-meal-builder.ts:286-289
// This works because it uses the REAL field names, not the type's names
calories: f.foodItem.calories * ratio,
protein: f.foodItem.protein * ratio,    // Note: even this is wrong --
carbs: f.foodItem.carbs * ratio,        // backend actually returns proteinG/carbsG/fatsG
fat: f.foodItem.fat * ratio,            // but Prisma Decimal may serialize differently
```

### Impact on Users

- **Nutrition data silently shows as zero or NaN:** Any component that trusts the
  `MealFoodItem` type and accesses `food.foodItem.caloriesPer100g` gets `undefined`, which
  becomes `NaN` in calculations or `0` with fallback operators.
- **Diet plan detail page affected:** The diet plan detail page (`diet-plans/[id]/page.tsx`)
  renders food items from meals -- if any nutrition display is added that relies on the typed
  fields, it will show incorrect values.
- **False sense of type safety:** TypeScript shows no errors, so developers assume the data
  shape is correct. Bugs only surface at runtime.

### The Fix

Align the `MealFoodItem` interface with the actual backend response shape.

```typescript
// frontend/src/lib/hooks/use-diet-plans.ts
export interface MealFoodItem {
    id: string;
    foodItem: {
        id: string;
        name: string;
        calories: number;       // Matches FoodItem.calories (Int)
        proteinG: number;       // Matches FoodItem.proteinG (Decimal)
        carbsG: number;         // Matches FoodItem.carbsG (Decimal)
        fatsG: number;          // Matches FoodItem.fatsG (Decimal)
        fiberG?: number;        // Matches FoodItem.fiberG (Decimal, optional)
        servingSizeG?: number;  // Matches FoodItem.servingSizeG (Decimal)
        category?: string;
    };
    quantityG: number;
    optionGroup?: number;
    optionLabel?: string;
    notes?: string;
}
```

Also update the `Meal` interface in the same file to include the `timeOfDay` field (see issue
7.3) and remove `scheduledTime`:

```typescript
export interface Meal {
    id: string;
    name: string;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    timeOfDay?: string;          // Was 'scheduledTime' -- see issue 7.3
    dayOfWeek?: number;
    foodItems: MealFoodItem[];
}
```

---

## 7.3 MEDIUM: `diet-plans/[id]/page.tsx` Uses `scheduledTime` That Does Not Exist

**File:** `frontend/src/app/dashboard/diet-plans/[id]/page.tsx` (lines 272-277)

### The Problem

The diet plan detail page checks for `meal.scheduledTime` to render a time display with a clock
icon. However, the backend `Meal` model uses `timeOfDay`, not `scheduledTime`. The field
`scheduledTime` exists only on the `MealLog` model (a completely different entity). As a result,
this block never renders.

**Current code (dead block):**

```tsx
// frontend/src/app/dashboard/diet-plans/[id]/page.tsx:272-277
{meal.scheduledTime && (
    <p className="text-sm text-gray-500 flex items-center gap-1">
        <Clock className="w-4 h-4" />
        {meal.scheduledTime}
    </p>
)}
```

**Backend Meal model shows the correct field:**

```prisma
// backend/prisma/schema.prisma:331-360
model Meal {
  id               String    @id @default(uuid())
  planId           String
  mealType         MealType
  timeOfDay        String?   // <-- THIS is the correct field
  name             String
  // ...
}
```

**MealLog model (different entity) has `scheduledTime`:**

```prisma
// backend/prisma/schema.prisma:433-440
model MealLog {
  id                    String        @id @default(uuid())
  scheduledDate         DateTime      @db.Date
  scheduledTime         String?       // <-- This is on MealLog, NOT Meal
  // ...
}
```

**The frontend `Meal` interface also incorrectly declares `scheduledTime`:**

```typescript
// frontend/src/lib/hooks/use-diet-plans.ts:7-13
export interface Meal {
    id: string;
    name: string;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    scheduledTime: string;     // WRONG: should be 'timeOfDay'
    foodItems: MealFoodItem[];
}
```

### Impact on Users

- **Missing time display:** Dietitians who set `timeOfDay` on meals (e.g., "08:00 AM") never
  see it on the plan detail page. The clock icon and time label simply do not appear.
- **Wasted backend data:** The backend correctly stores and returns `timeOfDay`, but the
  frontend silently ignores it because it is looking for a field that does not exist on the
  response object.
- **Confusing for developers:** The `Meal` interface says `scheduledTime` is required (not
  optional), yet it is always undefined at runtime. This masks the bug from TypeScript.

### The Fix

**Step 1: Fix the `Meal` interface:**

```typescript
// frontend/src/lib/hooks/use-diet-plans.ts
export interface Meal {
    id: string;
    name: string;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    timeOfDay?: string;     // Matches backend Meal.timeOfDay, optional
    dayOfWeek?: number;
    foodItems: MealFoodItem[];
}
```

**Step 2: Fix the detail page rendering:**

```tsx
// frontend/src/app/dashboard/diet-plans/[id]/page.tsx
// Before:
{meal.scheduledTime && (
    <p className="text-sm text-gray-500 flex items-center gap-1">
        <Clock className="w-4 h-4" />
        {meal.scheduledTime}
    </p>
)}

// After:
{meal.timeOfDay && (
    <p className="text-sm text-gray-500 flex items-center gap-1">
        <Clock className="w-4 h-4" />
        {meal.timeOfDay}
    </p>
)}
```

---

## 7.4 MEDIUM: Missing Error Boundaries on Key Routes

**File:** `frontend/src/app/dashboard/layout.tsx` (line 142), `frontend/src/components/error-boundary.tsx`

### The Problem

An `ErrorBoundary` component exists and is used in the dashboard layout, but it wraps **all**
child routes in a single boundary. There is no granular error isolation. If any component inside
the diet plan builder (which has deeply nested state, complex food item validation, and template
application logic) throws an error, the **entire dashboard page** is replaced with the error
fallback.

**Current usage -- single boundary wrapping all routes:**

```tsx
// frontend/src/app/dashboard/layout.tsx:142
<main className="p-6"><ErrorBoundary>{children}</ErrorBoundary></main>
```

**The ErrorBoundary component itself:**

```tsx
// frontend/src/components/error-boundary.tsx
export class ErrorBoundary extends Component<Props, State> {
    // ...
    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
                    {/* Generic error UI */}
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
                    <button onClick={() => this.setState({ hasError: false, error: null })}
                        className="px-4 py-2 bg-[#17cf54] text-white rounded-lg ...">
                        Try Again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
```

**Pages that have NO individual error boundaries:**

- `diet-plans/[id]/page.tsx` -- complex meal rendering with option groups
- `diet-plans/new/page.tsx` -- the meal builder with deeply nested state
- `clients/[id]/page.tsx` -- client detail with compliance charts and meal logs

### Impact on Users

- **Total page wipeout:** A single error in the meal option-group rendering logic (e.g., a
  null reference on `food.foodItem`) replaces the entire dashboard content area with
  "Something went wrong." The sidebar navigation remains, but the user loses all context of
  what they were doing.
- **Lost in-progress work:** In the diet plan builder, a runtime error means all unsaved meal
  entries are lost. There is no recovery other than "Try Again," which re-mounts the entire
  page from scratch.
- **No error context:** The generic error message gives no indication of which component
  failed or what data caused the issue.

### The Fix

Add granular `ErrorBoundary` wrappers around high-risk sections with contextual fallback UIs.

**Step 1: Add a section-level error boundary with custom fallback to the diet plan builder:**

```tsx
// frontend/src/app/dashboard/diet-plans/new/page.tsx
import { ErrorBoundary } from '@/components/error-boundary';

// In the template, wrap the MealEditor section:
<section className="col-span-6 flex flex-col gap-4 overflow-y-auto">
    <DayNavigator
        planDates={builder.planDates}
        selectedDayIndex={builder.selectedDayIndex}
        onSelectDay={builder.setSelectedDayIndex}
        isTemplateMode={isTemplateMode}
    />
    <ErrorBoundary
        fallback={
            <div className="flex flex-col items-center justify-center p-8 bg-white rounded-xl border border-red-200">
                <p className="text-red-600 font-medium mb-2">
                    Failed to render meal editor
                </p>
                <p className="text-gray-500 text-sm mb-4">
                    Your other data is preserved. Try refreshing the page.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium"
                >
                    Refresh Page
                </button>
            </div>
        }
    >
        <MealEditor
            meals={builder.currentMeals}
            onAddMeal={builder.addMeal}
            onRemoveMeal={builder.removeMeal}
            onOpenAddFood={builder.openAddFood}
            onRemoveFood={builder.removeFood}
            onUpdateFoodQuantity={builder.updateFoodQuantity}
            onUpdateMealField={builder.updateMealField}
            onAddAlternative={builder.addMealOption}
            onRemoveOption={builder.removeOption}
            onUpdateOptionLabel={builder.updateOptionLabel}
        />
    </ErrorBoundary>
</section>
```

**Step 2: Wrap the diet plan detail page meals section:**

```tsx
// frontend/src/app/dashboard/diet-plans/[id]/page.tsx
import { ErrorBoundary } from '@/components/error-boundary';

// Wrap the meals rendering:
<ErrorBoundary
    fallback={
        <div className="text-center py-8 text-red-500">
            <p className="font-medium">Could not display meals</p>
            <p className="text-sm text-gray-500 mt-1">
                The plan data may be corrupted. Try refreshing.
            </p>
        </div>
    }
>
    {plan.meals && plan.meals.length > 0 ? (
        <div className="space-y-4">
            {plan.meals.map((meal, index) => {
                // ... meal rendering ...
            })}
        </div>
    ) : (
        <div className="text-center py-8 text-gray-500">
            <Utensils className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No meals added yet</p>
        </div>
    )}
</ErrorBoundary>
```

**Step 3: Add a `reset` capability to the ErrorBoundary (optional enhancement):**

```tsx
// frontend/src/components/error-boundary.tsx
// Add a key-based reset prop so parent components can force recovery:

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    resetKey?: string | number;   // Change this to reset the boundary
}

// In the class:
componentDidUpdate(prevProps: Props) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
        this.setState({ hasError: false, error: null });
    }
}
```

---

## 7.5 MEDIUM: Age Calculation Uses Magic Number

**File:** `frontend/src/app/dashboard/diet-plans/new/page.tsx` (line 84)

### The Problem

The diet plan builder page calculates a client's age using an inline formula with the magic
number `3.15576e10` (milliseconds in an average year, accounting for leap years). This is
difficult to read and understand. Critically, a proper `calculateAge` utility function already
exists in the codebase and is used elsewhere (e.g., in the client detail page), but it is not
used here.

**Current code with magic number:**

```tsx
// frontend/src/app/dashboard/diet-plans/new/page.tsx:83-85
<span className="text-gray-600 text-sm">
    {client.fullName} ({client.dateOfBirth ?
        Math.floor((new Date().getTime() - new Date(client.dateOfBirth).getTime()) / 3.15576e10) :
        '?'
    } yrs)
</span>
```

**Existing utility function (not used here):**

```typescript
// frontend/src/lib/utils/formatters.ts:23-31
export function calculateAge(dob?: string): number | null {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
}
```

**The client detail page already uses this utility correctly:**

```typescript
// frontend/src/app/dashboard/clients/[id]/page.tsx:28
import { getInitials, calculateAge } from '@/lib/utils/formatters';

// frontend/src/app/dashboard/clients/[id]/page.tsx:137
const age = calculateAge(client.dateOfBirth);
```

### Impact on Users

- **Potential inaccuracy:** The magic number approach divides total milliseconds by an average
  year length. It does not account for timezone offsets, DST transitions, or the exact
  birthday boundary. A client born on Feb 28 could show as one year older or younger than
  expected around their birthday. The `calculateAge` utility handles the month/day comparison
  correctly.
- **Inconsistent age display:** The same client could show a different age on the client detail
  page vs. the diet plan builder if they are near their birthday, because two different
  calculation methods are used.
- **Maintenance burden:** If the age calculation logic needs to change (e.g., to handle
  null dates differently), it must be found and changed in multiple places.

### The Fix

Import and use the existing `calculateAge` utility.

```tsx
// frontend/src/app/dashboard/diet-plans/new/page.tsx

// Add import at the top:
import { calculateAge } from '@/lib/utils/formatters';

// Replace the inline calculation (line 83-85):
// Before:
<span className="text-gray-600 text-sm">
    {client.fullName} ({client.dateOfBirth ?
        Math.floor((new Date().getTime() - new Date(client.dateOfBirth).getTime()) / 3.15576e10) :
        '?'
    } yrs)
</span>

// After:
<span className="text-gray-600 text-sm">
    {client.fullName} ({calculateAge(client.dateOfBirth) ?? '?'} yrs)
</span>
```

This is a one-line change that improves readability, correctness, and consistency.

---

## 7.6 LOW: Color Constants Hardcoded

**Files:** 25 files across `frontend/src/` (194 total occurrences)

### The Problem

The brand color `#17cf54` is hardcoded as a string literal in approximately 194 places across
25 frontend files. This includes buttons, focus rings, hover states, loading spinners, text
accents, and backgrounds. The Tailwind config does not define a brand color, so every usage is a
raw hex value embedded in className strings.

**Examples of hardcoded color across the codebase:**

```tsx
// frontend/src/app/dashboard/diet-plans/[id]/page.tsx:78
<Loader2 className="w-8 h-8 animate-spin text-[#17cf54]" />

// frontend/src/app/dashboard/diet-plans/[id]/page.tsx:116
className="... focus:ring-2 focus:ring-[#17cf54] focus:border-transparent outline-none"

// frontend/src/app/dashboard/diet-plans/[id]/page.tsx:126
className="px-3 py-1 bg-[#17cf54] text-white text-sm font-medium rounded-lg hover:bg-[#17cf54]/90 ..."

// frontend/src/app/dashboard/diet-plans/[id]/page.tsx:181
className="px-4 py-2 bg-[#17cf54] text-white font-medium rounded-lg hover:bg-[#17cf54]/90 ..."

// frontend/src/app/dashboard/diet-plans/[id]/page.tsx:290
className="text-xs font-semibold text-[#17cf54] mb-1"

// frontend/src/app/dashboard/diet-plans/new/page.tsx:103
className="... bg-[#17cf54] hover:bg-[#17cf54]/90 text-white ..."

// frontend/src/app/dashboard/diet-plans/new/page.tsx:121
className="... bg-[#17cf54] hover:bg-[#17cf54]/90 text-white ..."

// frontend/src/components/error-boundary.tsx:48
className="px-4 py-2 bg-[#17cf54] text-white rounded-lg ..."
```

**Current Tailwind config has no brand color:**

```typescript
// frontend/tailwind.config.ts
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // No brand color defined
      },
    },
  },
  plugins: [],
};
```

### Impact on Users

- **Brand consistency risk:** If the brand color needs to change (even slightly), a developer
  must find-and-replace across 25 files and 194 locations. Missing even one creates a visual
  inconsistency.
- **Opacity variants are fragile:** Many usages rely on Tailwind's arbitrary value syntax with
  opacity modifiers like `bg-[#17cf54]/90`. If the color changes, every opacity variant must
  also be updated.
- **Dark mode becomes impractical:** Adding dark mode would require finding all 194 hardcoded
  values and adding conditional dark variants. A theme variable would make this trivial.

### The Fix

Define the brand color in the Tailwind config and replace all hardcoded values.

**Step 1: Add brand color to Tailwind config:**

```typescript
// frontend/tailwind.config.ts
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          DEFAULT: '#17cf54',
          50:  '#edfff3',
          100: '#d5ffe4',
          200: '#aeffcb',
          300: '#6fffa3',
          400: '#33f57e',
          500: '#17cf54',   // Primary brand color
          600: '#0ba843',
          700: '#0d8438',
          800: '#106830',
          900: '#0e5629',
          950: '#013014',
        },
      },
    },
  },
  plugins: [],
};
```

**Step 2: Replace hardcoded values throughout the codebase:**

```tsx
// Before (repeated 194 times in various forms):
className="bg-[#17cf54] text-white"
className="text-[#17cf54]"
className="bg-[#17cf54]/90"
className="focus:ring-[#17cf54]"

// After:
className="bg-brand text-white"
className="text-brand"
className="bg-brand/90"
className="focus:ring-brand"
```

**Step 3: Verify with a project-wide search that no occurrences remain:**

```bash
# Run from frontend directory:
grep -rn "#17cf54" src/
# Should return 0 results after the migration
```

**Affected files (all 25):**

| File | Occurrences |
|------|-------------|
| `components/modals/add-client-modal.tsx` | 11 |
| `app/page.tsx` | 37 |
| `app/dashboard/diet-plans/page.tsx` | 14 |
| `app/dashboard/reviews/page.tsx` | 10 |
| `app/dashboard/page.tsx` | 10 |
| `app/dashboard/food-library/page.tsx` | 9 |
| `app/dashboard/clients/page.tsx` | 8 |
| `components/modals/create-food-item-modal.tsx` | 7 |
| `components/modals/add-food-modal.tsx` | 6 |
| `app/dashboard/diet-plans/[id]/page.tsx` | 6 |
| `app/dashboard/analytics/page.tsx` | 6 |
| `app/dashboard/clients/[id]/page.tsx` | 24 |
| `app/dashboard/settings/page.tsx` | 11 |
| `app/dashboard/team/page.tsx` | 5 |
| `app/join/page.tsx` | 5 |
| `components/diet-plan/meal-editor.tsx` | 5 |
| `components/diet-plan/template-sidebar.tsx` | 4 |
| `app/dashboard/diet-plans/new/page.tsx` | 3 |
| `components/diet-plan/nutrition-summary.tsx` | 2 |
| `components/diet-plan/client-selector.tsx` | 6 |
| `components/diet-plan/client-info-card.tsx` | 1 |
| `components/diet-plan/day-navigator.tsx` | 1 |
| `components/diet-plan/medical-sidebar.tsx` | 1 |
| `components/error-boundary.tsx` | 1 |
| `lib/hooks/use-validation.ts` | 1 |

---

## Summary Table

| ID  | Severity | Issue | Root Cause | Files Affected |
|-----|----------|-------|------------|----------------|
| 7.1 | HIGH | `title`/`name` field confusion | Frontend invented `title`, backend uses `name` | `use-diet-plans.ts`, `diet-plans/page.tsx`, `use-meal-builder.ts` |
| 7.2 | HIGH | `MealFoodItem` type mismatch | Type says `caloriesPer100g`, backend sends `calories` | `use-diet-plans.ts`, any component rendering food nutrition |
| 7.3 | MEDIUM | `scheduledTime` does not exist on Meal | Copied field name from `MealLog` model instead of `Meal` model | `diet-plans/[id]/page.tsx`, `use-diet-plans.ts` |
| 7.4 | MEDIUM | Single error boundary for all routes | No granular error isolation | `layout.tsx`, `diet-plans/new/page.tsx`, `diet-plans/[id]/page.tsx` |
| 7.5 | MEDIUM | Magic number for age calculation | `calculateAge` utility exists but not imported | `diet-plans/new/page.tsx` |
| 7.6 | LOW | 194 hardcoded `#17cf54` across 25 files | No Tailwind theme color defined | 25 files across `frontend/src/` |
