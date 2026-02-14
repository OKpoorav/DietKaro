# 9. Type Safety Issues

**Severity**: HIGH / MEDIUM / LOW (per issue)
**Category**: Type System, Developer Experience, Maintainability

---

## 9.1 HIGH: Pervasive Use of `any` in Services

### Description

Multiple backend service methods accept `any`-typed parameters, bypassing TypeScript's type system entirely. This means invalid data shapes pass through the compiler without error and can only be caught at runtime -- if at all. The project already uses Zod schemas for some endpoints (e.g., `CreateDietPlanInput`, `UpdateMealLogInput`) but many service methods ignore these schemas and accept raw untyped objects.

### Affected Locations

| File | Line | Signature |
|------|------|-----------|
| `backend/src/services/client.service.ts` | 34 | `createClient(data: any, orgId: string, userId: string)` |
| `backend/src/services/client.service.ts` | 121 | `listClients(orgId: string, query: any, userRole: string, userId: string)` |
| `backend/src/services/client.service.ts` | 152 | `updateClient(clientId: string, updateData: any, orgId: string)` |
| `backend/src/services/client.service.ts` | 183 | `getClientProgress(clientId: string, orgId: string, query: any)` |
| `backend/src/services/meal.service.ts` | 6 | `addMealToPlan(body: any, orgId: string)` |
| `backend/src/services/meal.service.ts` | 46 | `updateMeal(mealId: string, body: any, orgId: string)` |
| `backend/src/services/dietPlan.service.ts` | 94 | `listPlans(orgId: string, query: any)` |
| `backend/src/services/dietPlan.service.ts` | 171 | `assignTemplateToClient(templateId: string, body: any, orgId: string, userId: string)` |
| `backend/src/services/mealLog.service.ts` | 42 | `listMealLogs(orgId: string, query: any, userRole: string, userId: string)` |

### Why This Is Dangerous

1. **No compile-time safety**: A caller can pass `{ fullname: "John" }` (lowercase `n`) instead of `{ fullName: "John" }` and the compiler will not catch it. The record is silently created with `fullName` as `undefined`.

2. **Prisma passes `any` through to SQL**: When `updateClient` receives `updateData: any` and passes it directly to `prisma.client.update({ data: updateData })`, any arbitrary field could be injected. If the request body contains `{ isActive: false, deletedAt: "2024-01-01" }`, it will be applied without validation.

3. **Internal `where: any` compounds the problem**: Inside `listClients` and `listPlans`, the Prisma `where` clause is typed `any`, meaning dynamically constructed filter objects have no shape validation:

```typescript
// backend/src/services/client.service.ts:125
const where: any = { orgId, isActive: status !== 'inactive' };
```

### Current Code Example

```typescript
// backend/src/services/client.service.ts:34
async createClient(data: any, orgId: string, userId: string) {
    // data.fullName, data.email, data.phone -- all unchecked at compile time
    const client = await prisma.client.create({
        data: {
            orgId,
            primaryDietitianId: data.primaryDietitianId || userId,
            fullName: data.fullName,       // Could be undefined
            email: data.email,             // Could be undefined
            phone: data.phone,             // Could be undefined
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            // ...20+ more fields from data
        },
    });
}
```

### Fix: Use Zod-Inferred Types Consistently

The project already has Zod schemas in `backend/src/schemas/`. Extend this pattern to all services.

**Step 1**: Create a Zod schema for client creation:

