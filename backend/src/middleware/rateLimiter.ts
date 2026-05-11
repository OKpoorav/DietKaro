import rateLimit, { Store, ClientRateLimitInfo } from 'express-rate-limit';

// Lazily resolve the shared Redis client and logger so that importing this module
// does not pull in the full env-config chain (which requires CLERK_SECRET_KEY etc.).
// Without lazy loading, test files that import rateLimiter.ts would crash if env
// vars aren't set, even when they just want to assert the exports exist.
function getRedis(): import('ioredis').Redis {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../utils/redis').default;
}
function getLogger(): import('winston').Logger {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../utils/logger').default;
}

// Lua script: atomically INCR the key and set its expiry on first hit.
// Returns [current_hit_count, pttl_ms].
// Using Lua ensures there is no race between INCR and PEXPIRE — a process crash
// between the two would leave a key without an expiry, causing a memory leak.
const LUA_INCR = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local pttl = redis.call('PTTL', KEYS[1])
return {hits, pttl}
`;

/**
 * Redis-backed store for express-rate-limit.
 *
 * Why: the default MemoryStore is per-process. In a multi-replica or PM2-cluster
 * deployment every process maintains independent counters, which means an attacker
 * can bypass any limit by distributing requests across replicas. This store keeps
 * counters in the shared Redis instance so limits are enforced globally.
 *
 * Fallback: if Redis is unavailable the store logs a warning and returns
 * totalHits=0, which is permissive (requests are allowed through). This is the
 * right trade-off for API rate limits — a brief Redis outage should not lock out
 * all users. For the OTP limiter a stricter fallback can be added later.
 */
class RedisRateLimitStore implements Store {
    private readonly windowMs: number;
    private readonly nsPrefix: string;

    // Tells express-rate-limit that keys are shared across processes.
    readonly localKeys = false;

    constructor(windowMs: number, nsPrefix: string) {
        this.windowMs = windowMs;
        this.nsPrefix = nsPrefix;
    }

    private key(rawKey: string): string {
        return `rl:${this.nsPrefix}:${rawKey}`;
    }

    async increment(rawKey: string): Promise<ClientRateLimitInfo> {
        const key = this.key(rawKey);
        try {
            const result = await getRedis().eval(
                LUA_INCR,
                1,
                key,
                this.windowMs.toString(),
            ) as [number, number];

            const [totalHits, pttl] = result;
            const resetTime = pttl > 0 ? new Date(Date.now() + pttl) : undefined;
            return { totalHits, resetTime };
        } catch (err) {
            getLogger().warn('Rate limiter Redis error — allowing request', {
                key,
                error: (err as Error).message,
            });
            // Permissive fallback: treat as first hit so the request is allowed.
            return { totalHits: 0, resetTime: undefined };
        }
    }

    async decrement(rawKey: string): Promise<void> {
        try {
            await getRedis().decr(this.key(rawKey));
        } catch (err) {
            getLogger().warn('Rate limiter Redis decrement error', { error: (err as Error).message });
        }
    }

    async resetKey(rawKey: string): Promise<void> {
        try {
            await getRedis().del(this.key(rawKey));
        } catch (err) {
            getLogger().warn('Rate limiter Redis resetKey error', { error: (err as Error).message });
        }
    }
}

export const otpRequestLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 3,
    keyGenerator: (req) => req.body.phone || req.ip || 'unknown',
    validate: { keyGeneratorIpFallback: false },
    store: new RedisRateLimitStore(5 * 60 * 1000, 'otp-request'),
    message: {
        success: false,
        error: {
            code: 'RATE_LIMITED',
            message: 'Too many OTP requests. Please try again in 5 minutes.',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const otpVerifyLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.body.phone || req.ip || 'unknown',
    validate: { keyGeneratorIpFallback: false },
    store: new RedisRateLimitStore(5 * 60 * 1000, 'otp-verify'),
    message: {
        success: false,
        error: {
            code: 'RATE_LIMITED',
            message: 'Too many verification attempts. Please request a new OTP.',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    store: new RedisRateLimitStore(60 * 1000, 'api'),
    message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests.' },
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const writeOperationLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    store: new RedisRateLimitStore(60 * 1000, 'write'),
    message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many write requests. Please slow down.' },
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Keyed by email address (from req.body.email) to prevent per-email abuse of the
// ensure-clerk-user endpoint. An attacker with many IPs could otherwise call this
// endpoint rapidly against the same victim email.
export const ensureClerkUserLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 3,
    keyGenerator: (req) => (req.body?.email as string | undefined)?.toLowerCase().trim() || req.ip || 'unknown',
    validate: { keyGeneratorIpFallback: false },
    store: new RedisRateLimitStore(5 * 60 * 1000, 'ensure-clerk'),
    message: {
        success: false,
        error: {
            code: 'RATE_LIMITED',
            message: 'Too many account setup attempts. Please try again in 5 minutes.',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
});
