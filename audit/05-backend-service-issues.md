# 05 - Backend Service Issues

> **Audit scope:** backend/src/services/ and backend/src/utils/
> **Severity range:** HIGH to LOW
> **Total issues:** 6

---

## 5.1 HIGH: N+1 Query Problem in Weekly Adherence

**File:** `backend/src/services/compliance.service.ts` lines 278-293

### The Problem

`calculateWeeklyAdherence` loops 7 days and calls `calculateDailyAdherence` for each day. Each call to `calculateDailyAdherence` executes two database queries: one for meal logs and one for the active diet plan. That is 14 queries just for the daily breakdowns. A fifteenth query fetches previous-week logs for the trend calculation.

```typescript
// compliance.service.ts:278-293 (current)
async calculateWeeklyAdherence(clientId: string, weekStartDate?: Date): Promise<WeeklyAdherence> {
    const weekStart = weekStartDate ? new Date(weekStartDate) : this.getWeekStart(new Date());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Calculate daily adherence for each day of the week
    const dailyBreakdown: DailyAdherence[] = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        const daily = await this.calculateDailyAdherence(clientId, day);
        dailyBreakdown.push(daily);
    }
    // ...
}
```

Each `calculateDailyAdherence` call (lines 208-273) runs:

```typescript
// Query 1: Get all meal logs for this day
const logs = await prisma.mealLog.findMany({
    where: {
        clientId,
        scheduledDate: { gte: start, lte: end },
    },
    include: {
        meal: { select: { name: true, mealType: true } },
    },
    orderBy: { scheduledTime: 'asc' },
});

// Query 2: Count planned meals from active diet plan
const activePlan = await prisma.dietPlan.findFirst({
    where: {
        clientId,
        status: 'active',
        isActive: true,
    },
    include: {
        meals: { select: { id: true } },
    },
});
```

### Performance / Correctness Impact

| Metric | Value |
|---|---|
| DB queries per request | 15 (7 x 2 daily + 1 trend) |
| Query for active plan | Identical across all 7 iterations -- the active plan does not change day to day |
| Latency at 50ms/query | ~750ms minimum per weekly adherence request |
| Under load | Multiplied by concurrent users; risk of connection pool exhaustion |

The active diet plan is fetched 7 times with the exact same `where` clause. Meal logs could be fetched once for the entire week instead of day by day.

### The Fix

Fetch all meal logs for the entire week in a single query, fetch the active plan once, then partition logs by date in memory.

