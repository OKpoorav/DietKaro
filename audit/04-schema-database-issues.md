# 04 - Schema & Database Issues

> Severity range: MEDIUM to LOW
> Area: Prisma schema, Zod validation schemas, database indexes, type safety

This document covers mismatches between Prisma schema definitions and Zod validation schemas, missing database indexes, and fields that use weaker types than necessary.

---

## Table of Contents

- [4.1 MEDIUM: ActivityLevel Enum Mismatch](#41-medium-activitylevel-enum-mismatch)
- [4.2 MEDIUM: Decimal Fields vs number Type in Zod Schemas](#42-medium-decimal-fields-vs-number-type-in-zod-schemas)
- [4.3 LOW: Missing Indexes](#43-low-missing-indexes)
- [4.4 LOW: Invitation.status Is a String Not an Enum](#44-low-invitationstatus-is-a-string-not-an-enum)
- [4.5 LOW: foodRestrictions Uses JSON Type](#45-low-foodrestrictions-uses-json-type)

---

## 4.1 MEDIUM: ActivityLevel Enum Mismatch

### The Problem

The Prisma `ActivityLevel` enum and the Zod validation schema in `client.schema.ts` define different sets of values. When a client sends one of the Zod-accepted values that does not exist in the Prisma enum, the database write fails at runtime.

**Prisma enum** (`backend/prisma/schema.prisma`, lines 41-46):

```prisma
enum ActivityLevel {
  sedentary
  lightly_active
  moderately_active
  very_active
}
```

**Zod schema** (`backend/src/schemas/client.schema.ts`, line 16):

```typescript
activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
```

**Value comparison:**

| Zod Value (API accepts) | Prisma Enum (DB accepts) | Match? |
|-------------------------|--------------------------|--------|
| `sedentary`             | `sedentary`              | Yes    |
| `light`                 | `lightly_active`         | NO     |
| `moderate`              | `moderately_active`      | NO     |
| `active`                | *(does not exist)*       | NO     |
| `very_active`           | `very_active`            | Yes    |

Three of the five Zod values do not exist in the Prisma enum. `active` has no Prisma counterpart at all.

### Impact

- **API calls fail silently at the database layer.** A `POST /clients` or `PATCH /clients/:id` request with `activityLevel: "light"` passes Zod validation but throws a Prisma error:
  ```
  Invalid value for argument `activityLevel`. Expected ActivityLevel.
  ```
- The frontend and client app may present dropdown options that can never be saved.
- Only `sedentary` and `very_active` reliably round-trip through the API.

### The Fix

Align the Zod schema values to match the Prisma enum exactly.

**File:** `backend/src/schemas/client.schema.ts`

```typescript
// BEFORE (broken)
activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),

// AFTER (aligned with Prisma)
activityLevel: z.enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active']).optional(),
```

**Frontend updates required:**

Any frontend component that renders activity-level options must also switch to the new values. Search all frontend files for the old values (`light`, `moderate`, `active`) and replace them:

```typescript
// Example: dropdown options
const activityLevelOptions = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'lightly_active', label: 'Lightly Active' },
  { value: 'moderately_active', label: 'Moderately Active' },
  { value: 'very_active', label: 'Very Active' },
];
```

**Client-app updates required:**

The React Native client app must use the same values in any picker or form that sets `activityLevel`.

**Data migration:**

If any rows were written with the old values (unlikely since they would fail at Prisma, but check raw SQL inserts or seed data):

```sql
-- Check for stale values (run against production before migrating)
SELECT id, "activityLevel" FROM "Client"
WHERE "activityLevel" NOT IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active');
```

No Prisma migration is needed because the Prisma enum is already correct. The fix is purely in application code.

---

## 4.2 MEDIUM: Decimal Fields vs number Type in Zod Schemas

### The Problem

Prisma uses the `Decimal` type (backed by PostgreSQL `NUMERIC`) for fields like weight, height, and nutrition macros. Zod schemas validate these as `z.number()`. At runtime, Prisma returns `Prisma.Decimal` objects (not plain JavaScript `number` values). The codebase compensates with `Number(value)` calls scattered across dozens of files, but this is fragile and error-prone.

**Prisma schema** (`backend/prisma/schema.prisma`):

```prisma
model Client {
  heightCm        Decimal?  @db.Decimal(5, 2)
  currentWeightKg Decimal?  @db.Decimal(5, 2)
  targetWeightKg  Decimal?  @db.Decimal(5, 2)
  targetProteinG  Decimal?  @db.Decimal(5, 1)
  targetCarbsG    Decimal?  @db.Decimal(5, 1)
  targetFatsG     Decimal?  @db.Decimal(5, 1)
}

model FoodItem {
  servingSizeG Decimal  @default(100) @db.Decimal(6, 2)
  proteinG     Decimal? @db.Decimal(5, 1)
  carbsG       Decimal? @db.Decimal(5, 1)
  fatsG        Decimal? @db.Decimal(5, 1)
  fiberG       Decimal? @db.Decimal(5, 1)
  sodiumMg     Decimal? @db.Decimal(7, 2)
  sugarG       Decimal? @db.Decimal(5, 1)
}

model WeightLog {
  weightKg                 Decimal  @db.Decimal(5, 2)
  bmi                      Decimal? @db.Decimal(4, 2)
  weightChangeFromPrevious Decimal? @db.Decimal(5, 2)
}
```

**Zod schemas validate as plain numbers** (`backend/src/schemas/client.schema.ts`, lines 9-15):

```typescript
heightCm: z.number().min(50).max(300).optional(),
currentWeightKg: z.number().min(10).max(500).optional(),
targetWeightKg: z.number().min(10).max(500).optional(),
targetProteinG: z.number().min(0).max(500).optional().nullable(),
targetCarbsG: z.number().min(0).max(1000).optional().nullable(),
targetFatsG: z.number().min(0).max(500).optional().nullable(),
```

**Scattered `Number()` conversions** (partial list from real codebase -- 60+ occurrences):

```typescript
// backend/src/services/weightLog.service.ts
const heightM = Number(client.heightCm) / 100;
weightKg: Number(weightLog.weightKg),
bmi: weightLog.bmi ? Number(weightLog.bmi) : null,

// backend/src/services/client.service.ts
const targetWeight = client.targetWeightKg ? Number(client.targetWeightKg) : null;
startWeight = Number(weightLogs[0].weightKg);
currentWeight = Number(weightLogs[weightLogs.length - 1].weightKg);

// backend/src/services/foodTagging.service.ts
proteinG: food.proteinG ? Number(food.proteinG) : null,
carbsG: food.carbsG ? Number(food.carbsG) : null,
fatsG: food.fatsG ? Number(food.fatsG) : null,

// backend/src/utils/nutritionCalculator.ts
const servingSize = Number(food.servingSizeG) || 100;
proteinG: food.proteinG != null ? Math.round(Number(food.proteinG) * multiplier * 10) / 10 : null,

// backend/src/controllers/foodItem.controller.ts
proteinG: foodItem.proteinG ? Number(foodItem.proteinG) : null,
carbsG: foodItem.carbsG ? Number(foodItem.carbsG) : null,
// ... repeated for every Decimal field
```

The `nutritionCalculator.ts` even types its input interface with `any` to work around the mismatch:

```typescript
interface FoodNutrition {
    calories: number;
    proteinG: number | null | any;  // <-- `any` is a red flag
    carbsG: number | null | any;
    fatsG: number | null | any;
    fiberG: number | null | any;
    servingSizeG: number | any;
}
```

### Impact

- **Type unsafety:** TypeScript thinks Decimal fields are `Prisma.Decimal` objects but most code treats them as `number`. Any place that forgets `Number()` may get `"72.50"` (stringified Decimal) instead of `72.5`, causing broken arithmetic or UI display bugs.
- **Maintenance burden:** Every new service or controller that reads a Decimal field must remember to wrap it in `Number()`. Missing even one causes subtle bugs.
- **`any` types** in `nutritionCalculator.ts` disable TypeScript checking entirely for nutrition fields.

### The Fix

#### Step 1: Create a Decimal converter utility

Create a reusable utility that converts Prisma Decimal objects to plain numbers. This centralizes conversion logic and removes the need for scattered `Number()` calls.

**New file:** `backend/src/utils/decimal.ts`

```typescript
import { Prisma } from '@prisma/client';

/**
 * Convert a Prisma Decimal (or null/undefined) to a plain number (or null).
 * Safe to call on values that are already numbers.
 */
export function toNumber(value: Prisma.Decimal | number | null | undefined): number | null {
    if (value == null) return null;
    return typeof value === 'number' ? value : value.toNumber();
}

/**
 * Convert all Decimal fields in an object to plain numbers.
 * Pass in the field names that are Decimal.
 */
export function convertDecimals<T extends Record<string, unknown>>(
    obj: T,
    fields: (keyof T)[]
): T & Record<string, number | null> {
    const result = { ...obj } as any;
    for (const field of fields) {
        result[field] = toNumber(result[field]);
    }
    return result;
}
```

#### Step 2: Add `.transform()` to Zod schemas for output validation

When returning data from API endpoints, add Zod transforms that automatically convert Decimals to numbers. This ensures the API contract always sends plain numbers to clients.

```typescript
// Example: response schema with Decimal-to-number transforms
import { toNumber } from '../utils/decimal';

const clientResponseSchema = z.object({
    heightCm: z.any().transform(toNumber),
    currentWeightKg: z.any().transform(toNumber),
    targetWeightKg: z.any().transform(toNumber),
    targetProteinG: z.any().transform(toNumber),
    targetCarbsG: z.any().transform(toNumber),
    targetFatsG: z.any().transform(toNumber),
});
```

#### Step 3: Refactor existing `Number()` calls

Replace scattered `Number()` calls with the utility:

```typescript
// BEFORE
const targetWeight = client.targetWeightKg ? Number(client.targetWeightKg) : null;
const heightM = Number(client.heightCm) / 100;

// AFTER
import { toNumber } from '../utils/decimal';

const targetWeight = toNumber(client.targetWeightKg);
const heightM = (toNumber(client.heightCm) ?? 0) / 100;
```

#### Step 4: Fix the `FoodNutrition` interface

Remove the `any` types in `backend/src/utils/nutritionCalculator.ts`:

```typescript
import { Prisma } from '@prisma/client';

interface FoodNutrition {
    calories: number;
    proteinG: Prisma.Decimal | number | null;
    carbsG: Prisma.Decimal | number | null;
    fatsG: Prisma.Decimal | number | null;
    fiberG: Prisma.Decimal | number | null;
    servingSizeG: Prisma.Decimal | number;
}
```

No Prisma migration is needed. This is a code-level fix only.

---

## 4.3 LOW: Missing Indexes

### The Problem

Several foreign key and filter columns that are used in queries have no database index, leading to sequential scans on large tables.

**`MealFoodItem.createdByUserId`** -- no index (`backend/prisma/schema.prisma`, line 422):

```prisma
model MealFoodItem {
  id              String    @id @default(uuid())
  mealId          String
  foodId          String
  // ...
  createdByUserId String?

  @@index([mealId])
  @@index([foodId])
  @@index([mealId, optionGroup])
  // Missing: @@index([createdByUserId])
}
```

**`Meal.createdByUserId`** -- no index (`backend/prisma/schema.prisma`, line 351):

```prisma
model Meal {
  id              String    @id @default(uuid())
  planId          String
  // ...
  createdByUserId String?

  @@index([planId])
  @@index([mealDate])
  // Missing: @@index([createdByUserId])
}
```

**`Client.dietPattern`** -- no index (`backend/prisma/schema.prisma`, line 220):

```prisma
model Client {
  // ...
  dietPattern String? // "vegetarian", "vegan", "non_veg", "pescatarian"

  // Existing indexes:
  @@index([orgId])
  @@index([primaryDietitianId])
  @@index([isActive])
  @@index([referralCode])
  @@index([referredByClientId])
  @@index([orgId, isActive, createdAt])
  // Missing: @@index([dietPattern])
}
```

The validation engine queries clients by `dietPattern` to build client tags:

```typescript
// backend/src/services/validationEngine.service.ts
// Client is fetched by ID and dietPattern is used in every validation call
dietPattern: client.dietPattern,
```

### Impact

- **`createdByUserId` on `MealFoodItem` and `Meal`:** Any query that filters or joins on "who created this meal/food item" (e.g., audit logs, admin filtering) requires a full table scan. As the food item table grows, these queries degrade.
- **`dietPattern` on `Client`:** While currently clients are fetched by primary key, any future reporting query like "find all vegetarian clients in this org" would do a sequential scan. With even a few thousand clients per org, this is noticeable.

### The Fix

Add the missing indexes in the Prisma schema and create a migration.

**File:** `backend/prisma/schema.prisma`

Add to the `MealFoodItem` model:

```prisma
model MealFoodItem {
  // ... existing fields ...

  @@index([mealId])
  @@index([foodId])
  @@index([mealId, optionGroup])
  @@index([createdByUserId])           // <-- ADD THIS
}
```

Add to the `Meal` model:

```prisma
model Meal {
  // ... existing fields ...

  @@index([planId])
  @@index([mealDate])
  @@index([createdByUserId])           // <-- ADD THIS
}
```

Add to the `Client` model:

```prisma
model Client {
  // ... existing fields ...

  @@index([orgId])
  @@index([primaryDietitianId])
  @@index([isActive])
  @@index([referralCode])
  @@index([referredByClientId])
  @@index([orgId, isActive, createdAt])
  @@index([dietPattern])               // <-- ADD THIS
}
```

**Migration steps:**

```bash
# 1. Generate the migration
cd backend
npx prisma migrate dev --name add_missing_indexes

# This will generate SQL like:
# CREATE INDEX "MealFoodItem_createdByUserId_idx" ON "MealFoodItem"("createdByUserId");
# CREATE INDEX "Meal_createdByUserId_idx" ON "Meal"("createdByUserId");
# CREATE INDEX "Client_dietPattern_idx" ON "Client"("dietPattern");

# 2. Verify the migration file was created
ls prisma/migrations/

# 3. Apply to staging/production
npx prisma migrate deploy
```

**Expected generated migration SQL:**

```sql
-- CreateIndex
CREATE INDEX "MealFoodItem_createdByUserId_idx" ON "MealFoodItem"("createdByUserId");

-- CreateIndex
CREATE INDEX "Meal_createdByUserId_idx" ON "Meal"("createdByUserId");

-- CreateIndex
CREATE INDEX "Client_dietPattern_idx" ON "Client"("dietPattern");
```

These are non-destructive, additive-only changes. They can be applied to production with zero downtime. On a table with fewer than 100k rows, index creation takes under a second.

---

## 4.4 LOW: Invitation.status Is a String Not an Enum

### The Problem

The `Invitation` model uses a plain `String` for the `status` field, while every other model in the schema that has a status field uses a Prisma enum.

**File:** `backend/prisma/schema.prisma`, lines 640-655:

```prisma
model Invitation {
  id        String   @id @default(uuid())
  email     String
  role      UserRole
  token     String   @unique
  orgId     String
  expiresAt DateTime
  status    String   @default("pending") // pending, accepted, expired   <-- plain String
  createdAt DateTime @default(now())

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId])
  @@index([token])
  @@index([email])
}
```

Compare to other models that use proper enums:

```prisma
// DietPlan uses an enum
status DietPlanStatus @default(draft)

// MealLog uses an enum
status MealLogStatus @default(pending)

// Invoice uses an enum
status InvoiceStatus @default(unpaid)
```

The application code uses string literals throughout (`backend/src/controllers/team.controller.ts`):

```typescript
// Line 77 - creating invitation
status: 'pending'

// Line 103 - checking status
if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {

// Line 152 - accepting invitation
data: { status: 'accepted' }

// Line 179 - accepting invitation (duplicate path)
data: { status: 'accepted' }
```

A typo like `status: 'accpeted'` would compile and run without error, only to leave the invitation in a broken state.

### Impact

- **No database-level constraint.** Any string value can be written: `"Pending"`, `"ACCEPTED"`, `"foo"`, `""`. The database will accept all of them.
- **No TypeScript safety.** Prisma generates `status: string` in the type, so TypeScript cannot catch misspelled status values.
- **Inconsistency.** Every other status-like field in the codebase uses an enum. This is the only exception, making it easy to miss in reviews.

### The Fix

Create a Prisma enum and migrate the column.

#### Step 1: Add the enum to the Prisma schema

**File:** `backend/prisma/schema.prisma`

Add the enum alongside other enums (after `DeliveryStatus`, around line 90):

```prisma
enum InvitationStatus {
  pending
  accepted
  expired
}
```

Update the `Invitation` model:

```prisma
model Invitation {
  id        String           @id @default(uuid())
  email     String
  role      UserRole
  token     String           @unique
  orgId     String
  expiresAt DateTime
  status    InvitationStatus @default(pending)  // <-- Changed from String
  createdAt DateTime         @default(now())

  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId])
  @@index([token])
  @@index([email])
}
```

#### Step 2: Create and apply the migration

```bash
cd backend

# Generate migration (Prisma will detect the String -> Enum change)
npx prisma migrate dev --name invitation_status_enum
```

Prisma may not auto-generate the migration for a String-to-Enum conversion. If it fails, create a custom migration:

```bash
npx prisma migrate dev --name invitation_status_enum --create-only
```

Then edit the generated SQL file:

```sql
-- Step 1: Create the enum type
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'expired');

-- Step 2: Convert existing data and alter the column
-- First, ensure all existing values are valid
UPDATE "Invitation"
SET status = 'pending'
WHERE status NOT IN ('pending', 'accepted', 'expired');

-- Step 3: Alter the column type
ALTER TABLE "Invitation"
ALTER COLUMN "status" TYPE "InvitationStatus"
USING status::"InvitationStatus";

-- Step 4: Set the default
ALTER TABLE "Invitation"
ALTER COLUMN "status" SET DEFAULT 'pending'::"InvitationStatus";
```

Then apply:

```bash
npx prisma migrate dev
```

#### Step 3: Update application code

The application code in `team.controller.ts` does not need changes because the string literals `'pending'` and `'accepted'` match the enum values. However, you gain TypeScript safety: Prisma's generated types will now use `InvitationStatus` instead of `string`, and any invalid value will be caught at compile time.

---

## 4.5 LOW: foodRestrictions Uses JSON Type

### The Problem

The `Client` model stores food restrictions as a `Json` field instead of a typed relation or validated structure. While there is a TypeScript interface `FoodRestriction` defined in `validation.types.ts`, the database has no knowledge of this shape, and Prisma provides no validation.

**File:** `backend/prisma/schema.prisma`, line 228:

```prisma
model Client {
  // ...
  foodRestrictions Json @default("[]") // Array of FoodRestriction objects for flexible restrictions
  // ...
}
```

**The TypeScript interface exists** (`backend/src/types/validation.types.ts`, lines 79-111):

```typescript
export interface FoodRestriction {
    foodId?: string;
    foodName?: string;
    foodCategory?: string;
    restrictionType: RestrictionType;  // 'day_based' | 'time_based' | 'frequency' | 'quantity' | 'always'
    avoidDays?: string[];
    avoidMeals?: string[];
    avoidAfter?: string;
    avoidBefore?: string;
    maxPerWeek?: number;
    maxPerDay?: number;
    maxGramsPerMeal?: number;
    excludes?: string[];
    includes?: string[];
    reason?: string;
    severity: 'strict' | 'flexible';
    note?: string;
}
```

**How it is used** (`backend/src/services/validationEngine.service.ts`):

```typescript
// Line 455 - fetched from DB as raw Json
foodRestrictions: true

// Line 467 - cast with `as unknown as` (unsafe)
foodRestrictions: (client.foodRestrictions as unknown as FoodRestriction[]) || [],

// Line 652 - iterated without runtime validation
for (const restriction of client.foodRestrictions) {
```

The `as unknown as FoodRestriction[]` cast is a type assertion that tells TypeScript "trust me, this is the right shape." If the JSON in the database is malformed, corrupted, or from an older schema version, the code will fail at runtime with no helpful error message.

### Impact

- **No database-level validation.** Any valid JSON can be stored: `null`, `"hello"`, `{}`, `[1, 2, 3]`. PostgreSQL will accept it.
- **No query capability.** You cannot write efficient SQL to find "all clients who have a `day_based` restriction on `tuesday`." You would need to parse the JSON in application code or use PostgreSQL's JSON operators, which are slower and harder to index.
- **Unsafe type assertions.** The `as unknown as FoodRestriction[]` cast can hide bugs where the stored data does not match the expected interface.
- **Migration risk.** If the `FoodRestriction` interface changes (e.g., a field is renamed), existing JSON data in the database is not automatically updated.

### The Fix

There are two approaches depending on whether you need to query restrictions from the database.

#### Option A: Keep JSON but add runtime validation (Recommended for now)

If food restrictions are always loaded as part of a full client object and never queried independently, keep the JSON column but add runtime validation using Zod.

**Create a Zod schema for `FoodRestriction`:**

**File:** `backend/src/schemas/client.schema.ts` (add to existing file)

```typescript
export const foodRestrictionSchema = z.object({
    foodId: z.string().uuid().optional(),
    foodName: z.string().optional(),
    foodCategory: z.string().optional(),
    restrictionType: z.enum(['day_based', 'time_based', 'frequency', 'quantity', 'always']),
    avoidDays: z.array(z.string()).optional(),
    avoidMeals: z.array(z.string()).optional(),
    avoidAfter: z.string().optional(),
    avoidBefore: z.string().optional(),
    maxPerWeek: z.number().int().min(0).optional(),
    maxPerDay: z.number().int().min(0).optional(),
    maxGramsPerMeal: z.number().min(0).optional(),
    excludes: z.array(z.string()).optional(),
    includes: z.array(z.string()).optional(),
    reason: z.string().optional(),
    severity: z.enum(['strict', 'flexible']),
    note: z.string().optional(),
}).refine(
    (data) => data.foodId || data.foodName || data.foodCategory,
    { message: 'At least one of foodId, foodName, or foodCategory must be specified' }
);

export const foodRestrictionsArraySchema = z.array(foodRestrictionSchema);

export type FoodRestrictionInput = z.infer<typeof foodRestrictionSchema>;
```

**Validate on write (in client creation/update):**

```typescript
// In the client service, before saving
import { foodRestrictionsArraySchema } from '../schemas/client.schema';

if (data.foodRestrictions) {
    const parsed = foodRestrictionsArraySchema.safeParse(data.foodRestrictions);
    if (!parsed.success) {
        throw AppError.badRequest(
            `Invalid foodRestrictions: ${parsed.error.message}`,
            'INVALID_FOOD_RESTRICTIONS'
        );
    }
}
```

**Validate on read (replace unsafe cast):**

```typescript
// BEFORE (unsafe)
foodRestrictions: (client.foodRestrictions as unknown as FoodRestriction[]) || [],

// AFTER (validated)
import { foodRestrictionsArraySchema } from '../schemas/client.schema';

const parsedRestrictions = foodRestrictionsArraySchema.safeParse(client.foodRestrictions);
const foodRestrictions = parsedRestrictions.success ? parsedRestrictions.data : [];
if (!parsedRestrictions.success) {
    console.warn(`[Validation] Client ${client.id} has malformed foodRestrictions:`, parsedRestrictions.error);
}
```

#### Option B: Normalize into a FoodRestriction model (if queried)

If you need to query restrictions from the database (e.g., "find all clients with a Tuesday restriction"), create a proper relational model.

**Add to Prisma schema:**

```prisma
enum RestrictionType {
  day_based
  time_based
  frequency
  quantity
  always
}

enum RestrictionSeverity {
  strict
  flexible
}

model FoodRestriction {
  id              String              @id @default(uuid())
  clientId        String
  foodId          String?
  foodName        String?
  foodCategory    String?
  restrictionType RestrictionType
  avoidDays       String[]            @default([])
  avoidMeals      String[]            @default([])
  avoidAfter      String?
  avoidBefore     String?
  maxPerWeek      Int?
  maxPerDay       Int?
  maxGramsPerMeal Decimal?            @db.Decimal(6, 2)
  excludes        String[]            @default([])
  includes        String[]            @default([])
  reason          String?
  severity        RestrictionSeverity
  note            String?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  client Client @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@index([clientId])
  @@index([restrictionType])
  @@index([clientId, restrictionType])
}
```

Update the `Client` model:

```prisma
model Client {
  // Remove: foodRestrictions Json @default("[]")
  // Add:
  foodRestrictions FoodRestriction[]
}
```

**Data migration:**

```bash
npx prisma migrate dev --name normalize_food_restrictions --create-only
```

Add a custom migration step to move JSON data into the new table:

```sql
-- Create the new table (Prisma generates this)
-- ...

-- Migrate existing JSON data
INSERT INTO "FoodRestriction" (
    id, "clientId", "foodId", "foodName", "foodCategory",
    "restrictionType", "avoidDays", "avoidMeals",
    "avoidAfter", "avoidBefore", "maxPerWeek", "maxPerDay",
    "maxGramsPerMeal", excludes, includes, reason, severity, note,
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(),
    c.id,
    r->>'foodId',
    r->>'foodName',
    r->>'foodCategory',
    (r->>'restrictionType')::"RestrictionType",
    CASE
        WHEN r->'avoidDays' IS NOT NULL
        THEN ARRAY(SELECT jsonb_array_elements_text(r->'avoidDays'))
        ELSE '{}'
    END,
    CASE
        WHEN r->'avoidMeals' IS NOT NULL
        THEN ARRAY(SELECT jsonb_array_elements_text(r->'avoidMeals'))
        ELSE '{}'
    END,
    r->>'avoidAfter',
    r->>'avoidBefore',
    (r->>'maxPerWeek')::int,
    (r->>'maxPerDay')::int,
    (r->>'maxGramsPerMeal')::decimal,
    CASE
        WHEN r->'excludes' IS NOT NULL
        THEN ARRAY(SELECT jsonb_array_elements_text(r->'excludes'))
        ELSE '{}'
    END,
    CASE
        WHEN r->'includes' IS NOT NULL
        THEN ARRAY(SELECT jsonb_array_elements_text(r->'includes'))
        ELSE '{}'
    END,
    r->>'reason',
    (r->>'severity')::"RestrictionSeverity",
    r->>'note',
    NOW(),
    NOW()
FROM "Client" c,
     jsonb_array_elements(c."foodRestrictions"::jsonb) AS r
WHERE c."foodRestrictions" IS NOT NULL
  AND c."foodRestrictions"::text != '[]';

-- Drop the old JSON column
ALTER TABLE "Client" DROP COLUMN "foodRestrictions";
```

Then apply:

```bash
npx prisma migrate dev
```

**Recommendation:** Start with **Option A** (keep JSON, add Zod validation). It is non-breaking and addresses the type safety concern immediately. Move to **Option B** only if product requirements demand querying restrictions directly from the database.

---

## Summary

| Issue | Severity | Breaking? | Migration Needed? | Estimated Effort |
|-------|----------|-----------|-------------------|------------------|
| 4.1 ActivityLevel Enum Mismatch | MEDIUM | Yes (API fails) | No (code-only) | 30 min |
| 4.2 Decimal vs number Mismatch | MEDIUM | No (works with `Number()`) | No (code-only) | 2-3 hours |
| 4.3 Missing Indexes | LOW | No | Yes (additive) | 15 min |
| 4.4 Invitation.status String | LOW | No | Yes (alter column) | 30 min |
| 4.5 foodRestrictions JSON | LOW | No | Optional | 1-2 hours (Option A) |

### Recommended priority order

1. **4.1** -- Fix immediately. It causes API failures right now.
2. **4.3** -- Quick win. Additive migration with zero risk.
3. **4.4** -- Quick win. Brings consistency and type safety.
4. **4.2** -- Medium effort. Create the utility first, then refactor file by file.
5. **4.5** -- Lowest priority. Add Zod validation (Option A) when touching that code next.
