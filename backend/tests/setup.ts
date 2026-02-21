import { vi } from 'vitest';

// Mock environment variables
process.env.CLIENT_JWT_SECRET = 'test-secret-for-vitest-do-not-use-in-production';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock Prisma
vi.mock('../src/utils/prisma', () => ({
    default: {
        client: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
        organization: { findFirst: vi.fn(), findUnique: vi.fn() },
        user: { findFirst: vi.fn(), findUnique: vi.fn() },
        notification: { create: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
        clientRefreshToken: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
        $transaction: vi.fn((fns: any[]) => Promise.all(fns)),
    },
}));

// Mock Redis
vi.mock('../src/utils/redis', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
    },
}));
