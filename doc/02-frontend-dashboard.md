# Module 2: Frontend Dashboard Refactoring

**Priority:** P1
**Effort:** 3-4 days
**Impact:** Maintainability, component reusability, developer velocity

---

## Current State

The Next.js 14 dashboard has good foundational patterns (React Query hooks, Clerk auth, Modal component) but suffers from one monolithic page component, dead code, duplicated helpers, and missing error boundaries.

---

## What Needs To Be Done

### 1. Refactor `diet-plans/new/page.tsx` (830 lines -> ~250 + components)

**File:** `frontend/src/app/dashboard/diet-plans/new/page.tsx`

This is the single biggest maintainability problem in the frontend. It handles 7 concerns in one file.

#### 1.1 Extract `useMealBuilder` Hook

**Create:** `frontend/src/lib/hooks/use-meal-builder.ts`

Move all state and handlers (~300 lines) from the page:
- `weeklyMeals` state and setters
- `selectedDay` state
- `activeMealId`, `showAddFoodModal` state
- `handleAddFood()`, `handleRemoveFood()`, `handleUpdateQuantity()`
- `handleApplyTemplate()` (82 lines alone)
- `handleSave()` / `handlePublish()` (59 lines)
- Nutrition calculation logic

The hook should return:
```typescript
{
  weeklyMeals, selectedDay, setSelectedDay,
  activeMealId, setActiveMealId,
  addFood, removeFood, updateFoodQuantity,
  applyTemplate, isApplyingTemplate,
  save, publish, isSaving,
  dailyNutrition, // computed from weeklyMeals
}
```

#### 1.2 Extract Components

| Component | Source Lines | New File |
|-----------|-------------|----------|
| `<ClientSelector />` | 114-174 | `components/diet-plan/client-selector.tsx` |
| `<DayNavigator />` | 617-658 | `components/diet-plan/day-navigator.tsx` |
| `<MealEditor />` | 660-756 | `components/diet-plan/meal-editor.tsx` |
| `<NutritionSummary />` | 777-806 | `components/diet-plan/nutrition-summary.tsx` |
| `<TemplateSidebar />` | 579-611 | `components/diet-plan/template-sidebar.tsx` |
| `<ClientInfoCard />` | 548-561 | `components/diet-plan/client-info-card.tsx` |

After extraction, `diet-plans/new/page.tsx` should be ~200-250 lines: layout grid + component composition.

---

### 2. Remove Dead Code

#### 2.1 Delete `frontend/src/lib/api/client.ts`

This file creates a static axios instance that is **never used**. The actual API client is the hook-based one in `use-api-client.ts`. This file is misleading and confusing.

#### 2.2 Remove Unused `isPublicRoute` in `middleware.ts`

`isPublicRoute` is defined on line 4 but never referenced. Either use it or remove it.

---

### 3. Extract Shared Helper Functions

**Create:** `frontend/src/lib/utils/formatters.ts`

These functions are duplicated across 3+ pages:

```typescript
// Currently duplicated in: clients/page.tsx, clients/[id]/page.tsx, diet-plans/new/page.tsx
export function getInitials(name: string): string { ... }

// Currently duplicated in: dashboard/page.tsx, clients/page.tsx (as formatLastActivity)
export function formatTimeAgo(date: Date | string): string { ... }

// Currently in: clients/[id]/page.tsx only, but reusable
export function calculateAge(dob: string): number | null { ... }
```

Then update all pages to import from `@/lib/utils/formatters`.

---

### 4. Add Global Error Boundary

**Create:** `frontend/src/components/error-boundary.tsx`

Currently no React error boundary exists. If any component throws during render, the entire app crashes with no recovery.

```
Where to add:
- frontend/src/app/layout.tsx (wrap children)
- OR frontend/src/app/dashboard/layout.tsx (wrap dashboard)
```

The error boundary should:
- Catch render errors
- Show a user-friendly fallback UI
- Provide a "Try Again" button that resets the error state
- Log errors for debugging

---

### 5. Fix Hook Inconsistencies

#### 5.1 Type Confusion in `use-diet-plans.ts`

The hook has a `name` vs `title` confusion (acknowledged in a comment on line 31-32). The `CreateDietPlanInput` requires manual `name -> title` mapping in the mutation. Standardize to one field name across the API and frontend.

#### 5.2 Unused `queryClient` in `use-team.ts`

The `useTeam` hook doesn't use `queryClient` for mutations (inconsistent with all other hooks). Add cache invalidation on team mutations.

#### 5.3 Ephemeral Validation Cache in `use-validation.ts`

Validation results are stored in `useState` which resets on component remount. Consider:
- Using React Query's cache instead
- Or persisting to `sessionStorage`

Also add a cache size limit to prevent unbounded growth.

---

### 6. Create Hook Factory Pattern (Optional, P2)

All 8 hooks follow the same structure. A factory would reduce boilerplate:

**Create:** `frontend/src/lib/hooks/use-resource.ts`

```typescript
// Generic factory for list + CRUD hooks
export function useListResource<T>(resourceKey: string, endpoint: string, options?) { ... }
export function useMutateResource<T>(resourceKey: string, endpoint: string) { ... }
```

This would cut ~40% of code from each hook file.

---

### 7. Enhance Middleware

**File:** `frontend/src/middleware.ts`

Current middleware only calls `auth.protect()` which throws an error. It should redirect unauthenticated users:

```typescript
// Add redirect to sign-in instead of throwing
if (isProtectedRoute(request)) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }
}
```

---

### 8. Component Extraction for Client Detail Page

**File:** `frontend/src/app/dashboard/clients/[id]/page.tsx` (279 lines)

- Tab navigation buttons exist (lines 184-196) but no state/switching logic is implemented
- Extract tab content into separate components when implementing

---

## Definition of Done

- [ ] `diet-plans/new/page.tsx` reduced to ~250 lines with extracted components + hook
- [ ] 6 new components in `components/diet-plan/`
- [ ] `useMealBuilder` hook created
- [ ] Dead `lib/api/client.ts` removed
- [ ] Shared formatters extracted to `lib/utils/formatters.ts`
- [ ] All pages import from shared formatters (no duplicated helpers)
- [ ] Global error boundary added
- [ ] Hook type inconsistencies fixed
- [ ] Middleware redirect logic added
- [ ] Unused `isPublicRoute` removed or used
