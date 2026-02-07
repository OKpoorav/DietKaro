# Module 6: Compliance Service

**Priority:** P0 (Critical)
**Effort:** 2-3 days
**Impact:** Core feature - measures how well clients follow their diet plans

---

## Current State

- Schema fields exist: `MealLog.complianceScore`, `MealLog.complianceColor`, `MealLog.complianceIssues`
- A `compliance.service.ts` file exists (108 lines) with basic `calculateCompliance()` and `calculateDailyAdherence()`
- But the service is incomplete: scoring is basic, no weekly aggregation, thresholds are hardcoded, and it's not auto-triggered

---

## What Needs To Be Done

### 1. Complete `ComplianceService` Methods

**File:** `backend/src/services/compliance.service.ts`

#### 1.1 Enhance `calculateMealCompliance(mealLog)`

Current implementation needs to score these factors:

| Factor | Points | Condition |
|--------|--------|-----------|
| Meal eaten on time | +20 | `loggedAt` within 30 min of `scheduledTime` |
| Photo uploaded | +15 | `mealPhotoUrl` is not null |
| Correct foods eaten | +30 | Status is `eaten` (not `substituted` or `skipped`) |
| Portion accuracy | +20 | No `complianceIssues` flagging portion problems |
| Dietitian approved | +15 | `dietitianFeedback` exists and is positive |
| Substitution made | -10 | Status is `substituted` |
| Skipped meal | =0 | Status is `skipped` (score is zero) |

**Total possible: 100 points per meal**

**Color mapping (make configurable):**
- GREEN: score >= 85
- YELLOW: score >= 60 and < 85
- RED: score < 60

#### 1.2 Implement `calculateDailyAdherence(clientId, date)`

```
Input: clientId, date
Process:
  1. Fetch all MealLogs for client on that date
  2. Calculate compliance score for each meal
  3. Return:
     - averageScore: mean of all meal scores
     - mealsLogged: count of non-pending meals
     - mealsTotal: total meals for the day
     - adherencePercentage: mealsLogged / mealsTotal * 100
     - color: based on averageScore
```

#### 1.3 Implement `calculateWeeklyAdherence(clientId, weekStartDate)`

```
Input: clientId, weekStartDate
Process:
  1. Get daily adherence for 7 days
  2. Return:
     - dailyBreakdown: array of 7 daily adherence objects
     - weeklyAverage: mean of daily averages
     - bestDay: highest scoring day
     - worstDay: lowest scoring day
     - totalMealsLogged: sum across week
     - totalMealsPlanned: sum across week
     - overallAdherencePercentage
     - trend: "improving" | "declining" | "stable" (compare to previous week)
```

#### 1.4 Implement `getClientComplianceHistory(clientId, dateRange)`

```
Input: clientId, startDate, endDate
Process:
  1. Get weekly adherence for each week in range
  2. Return array of weekly summaries for chart data
```

---

### 2. Make Thresholds Configurable

**Problem:** Compliance thresholds are hardcoded (lines 33-58 in current service):
- `variance > 0.2` (20%)
- `variance > 0.1` (10%)
- Score penalties: `10`, `30 * count`
- RED: `< 60`, YELLOW: `< 85`

**Create:** `backend/src/config/compliance.config.ts`

```typescript
export const COMPLIANCE_CONFIG = {
  // Scoring weights
  WEIGHT_ON_TIME: Number(process.env.COMPLIANCE_WEIGHT_ON_TIME) || 20,
  WEIGHT_PHOTO: Number(process.env.COMPLIANCE_WEIGHT_PHOTO) || 15,
  WEIGHT_CORRECT_FOODS: Number(process.env.COMPLIANCE_WEIGHT_CORRECT_FOODS) || 30,
  WEIGHT_PORTION: Number(process.env.COMPLIANCE_WEIGHT_PORTION) || 20,
  WEIGHT_APPROVED: Number(process.env.COMPLIANCE_WEIGHT_APPROVED) || 15,
  PENALTY_SUBSTITUTION: Number(process.env.COMPLIANCE_PENALTY_SUB) || 10,

  // Color thresholds
  GREEN_THRESHOLD: Number(process.env.COMPLIANCE_GREEN) || 85,
  YELLOW_THRESHOLD: Number(process.env.COMPLIANCE_YELLOW) || 60,

  // Time tolerance
  ON_TIME_TOLERANCE_MINUTES: Number(process.env.COMPLIANCE_TIME_TOLERANCE) || 30,
};
```

