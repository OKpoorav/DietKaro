# Module 1: Backend Architecture Refactoring

**Priority:** P0
**Effort:** 5-6 days
**Impact:** Fixes SRP, DRY, testability across the entire backend

---

## Current State

The backend follows an MVC-ish pattern where **all 16 controllers call Prisma directly**, bypassing any service abstraction. Only 6 services exist (compliance, foodTagging, notification, onboarding, storage, validationEngine), leaving the core CRUD domains without a service layer.

```
Current:  Routes -> Controllers -> Prisma (direct)
                        |
                    Services (partial, only for complex logic)

Target:   Routes -> Controllers -> Services -> Prisma
```

---

## What Needs To Be Done

### 1. Extract Service Layer for Core Domains

Each service should own all Prisma calls and business logic for its domain. Controllers should only handle request parsing, calling the service, and formatting the response.

#### 1.1 Create `ClientService` (`backend/src/services/client.service.ts`)

**Extract from:** `client.controller.ts` (328 lines)

| Method | Logic to extract | Source lines |
|--------|-----------------|--------------|
| `createClient(data, orgId, userId)` | Client creation + referral code generation | controller lines 43-137 |
| `generateUniqueReferralCode()` | Referral code loop with uniqueness check | controller lines 13-41 |
| `getClients(orgId, filters)` | List with pagination, search, status filter | controller list handler |
| `getClientById(clientId, orgId)` | Single client fetch with relations | controller get handler |
| `updateClient(clientId, data, orgId)` | Partial update | controller update handler |
| `deleteClient(clientId, orgId)` | Soft delete | controller delete handler |
| `getClientProgress(clientId, orgId)` | Weight trend + meal adherence calculation | controller lines 248-327 |
| `processReferralBenefit(referrerId)` | Referral count tracking and benefit tier logic | controller lines 102-128 |

**Key rule:** The referral benefit tier (`Math.floor(count / 3)`) should become a configurable constant, not hardcoded.

#### 1.2 Create `DietPlanService` (`backend/src/services/dietPlan.service.ts`)

**Extract from:** `dietPlan.controller.ts` (268 lines)

| Method | Logic to extract |
|--------|-----------------|
| `createPlan(data, orgId, userId)` | Nested meal + food item creation in transaction |
| `getPlan(planId, orgId)` | Fetch with nested meals/foods/nutrition |
| `updatePlan(planId, data, orgId)` | Metadata update |
| `publishPlan(planId, orgId)` | Status change + meal log generation |
| `assignTemplateToClient(planId, clientId, orgId)` | Template cloning with nested object mapping (lines 189-267) |
| `deletePlan(planId, orgId)` | Soft delete |

#### 1.3 Create `MealLogService` (`backend/src/services/mealLog.service.ts`)

**Extract from:** `mealLog.controller.ts` (319 lines)

| Method | Logic to extract |
|--------|-----------------|
| `getMealLogs(filters, orgId)` | List with date/status filtering |
| `getMealLog(mealLogId, orgId)` | Single log with nutrition calculation (lines 124-143) |
| `updateMealLog(mealLogId, data)` | Status update + compliance trigger |
| `reviewMealLog(mealLogId, feedback, userId)` | Dietitian review + notification |
| `calculateNutrition(mealLog)` | Nutrition math currently inline |

#### 1.4 Create `WeightLogService` (`backend/src/services/weightLog.service.ts`)

**Extract from:** `weightLog.controller.ts`

| Method | Logic to extract |
|--------|-----------------|
| `createWeightLog(data, clientId, orgId)` | BMI calculation, weight change from previous, outlier detection |
| `getWeightLogs(clientId, dateRange)` | List with trend data |
| `getWeightStats(clientId)` | Aggregated statistics |

#### 1.5 Create `FoodItemService` (`backend/src/services/foodItem.service.ts`)

**Extract from:** `foodItem.controller.ts` (620 lines)

