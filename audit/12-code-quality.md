# 12. Code Quality & Maintainability

This document catalogs code quality and maintainability issues found across the DietKaro codebase: oversized files that violate single-responsibility, console statements leaking into production, missing environment variable validation, stray build artifacts in source, inconsistent error handling, and fragmented logging patterns.

---

## 12.1 Large File Sizes

### The Problem

Several files have grown far beyond a maintainable size, combining unrelated concerns into single modules. This makes them difficult to navigate, test, and review.

**`backend/src/routes/clientApi.routes.ts` -- 587 lines**

This file is both a route definition layer AND a full service layer. Routes directly contain Prisma queries, business logic for macro calculation, compliance triggers, and data transformation. There are no controller or service boundaries.

```typescript
// Lines 14-148: The /meals/today endpoint contains ~130 lines of inline logic:
// - Prisma query with nested includes
// - Macro calculation (calcMacros helper)
// - Option group mapping
// - Meal log status merging
// - Response shaping
router.get('/meals/today', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    // ... 130 lines of Prisma queries, data mapping, macro calculation
    const calcMacros = (items: typeof foodItems) => {
        let calories = 0, protein = 0, carbs = 0, fats = 0;
        items.forEach(fi => {
            calories += fi.calories || Math.round((fi.foodItem.calories * Number(fi.quantityG)) / 100);
            // ... more computation
        });
        return { calories, protein: Math.round(protein), carbs: Math.round(carbs), fats: Math.round(fats) };
    };
    // ... more inline logic
}));
```

The file also has mid-file imports, which is a further code organization smell:

```typescript
// Line 242-243: Imports scattered throughout the file
import { uploadSinglePhoto } from '../middleware/upload.middleware';
import { mealLogService } from '../services/mealLog.service';

// Line 460-461:
import { onboardingService } from '../services/onboarding.service';

// Line 560-561:
import { complianceService } from '../services/compliance.service';
```

**`frontend/src/app/dashboard/clients/[id]/page.tsx` -- 767 lines**

A single React component renders four completely different tab views (Overview, Diet Plan, Meal Logs, Progress), each with its own data requirements, rendering logic, and UI structure. All four are conditionally rendered inside one return statement.

```typescript
// All hooks loaded unconditionally regardless of active tab (lines 74-85):
const { data: client, isLoading: clientLoading, error: clientError } = useClient(clientId);
const { data: progress, isLoading: progressLoading } = useClientProgress(clientId);
const { data: plansData } = useDietPlans({ clientId, isPublished: true });
const { data: weeklyAdherence } = useWeeklyAdherence(clientId);
const { data: fullPlan } = useDietPlan(activePlan?.id || '');
const { data: mealLogsData, isLoading: mealLogsLoading } = useMealLogs({ clientId, pageSize: 20 });
const { data: complianceHistory } = useComplianceHistory(clientId, 30);
const updateClient = useUpdateClient();

// Then ~650 lines of JSX across 4 conditional tab renders:
{activeTab === 'overview' && ( /* ~90 lines */ )}
{activeTab === 'diet-plan' && ( /* ~115 lines */ )}
{activeTab === 'meal-logs' && ( /* ~70 lines */ )}
{activeTab === 'progress' && ( /* ~160 lines */ )}
```

**`client-app/app/(tabs)/home/meal/[id].tsx` -- 773 lines**

Contains two entirely separate UIs in one component: a read-only "meal detail" view (lines 138-236) for already-logged meals, and an interactive "log meal" form (lines 238-395) for pending meals. The remaining ~375 lines are StyleSheet definitions.

```typescript
// Lines 137-236: Complete read-only meal detail UI
if (!isPendingMeal && (currentMealLog?.status === 'eaten' || ...)) {
    return (
        <SafeAreaView>
            {/* ~100 lines of read-only meal detail UI */}
        </SafeAreaView>
    );
}

// Lines 238-395: Complete interactive meal logging form UI
return (
    <SafeAreaView>
        {/* ~150 lines of form UI with photo, options, notes */}
    </SafeAreaView>
);

// Lines 398-773: ~375 lines of StyleSheet.create({...})
```

**`backend/src/services/compliance.service.ts` -- 409 lines**

Houses three distinct feature areas in one class: meal-level scoring (`calculateMealCompliance`), daily aggregation (`calculateDailyAdherence`), weekly aggregation (`calculateWeeklyAdherence`), and history retrieval (`getClientComplianceHistory`). The types alone take 60 lines.

### Impact