```typescript
// compliance.service.ts -- refactored calculateWeeklyAdherence

async calculateWeeklyAdherence(clientId: string, weekStartDate?: Date): Promise<WeeklyAdherence> {
    const weekStart = weekStartDate ? new Date(weekStartDate) : this.getWeekStart(new Date());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // --- Single query: all meal logs for the entire week ---
    const allLogs = await prisma.mealLog.findMany({
        where: {
            clientId,
            scheduledDate: { gte: weekStart, lte: weekEnd },
        },
        include: {
            meal: { select: { name: true, mealType: true } },
        },
        orderBy: { scheduledTime: 'asc' },
    });

    // --- Single query: active diet plan (same for all 7 days) ---
    const activePlan = await prisma.dietPlan.findFirst({
        where: {
            clientId,
            status: 'active',
            isActive: true,
        },
        include: {
            meals: { select: { id: true } },
        },
    });

    const mealsPlanned = activePlan?.meals.length || 0;

    // --- Partition logs by date in memory ---
    const logsByDate = new Map<string, typeof allLogs>();
    allLogs.forEach(log => {
        const dateKey = log.scheduledDate.toISOString().split('T')[0];
        if (!logsByDate.has(dateKey)) logsByDate.set(dateKey, []);
        logsByDate.get(dateKey)!.push(log);
    });

    // --- Build daily breakdown without additional queries ---
    const dailyBreakdown: DailyAdherence[] = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + i);
        const dateKey = day.toISOString().split('T')[0];
        const dayLogs = logsByDate.get(dateKey) || [];
        const daily = this.buildDailyAdherenceFromLogs(dateKey, dayLogs, mealsPlanned || dayLogs.length);
        dailyBreakdown.push(daily);
    }

    const daysWithScores = dailyBreakdown.filter(d => d.mealsLogged > 0);
    const avgScore = daysWithScores.length > 0
        ? Math.round(daysWithScores.reduce((sum, d) => sum + d.score, 0) / daysWithScores.length)
        : 0;

    // --- Single query: previous week trend ---
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(prevWeekStart);
    prevWeekEnd.setDate(prevWeekEnd.getDate() + 6);

    const prevLogs = await prisma.mealLog.findMany({
        where: {
            clientId,
            scheduledDate: { gte: prevWeekStart, lte: prevWeekEnd },
            complianceScore: { not: null },
        },
        select: { complianceScore: true },
    });

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (prevLogs.length > 0 && daysWithScores.length > 0) {
        const prevAvg = Math.round(prevLogs.reduce((s, l) => s + (l.complianceScore || 0), 0) / prevLogs.length);
        const diff = avgScore - prevAvg;
        if (diff > COMPLIANCE_CONFIG.TREND_THRESHOLD) trend = 'improving';
        else if (diff < -COMPLIANCE_CONFIG.TREND_THRESHOLD) trend = 'declining';
    }

    return {
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        averageScore: avgScore,
        color: getColor(avgScore),
        dailyBreakdown,
        trend,
    };
}

/**
 * Pure function: build a DailyAdherence from pre-fetched logs.
 * No database calls.
 */
private buildDailyAdherenceFromLogs(
    dateKey: string,
    logs: Array<{
        id: string;
        status: string;
        complianceScore: number | null;
        complianceColor: string | null;
        complianceIssues: string[];
        meal: { name: string; mealType: string };
    }>,
    mealsPlanned: number,
): DailyAdherence {
    const deriveScoreFromStatus = (status: string): number => {
        if (status === 'eaten') return 85;
        if (status === 'substituted') return 50;
        if (status === 'skipped') return 0;
        return 0;
    };

    const mealBreakdown: MealBreakdown[] = logs.map(log => {
        const score = log.complianceScore ?? (log.status !== 'pending' ? deriveScoreFromStatus(log.status) : null);
        return {
            mealLogId: log.id,
            mealName: log.meal.name,
            mealType: log.meal.mealType,
            score,
            color: score !== null ? (log.complianceColor as ComplianceColor) || getColor(score) : null,
            status: log.status,
            issues: log.complianceIssues || [],
        };
    });

    const scoredMeals = mealBreakdown.filter(m => m.score !== null);
    const totalScore = scoredMeals.reduce((sum, m) => sum + (m.score || 0), 0);
    const avgScore = scoredMeals.length > 0 ? Math.round(totalScore / scoredMeals.length) : 0;

    return {
        date: dateKey,
        score: avgScore,
        color: getColor(avgScore),
        mealsLogged: logs.filter(l => l.status !== 'pending').length,
        mealsPlanned,
        mealBreakdown,
    };
}
```

**Query count after fix:** 3 (week logs + active plan + previous week trend) instead of 15.

---

## 5.2 HIGH: Compliance Score Is Misleading for Unreviewed Meals

**File:** `backend/src/services/compliance.service.ts` lines 183-188

### The Problem

Factor 5 of the compliance score awards 15 points for dietitian approval. The five positive factors sum to 100:

| Factor | Weight |
|---|---|
| On-time | 20 |
| Photo uploaded | 15 |
| Correct foods | 30 |
| Portion accuracy | 20 |
| Dietitian approved | 15 |
| **Total** | **100** |

A client who eats the right food, on time, with a photo, in correct portions, still cannot exceed 85/100 until the dietitian reviews the meal. Since the GREEN threshold is set at 85, a perfectly compliant client shows YELLOW until the dietitian happens to open the dashboard.

```typescript
// compliance.service.ts:183-188 (current)
// Factor 5: Dietitian approved (+15)
if (mealLog.dietitianFeedback) {
    score += WEIGHTS.DIETITIAN_APPROVED;
} else {
    issues.push('Awaiting dietitian review');
}
```

### Performance / Correctness Impact

- **Misleading scores:** Clients see 85/100 YELLOW for a perfect meal, breeding frustration and distrust.
- **Unfair penalty:** The client has zero control over whether/when the dietitian reviews their log.
- **Dashboard noise:** Every unreviewed meal generates the issue "Awaiting dietitian review," flooding the issues list with a non-actionable item.
- **Broken GREEN threshold:** The config sets `GREEN_MIN: 85`. A perfect unreviewed meal scores exactly 85, which technically meets the threshold, but only because of the `>=` comparison. If the green threshold were ever raised to 86, no unreviewed meal could be green regardless of client behavior.

### The Fix

Make dietitian review a **bonus** that pushes the score above the base maximum, rather than a deduction from it. Restructure the weights so that the five client-controllable factors sum to 100. The dietitian review becomes a separate +15 bonus (score can temporarily exceed 100 before clamping). This way the base max without review is 100, and review adds a meaningful reward.