---

### 3. Auto-Trigger Compliance Calculation

**Problem:** Compliance calculation must run automatically when a meal log status changes, not be manually called.

#### 3.1 Trigger Points

Add compliance recalculation in these places:

| Trigger | Location | When |
|---------|----------|------|
| Meal logged | `mealLog.controller.ts` PATCH handler | When `status` changes to `eaten`/`skipped`/`substituted` |
| Photo uploaded | `mealLog.controller.ts` photo handler | When `mealPhotoUrl` is set |
| Dietitian review | `mealLog.controller.ts` review handler | When `dietitianFeedback` is set |

**Implementation:** After each trigger, call:
```typescript
const score = await complianceService.calculateMealCompliance(updatedMealLog);
await prisma.mealLog.update({
  where: { id: mealLogId },
  data: {
    complianceScore: score.score,
    complianceColor: score.color,
    complianceIssues: score.issues,
  }
});
```

**Better approach (once service layer is extracted):** This logic lives in `MealLogService.updateStatus()` which calls `complianceService` internally.

---

### 4. Create Compliance API Endpoints

**Create:** `backend/src/routes/compliance.routes.ts`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/clients/:clientId/adherence/daily?date=` | Daily adherence for a specific date |
| GET | `/api/v1/clients/:clientId/adherence/weekly?weekStart=` | Weekly adherence summary |
| GET | `/api/v1/clients/:clientId/adherence/history?from=&to=` | Compliance history for charts |

**Create:** `backend/src/controllers/compliance.controller.ts`

Thin controller that delegates to `complianceService` methods.

---

### 5. Frontend: Display Compliance Data

#### 5.1 Client Detail Page

**File:** `frontend/src/app/dashboard/clients/[id]/page.tsx`

Add a compliance section showing:
- Weekly adherence percentage (large number)
- Daily breakdown (7 colored dots: green/yellow/red)
- Trend indicator (arrow up/down/flat)
- "This week vs last week" comparison

#### 5.2 Dashboard Page

**File:** `frontend/src/app/dashboard/page.tsx`

Add to the dashboard overview:
- Average adherence across all clients
- Clients with declining adherence (alert list)
- Top performing clients

#### 5.3 Create Compliance Hook

**Create:** `frontend/src/lib/hooks/use-compliance.ts`

```typescript
export function useDailyAdherence(clientId: string, date: string) { ... }
export function useWeeklyAdherence(clientId: string, weekStart: string) { ... }
export function useComplianceHistory(clientId: string, from: string, to: string) { ... }
```

---

### 6. Mobile App: Show Compliance to Client

#### 6.1 Progress Screen

**File:** `client-app/app/(tabs)/progress/index.tsx`

Show the client their own compliance:
- This week's adherence percentage
- Daily meal completion status
- Streak counter (consecutive days with 100% logging)

#### 6.2 Home Screen Enhancement

**File:** `client-app/app/(tabs)/home/index.tsx`

Show today's adherence progress:
- "2 of 4 meals logged" progress bar
- Color-coded compliance after each meal

---

## Definition of Done

- [ ] `calculateMealCompliance()` scores all 7 factors with configurable weights
- [ ] `calculateDailyAdherence()` returns daily summary
- [ ] `calculateWeeklyAdherence()` returns weekly summary with trend
- [ ] `getClientComplianceHistory()` returns chart-ready data
- [ ] All thresholds configurable via config file / env vars
- [ ] Compliance auto-triggers on meal status change, photo upload, and review
- [ ] 3 API endpoints created (daily, weekly, history)
- [ ] Frontend hook created (`use-compliance.ts`)
- [ ] Client detail page shows weekly adherence
- [ ] Dashboard shows average adherence overview
- [ ] Mobile progress screen shows compliance
- [ ] Mobile home screen shows daily progress
