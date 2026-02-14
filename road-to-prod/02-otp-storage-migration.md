# 02 - OTP Storage Migration (In-Memory to Redis)

## Priority: CRITICAL
## Effort: 1-2 hours
## Risk if skipped: OTPs lost on server restart, breaks horizontal scaling, single-instance bottleneck

---

## The Problem

```typescript
// backend/src/controllers/clientAuth.controller.ts:16
const otpStore = new Map<string, { otp: string; expiresAt: Date }>();
```

An in-memory `Map` means:
- **Server restart** = all pending OTPs vanish, users can't verify
- **Multiple instances** = OTP generated on instance A, verify hits instance B, fails
- **No TTL** = manual expiry checking, entries could leak memory if never verified
- **OTP logged in plaintext** on line 45: `logger.info(\`[Client OTP] Generated for ${phone}: ${otp}\`)`

---

## The Fix

### Option A: Redis (Recommended for production)

```bash
npm install ioredis
```

Create `backend/src/utils/redis.ts`:
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export default redis;
```

Update `backend/src/controllers/clientAuth.controller.ts`:
```typescript
import redis from '../utils/redis';

const OTP_PREFIX = 'otp:';
const OTP_TTL_SECONDS = 300; // 5 minutes

export const requestOTP = asyncHandler(async (req: Request, res: Response) => {
    const { phone } = req.body;
    // ... validation ...

    const otp = generateOTP();

    // Store in Redis with auto-expiry
    await redis.set(`${OTP_PREFIX}${phone}`, otp, 'EX', OTP_TTL_SECONDS);

    // REMOVE this line in production:
    // logger.info(`[Client OTP] Generated for ${phone}: ${otp}`);

    res.status(200).json({
        success: true,
        message: 'OTP sent successfully',
    });
});

export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
    const { phone, otp } = req.body;
    // ... validation ...

    const stored = await redis.get(`${OTP_PREFIX}${phone}`);

    if (!stored) {
        throw AppError.badRequest('OTP expired or not found', 'OTP_EXPIRED');
    }

    // Use timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
        Buffer.from(stored),
        Buffer.from(otp)
    );

    if (!isValid) {
        throw AppError.badRequest('Invalid OTP', 'INVALID_OTP');
    }

    // Delete used OTP
    await redis.del(`${OTP_PREFIX}${phone}`);

    // ... rest of verification ...
});
```

### Option B: Database (Simpler, no Redis dependency)

If you don't want to add Redis yet, store OTPs in the database with a TTL. Add a model:

```prisma
model Otp {
    id        String   @id @default(uuid())
    phone     String
    otp       String
    expiresAt DateTime
    used      Boolean  @default(false)
    createdAt DateTime @default(now())

    @@index([phone, expiresAt])
}
```

This survives restarts and works across instances, but is slower than Redis.

---

## Additional Fixes in This File

| Line | Issue | Fix |
|------|-------|-----|
| 45 | OTP logged in plaintext | Remove or guard with `NODE_ENV === 'development'` |
| 51 | `dev_otp` returned in response | Already guarded, but verify `NODE_ENV` is set in prod |
| 73 | String comparison for OTP | Use `crypto.timingSafeEqual()` |

---

## Environment Variables to Add

```env
REDIS_URL=redis://localhost:6379   # Option A only
```

---

## Files to Change

| File | Change |
|------|--------|
| `backend/src/controllers/clientAuth.controller.ts` | Replace Map with Redis/DB |
| `backend/src/utils/redis.ts` | New file (if using Redis) |
| `backend/package.json` | Add `ioredis` dependency (if using Redis) |

---

## Verification

1. Request OTP, restart server, try to verify - should still work (Redis) or fail gracefully (DB)
2. Run two server instances behind a load balancer - OTP should work across both
3. Wait 5+ minutes after OTP request - should auto-expire