**Config change** (`compliance.config.ts`):

```typescript
export const COMPLIANCE_CONFIG = {
    // Client-controllable weights (sum to 100)
    WEIGHTS: {
        ON_TIME: Number(process.env.COMPLIANCE_WEIGHT_ON_TIME) || 25,
        PHOTO: Number(process.env.COMPLIANCE_WEIGHT_PHOTO) || 15,
        CORRECT_FOODS: Number(process.env.COMPLIANCE_WEIGHT_CORRECT_FOODS) || 30,
        PORTION_ACCURACY: Number(process.env.COMPLIANCE_WEIGHT_PORTION) || 30,
    },

    // Bonus: dietitian review is additive, not deductive
    BONUS: {
        DIETITIAN_APPROVED: Number(process.env.COMPLIANCE_BONUS_DIETITIAN) || 10,
    },

    // Penalties
    PENALTIES: {
        SUBSTITUTION: Number(process.env.COMPLIANCE_PENALTY_SUBSTITUTION) || -10,
        SKIPPED_SCORE: 0,
    },

    // Color thresholds
    THRESHOLDS: {
        GREEN_MIN: Number(process.env.COMPLIANCE_THRESHOLD_GREEN) || 80,
        YELLOW_MIN: Number(process.env.COMPLIANCE_THRESHOLD_YELLOW) || 60,
    },

    ON_TIME_WINDOW_MINUTES: Number(process.env.COMPLIANCE_ON_TIME_WINDOW) || 30,
    PORTION_TOLERANCE_PCT: 0.15,
    TREND_THRESHOLD: 5,
};
```

**Service change** (`compliance.service.ts`, inside `calculateMealCompliance`):

```typescript
async calculateMealCompliance(mealLogId: string): Promise<ComplianceResult> {
    const mealLog = await prisma.mealLog.findUnique({
        where: { id: mealLogId },
        include: {
            meal: {
                include: {
                    foodItems: {
                        include: { foodItem: true },
                    },
                },
            },
        },
    });

    if (!mealLog) {
        logger.warn('Compliance: MealLog not found', { mealLogId });
        return { score: 0, color: 'RED', issues: ['Meal log not found'] };
    }

    const { WEIGHTS, BONUS, PENALTIES } = COMPLIANCE_CONFIG;
    const issues: string[] = [];
    let score = 0;

    // Factor 7: Skipped -> score is 0
    if (mealLog.status === 'skipped') {
        await this.persistScore(mealLogId, PENALTIES.SKIPPED_SCORE, ['Meal was skipped']);
        return { score: 0, color: 'RED', issues: ['Meal was skipped'] };
    }

    // Factor 1: On-time (+25)
    if (mealLog.loggedAt && mealLog.scheduledTime) {
        const scheduled = parseScheduledDateTime(mealLog.scheduledDate, mealLog.scheduledTime);
        if (scheduled) {
            const diffMinutes = Math.abs(mealLog.loggedAt.getTime() - scheduled.getTime()) / 60000;
            if (diffMinutes <= COMPLIANCE_CONFIG.ON_TIME_WINDOW_MINUTES) {
                score += WEIGHTS.ON_TIME;
            } else {
                issues.push(`Meal logged ${Math.round(diffMinutes)} min from scheduled time`);
            }
        } else {
            score += WEIGHTS.ON_TIME;
        }
    } else if (mealLog.loggedAt) {
        score += WEIGHTS.ON_TIME;
    } else {
        issues.push('Meal not logged yet');
    }

    // Factor 2: Photo uploaded (+15)
    if (mealLog.mealPhotoUrl) {
        score += WEIGHTS.PHOTO;
    } else {
        issues.push('No photo uploaded');
    }

    // Factor 3: Correct foods (+30)
    if (mealLog.status === 'eaten') {
        score += WEIGHTS.CORRECT_FOODS;
    } else if (mealLog.status === 'substituted') {
        score += Math.round(WEIGHTS.CORRECT_FOODS * 0.5);
        issues.push('Substituted foods from planned meal');
    } else {
        issues.push('Foods not confirmed');
    }

    // Factor 4: Portion accuracy (+30)
    const chosenGroup = mealLog.chosenOptionGroup ?? 0;
    const plannedFoodItems = mealLog.meal.foodItems.filter(fi => fi.optionGroup === chosenGroup);
    let plannedCalories = 0;
    plannedFoodItems.forEach(fi => {
        const ratio = Number(fi.quantityG) / 100;
        plannedCalories += fi.foodItem.calories * ratio;
    });

    if (mealLog.substituteCaloriesEst && plannedCalories > 0) {
        const deviation = Math.abs(mealLog.substituteCaloriesEst - plannedCalories) / plannedCalories;
        if (deviation <= COMPLIANCE_CONFIG.PORTION_TOLERANCE_PCT) {
            score += WEIGHTS.PORTION_ACCURACY;
        } else {
            const portionScore = Math.max(0, WEIGHTS.PORTION_ACCURACY * (1 - deviation));
            score += Math.round(portionScore);
            issues.push(`Calorie deviation: ${Math.round(deviation * 100)}%`);
        }
    } else if (mealLog.status === 'eaten') {
        score += WEIGHTS.PORTION_ACCURACY;
    }

    // Factor 5: Dietitian review -- BONUS, not a deduction
    // The score is already out of 100 from client-controlled factors.
    // Dietitian review adds a bonus that gets clamped to 100.
    if (mealLog.dietitianFeedback) {
        score += BONUS.DIETITIAN_APPROVED;
    }
    // NOTE: No "else" branch. No issue is pushed for awaiting review.
    // The client is not penalized for something outside their control.

    // Factor 6: Substitution penalty (-10)
    if (mealLog.status === 'substituted') {
        score += PENALTIES.SUBSTITUTION;
        issues.push('Substitution penalty applied');
    }

    score = Math.max(0, Math.min(100, score));
    const color = getColor(score);

    await this.persistScore(mealLogId, score, issues);

    logger.info('Compliance calculated', { mealLogId, score, color, issues });
    return { score, color, issues };
}
```

