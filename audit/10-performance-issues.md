# 10. Performance Issues

**Severity**: HIGH / MEDIUM / LOW (per issue)
**Category**: Database Queries, Caching, API Performance

---

## 10.1 HIGH: GET /client/meals/today Fetches All Meals for Active Plan

### Description

The `GET /client/meals/today` endpoint retrieves every meal from the client's active diet plan, regardless of which day of the week it is. A weekly meal plan with 7 days x 4 meals = 28 meals will return all 28 meals on every single day, including their nested `foodItems` and `foodItem` relations. The client-side then receives far more data than it needs.

### Affected Location

`backend/src/routes/clientApi.routes.ts:14-148`

### Current Code

```typescript
// backend/src/routes/clientApi.routes.ts:22-39
const activePlan = await prisma.dietPlan.findFirst({
    where: {
        clientId: req.client.id,
        status: 'active',
        isActive: true,
    },
    include: {
        meals: {                              // <-- ALL meals for the plan
            include: {
                foodItems: {                  // <-- ALL food items per meal
                    include: { foodItem: true },  // <-- Full food item records
                },
            },
            orderBy: { mealType: 'asc' },
        },
    },
});
```

The query above loads every `Meal` row for the plan, every `MealFoodItem` row, and every `FoodItem` row for all of those. On a plan with 7 days, 4 meals per day, and 3-5 food items per meal, that is:

- 28 Meal rows
- 84-140 MealFoodItem rows
- 84-140 FoodItem rows (with all nutrition columns)

The client only needs today's meals (4 meals, ~12-20 food items).

### Additional Problem: No dayOfWeek Filter

The Prisma `Meal` model has a `dayOfWeek` field (`Int?`) representing 0=Monday through 6=Sunday. The endpoint does not filter on this field. It maps all meals and returns them all:

```typescript
// backend/src/routes/clientApi.routes.ts:57
const todayMeals = activePlan.meals.map((meal) => {
    // Processes ALL meals, not just today's
});
```

### Fix: Add Where Clause Filtering by dayOfWeek

```typescript
// backend/src/routes/clientApi.routes.ts -- FIXED
router.get('/meals/today', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Calculate today's day index (0=Monday, 6=Sunday)
    const jsDay = today.getDay();  // 0=Sunday, 1=Monday...
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;  // Convert to 0=Monday

    const activePlan = await prisma.dietPlan.findFirst({
        where: {
            clientId: req.client.id,
            status: 'active',
            isActive: true,
        },
        include: {
            meals: {
                where: {
                    OR: [
                        { dayOfWeek: dayOfWeek },    // Match today's day
                        { dayOfWeek: null },          // Include day-agnostic meals
                        { mealDate: {                 // Or specific date match
                            gte: today,
                            lt: tomorrow,
                        }},
                    ],
                },
                include: {
                    foodItems: {
                        orderBy: [{ optionGroup: 'asc' }, { sortOrder: 'asc' }],
                        include: { foodItem: true },
                    },
                },
                orderBy: [{ sequenceNumber: 'asc' }, { mealType: 'asc' }],
            },
        },
    });

    // ... rest of the handler
}));
```

### Impact

- **Before**: 28+ meals loaded per request, ~5-10KB+ JSON response
- **After**: 3-5 meals loaded per request, ~1-2KB JSON response
- **Improvement**: ~5-7x reduction in data transferred and Prisma query time

### Effort Estimate

Low -- single query change, no schema modifications needed.

---

## 10.2 MEDIUM: No Database Connection Pooling Configuration

### Description

The Prisma client is instantiated with default settings. In production, PostgreSQL defaults to a maximum of 100 connections. Prisma's default connection pool size is `num_cpus * 2 + 1`. If multiple server instances run behind a load balancer (or if serverless functions spin up), the pool can easily exhaust available connections.

### Affected Location

`backend/src/utils/prisma.ts:28-30`

```typescript
const base = new PrismaClient({
    log: ['error', 'warn'],
    // No datasources or connection pool configuration
});
```

And the `DATABASE_URL` in the environment has no pooling parameters:

```
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
```

### Fix: Configure Connection Limit in DATABASE_URL

**Option 1: URL-based configuration** (simplest)

```env
# .env
DATABASE_URL="postgresql://user:pass@host:5432/dbname?connection_limit=10&pool_timeout=30"
```

- `connection_limit=10`: Maximum connections per Prisma instance (adjust based on expected concurrency)
- `pool_timeout=30`: Seconds to wait for a free connection before throwing

**Option 2: Prisma client configuration**

```typescript
// backend/src/utils/prisma.ts
const base = new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn', 'query'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});
```

**Option 3: Use PgBouncer for connection pooling** (production best practice)

```env
# Direct connection for migrations
DIRECT_DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Pooled connection for app queries
DATABASE_URL="postgresql://user:pass@pgbouncer-host:6432/dbname?pgbouncer=true&connection_limit=10"
```

```prisma
// schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
}
```

### Additional Recommendation: Add Connection Health Logging