```typescript
// backend/src/schemas/client.schema.ts
import { z } from 'zod';

export const createClientSchema = z.object({
    fullName: z.string().min(1, 'Full name is required'),
    email: z.string().email('Invalid email'),
    phone: z.string().min(10, 'Phone must be at least 10 characters'),
    dateOfBirth: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid date').optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    heightCm: z.number().positive().optional(),
    currentWeightKg: z.number().positive().optional(),
    targetWeightKg: z.number().positive().optional(),
    activityLevel: z.enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active']).optional(),
    dietaryPreferences: z.array(z.string()).optional().default([]),
    allergies: z.array(z.string()).optional().default([]),
    medicalConditions: z.array(z.string()).optional().default([]),
    medications: z.array(z.string()).optional().default([]),
    healthNotes: z.string().optional(),
    primaryDietitianId: z.string().uuid().optional(),
    referralCode: z.string().optional(),
    referralSource: z.enum(['doctor', 'dietitian', 'client_referral', 'social_media', 'website', 'other']).optional(),
    referralSourceName: z.string().optional(),
    referralSourcePhone: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export const clientListQuerySchema = z.object({
    search: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    primaryDietitianId: z.string().uuid().optional(),
    sortBy: z.enum(['createdAt', 'fullName', 'updatedAt']).optional().default('createdAt'),
    page: z.coerce.number().int().positive().optional().default(1),
    pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
```

**Step 2**: Update the service to use inferred types:

```typescript
// backend/src/services/client.service.ts
import { CreateClientInput, UpdateClientInput, ClientListQuery } from '../schemas/client.schema';
import { Prisma } from '@prisma/client';

export class ClientService {
    async createClient(data: CreateClientInput, orgId: string, userId: string) {
        // data.fullName is now guaranteed to be a string
        // data.email is now guaranteed to be a valid email
        // TypeScript will catch typos at compile time
    }

    async listClients(orgId: string, query: ClientListQuery, userRole: string, userId: string) {
        const where: Prisma.ClientWhereInput = {
            orgId,
            isActive: query.status !== 'inactive',
        };
        // TypeScript now enforces valid Prisma filter shapes
    }

    async updateClient(clientId: string, updateData: UpdateClientInput, orgId: string) {
        // Only fields defined in the schema can be passed
        // Prevents injection of isActive, deletedAt, orgId, etc.
    }
}
```

**Step 3**: Similarly for `meal.service.ts`:

```typescript
// backend/src/schemas/meal.schema.ts
import { z } from 'zod';

export const addMealSchema = z.object({
    planId: z.string().uuid(),
    dayIndex: z.number().min(0).max(6).optional(),
    mealDate: z.string().optional(),
    mealType: z.enum(['breakfast', 'lunch', 'snack', 'dinner']),
    timeOfDay: z.string().optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    instructions: z.string().optional(),
    foodItems: z.array(z.object({
        foodId: z.string().uuid(),
        quantity: z.number().positive(),
        notes: z.string().optional(),
        optionGroup: z.number().int().min(0).optional().default(0),
        optionLabel: z.string().optional(),
    })).optional(),
});

export type AddMealInput = z.infer<typeof addMealSchema>;
```

**Step 4**: Replace `where: any` with Prisma types:

```typescript
// Before (unsafe)
const where: any = { orgId, isActive: true };
if (clientId) where.clientId = String(clientId);

// After (type-safe)
const where: Prisma.DietPlanWhereInput = { orgId, isActive: true };
if (query.clientId) where.clientId = query.clientId;
```

### Effort Estimate

Medium -- requires creating 2-3 new schema files and updating ~10 method signatures. No database changes needed.

---

## 9.2 MEDIUM: Duplicate Type Definitions

### Description

The same conceptual types are defined independently in three separate codebases with no shared package or code generation. When the backend adds a field, the frontend and client-app types must be manually updated, leading to drift.

### Affected Types and Locations

