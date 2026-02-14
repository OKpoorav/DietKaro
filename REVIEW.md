# DietKaro - Comprehensive Code Audit

**Audited by:** Senior Developer Review
**Date:** 2026-02-14
**Scope:** Full-stack audit — Backend (Node/Express/Prisma), Frontend (Next.js), Client App (React Native/Expo)

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Critical / Breaking Issues](#1-critical--breaking-issues)
3. [Security Vulnerabilities](#2-security-vulnerabilities)
4. [Data Integrity Bugs](#3-data-integrity-bugs)
5. [Schema & Database Issues](#4-schema--database-issues)
6. [Backend Service Issues](#5-backend-service-issues)
7. [API & Route Issues](#6-api--route-issues)
8. [Frontend (Next.js) Issues](#7-frontend-nextjs-issues)
9. [Client App (React Native) Issues](#8-client-app-react-native-issues)
10. [Type Safety & Consistency Issues](#9-type-safety--consistency-issues)
11. [Performance Issues](#10-performance-issues)
12. [Missing Features / Incomplete Implementations](#11-missing-features--incomplete-implementations)
13. [Code Quality & Maintainability](#12-code-quality--maintainability)
14. [Recommendations Summary](#13-recommendations-summary)

---

## Executive Summary

DietKaro is a diet management platform with a Prisma/Express backend, Next.js admin dashboard, and Expo React Native client app. The codebase is feature-rich but has several **critical security flaws**, **data integrity bugs**, and **architectural gaps** that need immediate attention before production deployment.

**Severity breakdown:**
- **CRITICAL (must fix before launch):** 8 issues
- **HIGH (likely to cause bugs in production):** 14 issues
- **MEDIUM (code quality / reliability):** 18 issues
- **LOW (cleanup / best practices):** 12 issues

---

## 1. Critical / Breaking Issues

### 1.1 CRITICAL: Hardcoded JWT Secret with Weak Default
**File:** `backend/src/middleware/clientAuth.middleware.ts:15`
```typescript
const JWT_SECRET = process.env.CLIENT_JWT_SECRET || 'client-secret-change-in-production';
```
- The fallback `'client-secret-change-in-production'` is a **publicly visible secret** in the codebase.
- If `CLIENT_JWT_SECRET` is not set in production `.env`, any attacker can forge client JWT tokens and impersonate any client.
- **Impact:** Full authentication bypass for all client accounts.
- **Fix:** Remove the fallback. Throw at startup if env var is missing.

### 1.2 CRITICAL: No Rate Limiting on OTP Endpoint
**File:** `backend/src/routes/clientAuth.routes.ts`
- The OTP request endpoint has no rate limiting.
- An attacker can brute-force OTP codes (typically 4-6 digits = 10,000 to 1,000,000 combinations).
- An attacker can also trigger SMS flooding, costing money per SMS sent.
- **Fix:** Add rate limiting (e.g., max 3 OTP requests per phone per 5 minutes).

### 1.3 CRITICAL: XSS in PDF Print HTML Generator
**File:** `backend/src/utils/pdfGenerator.ts:350-364`
```typescript
<h1>${plan.name}</h1>
${plan.client?.fullName ? `<p class="subtitle">Prepared for: ${plan.client.fullName}</p>` : ''}
```
- User-provided values (`plan.name`, `client.fullName`, `meal.description`, `plan.notesForClient`) are interpolated directly into raw HTML without any escaping.
- An attacker can inject `<script>alert('xss')</script>` into a diet plan name and execute arbitrary JS when the print view is opened.
- This also applies to the `emailDietPlan` endpoint where `customMessage` is directly injected into email HTML: `<p>${customMessage}</p>`.
- **Fix:** HTML-escape all user-provided strings before interpolation into HTML.

### 1.4 CRITICAL: No Input Validation on Client API Routes
**File:** `backend/src/routes/clientApi.routes.ts`
- The `PATCH /meals/:mealLogId/log` endpoint accepts `status`, `photoUrl`, `notes`, `chosenOptionGroup` from `req.body` **without any Zod validation**.
- The `POST /weight-logs` endpoint has only manual `if (!weightKg || !logDate)` checks — no type validation, no range checks.
- The `PUT /preferences` endpoint passes `req.body` fields almost directly through.
- **Fix:** Apply Zod validation middleware to all client API routes.

### 1.5 CRITICAL: `updateClient` Passes Raw Body to Prisma
**File:** `backend/src/services/client.service.ts:152-168`
```typescript
async updateClient(clientId: string, updateData: any, orgId: string) {
    ...
    const client = await prisma.client.update({
        where: { id: clientId },
        data: updateData,  // <-- raw, unfiltered input
    });
}
```
- `updateData` is typed as `any` and passed directly to Prisma.
- An attacker can set arbitrary fields: `orgId`, `isActive`, `referralCode`, `createdByUserId`, `onboardingCompleted`, etc.
- **Impact:** Privilege escalation — a user could reassign a client to a different org, or activate/deactivate clients.
- **Fix:** Whitelist allowed fields before passing to Prisma.

### 1.6 CRITICAL: Missing `deletedAt` Filter in Queries
**Files:** Multiple services
- `MealService.updateMeal` and `MealService.deleteMeal` do not check `deletedAt` (soft-deleted meals can be updated/deleted).
- `MealLogService.createMealLog` checks the meal exists but doesn't filter by `isActive` on the diet plan.
- `DietPlanService.updatePlan` doesn't check `isActive` — soft-deleted plans can be updated.
- `WeightLog` routes in `clientApi.routes.ts` don't filter by `deletedAt`.
- **Fix:** Add `deletedAt: null` or `isActive: true` filters consistently across all queries.

### 1.7 CRITICAL: Referral Benefit Calculation Race Condition
**File:** `backend/src/services/client.service.ts:89-107`
```typescript
const benefit = await tx.referralBenefit.upsert({
    ...
    update: { referralCount: { increment: 1 } },
});
const newReferralCount = benefit.referralCount + 1; // BUG: uses pre-increment value
```
- The `upsert` returns the value **after** the database operation, but `update: { increment: 1 }` means `benefit.referralCount` is already the new value.
- Then `newReferralCount = benefit.referralCount + 1` adds 1 again, making it off-by-one.
- On `create`, `referralCount: 1` is set, but then `newReferralCount` becomes `1 + 1 = 2`.
- **Impact:** Free months are awarded too early.
- **Fix:** Use `benefit.referralCount` directly (it's already incremented by the upsert).

### 1.8 CRITICAL: `publishPlan` Doesn't Create MealLogs
**File:** `backend/src/services/dietPlan.service.ts:149-169`
```typescript
async publishPlan(planId: string, orgId: string) {
    ...
    return {
        ...
        mealLogsCreated: plan.meals.length, // LIES — no meal logs are actually created
    };
}
```
- The method reports `mealLogsCreated: plan.meals.length` but **never actually creates any MealLog records**.
- The client app's `GET /client/meals/today` relies on MealLogs existing, but generates synthetic `pending-{mealId}` IDs as a workaround.
- This results in a fragile, ad-hoc system where meal logs are lazily created when clients first interact with them.
- **Impact:** Compliance tracking, daily adherence, and statistics are unreliable until clients manually log meals.
- **Fix:** Actually create MealLog entries for each meal when a plan is published.

---

## 2. Security Vulnerabilities

### 2.1 HIGH: No Org-Scoping on Meal Operations
**File:** `backend/src/services/meal.service.ts:6-44`
- `addMealToPlan` checks `plan.orgId === orgId`, but the `body` parameter is typed as `any` with no validation.
- The `mealType` field is a free-form string, not validated against the `MealType` enum.
- A malicious user could pass `mealType: "anything"` and bypass DB enum constraints would catch it, but at the wrong layer.
- **Fix:** Validate `mealType` against the Prisma `MealType` enum before DB insertion.

### 2.2 HIGH: Client Auth Token Never Expires Properly
**File:** `backend/src/middleware/clientAuth.middleware.ts:70-72`
```typescript
export const signClientToken = (clientId: string): string => {
    return jwt.sign({ clientId }, JWT_SECRET, { expiresIn: '30d' });
};
```
- 30-day token expiry with no refresh mechanism and no token revocation.
- If a client's account is deactivated, their token still works for up to 30 days (the middleware checks `isActive` on each request, mitigating this partially).
- No token blacklisting or rotation.

### 2.3 HIGH: WhatsApp Share Link Phone Number Handling
**File:** `backend/src/controllers/share.controller.ts:218`
```typescript
const whatsappLink = `https://wa.me/${plan.client?.phone?.replace(/[^0-9]/g, '') || ''}?text=...`;
```
- If `phone` is `null`, this generates `https://wa.me/?text=...` — a broken link.
- No country code handling. Indian numbers need `91` prefix.
- The message text contains emojis that may not render in all contexts.

### 2.4 MEDIUM: `Math.random()` Used for Security-Sensitive IDs
**File:** `backend/src/services/client.service.ts:14-20`
```typescript
function generateReferralCode(): string {
    let code = '';
    for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
        code += REFERRAL_CHARS.charAt(Math.floor(Math.random() * REFERRAL_CHARS.length));
    }
    return code;
}
```
- `Math.random()` is not cryptographically secure.
- Referral codes could theoretically be predicted.
- **Fix:** Use `crypto.randomBytes()` or `crypto.randomInt()`.

### 2.5 MEDIUM: Unused `clerkClient` Import
**File:** `backend/src/middleware/auth.middleware.ts:2`
```typescript
import { clerkClient, getAuth } from '@clerk/express';
```
- `clerkClient` is imported but never used. This is a minor issue but indicates dead code.

### 2.6 MEDIUM: No CORS Configuration Visible
- No CORS middleware configuration found in `app.ts` or routes.
- The client app at `localhost:3000` and frontend at a different port/domain need proper CORS.
- **Fix:** Configure CORS explicitly with allowed origins.

---

## 3. Data Integrity Bugs

### 3.1 HIGH: Progress Calculation Only Works for Weight Loss
**File:** `backend/src/routes/clientApi.routes.ts:413-418`
```typescript
progressPercent = Math.min(100, Math.max(0,
    ((startWeight - currentWeight) / (startWeight - targetWeight)) * 100
));
```
- The `progress-summary` endpoint on the client API assumes weight **loss** only.
- If a client is trying to **gain** weight (e.g., underweight), progress shows 0% or negative.
- The backend `ClientService.getClientProgress` handles both directions correctly, but the client API endpoint doesn't.
- **Impact:** Underweight clients see broken progress data.

### 3.2 HIGH: Nutrition Field Mismatch Between Frontend and Backend
**File:** `frontend/src/lib/hooks/use-meal-builder.ts:286-289`
```typescript
calories: f.foodItem.calories * ratio,
protein: f.foodItem.protein * ratio, // "protein" doesn't exist on backend
carbs: f.foodItem.carbs * ratio,     // "carbs" doesn't exist
fat: f.foodItem.fat * ratio,         // "fat" doesn't exist
```
**Backend FoodItem fields:** `proteinG`, `carbsG`, `fatsG`
**Frontend expects:** `protein`, `carbs`, `fat`

- When applying a template, the frontend reads `f.foodItem.protein` which is `undefined` on the backend response (field is `proteinG`).
- All nutrition values become `NaN * ratio = NaN`.
- **Impact:** Template application shows 0/NaN calories for all foods.
- **Fix:** Map backend field names to frontend names in the template application code.

### 3.3 HIGH: `quantity` Field Ambiguity
- Backend `createDietPlanSchema` uses `quantity` (a number in grams).
- Frontend `LocalFoodItem.quantity` is a **string** like `"1 serving"` or `"200g"`.
- Frontend `LocalFoodItem.quantityValue` is the numeric value.
- When saving, `notes: f.quantity` sends the display string as notes, while `quantity: f.quantityValue` sends the number.
- But the nutrition calculation uses `f.calories` (which was calculated at food-add time based on 100g default), so changing quantity display text doesn't recalculate nutrition.
- **Impact:** If a user types "200g" in the quantity field, the calories still show the 100g value.

### 3.4 MEDIUM: Duplicate MealLog Prevention Is Weak
**File:** `backend/prisma/schema.prisma:471`
```prisma
@@unique([clientId, mealId, scheduledDate])
```
- The unique constraint prevents duplicate logs per meal per day.
- But `clientApi.routes.ts:176-211` manually checks for existing logs before creating — this is a race condition.
- Two concurrent requests could both pass the `findFirst` check and then one would fail at the DB constraint level.
- The error handling for the constraint violation is the generic error handler, not a user-friendly "already logged" message.

### 3.5 MEDIUM: Weight Trend Only Uses Last 2 Entries
**File:** `backend/src/routes/clientApi.routes.ts:369-373`
```typescript
if (weightLogs.length >= 2) {
    const diff = Number(weightLogs[0].weightKg) - Number(weightLogs[1].weightKg);
    if (diff > 0.5) weightTrend = 'up';
    else if (diff < -0.5) weightTrend = 'down';
}
```
- Trend is based on only the last 2 entries with a 0.5kg threshold.
- A single day's fluctuation (water weight, food weight) can flip the entire trend indicator.
- **Fix:** Use a rolling average (e.g., 7-day average vs previous 7-day average).

### 3.6 MEDIUM: `currentStreak` Calculation Is Fake
**File:** `backend/src/routes/clientApi.routes.ts:386`
```typescript
currentStreak: Math.min(eatenMeals, 7), // Simplified streak
```
- The streak is just `min(eatenMeals, 7)` — not an actual consecutive-day streak.
- A client who ate 5 meals on Monday and skipped Tuesday-Sunday gets streak = 5.
- **Impact:** Misleading gamification metric shown prominently on the home screen.

---

## 4. Schema & Database Issues

### 4.1 MEDIUM: `ActivityLevel` Enum Mismatch
**Prisma enum:**
```prisma
enum ActivityLevel {
  sedentary
  lightly_active
  moderately_active
  very_active
}
```
**Client schema validation (`client.schema.ts`):**
```typescript
activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active'])
```
- The enum values don't match: `light` vs `lightly_active`, `moderate` vs `moderately_active`, `active` vs `very_active` (only this one matches).
- **Impact:** Setting activity level via API will fail with a Prisma enum error for `light`, `moderate`, and `active`.

### 4.2 MEDIUM: `Decimal` Fields vs `number` Type in Zod Schemas
- Prisma uses `Decimal` type for weight, height, nutrition values.
- Zod schemas validate as `z.number()`.
- Prisma returns `Decimal` objects (not plain numbers) from queries.
- Frontend and client app do `Number(value)` conversions everywhere, which is fragile.
- Missing `Number()` conversions will result in `[object Object]` strings or NaN.

### 4.3 LOW: Missing Indexes
- `MealFoodItem` has no index on `createdByUserId`.
- `Meal.createdByUserId` has no index (could be useful for audit queries).
- `Client.dietPattern` has no index (used in validation queries).

### 4.4 LOW: `Invitation.status` Is a String, Not an Enum
**File:** `backend/prisma/schema.prisma:647`
```prisma
status String @default("pending") // pending, accepted, expired
```
- All other status fields use proper Prisma enums, but `Invitation.status` is a free-form string.
- **Fix:** Create an `InvitationStatus` enum.

### 4.5 LOW: `foodRestrictions` Uses JSON Type
**File:** `backend/prisma/schema.prisma:228`
```prisma
foodRestrictions Json @default("[]")
```
- Storing structured data as JSON loses type safety and query capability.
- Consider a separate `FoodRestriction` model if this data needs to be queried.

---

## 5. Backend Service Issues

### 5.1 HIGH: `compliance.service.ts` Has N+1 Query Problem in Weekly Adherence
**File:** `backend/src/services/compliance.service.ts:278-293`
```typescript
for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    const daily = await this.calculateDailyAdherence(clientId, day);
    dailyBreakdown.push(daily);
}
```
- Each `calculateDailyAdherence` call makes **2 separate database queries** (meal logs + active plan).
- Weekly adherence = 7 days * 2 queries = **14 database queries** per request.
- Plus 1 more query for previous week's trend.
- **Fix:** Fetch all meal logs for the week in a single query and process in memory.

### 5.2 HIGH: Compliance Score Is Misleading for Unreviewed Meals
**File:** `backend/src/services/compliance.service.ts:184-188`
- Factor 5 gives +15 points for dietitian approval, but logs "Awaiting dietitian review" as an issue.
- A perfectly eaten meal maxes out at 85/100 until a dietitian reviews it.
- This penalizes clients for something outside their control.
- **Fix:** Don't deduct points for missing review; add bonus points if reviewed.

### 5.3 MEDIUM: `mealLogService.updateMealLog` Does Unnecessary Re-fetch
**File:** `backend/src/services/mealLog.service.ts:211-218`
```typescript
const updated = await prisma.mealLog.update({ where: { id: mealLogId }, data: updateData });
...
const finalLog = await prisma.mealLog.findUnique({ where: { id: updated.id } }); // redundant
```
- After updating, it fetches the same record again. The `update` already returns the updated record.
- This pattern repeats in `reviewMealLog` and `uploadMealPhoto`.
- The re-fetch is needed because `complianceService.calculateMealCompliance` updates the same record.
- **Fix:** Have `calculateMealCompliance` return the updated values instead of requiring a re-fetch.

### 5.4 MEDIUM: `dietPlanService.updatePlan` Uses Fragile Spread Pattern
**File:** `backend/src/services/dietPlan.service.ts:131-141`
```typescript
data: {
    ...(data.name && { name: data.name }),
    ...(data.description !== undefined && { description: data.description }),
```
- `data.name &&` skips the update if name is an empty string `""`, but `description !== undefined` allows empty strings.
- Inconsistent handling: `name` can't be cleared to empty, but `description` can.
- **Fix:** Use `!== undefined` consistently for all fields.

### 5.5 MEDIUM: No Pagination Limit Cap
**File:** `backend/src/utils/queryFilters.ts` (referenced but not read)
- The `pageSize` parameter is taken from query strings with no upper bound validation visible.
- A client could request `pageSize=100000` and dump the entire database.
- **Fix:** Cap `pageSize` at a reasonable max (e.g., 100).

### 5.6 LOW: `FoodNutrition` Interface Uses `any` Type
**File:** `backend/src/utils/nutritionCalculator.ts:7-13`
```typescript
interface FoodNutrition {
    proteinG: number | null | any;  // `any` defeats the purpose
    carbsG: number | null | any;
    ...
}
```
- The `any` type is used alongside `number | null`, making the type annotation meaningless.
- This was likely added to handle Prisma `Decimal` types without proper conversion.
- **Fix:** Use `number | null | Prisma.Decimal`.

---

## 6. API & Route Issues

### 6.1 HIGH: Inline Business Logic in Route Files
**File:** `backend/src/routes/clientApi.routes.ts`
- This 587-line route file contains ~400 lines of business logic (stats calculation, progress summary, weight log creation with delta calculation).
- Routes for `/meals/today`, `/stats`, `/progress-summary`, `/weight-logs` all have complex inline logic.
- **Impact:** Untestable, hard to maintain, duplicates logic from services.
- **Fix:** Extract to `clientDashboard.service.ts` or similar.

### 6.2 HIGH: Import Ordering Issue
**File:** `backend/src/routes/clientApi.routes.ts:243`
```typescript
import { uploadSinglePhoto } from '../middleware/upload.middleware';
import { mealLogService } from '../services/mealLog.service';
```
- These imports appear **in the middle of the file** (after route handlers that use them via closure).
- While this works in practice (module-level imports are hoisted), it's confusing and against Node.js conventions.
- Same issue at line 461: `import { onboardingService }` and line 561: `import { complianceService }`.

### 6.3 MEDIUM: Missing `GET /client/meals/:mealLogId` Route
**File:** `backend/src/routes/clientApi.routes.ts`
- The client app's `useMealLog` hook calls `GET /client/meals/${mealLogId}` via `mealLogsApi.getMealLog()`.
- But no such GET route exists in `clientApi.routes.ts`.
- The only meal-related GET is `/meals/today`.
- **Impact:** Meal detail screen fails to load for non-pending meals.
- **Fix:** Either the route is defined in another file (check `mealLog.routes.ts`) or it needs to be added.

### 6.4 MEDIUM: Inconsistent Response Shapes
- Some endpoints return `{ success: true, data: ... }`.
- Some endpoints return `{ success: true, message: ... }`.
- Some services return raw data without wrapping.
- The frontend has to handle both `data.data` (nested) and `data` patterns.

### 6.5 LOW: No API Versioning Strategy
- API is at `/api/v1` but there's no mechanism for v2 migration.
- All routes are in a single version namespace.

---

## 7. Frontend (Next.js) Issues

### 7.1 HIGH: `title` / `name` Field Confusion
**File:** `frontend/src/lib/hooks/use-diet-plans.ts:142-144`
```typescript
const { title, ...rest } = planData;
const payload = { ...rest, name: title };
```
- Frontend uses `title` internally, backend uses `name`.
- The mapping happens in the mutation, but the `DietPlan` type has BOTH `name` and `title` as optional fields.
- This creates confusion: `plan.name` sometimes works, `plan.title` sometimes doesn't.
- Component code accesses `plan.name || 'Diet Plan'` directly.
- **Fix:** Standardize on one field name. Remove the duplicate.

### 7.2 HIGH: `MealFoodItem` Type Mismatch
**File:** `frontend/src/lib/hooks/use-diet-plans.ts:16-26`
```typescript
export interface MealFoodItem {
    foodItem: {
        caloriesPer100g: number;  // Backend returns "calories", not "caloriesPer100g"
        proteinPer100g: number;   // Backend returns "proteinG"
        carbsPer100g: number;     // Backend returns "carbsG"
        fatsPer100g: number;      // Backend returns "fatsG"
    };
}
```
- These field names don't match what the backend actually returns.
- This type is defined but it's unclear if it's actually used — the meal detail page uses `any` casts.
- **Impact:** TypeScript gives false confidence; runtime field access returns `undefined`.

### 7.3 MEDIUM: `diet-plans/[id]/page.tsx` Uses `scheduledTime` That Doesn't Exist
**File:** `frontend/src/app/dashboard/diet-plans/[id]/page.tsx:272-277`
```typescript
{meal.scheduledTime && (
    <p className="text-sm text-gray-500 flex items-center gap-1">
        <Clock className="w-4 h-4" />
        {meal.scheduledTime}
    </p>
)}
```
- The `Meal` model has `timeOfDay`, not `scheduledTime`. This will never render.

### 7.4 MEDIUM: Missing Error Boundaries
- No React error boundaries anywhere in the frontend.
- A single component crash (e.g., from `undefined.map()`) takes down the entire page.
- Critical for the diet plan builder which has complex state.

### 7.5 MEDIUM: Age Calculation Uses Magic Number
**File:** `frontend/src/app/dashboard/diet-plans/new/page.tsx:84`
```typescript
Math.floor((new Date().getTime() - new Date(client.dateOfBirth).getTime()) / 3.15576e10)
```
- `3.15576e10` is milliseconds in a year (365.25 days).
- Fragile, hard to read, and doesn't account for timezone issues.
- Used inline instead of the `calculateAge` utility that's imported elsewhere.

### 7.6 LOW: Color Constants Hardcoded
- The brand color `#17cf54` is hardcoded in ~30 places across the frontend.
- Should be a CSS variable or Tailwind theme color.

---

## 8. Client App (React Native) Issues

### 8.1 HIGH: Photo Upload Is Fire-and-Forget
**File:** `client-app/hooks/useMealLog.ts:38-52`
```typescript
// Upload photo if provided (fire-and-forget — meal log succeeds even if photo fails)
if (photoUri) {
    try {
        ...
        await mealLogsApi.uploadPhoto(actualId, formData);
    } catch (err) {
        console.warn('Photo upload failed, meal log was saved:', err);
    }
}
```
- Photo upload failure is silently swallowed.
- User sees "Meal logged successfully!" but their photo is lost.
- No retry mechanism.
- **Fix:** Show a warning toast if photo upload fails, with a retry option.

### 8.2 HIGH: `useMealLog` Invalidates Wrong Query Key
**File:** `client-app/hooks/useMealLog.ts:57-61`
```typescript
onSuccess: async (_, { mealLogId }) => {
    await queryClient.invalidateQueries({ queryKey: ['meals', 'today'] });
    await queryClient.refetchQueries({ queryKey: ['meals', 'today'] });
    queryClient.invalidateQueries({ queryKey: ['meal-log', mealLogId] });
```
- Both `invalidateQueries` and `refetchQueries` are called for `['meals', 'today']` — the refetch is redundant since invalidation already triggers a refetch for active queries.
- The `mealLogId` could be `pending-{mealId}`, but the created log has a UUID id. The invalidation key `['meal-log', 'pending-xxx']` won't match the new log's cache entry.

### 8.3 MEDIUM: No Offline Support
- All API calls fail silently or with generic errors when offline.
- No queuing mechanism for meal logs submitted offline.
- Weight logs, meal photos, and feedback are lost if submitted without connectivity.
- **Fix:** Add react-query's `onlineManager` and a pending queue with local persistence.

### 8.4 MEDIUM: Hardcoded `localhost` API URL
**File:** `client-app/services/api.ts:23`
```typescript
const API_BASE_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000/api/v1';
```
- Falls back to `localhost` in production builds if `apiUrl` is not configured.
- **Fix:** Throw an error if `apiUrl` is not set in production.

### 8.5 MEDIUM: `mealTypes` Array Includes 'Substituted'
**File:** `client-app/app/(tabs)/home/meal/[id].tsx:23`
```typescript
const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Substituted'] as const;
```
- 'Substituted' is a meal **status**, not a meal **type**.
- This appears in the meal type selector UI, which is confusing.
- **Fix:** Remove 'Substituted' from this list.

### 8.6 MEDIUM: No Image Compression Before Upload
- Photos are taken at quality 0.8 but no maximum dimension constraint.
- Modern phone cameras produce 12-50MP images; even at 0.8 quality, these can be 3-8MB.
- The API timeout is 60s for uploads, which may not be enough on slow connections.
- **Fix:** Resize images to a max dimension (e.g., 1920px) before upload.

### 8.7 LOW: TypeScript `as any` Casts in FormData
**File:** `client-app/hooks/useMealLog.ts:43-47`
```typescript
formData.append('photo', {
    uri: photoUri,
    name: 'meal-photo.jpg',
    type: 'image/jpeg',
} as any);
```
- React Native's FormData expects this non-standard object format, hence the `as any`.
- This is a known RN limitation but should be documented.

---

## 9. Type Safety & Consistency Issues

### 9.1 HIGH: Pervasive Use of `any` in Services
- `client.service.ts:34`: `createClient(data: any, ...)`
- `client.service.ts:121`: `listClients(orgId: string, query: any, ...)`
- `client.service.ts:152`: `updateClient(clientId: string, updateData: any, ...)`
- `meal.service.ts:6`: `addMealToPlan(body: any, ...)`
- `dietPlan.service.ts:94`: `listPlans(orgId: string, query: any)`
- `dietPlan.service.ts:171`: `assignTemplateToClient(templateId: string, body: any, ...)`
- `mealLog.service.ts:42`: `listMealLogs(orgId: string, query: any, ...)`
- **Impact:** No compile-time safety. Runtime errors instead of build errors.
- **Fix:** Use the Zod-inferred types (e.g., `CreateClientInput`) consistently.

### 9.2 MEDIUM: Duplicate Type Definitions
- `ComplianceColor`, `DailyAdherence`, `WeeklyAdherence`, `ComplianceHistory` are defined in:
  1. `backend/src/services/compliance.service.ts`
  2. `client-app/types/index.ts`
- `Meal`, `MealLog` are defined separately in:
  1. Backend Prisma types
  2. Frontend `use-diet-plans.ts`
  3. Client app `types/index.ts`
- No shared type package.

### 9.3 MEDIUM: Frontend `ClientData` vs Backend `Client`
- `frontend/src/lib/types/diet-plan.types.ts:7-31` defines `ClientData` with `medicalProfile?: { allergies?, conditions? }`.
- `frontend/src/lib/hooks/use-clients.ts:8-46` defines `Client` with `medicalProfile?: { allergies, conditions, medications }`.
- Backend returns the full `Client` model with `medicalProfile` relation.
- Multiple incomplete type definitions for the same entity.

### 9.4 LOW: Inconsistent Naming Conventions
- Backend: `fullName`, `timeOfDay`, `dayOfWeek`
- Frontend types: `scheduledTime` (doesn't exist), `title` (mapped to `name`)
- Client app: `mealType` (correct), `mealName` (derived)

---

## 10. Performance Issues

### 10.1 HIGH: `GET /client/meals/today` Fetches All Meals for All Days
**File:** `backend/src/routes/clientApi.routes.ts:22-39`
```typescript
const activePlan = await prisma.dietPlan.findFirst({
    where: { clientId, status: 'active', isActive: true },
    include: {
        meals: {  // ALL meals, not filtered by day
            include: {
                foodItems: { include: { foodItem: true } },
            },
        },
    },
});
```
- Fetches ALL meals from the active plan (potentially 28 meals for a 7-day plan) when only today's meals are needed.
- Each meal includes all food items with full food item details.
- **Fix:** Filter meals by `dayOfWeek` matching today or by `mealDate`.

### 10.2 MEDIUM: No Database Connection Pooling Configuration
- `prisma.ts` likely uses default connection pool settings.
- For production with multiple concurrent users, connection pool should be configured.

### 10.3 MEDIUM: Compliance History Queries Entire Month
**File:** `backend/src/services/compliance.service.ts:335-382`
- `getClientComplianceHistory` fetches all meal logs for 30 days and processes in memory.
- For active users with 4 meals/day, this is ~120 records per query.
- The grouping and averaging could be done in SQL.

### 10.4 LOW: No Response Caching
- Endpoints like `/client/stats`, `/client/adherence/daily` compute the same data on every request.
- Consider short-lived caching (e.g., 1-5 minutes) for dashboard stats.

---

## 11. Missing Features / Incomplete Implementations

### 11.1 No Meal Log Auto-Creation on Plan Publish
- When a plan is published, meal logs should be automatically created for the plan's duration.
- Currently, meal logs are created ad-hoc when clients interact with the home screen.

### 11.2 No Subscription Enforcement
- `Organization` has `subscriptionTier`, `subscriptionStatus`, `subscriptionExpiresAt`, `maxClients`.
- But no middleware or service checks these values.
- A free-tier org can have unlimited clients.

### 11.3 No Push Notification Implementation
- `User` and `Client` models have `pushTokens` fields.
- `Notification` model exists with full schema.
- But `notification.service.ts` likely doesn't implement actual push sending (Expo push).
- Notification creation and delivery pipeline is incomplete.

### 11.4 No File Upload Validation
- `upload.middleware.ts` is imported but its validation rules aren't visible.
- File type validation (only images), size limits, and malware scanning should be verified.

### 11.5 Invoice System Is Schema-Only
- `Invoice` model exists with complete schema.
- No controller, service, or routes for invoice management are visible in the modified files.

### 11.6 No Test Coverage
- Only one test file exists: `tests/validationEngine.test.ts`.
- No integration tests, no API tests, no frontend tests.
- **Impact:** Every deploy is a prayer.

### 11.7 Soft Delete Is Inconsistent
- Some models use `deletedAt` + `isActive` (Client, DietPlan, MealLog, FoodItem).
- Some only use `deletedAt` (Meal, WeightLog, BodyMeasurement, SessionNote).
- Some have no soft delete (Notification, ActivityLog, ReferralBenefit).
- Queries inconsistently filter by `isActive: true` vs `deletedAt: null`.

---

## 12. Code Quality & Maintainability

### 12.1 Large File Sizes
| File | Lines | Concern |
|------|-------|---------|
| `clientApi.routes.ts` | 587 | Should be split into route + service files |
| `client/[id]/page.tsx` | 800+ | Single component with 4 tab views |
| `meal/[id].tsx` | 773 | Two complete UIs in one component |
| `compliance.service.ts` | 409 | Could split daily/weekly/history into separate methods |

### 12.2 Console.log/warn in Production Code
- `console.error('Failed to publish plan:', err)` in frontend
- `console.warn('Photo upload failed...')` in client app
- `console.error('Auth middleware error:', error)` in backend
- **Fix:** Use structured logging (backend already has a `logger` utility).

### 12.3 No Environment Variable Validation
- No startup validation that required env vars exist.
- `DATABASE_URL`, `CLIENT_JWT_SECRET`, `CLERK_SECRET_KEY` could all be missing.
- **Fix:** Add a startup check (e.g., using `envalid` or a custom validator).

### 12.4 Backend XML File in Schemas Directory
**File:** `backend/src/schemas/backend.xml`
- A Repomix-generated XML dump sitting in the schemas directory.
- This should be in `.gitignore` or a docs folder, not in source code.

---

## 13. Recommendations Summary

### Immediate (Before Launch)
1. **Remove hardcoded JWT secret fallback** — throw if env var missing
2. **Add rate limiting** to OTP and auth endpoints
3. **HTML-escape** all user input in PDF/HTML generators
4. **Add Zod validation** to all client API routes
5. **Whitelist fields** in `updateClient` — never pass raw `any` to Prisma
6. **Fix referral count off-by-one** bug
7. **Create MealLogs on plan publish** — don't rely on lazy creation
8. **Fix `ActivityLevel` enum mismatch** between schema and Zod

### Short-Term (First Sprint Post-Launch)
1. **Fix nutrition field name mismatch** (`proteinG` vs `protein`)
2. **Add `deletedAt` filters** consistently across all queries
3. **Extract business logic** from `clientApi.routes.ts` into services
4. **Fix weight progress** calculation to handle both gain and loss in client API
5. **Add error boundaries** to frontend React components
6. **Implement proper streak calculation**
7. **Add API tests** for critical flows (create plan, log meal, compliance)

### Medium-Term (Next 2-3 Sprints)
1. **Optimize N+1 queries** in compliance service
2. **Add offline support** to client app
3. **Implement push notifications**
4. **Add subscription enforcement**
5. **Create shared type package** between frontend, backend, and client app
6. **Add database connection pool configuration**
7. **Image compression** before upload in client app
8. **Response caching** for dashboard endpoints

---

*This review covers the codebase as of 2026-02-14. Issues are prioritized by production impact.*