- **Cognitive load**: Developers must hold 500-800 lines of context in their head to modify a single feature.
- **Merge conflicts**: Multiple developers working on different tabs or routes will collide in the same file.
- **Test isolation**: Unit-testing the macro calculation logic in `clientApi.routes.ts` is impossible because it is embedded in a route handler closure.
- **Bundle size** (frontend): All four tab views in `clients/[id]/page.tsx` are loaded simultaneously, even though only one is visible. All hooks fire on mount regardless of which tab the user is viewing.
- **StyleSheet bloat** (React Native): 375 lines of styles in `meal/[id].tsx` are duplicating styling that could be shared with the theme system.

### The Fix

**`clientApi.routes.ts` -- Split into route file + service module**

Create `backend/src/services/clientApi.service.ts` to hold all business logic, and reduce the route file to thin delegation:

```typescript
// backend/src/services/clientApi.service.ts
import prisma from '../utils/prisma';
import { complianceService } from './compliance.service';

interface TodayMealResult { /* ... */ }

export class ClientApiService {

    async getTodayMeals(clientId: string): Promise<TodayMealResult[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const activePlan = await prisma.dietPlan.findFirst({
            where: { clientId, status: 'active', isActive: true },
            include: {
                meals: {
                    include: { foodItems: { include: { foodItem: true } } },
                    orderBy: { mealType: 'asc' },
                },
            },
        });

        if (!activePlan) return [];

        const mealLogs = await prisma.mealLog.findMany({
            where: { clientId, scheduledDate: { gte: today, lt: tomorrow } },
        });

        return activePlan.meals.map(meal => this.mapMealToResponse(meal, mealLogs, today));
    }

    async logMeal(clientId: string, orgId: string, mealLogId: string, data: LogMealInput) {
        // ... extracted from the PATCH /meals/:mealLogId/log handler
    }

    async getClientStats(clientId: string) {
        // ... extracted from GET /stats
    }

    async getProgressSummary(clientId: string) {
        // ... extracted from GET /progress-summary
    }

    // Private helpers
    private mapMealToResponse(meal: any, mealLogs: any[], today: Date) { /* ... */ }
    private calcMacros(items: MealFoodItem[]) { /* ... */ }
}

export const clientApiService = new ClientApiService();
```

```typescript
// backend/src/routes/clientApi.routes.ts (reduced to ~80 lines)
import { Router, Response } from 'express';
import { requireClientAuth, ClientAuthRequest } from '../middleware/clientAuth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { clientApiService } from '../services/clientApi.service';

const router = Router();
router.use(requireClientAuth);

router.get('/meals/today', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    const data = await clientApiService.getTodayMeals(req.client!.id);
    res.json({ success: true, data });
}));

router.patch('/meals/:mealLogId/log', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    const data = await clientApiService.logMeal(
        req.client!.id, req.client!.orgId, req.params.mealLogId, req.body
    );
    res.json({ success: true, data });
}));

// ... remaining thin routes
export default router;
```

**`clients/[id]/page.tsx` -- Extract tab components**

```
frontend/src/app/dashboard/clients/[id]/
  page.tsx                    (~120 lines - shell + tab nav + shared data)
  _components/
    overview-tab.tsx          (~100 lines)
    diet-plan-tab.tsx         (~120 lines)
    meal-logs-tab.tsx         (~80 lines)
    progress-tab.tsx          (~170 lines)
    client-header.tsx         (~50 lines)
    key-metrics.tsx           (~120 lines)
```

```typescript
// page.tsx -- shell component
export default function ClientProfilePage() {
    const [activeTab, setActiveTab] = useState<ClientTab>('overview');
    const { data: client, isLoading } = useClient(clientId);

    if (isLoading) return <LoadingSpinner />;
    if (!client) return <ErrorState />;

    return (
        <div className="space-y-6">
            <ClientHeader client={client} />
            <KeyMetrics clientId={clientId} />
            <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

            {activeTab === 'overview' && <OverviewTab clientId={clientId} client={client} />}
            {activeTab === 'diet-plan' && <DietPlanTab clientId={clientId} client={client} />}
            {activeTab === 'meal-logs' && <MealLogsTab clientId={clientId} />}
            {activeTab === 'progress' && <ProgressTab clientId={clientId} />}
        </div>
    );
}
```

Each tab component owns its own hooks, so data is only fetched when that tab mounts.

**`meal/[id].tsx` -- Split into two screens + shared styles**

```
client-app/app/(tabs)/home/meal/
  [id].tsx              (~30 lines - router/switcher)
  _components/
    meal-detail.tsx     (~120 lines - read-only view)
    meal-log-form.tsx   (~180 lines - interactive form)
    meal-styles.ts      (~200 lines - shared StyleSheet)
```