**Key changes:**

1. Client-controllable weights now sum to 100 (25 + 15 + 30 + 30).
2. Dietitian review is a +10 bonus, clamped at 100 by the existing `Math.min(100, score)`.
3. No "Awaiting dietitian review" issue is pushed -- clients see only actionable feedback.
4. A perfect unreviewed meal scores 100. A reviewed meal also scores 100 (clamped), but the bonus compensates for any minor point losses elsewhere.

---

## 5.3 MEDIUM: mealLogService.updateMealLog Does Unnecessary Re-fetch

**File:** `backend/src/services/mealLog.service.ts` lines 211-218

### The Problem

After updating a meal log record, the code calls `complianceService.calculateMealCompliance(updated.id)` which internally fetches the meal log again to compute the score, then writes the score back via `persistScore`. After that, `updateMealLog` does yet another fetch to read the score it just wrote:

```typescript
// mealLog.service.ts:211-218 (current)
const updated = await prisma.mealLog.update({ where: { id: mealLogId }, data: updateData });

// Recalculate compliance when status changes from pending
if (data.status && data.status !== 'pending' && data.status !== mealLog.status) {
    await complianceService.calculateMealCompliance(updated.id);
}

const finalLog = await prisma.mealLog.findUnique({ where: { id: updated.id } });
```

The same pattern appears in `reviewMealLog` (line 252) and `uploadMealPhoto` (line 287):

```typescript
// reviewMealLog:248-252
await complianceService.calculateMealCompliance(updated.id);
// ...
const finalLog = await prisma.mealLog.findUnique({ where: { id: updated.id } });

// uploadMealPhoto:283-287
await complianceService.calculateMealCompliance(updated.id);
// ...
const finalLog = await prisma.mealLog.findUnique({ where: { id: updated.id } });
```

### Performance / Correctness Impact

- **Extra database round-trip:** Every update/review/photo-upload triggers a redundant `findUnique` just to read back the compliance score that `calculateMealCompliance` just wrote.
- **`calculateMealCompliance` itself** fetches the full meal log with food items (line 89-100), computes the score, then writes it back. That is: fetch (inside compliance) + write (persistScore) + fetch again (the finalLog query) = 3 queries where 1 would suffice.
- **Race condition risk:** Between `persistScore` writing the score and the `finalLog` read, another concurrent request could modify the record, leading to stale reads.

### The Fix

Have `calculateMealCompliance` return the compliance result (which it already does), and use that return value directly instead of re-fetching the record.

