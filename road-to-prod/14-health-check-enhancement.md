# 14 - Health Check Enhancement

## Priority: HIGH
## Effort: 30 minutes
## Risk if skipped: Load balancers can't detect unhealthy instances, broken DB/S3 connections go unnoticed

---

## Current State

```typescript
// backend/src/app.ts:21-23
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

This always returns 200 even if:
- Database is disconnected
- S3 storage is unreachable
- Redis is down (if/when added)
- Server is out of memory

---

## The Fix

Replace the simple health check with liveness and readiness probes:

```typescript
// backend/src/app.ts - replace existing health check

import prisma from './utils/prisma';

// Liveness probe - is the process alive?
// Used by container orchestrators to know when to restart
app.get('/health/live', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// Readiness probe - can the service handle requests?
// Used by load balancers to know when to route traffic
app.get('/health/ready', async (req, res) => {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
    let allHealthy = true;

    // Check database
    try {
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
    } catch (error: any) {
        checks.database = { status: 'error', error: error.message };
        allHealthy = false;
    }

    // Check S3 (optional, non-blocking)
    try {
        const s3Start = Date.now();
        const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');
        const s3 = new S3Client({
            endpoint: process.env.S3_ENDPOINT,
            region: process.env.S3_REGION || 'garage',
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY || '',
                secretAccessKey: process.env.S3_SECRET_KEY || '',
            },
            forcePathStyle: true,
        });
        await s3.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET || '' }));
        checks.storage = { status: 'ok', latencyMs: Date.now() - s3Start };
    } catch (error: any) {
        checks.storage = { status: 'degraded', error: error.message };
        // S3 being down is degraded, not fatal - app can still serve data
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    checks.memory = {
        status: heapUsedMB > heapTotalMB * 0.9 ? 'warning' : 'ok',
        latencyMs: 0,
    };

    const statusCode = allHealthy ? 200 : 503;

    res.status(statusCode).json({
        status: allHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || 'unknown',
        checks,
    });
});

// Keep backward-compatible /health endpoint
app.get('/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch {
        res.status(503).json({ status: 'error', timestamp: new Date().toISOString() });
    }
});
```

---

## Example Responses

### Healthy:
```json
{
    "status": "healthy",
    "timestamp": "2026-02-14T10:30:00.000Z",
    "uptime": 3600.5,
    "version": "1.0.0",
    "checks": {
        "database": { "status": "ok", "latencyMs": 12 },
        "storage": { "status": "ok", "latencyMs": 45 },
        "memory": { "status": "ok", "latencyMs": 0 }
    }
}
```

### Database down:
```json
{
    "status": "unhealthy",
    "timestamp": "2026-02-14T10:30:00.000Z",
    "uptime": 3600.5,
    "checks": {
        "database": { "status": "error", "error": "Connection refused" },
        "storage": { "status": "ok", "latencyMs": 45 },
        "memory": { "status": "ok", "latencyMs": 0 }
    }
}
```

---

## Platform Configuration

### Docker / Kubernetes
```yaml
# In Kubernetes deployment
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

### Railway / Render
Set health check path to `/health/ready` in the dashboard.

### Docker Compose
```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health/ready"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

---

## Security Note

The `/health/ready` endpoint exposes some internal state (DB latency, memory usage). For production, you may want to restrict it:

```typescript
// Only allow health checks from internal IPs or with a secret header
app.get('/health/ready', (req, res, next) => {
    const healthSecret = process.env.HEALTH_CHECK_SECRET;
    if (healthSecret && req.headers['x-health-secret'] !== healthSecret) {
        // Return basic response without details
        return res.status(200).json({ status: 'ok' });
    }
    next();
}, async (req, res) => {
    // ... detailed health check
});
```

---

## Files to Change

| File | Change |
|------|--------|
| `backend/src/app.ts:21-23` | Replace with liveness + readiness probes |
| Deployment config | Point health check to `/health/ready` |

---

## Verification

1. `GET /health/live` - always returns 200 if process is running
2. `GET /health/ready` - returns 200 with all checks passing
3. Stop the database - `GET /health/ready` should return 503
4. Load balancer should stop routing traffic to unhealthy instances