| Type | Backend | Frontend | Client-App |
|------|---------|----------|------------|
| `ComplianceColor` | `compliance.service.ts:12` | N/A | `types/index.ts:198` |
| `DailyAdherence` | `compliance.service.ts:30-37` | N/A | `types/index.ts:210-217` |
| `WeeklyAdherence` | `compliance.service.ts:39-46` | N/A | `types/index.ts:219-226` |
| `ComplianceHistory` | `compliance.service.ts:54-59` | N/A | `types/index.ts:234-239` |
| `MealBreakdown` | `compliance.service.ts:20-28` | N/A | `types/index.ts:200-208` |
| `ComplianceHistoryEntry` | `compliance.service.ts:48-52` | N/A | `types/index.ts:228-232` |
| `Meal` (concept) | Prisma model | `diet-plan.types.ts:75-81` (`LocalMeal`) | `types/index.ts:40-55` |
| `MealLog` (concept) | Prisma model | Inline in hooks | `types/index.ts:67-80` |
| `Client` (concept) | Prisma model | `use-clients.ts:8-46` | `types/index.ts:16-28` |

### Concrete Drift Example

The backend compliance types and client-app compliance types are currently identical, but there is no mechanism to keep them in sync. If the backend adds a `streakDays` field to `DailyAdherence`, the client-app will not receive a compile-time error.

```typescript
// Backend: compliance.service.ts:30-37
export interface DailyAdherence {
    date: string;
    score: number;
    color: ComplianceColor;
    mealsLogged: number;
    mealsPlanned: number;
    mealBreakdown: MealBreakdown[];
}

// Client-App: types/index.ts:210-217
// Exact same interface, manually duplicated
export interface DailyAdherence {
    date: string;
    score: number;
    color: ComplianceColor;
    mealsLogged: number;
    mealsPlanned: number;
    mealBreakdown: MealBreakdown[];
}
```

### Fix Options

**Option A: Shared types package (monorepo approach)**

```
DietKaro/
  packages/
    shared-types/
      src/
        compliance.ts
        client.ts
        meal.ts
        mealLog.ts
        api.ts
      package.json
      tsconfig.json
  backend/
    package.json        # depends on @dietkaro/shared-types
  frontend/
    package.json        # depends on @dietkaro/shared-types
  client-app/
    package.json        # depends on @dietkaro/shared-types
```

```typescript
// packages/shared-types/src/compliance.ts
export type ComplianceColor = 'GREEN' | 'YELLOW' | 'RED';

export interface DailyAdherence {
    date: string;
    score: number;
    color: ComplianceColor;
    mealsLogged: number;
    mealsPlanned: number;
    mealBreakdown: MealBreakdown[];
}
// ... all shared types in one place
```

**Option B: API type generation (codegen approach)**

Use a tool like `openapi-typescript` to generate client types from the backend API schema:

```bash
# Generate types from OpenAPI spec
npx openapi-typescript http://localhost:3000/api-docs/swagger.json -o ./src/types/api.generated.ts
```

### Effort Estimate

Medium-High -- Option A requires setting up workspace packages; Option B requires adding OpenAPI spec annotations to the backend.

---

## 9.3 MEDIUM: Frontend ClientData vs Backend Client

### Description

The frontend uses at least two different type definitions for the same "Client" entity, neither of which fully matches the backend Prisma model. This leads to confusion about which fields are available at any point in the code.

### The Three Definitions

**1. `frontend/src/lib/types/diet-plan.types.ts:7-31` -- `ClientData`**

Used by the diet plan builder. Contains a subset of fields, all optional:

```typescript
export interface ClientData {
    fullName?: string;
    targetWeightKg?: number;
    dateOfBirth?: string;
    heightCm?: number;
    currentWeightKg?: number;
    email?: string;
    phone?: string;
    gender?: string;
    medicalProfile?: {
        allergies?: string[];
        conditions?: string[];
    };
    allergies?: string[];
    intolerances?: string[];
    dietPattern?: string;
    medicalConditions?: string[];
    foodRestrictions?: FoodRestriction[];
    dislikes?: string[];
    likedFoods?: string[];
    targetCalories?: number | null;
    targetProteinG?: number | null;
    targetCarbsG?: number | null;
    targetFatsG?: number | null;
}
```

**2. `frontend/src/lib/hooks/use-clients.ts:8-46` -- `Client`**

