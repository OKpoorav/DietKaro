# Module 4: Database Schema Improvements

**Priority:** P1
**Effort:** 1-2 days
**Impact:** Data integrity, query performance, spec alignment

---

## Current State

The Prisma schema is the strongest part of the codebase (9/10). It has proper relations, 10+ enums, UUID primary keys, and multi-tenancy via `orgId`. However, there are inconsistencies in soft deletes, missing indexes, and a few spec-required models not yet created.

---

## What Needs To Be Done

### 1. Add Missing Soft Deletes

**Problem:** Soft deletes (`deletedAt DateTime?`) exist on some models but not others. If a record without soft delete is deleted, data is permanently lost.

| Model | Has `deletedAt`? | Action |
|-------|:---------------:|--------|
| Organization | Yes | No change |
| User | Yes | No change |
| Client | Yes | No change |
| DietPlan | Yes | No change |
| SessionNote | Yes | No change |
| **Meal** | **No** | **Add** |
| **MealLog** | **No** | **Add** |
| **WeightLog** | **No** | **Add** |
| **BodyMeasurement** | **No** | **Add** |
| **FoodItem** | **No** | **Add** |
| **MealFoodItem** | **No** | **Add** |
| **Invoice** | **No** | **Add** |

**For each model, add:**
```prisma
deletedAt DateTime?
```

**Then update all queries** that list these models to filter `where: { deletedAt: null }`. This affects:
- All controllers/services that query these tables
- Consider creating a Prisma middleware for automatic soft-delete filtering

---

### 2. Add Compound Indexes

**Problem:** Only single-column indexes exist. Common query patterns involve multiple columns.

**Add these compound indexes:**

```prisma
// Client - frequently filtered by org + status + creation
model Client {
  @@index([orgId, isActive, createdAt])
}

// DietPlan - filtered by org + status
model DietPlan {
  @@index([orgId, status, createdAt])
  @@index([clientId, status])
}

// MealLog - most common query pattern
model MealLog {
  @@index([orgId, status, scheduledDate])
  @@index([clientId, scheduledDate])
}

// WeightLog - time-series query
model WeightLog {
  @@index([clientId, logDate])
}

// Notification - recipient inbox query
model Notification {
  @@index([recipientId, recipientType, isRead, createdAt])
}

// FoodItem - search query
model FoodItem {
  @@index([orgId, category])
}
```

---

### 3. Add Missing Model: `ClientPreferences`

**Source:** `remaining.md` lists this as P1

This model stores client lifestyle data needed for better diet plan personalization.

```prisma
model ClientPreferences {
  id                String   @id @default(uuid())
  clientId          String   @unique
  breakfastTime     String?  // "06:00" - "10:00"
  lunchTime         String?  // "12:00" - "14:00"
  dinnerTime        String?  // "19:00" - "21:00"
  snackTime         String?  // "16:00" - "17:00"
  canCook           Boolean  @default(true)
  kitchenAvailable  Boolean  @default(true)
  hasDietaryCook    Boolean  @default(false)
  weekdayActivity   String?  // sedentary/light/moderate/active
  weekendActivity   String?  // sedentary/light/moderate/active
  sportOrHobby      String?
  generalNotes      String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  client Client @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@index([clientId])
}
```

**Also add** the reverse relation on Client model:
```prisma
model Client {
  // ... existing fields
  preferences ClientPreferences?
}
```

---

### 4. Add `labValues` to MedicalProfile

**Source:** `remaining.md` lists this as P1

Lab values are needed for auto-derived risk flags and the validation engine.

```prisma
model MedicalProfile {
  // ... existing fields

  // Add these:
  labValues    Json?     // { hba1c: 6.8, vitaminD: 22, b12: 180, ... }
  labDate      DateTime? // When labs were last updated
  labDerivedTags String[] // Auto-computed: ["pre_diabetic", "vitamin_d_deficient"]
}
```

---

### 5. Add Audit Fields to Key Models

**Problem:** Most models lack `createdByUserId` / `updatedByUserId`, making it impossible to track who made changes.

**Add to these models:**

| Model | Add Field |
|-------|-----------|
| Meal | `createdByUserId String?` |
| MealFoodItem | `createdByUserId String?` |
| FoodItem | `updatedByUserId String?` (createdBy already exists) |
| WeightLog | `createdByUserId String?` |
| BodyMeasurement | `createdByUserId String?` |

---

### 6. Validate String Array Fields

**Problem:** Fields like `Client.allergies`, `Client.dislikes`, `Client.medicalConditions` are `String[]` with no value constraints. Invalid values can be inserted.

**Solution:** This is best handled at the API validation layer (Zod schemas), not the database. But document the expected values:

**Create:** Zod enum arrays in the relevant schemas:

```typescript
// In client.schema.ts
const VALID_ALLERGIES = ['peanuts', 'dairy', 'gluten', 'shellfish', 'eggs', 'soy', 'tree_nuts', 'fish', 'wheat', 'sesame'] as const;
const VALID_CONDITIONS = ['diabetes', 'pcos', 'thyroid', 'hypertension', 'heart_disease', 'kidney_disease', 'celiac', 'ibs'] as const;

// Allow both predefined and custom values
allergies: z.array(z.string().min(1).max(100)).max(20).optional()
```

---

### 7. Consider Prisma Middleware for Soft Deletes

Instead of manually adding `where: { deletedAt: null }` to every query, add a Prisma middleware:

**File:** `backend/src/utils/prisma.ts`

```typescript
// Automatically filter soft-deleted records on findMany/findFirst
prisma.$use(async (params, next) => {
  if (params.action === 'findMany' || params.action === 'findFirst') {
    if (SOFT_DELETE_MODELS.includes(params.model)) {
      params.args.where = { ...params.args.where, deletedAt: null };
    }
  }
  return next(params);
});
```

---

## Migration Plan

1. Create migration for soft delete fields (non-breaking, nullable columns)
2. Create migration for compound indexes (non-breaking, additive)
3. Create migration for ClientPreferences model (new table)
4. Create migration for MedicalProfile lab fields (additive)
5. Create migration for audit fields (additive)
6. Run `npx prisma migrate dev` for each
7. Update Zod schemas for array validation
8. Update queries to respect `deletedAt` filter

---

## Definition of Done

- [ ] `deletedAt` added to 7 models (Meal, MealLog, WeightLog, BodyMeasurement, FoodItem, MealFoodItem, Invoice)
- [ ] 6 compound indexes added
- [ ] ClientPreferences model created with relation to Client
- [ ] labValues + labDate + labDerivedTags added to MedicalProfile
- [ ] Audit fields added to 5 models
- [ ] Migrations run successfully
- [ ] All list queries updated to filter `deletedAt: null`
- [ ] Zod schemas updated for array field validation
