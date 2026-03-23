/**
 * Environment variable validation.
 * Import this module instead of using process.env directly.
 * The app will refuse to start if required variables are missing.
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

// Validate at import time — crashes early if critical vars are missing
export const env = {
    // Server
    PORT: parseInt(optionalEnv('PORT', '3000'), 10),
    NODE_ENV: optionalEnv('NODE_ENV', 'development'),

    // Database (required)
    DATABASE_URL: requireEnv('DATABASE_URL', 'PostgreSQL connection string'),

    // Authentication (required)
    CLERK_SECRET_KEY: requireEnv('CLERK_SECRET_KEY', 'Clerk authentication secret key'),
    CLIENT_JWT_SECRET: requireEnv('CLIENT_JWT_SECRET', 'Secret for signing client JWT tokens'),

    // S3 / Object Storage
    S3_ENDPOINT: optionalEnv('S3_ENDPOINT', 'http://localhost:3900'),
    S3_REGION: optionalEnv('S3_REGION', 'garage'),
    S3_ACCESS_KEY: optionalEnv('S3_ACCESS_KEY', ''),
    S3_SECRET_KEY: optionalEnv('S3_SECRET_KEY', ''),
    S3_BUCKET: optionalEnv('S3_BUCKET', 'healthpractix-media'),

    // AWS S3 (for reports)
    AWS_REGION: optionalEnv('AWS_REGION', 'ap-south-1'),
    AWS_ACCESS_KEY_ID: optionalEnv('AWS_ACCESS_KEY_ID', ''),
    AWS_SECRET_ACCESS_KEY: optionalEnv('AWS_SECRET_ACCESS_KEY', ''),
    AWS_S3_BUCKET: optionalEnv('AWS_S3_BUCKET', 'healthpractix-uploads'),

    // Frontend URL
    FRONTEND_URL: optionalEnv('FRONTEND_URL', 'http://localhost:3000'),
    API_BASE_URL: optionalEnv('API_BASE_URL', 'http://localhost:3000'),

    // CORS
    CORS_ALLOWED_ORIGINS: optionalEnv('CORS_ALLOWED_ORIGINS', ''),

    // Logging
    LOG_LEVEL: optionalEnv('LOG_LEVEL', 'info'),

    // Redis (shared with Socket.io)
    REDIS_URL: optionalEnv('REDIS_URL', 'redis://localhost:6379'),

    // AI providers
    OPENAI_API_KEY: optionalEnv('OPENAI_API_KEY', ''),
    GOOGLE_AI_API_KEY: optionalEnv('GOOGLE_AI_API_KEY', ''),
} as const;

// Startup warnings for optional but important env vars
if (!env.S3_ACCESS_KEY) console.warn('[env] WARNING: S3_ACCESS_KEY not set — file uploads will fail');
if (!env.OPENAI_API_KEY) console.warn('[env] WARNING: OPENAI_API_KEY not set — AI features disabled');
if (!env.GOOGLE_AI_API_KEY) console.warn('[env] WARNING: GOOGLE_AI_API_KEY not set — document extraction disabled');