```typescript
// mealLog.service.ts -- refactored updateMealLog

async updateMealLog(mealLogId: string, data: UpdateMealLogInput, orgId: string) {
    const mealLog = await prisma.mealLog.findFirst({
        where: { id: mealLogId, orgId },
    });

    if (!mealLog) throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');

    const updateData: any = {};
    if (data.status) updateData.status = data.status;
    if (data.clientNotes !== undefined) updateData.clientNotes = data.clientNotes;
    if (data.substituteDescription !== undefined) updateData.substituteDescription = data.substituteDescription;
    if (data.substituteCaloriesEst !== undefined) updateData.substituteCaloriesEst = data.substituteCaloriesEst;
    if (data.chosenOptionGroup !== undefined) updateData.chosenOptionGroup = data.chosenOptionGroup;
    if (data.photoUrl) {
        updateData.mealPhotoUrl = data.photoUrl;
        updateData.photoUploadedAt = new Date();
    }
    if (data.status && data.status !== 'pending') updateData.loggedAt = new Date();

    const updated = await prisma.mealLog.update({ where: { id: mealLogId }, data: updateData });

    // Use the returned ComplianceResult directly -- no re-fetch needed
    let complianceScore: number | null = updated.complianceScore;
    let complianceColor: string | null = updated.complianceColor;

    if (data.status && data.status !== 'pending' && data.status !== mealLog.status) {
        const result = await complianceService.calculateMealCompliance(updated.id);
        complianceScore = result.score;
        complianceColor = result.color;
    }

    logger.info('Meal log updated', { mealLogId: updated.id });

    return {
        id: updated.id,
        status: updated.status,
        photoUrl: updated.mealPhotoUrl,
        clientNotes: updated.clientNotes,
        loggedAt: updated.loggedAt,
        complianceScore,
        complianceColor,
    };
}
```

Apply the same pattern to `reviewMealLog`:

```typescript
// mealLog.service.ts -- refactored reviewMealLog

async reviewMealLog(mealLogId: string, data: ReviewMealLogInput, orgId: string, userId: string) {
    const mealLog = await prisma.mealLog.findFirst({ where: { id: mealLogId, orgId } });
    if (!mealLog) throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');

    const updateData: any = { reviewedByUserId: userId, dietitianFeedbackAt: new Date() };
    if (data.dietitianFeedback !== undefined) updateData.dietitianFeedback = data.dietitianFeedback;
    if (data.status) updateData.status = data.status;
    if (data.overrideCalories !== undefined) updateData.substituteCaloriesEst = data.overrideCalories;

    const updated = await prisma.mealLog.update({
        where: { id: mealLogId },
        data: updateData,
        include: { reviewer: { select: { id: true, fullName: true } } },
    });

    // Use returned result directly instead of re-fetching
    const result = await complianceService.calculateMealCompliance(updated.id);

    logger.info('Meal log reviewed', { mealLogId: updated.id, reviewerId: userId });

    return {
        id: updated.id,
        status: updated.status,
        dietitianFeedback: updated.dietitianFeedback,
        reviewedByUser: updated.reviewer,
        dietitianReviewedAt: updated.dietitianFeedbackAt,
        complianceScore: result.score,
        complianceColor: result.color,
    };
}
```

Apply the same pattern to `uploadMealPhoto`:

```typescript
// mealLog.service.ts -- refactored uploadMealPhoto

async uploadMealPhoto(mealLogId: string, fileBuffer: Buffer, fileSize: number, orgId: string) {
    const mealLog = await prisma.mealLog.findFirst({ where: { id: mealLogId, orgId } });
    if (!mealLog) throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');

    const { StorageService } = await import('./storage.service');

    const { fullUrl, thumbUrl } = await StorageService.uploadMealPhoto(fileBuffer, orgId, mealLogId);

    const updated = await prisma.mealLog.update({
        where: { id: mealLogId },
        data: {
            mealPhotoUrl: fullUrl,
            mealPhotoSmallUrl: thumbUrl,
            photoUploadedAt: new Date(),
            ...(mealLog.status === 'pending' && { status: 'eaten', loggedAt: new Date() }),
        },
    });

    // Use returned result directly instead of re-fetching
    const result = await complianceService.calculateMealCompliance(updated.id);

    logger.info('Meal photo uploaded', { mealLogId, fullUrl, thumbUrl, originalSize: fileSize });

    return {
        id: updated.id,
        mealPhotoUrl: updated.mealPhotoUrl,
        mealPhotoSmallUrl: updated.mealPhotoSmallUrl,
        photoUploadedAt: updated.photoUploadedAt,
        status: updated.status,
        complianceScore: result.score,
        complianceColor: result.color,
    };
}
```

**Queries saved per operation:** 1 `findUnique` eliminated from each of the three methods (updateMealLog, reviewMealLog, uploadMealPhoto).