```typescript
// [id].tsx -- thin router
export default function MealDetailScreen() {
    const { id, status } = useLocalSearchParams();
    const { data: mealLog, isLoading } = useMealLog(id ?? '');

    const isLoggedMeal = status === 'eaten' || status === 'skipped';

    if (isLoading) return <LoadingScreen />;

    if (isLoggedMeal || mealLog?.status === 'eaten' || mealLog?.status === 'skipped') {
        return <MealDetail mealLog={mealLog} />;
    }

    return <MealLogForm mealLog={mealLog} mealLogId={id} />;
}
```

**`compliance.service.ts` -- Split by concern**

```
backend/src/services/compliance/
  index.ts                        (re-exports)
  meal-compliance.service.ts      (~120 lines - 7-factor scoring)
  daily-adherence.service.ts      (~80 lines)
  weekly-adherence.service.ts     (~70 lines)
  compliance-history.service.ts   (~60 lines)
  compliance.types.ts             (~60 lines - shared types)
  compliance.helpers.ts           (~20 lines - getColor, parseScheduledDateTime)
```

---

## 12.2 Console.log/warn in Production Code

### The Problem

The codebase has 50+ `console.log`, `console.warn`, and `console.error` calls scattered across production source files. These bypass the structured logging system (winston `logger`) that already exists in the backend and provide no value in production while potentially leaking sensitive context.

**Backend -- `console.error` in middleware and routes:**

```typescript
// backend/src/middleware/auth.middleware.ts:68
} catch (error) {
    console.error('Auth middleware error:', error);
    // The logger utility exists and is used elsewhere, but not here
}

// backend/src/routes/media.routes.ts:58
} catch (error) {
    console.error('Error fetching image:', error);
}

// backend/src/server.ts:7
console.log(`Server is running on port ${PORT}`);
// Should use: logger.info(`Server is running on port ${PORT}`);
```

**Frontend (Next.js) -- `console.error` in hooks and pages:**

```typescript
// frontend/src/app/dashboard/diet-plans/[id]/page.tsx:29
} catch (err) {
    console.error('Failed to publish plan:', err);
}

// frontend/src/app/dashboard/diet-plans/[id]/page.tsx:40
} catch (err) {
    console.error('Failed to update name:', err);
}

// frontend/src/app/dashboard/diet-plans/[id]/page.tsx:56
} catch (err) {
    console.error('Failed to download PDF:', err);
}

// frontend/src/lib/hooks/use-meal-builder.ts:317
console.error(error);  // No context at all

// frontend/src/lib/api/use-api-client.ts:28
console.error('Error getting auth token:', error);

// frontend/src/app/dashboard/reviews/page.tsx:51
console.error('Failed to review meal:', err);
```

**Client App (React Native) -- `console.warn` and `console.error`:**

```typescript
// client-app/hooks/useMealLog.ts:50
console.warn('Photo upload failed, meal log was saved:', err);

// client-app/app/(tabs)/home/meal/[id].tsx:117
console.error('Log meal error:', error);

// client-app/contexts/AuthContext.tsx:42
console.error('Auth check failed:', error);
```

### Impact

- **No structured output**: `console.error` outputs plain text that cannot be parsed, filtered, or alerted on by log aggregation tools (Datadog, CloudWatch, etc.).
- **No log levels in frontend/mobile**: Every error is equally anonymous. There is no way to distinguish a photo upload warning from an authentication failure in monitoring.
- **Sensitive data leakage**: `console.error('Auth middleware error:', error)` may print full stack traces and JWT content to stdout in production.
- **Silent failures**: Frontend `console.error` calls swallow exceptions. The user sees nothing; the error goes to the browser console where nobody is watching.
- **Inconsistency**: Some backend services use `logger.info`/`logger.error` (the correct pattern), while middleware and routes use `console.error` -- making it unclear which pattern is "official."

### The Fix

**Backend: Replace all `console.*` with the existing `logger` utility.**

The `logger` utility already exists at `backend/src/utils/logger.ts` and is a winston instance with structured JSON output in production and file transports. It is already used correctly in most services.

```typescript
// backend/src/middleware/auth.middleware.ts -- BEFORE
} catch (error) {
    console.error('Auth middleware error:', error);
}

// AFTER
import logger from '../utils/logger';

} catch (error) {
    logger.error('Auth middleware error', {
        error: error instanceof Error ? error.message : error,
        path: req.path,
        method: req.method,
    });
}
```

```typescript
// backend/src/server.ts -- BEFORE
console.log(`Server is running on port ${PORT}`);

// AFTER
import logger from './utils/logger';
logger.info(`Server is running on port ${PORT}`);
```

**Frontend: Create a lightweight error reporting utility.**

