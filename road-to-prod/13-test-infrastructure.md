# 13 - Test Infrastructure

## Priority: HIGH
## Effort: 3-4 hours (initial setup), ongoing for coverage
## Risk if skipped: No regression safety, no CI/CD possible, bugs discovered only in production

---

## Current State

- 1 test file exists: `backend/tests/validationEngine.test.ts` (25+ test cases)
- No test runner configured
- `npm test` returns `echo "Error: no test specified" && exit 1`
- No frontend tests at all
- No integration tests
- No CI/CD pipeline

---

## The Fix

### Step 1: Install test dependencies

```bash
cd backend
npm install -D vitest @vitest/coverage-v8 supertest @types/supertest
```

Why Vitest over Jest: faster, ESM-native, same API as Jest, works out of the box with TypeScript.

### Step 2: Configure Vitest

Create `backend/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['src/types/**', 'src/**/*.d.ts'],
        },
        setupFiles: ['tests/setup.ts'],
    },
});
```

### Step 3: Create test setup

Create `backend/tests/setup.ts`:

```typescript
import { beforeAll, afterAll } from 'vitest';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.CLIENT_JWT_SECRET = 'test-secret-for-testing-only';

beforeAll(async () => {
    // Any global setup (e.g., connect to test DB)
});

afterAll(async () => {
    // Cleanup
});
```

### Step 4: Update package.json scripts

```json
{
    "scripts": {
        "dev": "tsx watch src/server.ts",
        "build": "tsc",
        "start": "node dist/server.js",
        "test": "vitest run",
        "test:watch": "vitest",
        "test:coverage": "vitest run --coverage"
    }
}
```

### Step 5: Write priority tests

#### A. Auth Middleware Tests

Create `backend/tests/middleware/clientAuth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { signClientAccessToken } from '../../src/middleware/clientAuth.middleware';

describe('Client Auth', () => {
    it('should generate a valid access token', () => {
        const token = signClientAccessToken('client-123');
        const decoded = jwt.verify(token, process.env.CLIENT_JWT_SECRET!) as any;
        expect(decoded.clientId).toBe('client-123');
        expect(decoded.type).toBe('access');
    });

    it('should reject expired tokens', () => {
        const token = jwt.sign(
            { clientId: 'client-123', type: 'access' },
            process.env.CLIENT_JWT_SECRET!,
            { expiresIn: '0s' }
        );
        expect(() => jwt.verify(token, process.env.CLIENT_JWT_SECRET!)).toThrow();
    });
});
```

#### B. Service Tests (with mocked Prisma)

Create `backend/tests/services/client.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientService } from '../../src/services/client.service';

// Mock Prisma
vi.mock('../../src/utils/prisma', () => ({
    default: {
        client: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn(),
            count: vi.fn(),
        },
        $transaction: vi.fn(),
    },
}));

import prisma from '../../src/utils/prisma';

describe('ClientService', () => {
    const service = new ClientService();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should scope client lookup by orgId', async () => {
        const mockClient = { id: '1', orgId: 'org-1', fullName: 'Test' };
        vi.mocked(prisma.client.findFirst).mockResolvedValue(mockClient as any);

        const result = await service.getClient('1', 'org-1');

        expect(prisma.client.findFirst).toHaveBeenCalledWith({
            where: { id: '1', orgId: 'org-1', isActive: true },
            include: expect.any(Object),
        });
    });

    it('should throw NotFound for wrong org', async () => {
        vi.mocked(prisma.client.findFirst).mockResolvedValue(null);

        await expect(service.getClient('1', 'wrong-org')).rejects.toThrow('Client not found');
    });
});
```

#### C. API Integration Tests

Create `backend/tests/api/health.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app';

describe('Health Check', () => {
    it('GET /health should return 200', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});

describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
        const res = await request(app).get('/api/v1/nonexistent');
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
    });
});
```

---

## Priority Test Coverage

Write tests in this order for maximum safety return:

| Priority | Area | Why |
|----------|------|-----|
| 1 | Auth middleware (Clerk + JWT) | Gate to all data |
| 2 | Client service (CRUD + orgId scoping) | Core multi-tenancy |
| 3 | OTP flow (request + verify) | Client-facing auth |
| 4 | Meal log service (create + update + compliance) | Core feature |
| 5 | Referral code scoping | Cross-tenant risk |
| 6 | API route integration tests | End-to-end validation |
| 7 | Validation engine (already exists) | Migrate to vitest |

---

## CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        working-directory: backend
        run: npm ci

      - name: Generate Prisma client
        working-directory: backend
        run: npx prisma generate

      - name: Run tests
        working-directory: backend
        run: npm test
        env:
          CLIENT_JWT_SECRET: test-secret
          NODE_ENV: test

      - name: Build check
        working-directory: backend
        run: npm run build
```

---

## Files to Create/Change

| File | Purpose |
|------|---------|
| `backend/vitest.config.ts` | Test runner configuration |
| `backend/tests/setup.ts` | Global test setup |
| `backend/tests/middleware/clientAuth.test.ts` | Auth tests |
| `backend/tests/services/client.service.test.ts` | Service tests |
| `backend/tests/api/health.test.ts` | Integration tests |
| `backend/package.json` | Update test scripts |
| `.github/workflows/test.yml` | CI/CD pipeline |

---

## Verification

1. `npm test` should run all tests and exit 0
2. `npm run test:coverage` should show coverage report
3. GitHub Actions should run on push/PR