Used by the client list/detail pages. Has fields that `ClientData` lacks (`isActive`, `createdAt`, `primaryDietitian`) and vice versa:

```typescript
export interface Client {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth?: string;
    gender?: 'male' | 'female' | 'other';
    currentWeightKg?: number;
    targetWeightKg?: number;
    heightCm?: number;
    isActive: boolean;
    status?: 'active' | 'at-risk' | 'completed';
    createdAt: string;
    updatedAt: string;
    lastActivityAt?: string;
    primaryDietitian?: { id: string; fullName: string; };
    medicalProfile?: { allergies: string[]; conditions: string[]; medications: string[]; };
    allergies?: string[];
    intolerances?: string[];
    dietPattern?: string;
    medicalConditions?: string[];
    foodRestrictions?: FoodRestriction[];
    dislikes?: string[];
    likedFoods?: string[];
    preferredCuisines?: string[];
    targetCalories?: number | null;
    targetProteinG?: number | null;
    targetCarbsG?: number | null;
    targetFatsG?: number | null;
}
```

**3. `client-app/types/index.ts:16-28` -- `Client`**

A minimal definition for the mobile app:

```typescript
export interface Client {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    profilePhotoUrl?: string;
    heightCm?: number;
    currentWeightKg?: number;
    targetWeightKg?: number;
    dietaryPreferences: string[];
    allergies: string[];
    onboardingCompleted?: boolean;
}
```

### Problems

1. `ClientData.gender` is `string`, while `Client.gender` is `'male' | 'female' | 'other'`. Assigning one to the other is not type-safe.
2. `ClientData.medicalProfile` has `{ allergies?, conditions? }` while `Client.medicalProfile` has `{ allergies, conditions, medications }` -- the shapes do not match.
3. `ClientData` lacks `id`, making it impossible to reference which client the data belongs to without passing `id` separately.
4. The client-app `Client` lacks `gender`, `activityLevel`, `medicalConditions`, and many other fields present in the backend.

### Fix: Single Source of Truth

Define one canonical `Client` type (or use the shared package from 9.2) and derive subsets as needed:

```typescript
// shared-types/client.ts
export interface Client {
    id: string;
    orgId: string;
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth?: string;
    gender?: 'male' | 'female' | 'other';
    profilePhotoUrl?: string;
    heightCm?: number;
    currentWeightKg?: number;
    targetWeightKg?: number;
    activityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
    dietaryPreferences: string[];
    allergies: string[];
    intolerances: string[];
    medicalConditions: string[];
    dietPattern?: string;
    dislikes: string[];
    likedFoods: string[];
    isActive: boolean;
    onboardingCompleted: boolean;
    createdAt: string;
    updatedAt: string;
    targetCalories?: number | null;
    targetProteinG?: number | null;
    targetCarbsG?: number | null;
    targetFatsG?: number | null;
    primaryDietitian?: { id: string; fullName: string };
}

// For the diet plan builder, pick just what's needed
export type ClientDietContext = Pick<Client,
    | 'fullName' | 'allergies' | 'intolerances' | 'dietPattern'
    | 'medicalConditions' | 'dislikes' | 'likedFoods'
    | 'targetCalories' | 'targetProteinG' | 'targetCarbsG' | 'targetFatsG'
    | 'heightCm' | 'currentWeightKg' | 'targetWeightKg' | 'gender'
>;

// For the mobile app, pick the minimal set
export type ClientAppProfile = Pick<Client,
    | 'id' | 'fullName' | 'email' | 'phone' | 'profilePhotoUrl'
    | 'heightCm' | 'currentWeightKg' | 'targetWeightKg'
    | 'dietaryPreferences' | 'allergies' | 'onboardingCompleted'
>;
```

### Effort Estimate

Medium -- consolidate into one file, update imports across frontend and client-app.

---

## 9.4 LOW: Inconsistent Naming Conventions

### Description

Field naming varies between backend and frontend, requiring manual mapping code in hooks and components. This creates maintenance burden and is a source of bugs.

