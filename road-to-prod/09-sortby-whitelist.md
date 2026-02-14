# 09 - sortBy Parameter Whitelist

## Priority: HIGH
## Effort: 30 minutes
## Risk if skipped: Server crashes on invalid field names, potential information leakage about schema

---

## The Problem

Multiple services pass user-controlled `sortBy` directly into Prisma `orderBy`:

```typescript
// backend/src/services/client.service.ts:143
orderBy: { [String(sortBy)]: 'desc' },

// backend/src/services/mealLog.service.ts:69
orderBy: { [String(sortBy)]: 'desc' },

// backend/src/services/foodItem.service.ts:71
orderBy: { [String(sortBy)]: 'asc' },
```

While Prisma prevents SQL injection (parameterized queries), an invalid field name like `sortBy=password` or `sortBy=__proto__` will:
1. Cause a Prisma error that crashes the request
2. Potentially leak table column names in error messages
3. In certain edge cases, could trigger unexpected behavior with computed fields

---

## The Fix

### Option A: Whitelist per service (Recommended)

Create allowed field maps for each service:

```typescript
// backend/src/services/client.service.ts

const CLIENT_SORTABLE_FIELDS = new Set([
    'createdAt', 'fullName', 'email', 'currentWeightKg', 'updatedAt',
]);

async listClients(orgId: string, query: any, userRole: string, userId: string) {
    const { sortBy = 'createdAt' } = query;

    const safeSortBy = CLIENT_SORTABLE_FIELDS.has(String(sortBy))
        ? String(sortBy)
        : 'createdAt';

    // ...
    orderBy: { [safeSortBy]: 'desc' },
}
```

```typescript
// backend/src/services/mealLog.service.ts

const MEAL_LOG_SORTABLE_FIELDS = new Set([
    'scheduledDate', 'scheduledTime', 'status', 'createdAt', 'loggedAt',
]);

async listMealLogs(orgId: string, query: any, userRole: string, userId: string) {
    const { sortBy = 'scheduledDate' } = query;

    const safeSortBy = MEAL_LOG_SORTABLE_FIELDS.has(String(sortBy))
        ? String(sortBy)
        : 'scheduledDate';

    // ...
    orderBy: { [safeSortBy]: 'desc' },
}
```

```typescript
// backend/src/services/foodItem.service.ts

const FOOD_ITEM_SORTABLE_FIELDS = new Set([
    'name', 'category', 'calories', 'createdAt', 'isVerified',
]);

async listFoodItems(orgId: string, query: any) {
    const { sortBy = 'name' } = query;

    const safeSortBy = FOOD_ITEM_SORTABLE_FIELDS.has(String(sortBy))
        ? String(sortBy)
        : 'name';

    // ...
    orderBy: { [safeSortBy]: 'asc' },
}
```

### Option B: Shared utility (DRY approach)

```typescript
// backend/src/utils/queryFilters.ts - add this function

export function safeSortBy(
    sortBy: unknown,
    allowedFields: Set<string>,
    defaultField: string
): string {
    const field = String(sortBy || defaultField);
    return allowedFields.has(field) ? field : defaultField;
}
```

Then in each service:
```typescript
import { safeSortBy } from '../utils/queryFilters';

const SORTABLE = new Set(['createdAt', 'fullName', 'email']);

// Usage:
orderBy: { [safeSortBy(query.sortBy, SORTABLE, 'createdAt')]: 'desc' },
```

### Also check: weightLog.service.ts

```typescript
// backend/src/services/weightLog.service.ts (if it has the same pattern)
orderBy: { [String(query.sortBy || 'logDate')]: 'asc' }
// Apply the same fix
```

---

## Files to Change

| File | Line | Allowed Fields |
|------|------|---------------|
| `backend/src/services/client.service.ts` | 143 | `createdAt, fullName, email, currentWeightKg, updatedAt` |
| `backend/src/services/mealLog.service.ts` | 69 | `scheduledDate, scheduledTime, status, createdAt, loggedAt` |
| `backend/src/services/foodItem.service.ts` | 71 | `name, category, calories, createdAt, isVerified` |
| `backend/src/utils/queryFilters.ts` | new | Add `safeSortBy` helper |

---

## Verification

1. `GET /api/v1/clients?sortBy=createdAt` - should work
2. `GET /api/v1/clients?sortBy=fullName` - should work
3. `GET /api/v1/clients?sortBy=password` - should silently fall back to default, not crash
4. `GET /api/v1/clients?sortBy=__proto__` - should fall back to default