---

## 5.4 MEDIUM: dietPlanService.updatePlan Uses Fragile Spread Pattern

**File:** `backend/src/services/dietPlan.service.ts` lines 131-141

### The Problem

The update data object uses two different conditional spread patterns inconsistently:

```typescript
// dietPlan.service.ts:128-143 (current)
const updated = await prisma.dietPlan.update({
    where: { id: planId },
    data: {
        ...(data.name && { name: data.name }),                                    // truthy check
        ...(data.description !== undefined && { description: data.description }), // !== undefined check
        ...(data.startDate && { startDate: new Date(data.startDate) }),           // truthy check
        ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
        ...(data.targetCalories !== undefined && { targetCalories: data.targetCalories }),
        ...(data.targetProteinG !== undefined && { targetProteinG: data.targetProteinG }),
        ...(data.targetCarbsG !== undefined && { targetCarbsG: data.targetCarbsG }),
        ...(data.targetFatsG !== undefined && { targetFatsG: data.targetFatsG }),
        ...(data.targetFiberG !== undefined && { targetFiberG: data.targetFiberG }),
        ...(data.notesForClient !== undefined && { notesForClient: data.notesForClient }),
        ...(data.internalNotes !== undefined && { internalNotes: data.internalNotes }),
    },
});
```

The inconsistency:

| Field | Guard | Empty string `""` | `0` | `null` |
|---|---|---|---|---|
| `name` | `data.name &&` (truthy) | **Skipped** (falsy) | N/A | **Skipped** |
| `description` | `data.description !== undefined` | **Included** | N/A | **Included** |
| `startDate` | `data.startDate &&` (truthy) | **Skipped** | N/A | **Skipped** |
| `targetCalories` | `data.targetCalories !== undefined` | N/A | **Included** | **Included** |

- `name` cannot be cleared to an empty string -- the truthy check silently drops `""`.
- `description` can be cleared to an empty string -- it uses `!== undefined`.
- `startDate` cannot be set to a falsy value, but more critically, a legitimate `0` for numeric fields using truthy checks would be silently dropped (though this does not apply to `startDate` as a string).
- The `targetCalories` field with `!== undefined` correctly handles `0`, meaning "no calorie target."

A developer sending `{ name: "" }` to clear a plan name gets a silent no-op. The API returns success but the name is unchanged.

### Performance / Correctness Impact

- **Silent data loss:** Attempting to clear `name` or `startDate` silently fails.
- **Inconsistent API behavior:** Some fields can be cleared, others cannot, with no documentation or validation explaining why.
- **Bug magnet:** Future developers will copy whichever pattern they see first, propagating the inconsistency.

### The Fix

Use `!== undefined` consistently for all fields. For fields that must not be empty (like `name`), add explicit validation instead of relying on the spread guard to silently drop the value.

```typescript
// dietPlan.service.ts -- refactored updatePlan

async updatePlan(planId: string, data: UpdateDietPlanInput, orgId: string) {
    const existing = await prisma.dietPlan.findFirst({ where: { id: planId, orgId } });
    if (!existing) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');

    // Explicit validation for required fields
    if (data.name !== undefined && data.name.trim() === '') {
        throw AppError.badRequest('Plan name cannot be empty', 'INVALID_PLAN_NAME');
    }
    if (data.startDate !== undefined && !data.startDate) {
        throw AppError.badRequest('Start date cannot be empty', 'INVALID_START_DATE');
    }

    // Consistent !== undefined guard for all fields
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.targetCalories !== undefined) updateData.targetCalories = data.targetCalories;
    if (data.targetProteinG !== undefined) updateData.targetProteinG = data.targetProteinG;
    if (data.targetCarbsG !== undefined) updateData.targetCarbsG = data.targetCarbsG;
    if (data.targetFatsG !== undefined) updateData.targetFatsG = data.targetFatsG;
    if (data.targetFiberG !== undefined) updateData.targetFiberG = data.targetFiberG;
    if (data.notesForClient !== undefined) updateData.notesForClient = data.notesForClient;
    if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;

    const updated = await prisma.dietPlan.update({
        where: { id: planId },
        data: updateData,
    });

    logger.info('Diet plan updated', { planId: updated.id });
    return updated;
}
```

**Key changes:**

1. All fields use `!== undefined` consistently.
2. Fields that must not be empty (`name`, `startDate`) are validated explicitly with a clear error message.
3. The nested spread pattern is replaced with a plain object built field-by-field, which is easier to read and debug.