### Examples

| Concept | Backend Field (Prisma/API) | Frontend Usage | Issue |
|---------|---------------------------|----------------|-------|
| Meal name | `name` (Meal model) | `title` (schema, `meal.service.ts:7`) | Schema says `title`, service maps to `name` |
| Time slot | `timeOfDay` (Meal model) | `scheduledTime` (MealLog model) | Different names for related concepts |
| Day index | `dayOfWeek` (Meal model) | `dayIndex` (schema) | Schema says `dayIndex`, mapped to `dayOfWeek` in service |
| Meal type | `mealType` enum | `type` (in `LocalMeal.type`) | Frontend uses `type`, backend uses `mealType` |
| Food quantity | `quantityG` (DB) | `quantity` (schema) | Schema says `quantity`, mapped to `quantityG` in service |

### Evidence of Mapping Overhead

The mapping is scattered across service code:

```typescript
// backend/src/services/meal.service.ts:16-21
const meal = await prisma.meal.create({
    data: {
        planId,
        dayOfWeek: dayIndex,        // dayIndex -> dayOfWeek
        mealType,
        timeOfDay,
        name: title,                // title -> name
        // ...
    },
});

// backend/src/services/dietPlan.service.ts:41-49
create: data.meals.map((meal: any, index: number) => ({
    dayOfWeek: meal.dayIndex,       // dayIndex -> dayOfWeek
    mealType: meal.mealType,
    name: meal.title,               // title -> name
    // ...
})),
```

And the frontend also maps in the other direction:

```typescript
// frontend/src/lib/hooks/use-clients.ts:128-148
// Must manually map weightTrend.totalWeightChange -> weight.totalChange
// Must manually map mealAdherence.eatenMeals -> meals.eaten
const progress: ClientProgress = {
    weight: {
        totalChange: raw.weightTrend?.totalWeightChange ?? null,
        weeklyAvgChange: raw.weightTrend?.weeklyAverageChange ?? null,
        // ...
    },
};
```

### Fix: Standardize Naming

Pick one convention and apply it end to end. The recommended approach is to match the Prisma model naming (since it is the source of truth) and use Zod schemas for the API boundary:

```typescript
// Option 1: Rename schema to match Prisma (least disruption)
export const addMealSchema = z.object({
    planId: z.string().uuid(),
    dayOfWeek: z.number().min(0).max(6).optional(),    // was dayIndex
    mealType: z.enum(['breakfast', 'lunch', 'snack', 'dinner']),
    timeOfDay: z.string().optional(),
    name: z.string().min(1),                            // was title
    description: z.string().optional(),
    instructions: z.string().optional(),
    foodItems: z.array(z.object({
        foodId: z.string().uuid(),
        quantityG: z.number().positive(),               // was quantity
        notes: z.string().optional(),
        optionGroup: z.number().int().min(0).optional().default(0),
        optionLabel: z.string().optional(),
    })).optional(),
});

// Option 2: Keep API names but use a transform layer (more work, cleaner API)
export const addMealSchema = z.object({
    title: z.string().min(1),
    dayIndex: z.number().min(0).max(6).optional(),
}).transform(data => ({
    name: data.title,
    dayOfWeek: data.dayIndex,
}));
```

### Effort Estimate

Low -- mostly renaming. Can be done incrementally. Frontend mapping code in `use-clients.ts` can be removed once the API response shape is standardized.

---

## Summary

| Issue | Severity | Effort | Impact |
|-------|----------|--------|--------|
| 9.1 Pervasive `any` in services | HIGH | Medium | Runtime errors, potential data corruption |
| 9.2 Duplicate type definitions | MEDIUM | Medium-High | Type drift between apps |
| 9.3 ClientData vs Client confusion | MEDIUM | Medium | Developer confusion, incomplete types |
| 9.4 Inconsistent naming | LOW | Low | Mapping boilerplate, subtle bugs |
