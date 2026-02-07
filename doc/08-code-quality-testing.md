# Module 8: Code Quality, Testing & Configuration

**Priority:** P2
**Effort:** Ongoing (3-5 days initial, then continuous)
**Impact:** Long-term maintainability, reliability, developer confidence

---

## Current State

- **Test coverage: 0%** - Only one test file exists (`backend/tests/validationEngine.test.ts`), no frontend or mobile tests
- **TypeScript strictness: Partial** - `any` types used in controllers, no strict mode enforced
- **Hardcoded configuration: Widespread** - Business rules embedded in service code
- **Logging: Minimal** - No structured logging or request tracing
- **No CI/CD pipeline** visible in the codebase

---

## What Needs To Be Done

### 1. Extract All Hardcoded Configuration

Gather every hardcoded business value into configuration files.

**Create:** `backend/src/config/` directory with:

#### `backend/src/config/app.config.ts`
```
- DEFAULT_PAGE_SIZE: 20
- MAX_PAGE_SIZE: 100
- FILE_UPLOAD_MAX_SIZE_MB: 10
- PRESIGNED_URL_EXPIRY_SECONDS: 3600
- IMAGE_COMPRESSION_QUALITY: 80
- SESSION_EXPIRY_DAYS: 30
```

#### `backend/src/config/compliance.config.ts`
(See Module 6 for details)

#### `backend/src/config/validation.config.ts`
(See Module 5 for details)

#### `backend/src/config/referral.config.ts`
```
- REFERRALS_PER_BENEFIT: 3 (currently hardcoded as `Math.floor(count / 3)`)
- BENEFIT_TYPE: 'free_month'
```

#### `backend/src/config/nutrition.config.ts`
```
- NUTRITION_THRESHOLDS (currently hardcoded in foodTagging.service.ts lines 47-61)
- HEALTH_FLAG_RULES (currently hardcoded in foodTagging.service.ts lines 65-70)
- ALLERGEN_KEYWORDS (currently hardcoded in foodTagging.service.ts)
```

---

### 2. Fix TypeScript Strictness

#### 2.1 Eliminate `any` Types in Controllers

**Problem:** Multiple controllers use `const where: any = {}` for building Prisma queries.

**Fix:** Create typed filter interfaces:

```typescript
// backend/src/types/filters.ts
interface ClientFilters {
  orgId: string;
  isActive?: boolean;
  primaryDietitianId?: string;
  search?: string;
  deletedAt?: null;
}

interface DateRangeFilter {
  gte?: Date;
  lte?: Date;
}

interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}
```

#### 2.2 Create Generic Response Types