```typescript
// frontend/src/lib/utils/error-reporter.ts
type ErrorSeverity = 'warning' | 'error' | 'fatal';

interface ErrorReport {
    message: string;
    severity: ErrorSeverity;
    context?: Record<string, unknown>;
    error?: unknown;
}

export function reportError({ message, severity, context, error }: ErrorReport): void {
    // In development, log to console for DX
    if (process.env.NODE_ENV === 'development') {
        console.error(`[${severity.toUpperCase()}] ${message}`, context, error);
        return;
    }

    // In production, send to error reporting service (Sentry, LogRocket, etc.)
    // Example with Sentry:
    // Sentry.captureException(error instanceof Error ? error : new Error(message), {
    //     level: severity,
    //     extra: context,
    // });
}

// Usage in components:
// BEFORE: console.error('Failed to publish plan:', err);
// AFTER:
reportError({
    message: 'Failed to publish plan',
    severity: 'error',
    context: { planId },
    error: err,
});
```

**Client App (React Native): Same pattern, mobile-adapted.**

```typescript
// client-app/utils/errorReporter.ts
export function reportError(message: string, error?: unknown, context?: Record<string, unknown>): void {
    if (__DEV__) {
        console.error(`[ERROR] ${message}`, error, context);
        return;
    }

    // Production: send to Sentry, Crashlytics, etc.
    // Sentry.captureException(error instanceof Error ? error : new Error(message), {
    //     extra: context,
    // });
}
```

**Add an ESLint rule to prevent future regressions:**

```json
// .eslintrc.json (all packages)
{
    "rules": {
        "no-console": ["warn", { "allow": [] }]
    },
    "overrides": [
        {
            "files": ["**/scripts/**", "**/tests/**"],
            "rules": { "no-console": "off" }
        }
    ]
}
```

---

## 12.3 No Environment Variable Validation

### The Problem

The application reads over 30 environment variables across backend services, middleware, and configuration files. None of them are validated at startup. If a critical variable is missing or malformed, the application starts successfully but fails at runtime when a user hits the affected code path.

**Critical variables used without validation:**

```typescript
// backend/src/middleware/clientAuth.middleware.ts:15
const JWT_SECRET = process.env.CLIENT_JWT_SECRET || 'client-secret-change-in-production';
// Falls back to a hardcoded secret -- a severe security issue if .env is missing

// backend/src/services/storage.service.ts:8-17
endpoint: process.env.S3_ENDPOINT || 'http://localhost:3900',
region: process.env.S3_REGION || 'garage',
accessKeyId: process.env.S3_ACCESS_KEY || '',      // Empty string credentials
secretAccessKey: process.env.S3_SECRET_KEY || '',   // Empty string credentials
const BUCKET = process.env.S3_BUCKET || 'dietkaro-media';

// backend/src/controllers/reports.controller.ts:12-19
region: process.env.AWS_REGION || 'ap-south-1',
accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'dietconnect-uploads';

// backend/src/utils/logger.ts:22
level: process.env.LOG_LEVEL || 'info',
```

**S3 client is configured in two separate places with different variable names:**

```typescript
// storage.service.ts uses: S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY
// reports.controller.ts uses: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
// These are TWO separate S3 clients with different credentials -- likely intentional but undocumented
```

**DATABASE_URL is never checked** -- Prisma will crash with a cryptic error if it is missing, rather than a clear validation message at startup.

### Impact

- **Silent security vulnerability**: `CLIENT_JWT_SECRET` defaults to `'client-secret-change-in-production'`. If someone deploys without setting this variable, all client JWTs are signed with a publicly known secret. Any attacker can forge tokens.
- **Runtime crashes on first use**: Missing S3 credentials will not fail at startup. They will fail when a user uploads a photo, producing a confusing AWS SDK error deep in a stack trace.
- **Debugging difficulty**: When `S3_ACCESS_KEY` is empty string, the AWS SDK may produce a "403 Forbidden" or "missing credentials" error that does not mention the environment variable name, making debugging time-consuming.
- **Configuration drift**: Two separate S3 configurations with different variable names create silent misconfiguration risk during deployment.

### The Fix

Create a startup validation module that runs before the Express app initializes. Either use the `envalid` library or a simple custom validator.

**Option A: Using `envalid` (recommended)**

```bash
npm install envalid
```

