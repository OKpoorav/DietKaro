/**
 * Environment variable validation.
 * Import this module instead of using process.env directly.
 * The app will refuse to start if required variables are missing.
 *
 * NOTE: Do NOT import logger here — logger imports env, creating a circular dependency.
 * Use console.warn/error for startup diagnostics instead.
 */

function requireEnv(name: string, description?: string): string {
    const value = process.env[name];
    if (!value) {
        const desc = description ? ` (${description})` : '';
        throw new Error(`Missing required environment variable: ${name}${desc}`);
    }
    return value;
}

function optionalEnv(name: string, fallback: string): string {
    return process.env[name] || fallback;
}

const NODE_ENV = optionalEnv('NODE_ENV', 'development');
const isProduction = NODE_ENV === 'production';

/**
 * In production, certain vars that are "optional" in dev become required.
 * This prevents deploying with missing config.
 */
function requireInProd(name: string, devFallback: string, description?: string): string {
    const value = process.env[name];
    if (!value && isProduction) {
        throw new Error(`Missing required production env var: ${name}${description ? ` (${description})` : ''}`);
    }
    return value || devFallback;
}

// Validate at import time — crashes early if critical vars are missing
export const env = {
    // Server
    PORT: parseInt(optionalEnv('PORT', '3001'), 10),
    NODE_ENV,

    // Database (required)
    DATABASE_URL: requireEnv('DATABASE_URL', 'PostgreSQL connection string'),

    // Authentication (required)
    CLERK_SECRET_KEY: requireEnv('CLERK_SECRET_KEY', 'Clerk authentication secret key'),
    CLIENT_JWT_SECRET: requireEnv('CLIENT_JWT_SECRET', 'Secret for signing client JWT tokens'),

    // S3 / Object Storage
    S3_ENDPOINT: optionalEnv('S3_ENDPOINT', 'http://localhost:3900'),
    S3_REGION: optionalEnv('S3_REGION', 'garage'),
    S3_ACCESS_KEY: requireInProd('S3_ACCESS_KEY', '', 'S3 access key for file uploads'),
    S3_SECRET_KEY: requireInProd('S3_SECRET_KEY', '', 'S3 secret key for file uploads'),
    S3_BUCKET: optionalEnv('S3_BUCKET', 'healthpractix-media'),

    // AWS S3 (for reports)
    AWS_REGION: optionalEnv('AWS_REGION', 'ap-south-1'),
    AWS_ACCESS_KEY_ID: optionalEnv('AWS_ACCESS_KEY_ID', ''),
    AWS_SECRET_ACCESS_KEY: optionalEnv('AWS_SECRET_ACCESS_KEY', ''),
    AWS_S3_BUCKET: optionalEnv('AWS_S3_BUCKET', 'healthpractix-uploads'),

    // Frontend URL
    FRONTEND_URL: requireInProd('FRONTEND_URL', 'http://localhost:3000', 'Used in invite/share links'),
    API_BASE_URL: requireInProd('API_BASE_URL', 'http://localhost:3000', 'Used in media URLs'),

    // CORS
    CORS_ALLOWED_ORIGINS: requireInProd('CORS_ALLOWED_ORIGINS', '', 'Comma-separated allowed origins'),

    // Logging
    LOG_LEVEL: optionalEnv('LOG_LEVEL', isProduction ? 'warn' : 'info'),

    // Redis (shared with Socket.io)
    REDIS_URL: requireInProd('REDIS_URL', 'redis://localhost:6379', 'Redis for Socket.io, BullMQ, caching'),

    // AI providers
    OPENAI_API_KEY: optionalEnv('OPENAI_API_KEY', ''),
    GOOGLE_AI_API_KEY: optionalEnv('GOOGLE_AI_API_KEY', ''),
} as const;

// ── Startup diagnostics (uses console — logger isn't ready yet) ──
if (isProduction) {
    if (!env.DATABASE_URL.includes('sslmode=require') && !env.DATABASE_URL.includes('ssl=true')) {
        console.warn('[env] WARNING: DATABASE_URL does not appear to use SSL — strongly recommended in production');
    }
    if (!env.CORS_ALLOWED_ORIGINS) {
        console.error('[env] CRITICAL: CORS_ALLOWED_ORIGINS is empty in production — all cross-origin requests will be blocked');
    }
    console.log(`[env] Production validated — port=${env.PORT} bucket=${env.S3_BUCKET} cors=${env.CORS_ALLOWED_ORIGINS.split(',').length} origins`);
} else {
    if (!env.S3_ACCESS_KEY) console.warn('[env] S3_ACCESS_KEY not set — file uploads will fail');
    if (!env.OPENAI_API_KEY) console.warn('[env] OPENAI_API_KEY not set — AI features disabled');
    if (!env.GOOGLE_AI_API_KEY) console.warn('[env] GOOGLE_AI_API_KEY not set — document extraction disabled');
}