**Create:** `backend/src/types/response.ts`

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
```

Currently each controller reimplements the meta/pagination structure inline.

#### 2.3 Enable Strict TypeScript (Optional, P3)

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

This will surface many issues. Fix incrementally, file by file.

---

### 3. Add Backend Tests

**Current:** 1 test file (`validationEngine.test.ts`)
**Target:** Unit tests for all services, integration tests for API endpoints

#### 3.1 Service Unit Tests (Priority)

| Test File | Service | Key Test Cases |
|-----------|---------|---------------|
| `compliance.service.test.ts` | ComplianceService | Score calculation, color assignment, edge cases |
| `foodTagging.service.test.ts` | FoodTaggingService | Category detection, allergen detection, bulk tagging |
| `onboarding.service.test.ts` | OnboardingService | Step saving, status tracking, preset application |
| `notification.service.test.ts` | NotificationService | Notification creation, delivery status |
| `storage.service.test.ts` | StorageService | Upload, compression, thumbnail generation |

**Once service layer is extracted (Module 1):**

| Test File | Service | Key Test Cases |
|-----------|---------|---------------|
| `client.service.test.ts` | ClientService | CRUD, referral code, progress calculation |
| `dietPlan.service.test.ts` | DietPlanService | Nested creation, publishing, template cloning |
| `mealLog.service.test.ts` | MealLogService | Status update, compliance trigger, nutrition calc |
| `weightLog.service.test.ts` | WeightLogService | BMI calculation, outlier detection, stats |
| `foodItem.service.test.ts` | FoodItemService | Search, nutrition scaling, auto-tag trigger |

#### 3.2 API Integration Tests

| Test File | Endpoints | Key Test Cases |
|-----------|-----------|---------------|
| `auth.integration.test.ts` | `/auth/*` | Login, token refresh, invalid credentials |
| `clients.integration.test.ts` | `/clients/*` | CRUD, pagination, search, medical profile |
| `dietPlans.integration.test.ts` | `/diet-plans/*` | Create with meals, publish, template |
| `mealLogs.integration.test.ts` | `/meal-logs/*` | Status update, review, photo upload |

#### 3.3 Test Setup

**Create:** `backend/tests/setup.ts`
- Configure test database (use `.env.test`)
- Seed test data before suites
- Clean up after suites
- Mock external services (S3, email, push notifications)

---

### 4. Add Frontend Tests

#### 4.1 Hook Tests

Using `@testing-library/react-hooks` or Vitest:

| Test File | Hook | Key Test Cases |
|-----------|------|---------------|
| `use-clients.test.ts` | useClients | Fetch list, pagination, search, create mutation |
| `use-diet-plans.test.ts` | useDietPlans | Fetch, create, publish mutation |
| `use-validation.test.ts` | useValidation | Validate food, batch validate, cache behavior |

#### 4.2 Component Tests

Using `@testing-library/react`:

| Test File | Component | Key Test Cases |
|-----------|-----------|---------------|
| `modal.test.tsx` | Modal | Open, close, escape key, overlay click |
| `add-food-modal.test.tsx` | AddFoodModal | Search, select, validation alert |
| `validation-alert.test.tsx` | ValidationAlert | RED/YELLOW/GREEN rendering |

#### 4.3 E2E Tests (P3)

Using Playwright or Cypress:
- Dietitian login -> create client -> create diet plan -> publish
- Meal log review flow
- Weight tracking flow

---

### 5. Add Structured Logging

#### 5.1 Backend Logging

**File:** `backend/src/utils/logger.ts`

Enhance with:
- Request ID tracking (correlate logs across a request lifecycle)
- Structured JSON format for production
- Log levels: error, warn, info, debug
- Request/response logging middleware (method, path, status, duration)

**Create:** `backend/src/middleware/requestLogger.middleware.ts`

```
Log for every request:
- Request ID (UUID)
- Method + path
- User ID (from auth)
- Response status code
- Response time in ms
```

#### 5.2 Mobile App Logging

**Create:** `client-app/utils/logger.ts`

- Log API calls with request/response (in dev mode)
- Log navigation events
- Log errors with stack traces
- Optionally send error logs to backend for monitoring

---

### 6. Add Request Correlation IDs

**Create:** `backend/src/middleware/requestId.middleware.ts`

```
- Generate UUID for each incoming request
- Attach to `req.requestId`
- Include in all log entries
- Return in response header: `X-Request-ID`
- Pass to downstream service calls
```

This enables tracing a single user action across all log entries.

---

### 7. Linting & Formatting Standardization

#### 7.1 Backend

**Verify/create:** `backend/.eslintrc.json`
- TypeScript ESLint rules
- No `any` warning
- Unused variable errors
- Consistent import ordering

**Verify/create:** `backend/.prettierrc`
- Consistent formatting across all files

#### 7.2 Frontend

**Verify existing:** `frontend/.eslintrc.json`
- Ensure React hooks rules enabled
- Ensure accessibility rules enabled

#### 7.3 Mobile App

**Create if missing:** `client-app/.eslintrc.json`
- React Native specific rules
- Expo specific rules

---

### 8. API Documentation

**Create:** `backend/src/docs/` or use Swagger/OpenAPI

Document all endpoints with:
- Request/response schemas
- Authentication requirements
- Error codes
- Rate limits

Consider using `swagger-jsdoc` + `swagger-ui-express` to auto-generate from JSDoc comments on routes.

---

### 9. Environment Variable Validation

**Create:** `backend/src/config/env.ts`

Validate all required environment variables at startup:
```typescript
const requiredVars = ['DATABASE_URL', 'CLERK_SECRET_KEY', 'S3_ENDPOINT', ...];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}
```

This prevents the app from starting with missing config and failing at runtime.

---

## Definition of Done

- [ ] All hardcoded business values extracted to config files
- [ ] `any` types replaced with proper TypeScript interfaces
- [ ] Generic response types created and used across controllers
- [ ] Backend service unit tests written (target: 80% coverage)
- [ ] API integration tests for core endpoints
- [ ] Frontend hook tests written
- [ ] Structured logging with request IDs implemented
- [ ] ESLint + Prettier configured consistently across all 3 codebases
- [ ] Environment variable validation at startup
- [ ] Test setup with test database and mocking configured