```typescript
// backend/src/config/env.ts
import { cleanEnv, str, port, num, bool, url } from 'envalid';

/**
 * Validated environment variables.
 * Import this module instead of using process.env directly.
 * The app will refuse to start if required variables are missing.
 */
export const env = cleanEnv(process.env, {
    // Server
    PORT: port({ default: 3000 }),
    NODE_ENV: str({ choices: ['development', 'production', 'test'], default: 'development' }),

    // Database (required)
    DATABASE_URL: url({ desc: 'PostgreSQL connection string' }),

    // Authentication (required in production)
    CLIENT_JWT_SECRET: str({
        desc: 'Secret key for signing client JWT tokens',
        // No default -- forces explicit configuration
    }),
    CLERK_SECRET_KEY: str({
        desc: 'Clerk API secret key',
        devDefault: 'sk_test_placeholder',
    }),

    // S3 / Object Storage
    S3_ENDPOINT: str({ default: 'http://localhost:3900' }),
    S3_REGION: str({ default: 'garage' }),
    S3_ACCESS_KEY: str({ desc: 'S3 access key ID' }),
    S3_SECRET_KEY: str({ desc: 'S3 secret access key' }),
    S3_BUCKET: str({ default: 'dietkaro-media' }),

    // AWS S3 (for reports -- if different from primary S3)
    AWS_REGION: str({ default: 'ap-south-1' }),
    AWS_ACCESS_KEY_ID: str({ devDefault: '' }),
    AWS_SECRET_ACCESS_KEY: str({ devDefault: '' }),
    AWS_S3_BUCKET: str({ default: 'dietconnect-uploads' }),

    // Email (optional)
    SMTP_HOST: str({ default: '' }),
    SMTP_PORT: port({ default: 587 }),
    SMTP_USER: str({ default: '' }),
    SMTP_PASS: str({ default: '' }),

    // Frontend URL
    FRONTEND_URL: str({ default: 'http://localhost:3000' }),
    API_BASE_URL: str({ default: 'http://localhost:3000' }),

    // Logging
    LOG_LEVEL: str({ choices: ['debug', 'info', 'warn', 'error'], default: 'info' }),
});
```

```typescript
// backend/src/server.ts -- import env validation FIRST
import 'dotenv/config';
import { env } from './config/env';  // Validates on import -- crashes early if invalid
import app from './app';
import logger from './utils/logger';

app.listen(env.PORT, () => {
    logger.info(`Server is running on port ${env.PORT}`);
});
```

Then replace all `process.env.X` references with `env.X` throughout the backend.

**Option B: Custom validator (no dependencies)**

```typescript
// backend/src/config/env.ts
function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function optionalEnv(name: string, fallback: string): string {
    return process.env[name] || fallback;
}

// Validate at import time
export const env = {
    PORT: parseInt(optionalEnv('PORT', '3000'), 10),
    NODE_ENV: optionalEnv('NODE_ENV', 'development'),
    DATABASE_URL: requireEnv('DATABASE_URL'),
    CLIENT_JWT_SECRET: requireEnv('CLIENT_JWT_SECRET'),
    S3_ACCESS_KEY: requireEnv('S3_ACCESS_KEY'),
    S3_SECRET_KEY: requireEnv('S3_SECRET_KEY'),
    // ... etc
} as const;
```

**Startup output on missing variables:**

```
================================
  Missing environment variables:
================================
  CLIENT_JWT_SECRET: Secret key for signing client JWT tokens
  S3_ACCESS_KEY: S3 access key ID

  Exiting. Fix your .env file and restart.
================================
```

---

## 12.4 Backend XML File in Schemas Directory

### The Problem

The file `backend/src/schemas/backend.xml` is a Repomix-generated dump of the entire backend codebase. It sits inside the source `schemas` directory alongside actual Zod schema files (`dietPlan.schema.ts`, `mealLog.schema.ts`, etc.).

```
backend/src/schemas/
  backend.xml          <-- 10,000+ line Repomix dump (NOT source code)
  dietPlan.schema.ts
  mealLog.schema.ts
```

The first line of the file confirms its nature:

```
This file is a merged representation of the entire codebase, combined into a single document by Repomix.
```

The root `.gitignore` already ignores `repomix-output.xml` at the project root, but this file is at a different path (`backend/src/schemas/backend.xml`) so it is not matched:

```gitignore
# .gitignore (current)
repomix-output.xml     # Only matches root-level file, not backend/src/schemas/backend.xml
```

### Impact

- **Repository bloat**: The file is likely thousands of lines (a full codebase dump), adding significant size to the git repository.
- **Confusion**: A developer browsing the `schemas/` directory would reasonably assume `backend.xml` is a schema configuration file.
- **Stale data**: The dump is a snapshot in time. It will quickly become outdated and misleading if anyone references it.
- **Security risk**: If the dump includes environment variable patterns or configuration details, it exposes internal architecture.

### The Fix

1. **Remove the file from the repository:**

```bash
git rm backend/src/schemas/backend.xml
```

2. **Update `.gitignore` to catch future Repomix dumps anywhere in the tree:**

```gitignore
# .gitignore -- add these patterns
repomix-output.xml
**/backend.xml
*.repomix.xml
```