```typescript
// backend/src/utils/prisma.ts
const base = new PrismaClient({
    log: [
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
    ],
});

base.$on('error', (e) => {
    logger.error('Prisma error', { message: e.message, target: e.target });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    await base.$disconnect();
    process.exit(0);
});
```

### Effort Estimate

Low -- environment variable change and optional Prisma configuration.

---

## 10.3 MEDIUM: Compliance History Queries Entire Month in Application Code

### Description

The `getClientComplianceHistory` method fetches all individual meal log records for up to 30 days, transfers them to the application server, and then groups by date in JavaScript. For an active client logging 4 meals/day over 30 days, that is 120 rows fetched just to compute 30 daily averages.

### Affected Location

`backend/src/services/compliance.service.ts:335-382`

### Current Code

```typescript
// backend/src/services/compliance.service.ts:335-382
async getClientComplianceHistory(clientId: string, days: number = 30): Promise<ComplianceHistory> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Fetches ALL individual meal logs for the period
    const logs = await prisma.mealLog.findMany({
        where: {
            clientId,
            scheduledDate: { gte: startDate },
            complianceScore: { not: null },
        },
        select: {
            scheduledDate: true,
            complianceScore: true,
            complianceColor: true,
        },
        orderBy: { scheduledDate: 'asc' },
    });

    // Groups by date in JavaScript
    const dateMap = new Map<string, number[]>();
    logs.forEach(log => {
        const dateKey = log.scheduledDate.toISOString().split('T')[0];
        if (!dateMap.has(dateKey)) dateMap.set(dateKey, []);
        dateMap.get(dateKey)!.push(log.complianceScore!);
    });

    // Computes averages in JavaScript
    const data: ComplianceHistoryEntry[] = [];
    dateMap.forEach((scores, dateKey) => {
        const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
        data.push({ date: dateKey, score: avg, color: getColor(avg) });
    });

    // Finds best/worst in JavaScript
    const bestDay = data.reduce((best, d) => d.score > best.score ? d : best, data[0]);
    const worstDay = data.reduce((worst, d) => d.score < worst.score ? d : worst, data[0]);

    return { data, averageScore: totalAvg, bestDay, worstDay };
}
```

### Fix: Use Prisma groupBy or Raw SQL

**Option A: Prisma groupBy**

```typescript
async getClientComplianceHistory(clientId: string, days: number = 30): Promise<ComplianceHistory> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Single query: group by date, compute average in DB
    const grouped = await prisma.mealLog.groupBy({
        by: ['scheduledDate'],
        where: {
            clientId,
            scheduledDate: { gte: startDate },
            complianceScore: { not: null },
        },
        _avg: { complianceScore: true },
        _max: { complianceScore: true },
        _min: { complianceScore: true },
        _count: { complianceScore: true },
        orderBy: { scheduledDate: 'asc' },
    });

    const data: ComplianceHistoryEntry[] = grouped.map(g => {
        const avg = Math.round(g._avg.complianceScore ?? 0);
        return {
            date: g.scheduledDate.toISOString().split('T')[0],
            score: avg,
            color: getColor(avg),
        };
    });

    const totalAvg = data.length > 0
        ? Math.round(data.reduce((s, d) => s + d.score, 0) / data.length)
        : 0;

    const bestDay = data.length > 0
        ? data.reduce((best, d) => d.score > best.score ? d : best, data[0])
        : null;

    const worstDay = data.length > 0
        ? data.reduce((worst, d) => d.score < worst.score ? d : worst, data[0])
        : null;

    return { data, averageScore: totalAvg, bestDay, worstDay };
}
```

**Option B: Raw SQL** (if more control needed)

```typescript
async getClientComplianceHistory(clientId: string, days: number = 30): Promise<ComplianceHistory> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await prisma.$queryRaw<Array<{
        scheduled_date: Date;
        avg_score: number;
        meal_count: number;
    }>>`
        SELECT
            "scheduledDate"::date AS scheduled_date,
            ROUND(AVG("complianceScore"))::int AS avg_score,
            COUNT(*) AS meal_count
        FROM "MealLog"
        WHERE "clientId" = ${clientId}
          AND "scheduledDate" >= ${startDate}
          AND "complianceScore" IS NOT NULL
          AND "deletedAt" IS NULL
        GROUP BY "scheduledDate"::date
        ORDER BY scheduled_date ASC
    `;

    const data = result.map(r => ({
        date: r.scheduled_date.toISOString().split('T')[0],
        score: r.avg_score,
        color: getColor(r.avg_score),
    }));

    // ... compute totalAvg, bestDay, worstDay from data
    return { data, averageScore: totalAvg, bestDay, worstDay };
}
```

### Impact

- **Before**: 120 rows transferred to application, grouped in JavaScript
- **After**: 30 rows (or fewer) returned from database, already aggregated
- **Improvement**: ~4x fewer rows transferred, reduced memory allocation, faster response

### Related: Weekly Adherence Has N+1 Query Pattern

The `calculateWeeklyAdherence` method (lines 278-330) calls `calculateDailyAdherence` in a loop for each day of the week, resulting in 7 sequential database queries (plus 7 more for the active plan lookup). This could be batched into a single query that fetches all meal logs for the week at once.