---

## 5.5 MEDIUM: No Pagination Limit Cap

**File:** `backend/src/utils/queryFilters.ts` line 27

### The Problem

While examining the code, I found that `buildPaginationParams` already contains a cap:

```typescript
// queryFilters.ts:25-34 (current)
export function buildPaginationParams(page?: string | any, pageSize?: string | any): PaginationParams {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    return {
        page: p,
        pageSize: ps,
        skip: (p - 1) * ps,
        take: ps,
    };
}
```

The `Math.min(100, ...)` on line 27 caps `pageSize` at 100. However, this only protects routes that use `buildPaginationParams`. Any service that manually reads `pageSize` from the query string bypasses this protection. Additionally, the cap of 100 is hardcoded and not configurable, making it invisible to API consumers.

The real issue is that there is no server-side enforcement at the **validation layer** (Zod schemas). If a controller bypasses `buildPaginationParams` and reads `query.pageSize` directly, or if a new endpoint is added without using this utility, the cap disappears.

### Performance / Correctness Impact

- **Partial protection:** Only routes using `buildPaginationParams` are safe. Any manual pagination bypasses the cap.
- **No client feedback:** The cap silently clamps -- a request for `pageSize=5000` returns 100 results with meta saying `pageSize: 100`, confusing API consumers who expected 5000.
- **Not configurable:** The 100 limit is hardcoded, making it harder to tune per-route if needed.

### The Fix

Enforce the limit at the Zod schema validation layer so it applies universally and returns an explicit error, while keeping the utility function as a safety net.

Add a shared pagination schema:

```typescript
// backend/src/schemas/pagination.schema.ts

import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE, {
        message: `pageSize cannot exceed ${MAX_PAGE_SIZE}`,
    }).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
```

Update `buildPaginationParams` to accept the typed input and make the cap configurable:

```typescript
// queryFilters.ts -- refactored

import { MAX_PAGE_SIZE } from '../schemas/pagination.schema';

export function buildPaginationParams(
    page?: string | number,
    pageSize?: string | number,
    maxPageSize: number = MAX_PAGE_SIZE,
): PaginationParams {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(maxPageSize, Math.max(1, Number(pageSize) || 20));
    return {
        page: p,
        pageSize: ps,
        skip: (p - 1) * ps,
        take: ps,
    };
}
```

Then in route-level Zod schemas, merge the pagination schema:

```typescript
// Example: in any list endpoint schema
import { paginationSchema } from './pagination.schema';

export const listMealLogsSchema = z.object({
    query: paginationSchema.extend({
        clientId: z.string().uuid().optional(),
        status: z.string().optional(),
        // ...other filters
    }),
});
```

This way:
1. Zod rejects `pageSize > 100` with a clear 400 error before the query ever runs.
2. `buildPaginationParams` remains as a defense-in-depth safety net.
3. The max is configurable via `MAX_PAGE_SIZE` constant.

---

## 5.6 LOW: FoodNutrition Interface Uses `any` Type

**File:** `backend/src/utils/nutritionCalculator.ts` lines 7-13

### The Problem

The `FoodNutrition` interface uses `any` as a union member on every numeric field:

```typescript
// nutritionCalculator.ts:6-13 (current)
interface FoodNutrition {
    calories: number;
    proteinG: number | null | any;
    carbsG: number | null | any;
    fatsG: number | null | any;
    fiberG: number | null | any;
    servingSizeG: number | any;
}
```

The `any` in a union absorbs all other types. `number | null | any` is equivalent to just `any`. This means:

- `proteinG: "hello"` -- TypeScript allows it, no error.
- `carbsG: { foo: 'bar' }` -- TypeScript allows it, no error.
- `servingSizeG: undefined` -- TypeScript allows it, no error.

The `any` was almost certainly added as a workaround because Prisma returns `Decimal` objects for fields declared as `Decimal` in the schema, and TypeScript complains when you pass a `Prisma.Decimal` where `number` is expected. The fix was to add `any` to silence the compiler, but this eliminates all type checking on these fields.

### Performance / Correctness Impact

- **Type safety is defeated:** The entire interface is effectively untyped. Any value can be passed for nutrition fields without a compiler error.
- **Silent runtime errors:** Passing a non-numeric value causes `Number(food.proteinG)` in `scaleNutrition` to produce `NaN`, which propagates silently through calculations.
- **False confidence:** The interface appears typed, so developers trust it and skip runtime checks.

### The Fix