3. **If the dump is useful for documentation, move it outside source:**

```bash
mkdir -p docs/repomix
mv backend/src/schemas/backend.xml docs/repomix/backend-snapshot.xml
```

But even in `docs/`, a multi-thousand-line XML dump is better regenerated on demand than committed:

```bash
# Add to package.json scripts instead
"scripts": {
    "repomix": "repomix --output docs/repomix/backend-snapshot.xml"
}
```

Additionally, the root-level `diet.xml` (shown as untracked in git status) appears to be another Repomix dump. It should also be gitignored:

```gitignore
diet.xml
```

---

## 12.5 Error Handling Patterns

### The Problem

The codebase uses three different error handling strategies, sometimes within the same request lifecycle, with no documented convention for which to use when.

**Pattern 1: `AppError` thrown from services (correct pattern)**

Most service methods throw `AppError` instances with semantic HTTP codes. These are caught by the global `errorHandler` middleware and formatted into consistent JSON responses.

```typescript
// backend/src/services/client.service.ts
if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

// backend/src/services/dietPlan.service.ts
if (!clientId) throw AppError.badRequest('clientId is required', 'CLIENT_ID_REQUIRED');

// backend/src/services/foodItem.service.ts
throw AppError.conflict(`Cannot delete: food item is used in ${usageCount} meal(s)`, 'FOOD_IN_USE');
```

**Pattern 2: Raw JSON responses from middleware (inconsistent)**

Auth middleware bypasses the `AppError` system entirely and manually constructs JSON responses:

```typescript
// backend/src/middleware/auth.middleware.ts:20-27
if (!auth.userId) {
    return res.status(401).json({
        success: false,
        error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
        }
    });
}

// Same file, line 36-43
if (!dbUser) {
    return res.status(401).json({
        success: false,
        error: {
            code: 'USER_NOT_REGISTERED',
            message: 'User not registered in the system.'
        }
    });
}
```

The `clientAuth.middleware.ts` does the same:

```typescript
// backend/src/middleware/clientAuth.middleware.ts:25-28
return res.status(401).json({
    success: false,
    error: { code: 'UNAUTHORIZED', message: 'No token provided' },
});
```

Meanwhile, route handlers in `clientApi.routes.ts` use `throw AppError.unauthorized()` for the same scenario:

```typescript
// backend/src/routes/clientApi.routes.ts:15
if (!req.client) throw AppError.unauthorized();
```

This means "unauthenticated" errors come from two different code paths with slightly different response shapes.

**Pattern 3: Inline `try/catch` with `console.error` and swallowed errors (frontend)**

Frontend catch blocks log to console but do not surface the error to the user:

```typescript
// frontend/src/app/dashboard/diet-plans/[id]/page.tsx
const handlePublish = async () => {
    try {
        await publishMutation.mutateAsync(planId);
    } catch (err) {
        console.error('Failed to publish plan:', err);
        // Error swallowed -- user sees no feedback
    }
};

const handleDownloadPdf = async () => {
    try {
        // ...
    } catch (err) {
        console.error('Failed to download PDF:', err);
        // Error swallowed -- user sees no feedback
    }
};
```

**Pattern 4: Return error objects instead of throwing (compliance service)**

The compliance service returns error data as a normal response instead of throwing:

```typescript
// backend/src/services/compliance.service.ts:102-104
if (!mealLog) {
    logger.warn('Compliance: MealLog not found', { mealLogId });
    return { score: 0, color: 'RED', issues: ['Meal log not found'] };
    // Does NOT throw AppError.notFound -- returns a degraded result
}
```

This is actually a valid design choice (graceful degradation), but it is not documented as an intentional pattern, so it looks inconsistent.

### Impact

- **Inconsistent error responses**: The same "unauthorized" scenario produces subtly different JSON depending on whether it comes from middleware or a route handler.
- **Silent failures in frontend**: Users perform an action, it fails, and they receive no feedback because `console.error` is the only handling.
- **Debugging difficulty**: When a service returns an error object vs. throws, the calling code must handle both paths. If a developer assumes "services always throw," they will miss the returned-error case.
- **No error codes in middleware responses**: The `errorHandler` middleware normalizes `AppError` instances into a standard shape, but manually-constructed responses in auth middleware skip this normalization.

### The Fix

**1. Document the error handling convention:**