```typescript
// Current: 7 sequential calls
for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    const daily = await this.calculateDailyAdherence(clientId, day);  // 2 queries each
    dailyBreakdown.push(daily);
}
// Total: 14 queries minimum
```

Fix: Fetch all logs for the week in one query and partition in code.

### Effort Estimate

Low-Medium -- Prisma `groupBy` approach is straightforward. Weekly adherence batching requires some refactoring.

---

## 10.4 LOW: No Response Caching

### Description

Several client-facing endpoints recompute data from scratch on every request, even though the underlying data changes infrequently. The following endpoints are called frequently by the mobile app and could benefit from short-TTL caching:

| Endpoint | What It Does | How Often Data Changes |
|----------|-------------|----------------------|
| `GET /client/stats` | Computes weekly adherence, weight trend, streak | Once per meal log (3-5x/day) |
| `GET /client/adherence/daily` | Calculates daily compliance breakdown | Once per meal log |
| `GET /client/adherence/weekly` | Calculates weekly compliance with 14+ queries | Once per meal log |
| `GET /client/adherence/history` | Queries 30 days of compliance data | Once per meal log |
| `GET /client/progress-summary` | Computes weight progress, chart data | Once per weight log (1x/day) |

### Current Behavior

Every request hits the database with full queries:

```typescript
// backend/src/routes/clientApi.routes.ts:337-389
router.get('/stats', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    // Fetches client weight, last 7 days of meal logs, last 2 weight logs
    // Computes adherence, streak, trend
    // ~4 database queries per request
}));
```

If the mobile app polls `/client/stats` every 30 seconds (or on each screen focus), that is 120 queries/hour per active client.

### Fix: Add Short TTL Caching

**Option A: In-memory cache with node-cache (simplest)**

```typescript
// backend/src/utils/cache.ts
import NodeCache from 'node-cache';

// 60-second TTL, check expired entries every 120 seconds
export const appCache = new NodeCache({
    stdTTL: 60,
    checkperiod: 120,
    useClones: false,
});

// Helper: cache wrapper
export async function cached<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>
): Promise<T> {
    const existing = appCache.get<T>(key);
    if (existing !== undefined) return existing;

    const result = await fn();
    appCache.set(key, result, ttlSeconds);
    return result;
}
```

```typescript
// backend/src/routes/clientApi.routes.ts -- with caching
import { cached, appCache } from '../utils/cache';

router.get('/stats', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const stats = await cached(
        `client:stats:${req.client.id}`,
        60,  // 1 minute TTL
        async () => {
            // ... existing computation
            return { weeklyAdherence, mealCompletionRate, weightTrend, latestWeight, targetWeight, currentStreak };
        }
    );

    res.status(200).json({ success: true, data: stats });
}));
```

**Cache invalidation on write:**

```typescript
// In the meal log update handler
router.patch('/meals/:mealLogId/log', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    // ... existing logic

    // Invalidate related caches
    appCache.del(`client:stats:${req.client.id}`);
    appCache.del(`client:adherence:daily:${req.client.id}:${today}`);
    appCache.del(`client:adherence:weekly:${req.client.id}`);

    res.status(200).json({ success: true, data: mealLog });
}));
```

**Option B: Redis cache (for multi-instance deployments)**

```typescript
// backend/src/utils/cache.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
    const existing = await redis.get(key);
    if (existing) return JSON.parse(existing);

    const result = await fn();
    await redis.setex(key, ttl, JSON.stringify(result));
    return result;
}

export async function invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
}
```

**Option C: HTTP-level caching headers** (lightest touch)

```typescript
// For data that changes infrequently
router.get('/adherence/history', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    // ... compute data

    res.setHeader('Cache-Control', 'private, max-age=300');  // 5 minutes
    res.status(200).json({ success: true, data });
}));
```

### Impact

- Reduces database load by 80-90% for repeat requests within the TTL window
- Faster response times for the mobile app (cache hit = ~1ms vs database = ~50-200ms)
- Particularly impactful for `adherence/weekly` which currently runs 14+ queries

### Effort Estimate

Low -- `node-cache` approach requires minimal code changes. Redis approach requires adding a dependency.

---

## Summary

| Issue | Severity | Effort | Impact |
|-------|----------|--------|--------|
| 10.1 /meals/today fetches all meals | HIGH | Low | 5-7x data reduction |
| 10.2 No connection pooling config | MEDIUM | Low | Production stability |
| 10.3 Compliance history in-app grouping | MEDIUM | Low-Medium | 4x fewer DB rows transferred |
| 10.4 No response caching | LOW | Low | 80-90% fewer repeat queries |

### Quick Wins Priority Order

1. **10.1** -- Add `dayOfWeek` filter (10 minutes, immediate improvement)
2. **10.2** -- Add `connection_limit` to DATABASE_URL (5 minutes)
3. **10.3** -- Switch to `groupBy` (30 minutes)
4. **10.4** -- Add `node-cache` for `/stats` and `/adherence/*` (1 hour)