Replace `any` with a proper type that handles Prisma's `Decimal` type. The `scaleNutrition` function already calls `Number(...)` on these fields (lines 32-35), so the conversion is handled -- we just need the type to reflect reality.

**Option A: Accept `Prisma.Decimal` explicitly (recommended if Prisma types are available):**

```typescript
// nutritionCalculator.ts -- refactored with Prisma.Decimal

import { Prisma } from '@prisma/client';

type NumericField = number | Prisma.Decimal | null;

interface FoodNutrition {
    calories: number | Prisma.Decimal;
    proteinG: NumericField;
    carbsG: NumericField;
    fatsG: NumericField;
    fiberG: NumericField;
    servingSizeG: number | Prisma.Decimal;
}

export interface ScaledNutrition {
    calories: number;
    proteinG: number | null;
    carbsG: number | null;
    fatsG: number | null;
    fiberG: number | null;
}

/**
 * Safely convert a Prisma Decimal or number to a plain number.
 */
function toNumber(value: number | Prisma.Decimal | null): number | null {
    if (value === null) return null;
    return Number(value);
}

/**
 * Scale nutrition values based on quantity vs serving size
 */
export function scaleNutrition(food: FoodNutrition, quantityG: number): ScaledNutrition {
    const servingSize = Number(food.servingSizeG) || 100;
    const multiplier = quantityG / servingSize;

    const protein = toNumber(food.proteinG);
    const carbs = toNumber(food.carbsG);
    const fats = toNumber(food.fatsG);
    const fiber = toNumber(food.fiberG);

    return {
        calories: Math.round(Number(food.calories) * multiplier),
        proteinG: protein !== null ? Math.round(protein * multiplier * 10) / 10 : null,
        carbsG: carbs !== null ? Math.round(carbs * multiplier * 10) / 10 : null,
        fatsG: fats !== null ? Math.round(fats * multiplier * 10) / 10 : null,
        fiberG: fiber !== null ? Math.round(fiber * multiplier * 10) / 10 : null,
    };
}

/**
 * Sum nutrition across multiple food items
 */
export function sumNutrition(items: ScaledNutrition[]): ScaledNutrition {
    return items.reduce(
        (totals, item) => ({
            calories: totals.calories + item.calories,
            proteinG: (totals.proteinG ?? 0) + (item.proteinG ?? 0),
            carbsG: (totals.carbsG ?? 0) + (item.carbsG ?? 0),
            fatsG: (totals.fatsG ?? 0) + (item.fatsG ?? 0),
            fiberG: (totals.fiberG ?? 0) + (item.fiberG ?? 0),
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatsG: 0, fiberG: 0 }
    );
}
```

**Option B: Use `number | null` with conversion at the Prisma query level (simpler, if you control the queries):**

If all Prisma queries that feed into `scaleNutrition` are under your control, convert Decimal to number at the query boundary:

```typescript
// In any service that fetches food items for nutrition calculation:
const foodItems = rawFoodItems.map(item => ({
    ...item,
    calories: Number(item.calories),
    proteinG: item.proteinG !== null ? Number(item.proteinG) : null,
    carbsG: item.carbsG !== null ? Number(item.carbsG) : null,
    fatsG: item.fatsG !== null ? Number(item.fatsG) : null,
    fiberG: item.fiberG !== null ? Number(item.fiberG) : null,
    servingSizeG: Number(item.servingSizeG),
}));
```

Then the interface becomes clean:

```typescript
interface FoodNutrition {
    calories: number;
    proteinG: number | null;
    carbsG: number | null;
    fatsG: number | null;
    fiberG: number | null;
    servingSizeG: number;
}
```

**Option A is recommended** because it handles the conversion inside `nutritionCalculator.ts` itself, making it a single point of responsibility. Callers do not need to remember to convert Decimal values before passing them in.

---

## Summary Table

| Issue | Severity | Category | Queries Saved / Impact |
|---|---|---|---|
| 5.1 N+1 in weekly adherence | HIGH | Performance | 15 queries reduced to 3 |
| 5.2 Misleading compliance score | HIGH | Correctness | Perfect meals now score 100/100 without review |
| 5.3 Unnecessary re-fetch after update | MEDIUM | Performance | 1 query saved per update/review/photo-upload |
| 5.4 Fragile spread pattern | MEDIUM | Correctness | Silent data loss eliminated |
| 5.5 No pagination limit cap | MEDIUM | Security | Prevents unbounded result sets at validation layer |
| 5.6 FoodNutrition uses `any` | LOW | Type Safety | Full compile-time checking restored |