```
ERROR HANDLING CONVENTIONS
==========================

Backend Services:
- MUST throw AppError for all expected error conditions (not found, bad input, auth failure)
- MAY return degraded results for non-critical failures (compliance calculation on missing data)
  - When doing so, add a comment: // Graceful degradation: returns zero score instead of failing
- MUST NOT catch errors silently -- let asyncHandler propagate to errorHandler

Backend Middleware:
- MUST throw AppError instead of manually constructing JSON responses
- The global errorHandler will format the response consistently

Backend Controllers:
- MUST use asyncHandler wrapper
- MUST NOT have try/catch blocks (asyncHandler handles this)
- Exception: when partial failure needs special handling (e.g., "save succeeded, photo upload failed")

Frontend:
- MUST show user-visible feedback (toast/alert) for all caught errors
- MUST use the reportError utility instead of console.error
```

**2. Convert middleware to use `AppError`:**

```typescript
// backend/src/middleware/auth.middleware.ts -- AFTER
import { AppError } from '../errors/AppError';

export const requireAuth = async (req, res, next) => {
    try {
        const auth = getAuth(req);
        if (!auth.userId) {
            throw AppError.unauthorized('Authentication required');
        }

        const dbUser = await prisma.user.findUnique({ where: { clerkUserId: auth.userId } });
        if (!dbUser) {
            throw AppError.unauthorized('User not registered in the system');
        }
        if (!dbUser.isActive) {
            throw AppError.forbidden('User account is inactive');
        }

        req.user = { /* ... */ };
        next();
    } catch (error) {
        // If it's already an AppError, pass it through
        if (error instanceof AppError) {
            return next(error);
        }
        // Unknown error -- wrap it
        logger.error('Auth middleware error', { error });
        next(AppError.unauthorized('Authentication failed'));
    }
};
```

**3. Add user-facing error feedback in frontend:**

```typescript
// frontend/src/app/dashboard/diet-plans/[id]/page.tsx -- AFTER
import { toast } from 'sonner'; // or whatever toast library is used

const handlePublish = async () => {
    if (!plan) return;
    try {
        await publishMutation.mutateAsync(planId);
        await refetch();
        toast.success('Diet plan published successfully');
    } catch (err) {
        reportError({ message: 'Failed to publish plan', severity: 'error', error: err });
        toast.error('Failed to publish plan. Please try again.');
    }
};
```

---

## 12.6 Logging Inconsistencies

### The Problem

The backend has a well-configured winston logger (`backend/src/utils/logger.ts`) that outputs structured JSON in production with file transports. However, usage is inconsistent across the codebase, and there is no request-level correlation.

**Mixed logging: `logger.*` vs `console.*` in backend**

Services consistently use the winston logger:

```typescript
// backend/src/services/client.service.ts:85
logger.info('Client created', { clientId: client.id, orgId, referralSource: data.referralSource });

// backend/src/services/compliance.service.ts:201
logger.info('Compliance calculated', { mealLogId, score, color, issues });

// backend/src/services/storage.service.ts:71
logger.info('Uploaded to S3', { key });
```

But middleware and some routes use `console.*`:

```typescript
// backend/src/middleware/auth.middleware.ts:68
console.error('Auth middleware error:', error);

// backend/src/middleware/testAuth.middleware.ts:56
console.error('Test auth error:', error);

// backend/src/routes/media.routes.ts:58
console.error('Error fetching image:', error);

// backend/src/server.ts:7
console.log(`Server is running on port ${PORT}`);

// backend/src/controllers/team.controller.ts:83
console.log(`[Team] Invitation created for ${email}. Link: ${inviteLink}`);
```

**No request ID tracking**

When multiple requests are being processed concurrently, log lines from different requests interleave. There is no request ID to correlate log entries belonging to the same request.

Current log output looks like:

```
2025-05-01 10:00:01 [info]: Client created {"clientId":"abc","orgId":"org1"}
2025-05-01 10:00:01 [info]: Compliance calculated {"mealLogId":"xyz","score":85}
2025-05-01 10:00:01 [error]: Error caught by global handler {"error":"Not found","path":"/api/v1/clients/def"}
```

It is impossible to tell which of these log lines belong to the same HTTP request.

**Sensitive data in logs:**

```typescript
// backend/src/controllers/clientAuth.controller.ts:38
logger.info(`[Client OTP] Generated for ${phone}: ${otp}`);
// Logs the actual OTP code -- sensitive in production
```

The comment says "Remove in production" but there is no mechanism to ensure this happens.

### Impact

- **Blind spots**: `console.error` in middleware bypasses file transports in production. Auth failures will not appear in `logs/error.log` or be picked up by log aggregation.
- **Cannot trace requests**: When a user reports "my request failed," there is no way to find all log lines from that specific request without a correlation ID.
- **Compliance risk**: Logging OTP codes violates security best practices and potentially data protection regulations.
- **Inconsistent formatting**: `console.log` outputs plain text while `logger.info` outputs structured JSON. Log aggregation parsers must handle both formats.