| Method | Logic to extract |
|--------|-----------------|
| `searchFoodItems(query, orgId, filters)` | Search with org-scoped + global foods |
| `createFoodItem(data, orgId, userId)` | Creation + auto-tagging trigger |
| `updateFoodItem(foodId, data, orgId)` | Update + re-tag |
| `calculateScaledNutrition(food, quantityG)` | Nutrition scaling math (duplicated in 3 places) |

#### 1.6 Create `MealService` (`backend/src/services/meal.service.ts`)

**Extract from:** `meal.controller.ts` (94 lines)

| Method | Logic to extract |
|--------|-----------------|
| `addFoodToMeal(mealId, foodId, quantity)` | Food item addition with nutrition calc |
| `updateMeal(mealId, data)` | Meal metadata update |
| `removeFoodFromMeal(mealId, foodItemId)` | Deletion |

---

### 2. Create Shared Utilities

#### 2.1 Nutrition Calculator (`backend/src/utils/nutritionCalculator.ts`)

Currently duplicated in 3+ controllers:

```typescript
// Extract this repeated pattern:
export function scaleNutrition(food: FoodItem, quantityG: number) {
  const multiplier = quantityG / (food.servingSizeG || 100);
  return {
    calories: Math.round((food.calories || 0) * multiplier),
    proteinG: Math.round(((food.proteinG || 0) * multiplier) * 10) / 10,
    carbsG: Math.round(((food.carbsG || 0) * multiplier) * 10) / 10,
    fatsG: Math.round(((food.fatsG || 0) * multiplier) * 10) / 10,
    fiberG: Math.round(((food.fiberG || 0) * multiplier) * 10) / 10,
  };
}
```

#### 2.2 Query Filter Builder (`backend/src/utils/queryFilters.ts`)

Currently duplicated in 5+ controllers:

```typescript
// Extract repeated date/status/search filtering:
export function buildDateFilter(dateFrom?: string, dateTo?: string) { ... }
export function buildPaginationParams(page?: string, pageSize?: string) { ... }
export function buildSearchFilter(search?: string, fields: string[]) { ... }
```

#### 2.3 Response Helpers (`backend/src/utils/responseHelpers.ts`)

```typescript
// Standardize pagination meta across all list endpoints:
export function paginatedResponse<T>(data: T[], total: number, page: number, pageSize: number) { ... }
```

---

### 3. Standardize Service Export Pattern

Currently inconsistent:
- Some export singletons: `export const complianceService = new ComplianceService()`
- Some export objects: `export const StorageService = { ... }`
- Some export classes with no instantiation

**Standard to follow:**
```typescript
// All services: export class + singleton instance
export class ClientService {
  async createClient(...) { ... }
}
export const clientService = new ClientService();
```

---

### 4. Extract Test Routes from `app.ts`

Lines 74-187 of `app.ts` contain test-only routes with inline Prisma calls and controller imports. Move to:
- `backend/src/routes/test.routes.ts` (gated by `NODE_ENV !== 'production'`)

---

### 5. Add Missing Middleware

| Middleware | Purpose | File |
|-----------|---------|------|
| Request ID | Correlation ID for log tracing | `middleware/requestId.middleware.ts` |
| Rate Limiting | Protect against abuse | `middleware/rateLimit.middleware.ts` |
| Request Timeout | Prevent hanging requests | `middleware/timeout.middleware.ts` |

---

### 6. Standardize Validation Schema Usage

Currently some routes apply Zod validation, others accept raw `req.body`. Ensure every POST/PATCH route uses the `validate()` middleware from `validation.middleware.ts`.

**Audit needed:** Check each route file for missing `validate(schema)` calls.

---

## Definition of Done

- [ ] All 6 new services created with extracted logic
- [ ] Controllers reduced to <80 lines each (request parsing + service call + response)
- [ ] Zero direct Prisma imports in controllers
- [ ] Shared utilities created (nutrition, filters, response)
- [ ] Consistent service export pattern
- [ ] Test routes extracted from app.ts
- [ ] All routes use Zod validation middleware
- [ ] Existing functionality unchanged (no regressions)
