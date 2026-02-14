# 10 - API Rate Limiting

## Priority: HIGH
## Effort: 30 minutes
## Risk if skipped: No protection against brute-force attacks, API abuse, or denial of service on authenticated endpoints

---

## Current State

Rate limiters exist but are underused:

```typescript
// backend/src/middleware/rateLimiter.ts

// These two ARE applied to OTP routes:
export const otpRequestLimiter  // 3 per 5 min per phone  ✓ Applied
export const otpVerifyLimiter   // 5 per 5 min per phone  ✓ Applied

// This one is DEFINED but NEVER USED:
export const apiLimiter         // 100 per 60 sec          ✗ Not applied anywhere
```

The `apiLimiter` is exported from `rateLimiter.ts` but never imported or applied in `app.ts` or any route file.

---

## The Fix

### Step 1: Apply global API limiter

```typescript
// backend/src/app.ts - add after helmet()
import { apiLimiter } from './middleware/rateLimiter';

app.use(express.json());
app.use(cors({/* ... */}));
app.use(helmet());
app.use(morgan('dev'));

// Apply global rate limit to all API routes
app.use('/api/', apiLimiter);
```

### Step 2: Add per-user rate limiting for authenticated routes

The global limiter uses IP by default. For authenticated users, rate limit per user ID:

```typescript
// backend/src/middleware/rateLimiter.ts - add

export const authenticatedApiLimiter = rateLimit({
    windowMs: 60 * 1000,    // 1 minute
    max: 60,                 // 60 requests per minute per user
    keyGenerator: (req: any) => {
        // Use user ID if authenticated, fall back to IP
        return req.user?.id || req.client?.id || req.ip;
    },
    message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
    },
    standardHeaders: true,
    legacyHeaders: false,
});
```

### Step 3: Add stricter limits on write operations

```typescript
// backend/src/middleware/rateLimiter.ts - add

export const writeOperationLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,                 // 20 write operations per minute
    keyGenerator: (req: any) => req.user?.id || req.client?.id || req.ip,
    message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many write operations.' },
    },
    standardHeaders: true,
    legacyHeaders: false,
});
```

Apply to POST/PUT/PATCH/DELETE routes:
```typescript
// backend/src/routes/client.routes.ts (example)
router.post('/', requireAuth, writeOperationLimiter, validate(createClientSchema), createClient);
router.put('/:id', requireAuth, writeOperationLimiter, validate(updateClientSchema), updateClient);
router.delete('/:id', requireAuth, requireRole('admin', 'owner'), writeOperationLimiter, deleteClient);
```

### Step 4: Protect file upload endpoint

```typescript
// backend/src/middleware/rateLimiter.ts - add

export const uploadLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,   // 5 minutes
    max: 10,                     // 10 uploads per 5 min
    keyGenerator: (req: any) => req.user?.id || req.client?.id || req.ip,
    message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many uploads. Please try again later.' },
    },
    standardHeaders: true,
    legacyHeaders: false,
});
```

---

## Recommended Rate Limit Tiers

| Endpoint Type | Limit | Window | Key |
|---------------|-------|--------|-----|
| Global API | 100 req | 1 min | IP |
| Authenticated reads | 60 req | 1 min | User ID |
| Write operations | 20 req | 1 min | User ID |
| File uploads | 10 req | 5 min | User ID |
| OTP request | 3 req | 5 min | Phone |
| OTP verify | 5 req | 5 min | Phone |

---

## Files to Change

| File | Change |
|------|--------|
| `backend/src/app.ts` | Apply `apiLimiter` globally on `/api/` |
| `backend/src/middleware/rateLimiter.ts` | Add `authenticatedApiLimiter`, `writeOperationLimiter`, `uploadLimiter` |
| `backend/src/routes/*.routes.ts` | Apply write/upload limiters to relevant routes |

---

## Production Note: Redis Store

The default `express-rate-limit` uses in-memory storage (same problem as OTP). For multi-instance deployments, use Redis:

```bash
npm install rate-limit-redis
```

```typescript
import RedisStore from 'rate-limit-redis';
import redis from '../utils/redis';

export const apiLimiter = rateLimit({
    store: new RedisStore({ sendCommand: (...args: string[]) => redis.call(...args) }),
    windowMs: 60 * 1000,
    max: 100,
    // ...
});
```

---

## Verification

1. Fire 101 requests in 60 seconds to any API endpoint - 101st should get 429
2. Check response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
3. Different users should have independent rate limits
4. OTP endpoints should still have their stricter limits