### The Fix

**1. Add request ID middleware:**

```typescript
// backend/src/middleware/requestId.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import logger from '../utils/logger';

declare global {
    namespace Express {
        interface Request {
            requestId: string;
        }
    }
}

/**
 * Assigns a unique request ID to every incoming request.
 * Uses the X-Request-ID header if provided (for distributed tracing),
 * otherwise generates a new UUID.
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
};
```

**2. Create a request-scoped logger helper:**

```typescript
// backend/src/utils/requestLogger.ts
import logger from './logger';
import { Request } from 'express';

/**
 * Creates a child logger that automatically includes the request ID
 * in every log entry, enabling full request tracing.
 */
export function getRequestLogger(req: Request) {
    return {
        info: (message: string, meta?: Record<string, unknown>) =>
            logger.info(message, { requestId: req.requestId, ...meta }),
        warn: (message: string, meta?: Record<string, unknown>) =>
            logger.warn(message, { requestId: req.requestId, ...meta }),
        error: (message: string, meta?: Record<string, unknown>) =>
            logger.error(message, { requestId: req.requestId, ...meta }),
        debug: (message: string, meta?: Record<string, unknown>) =>
            logger.debug(message, { requestId: req.requestId, ...meta }),
    };
}
```

**3. Register the middleware early in the stack:**

```typescript
// backend/src/app.ts
import { requestIdMiddleware } from './middleware/requestId.middleware';

const app = express();
app.use(requestIdMiddleware);  // FIRST -- before any other middleware
app.use(express.json());
app.use(cors());
// ...
```

**4. Use request logger in controllers and middleware:**

```typescript
// backend/src/middleware/auth.middleware.ts -- AFTER
import { getRequestLogger } from '../utils/requestLogger';

export const requireAuth = async (req, res, next) => {
    const log = getRequestLogger(req);
    try {
        const auth = getAuth(req);
        if (!auth.userId) {
            log.warn('Unauthenticated request', { path: req.path });
            throw AppError.unauthorized();
        }
        // ...
    } catch (error) {
        log.error('Auth middleware error', {
            error: error instanceof Error ? error.message : String(error),
        });
        next(error instanceof AppError ? error : AppError.unauthorized());
    }
};
```

**5. Redact sensitive data:**

```typescript
// backend/src/controllers/clientAuth.controller.ts -- AFTER
logger.info('Client OTP generated', {
    phone: phone.slice(0, 3) + '****' + phone.slice(-2),
    // OTP is NEVER logged, even in development
});
```

**6. Resulting structured log output:**

```json
{
    "timestamp": "2025-05-01 10:00:01",
    "level": "info",
    "message": "Client created",
    "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "service": "diet-connect-api",
    "clientId": "abc",
    "orgId": "org1"
}
```

Now all log entries from the same HTTP request share a `requestId`, enabling full request tracing:

```bash
# Find all logs for a specific request
grep "a1b2c3d4-e5f6-7890-abcd-ef1234567890" logs/combined.log
```

**7. Standardization checklist:**

| Location | Current | Target |
|---|---|---|
| `server.ts` | `console.log` | `logger.info` |
| `auth.middleware.ts` | `console.error` | `logger.error` with request ID |
| `testAuth.middleware.ts` | `console.error` | `logger.error` |
| `media.routes.ts` | `console.error` | `logger.error` |
| `team.controller.ts` | `console.log` | `logger.info` |
| `clientAuth.controller.ts` | `logger.info` with OTP | `logger.info` with redacted phone, no OTP |
| All services | `logger.*` (correct) | No changes needed |
| `errorHandler.ts` | `logger.error` (correct) | Add `requestId: req.requestId` |

---

## Summary of Prioritized Fixes

| Issue | Severity | Effort | Priority |
|---|---|---|---|
| 12.3 No env var validation | **High** | Low (1-2 hours) | P0 -- security risk with JWT fallback |
| 12.5 Inconsistent error handling | **Medium** | Medium (4-6 hours) | P1 -- affects reliability |
| 12.2 Console statements in production | **Medium** | Low (2-3 hours) | P1 -- affects observability |
| 12.6 Logging inconsistencies / no request ID | **Medium** | Medium (3-4 hours) | P1 -- affects debugging |
| 12.4 XML file in source | **Low** | Trivial (5 min) | P2 -- repo hygiene |
| 12.1 Large file sizes | **Medium** | High (1-2 days) | P2 -- affects maintainability |

Start with 12.3 (env validation) because it closes a security hole. Then address 12.2 + 12.6 together since they are related (logging standardization). Tackle 12.5 (error handling) alongside feature work. Schedule 12.1 (file splitting) as a refactoring sprint when there is capacity.
