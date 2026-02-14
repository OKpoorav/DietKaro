# 04 - Media Endpoint Authentication

## Priority: CRITICAL
## Effort: 1 hour
## Risk if skipped: Anyone on the internet can access any org's meal photos, reports, and uploaded files by guessing the URL pattern

---

## The Problem

```typescript
// backend/src/app.ts:65
app.use('/media', mediaRoutes); // Public media proxy (no auth required)
```

```typescript
// backend/src/routes/media.routes.ts:24-27
router.get('/:prefix/:orgId/:entityId/:filename', async (req: Request, res: Response) => {
    const { prefix, orgId, entityId, filename } = req.params;
    const key = `${prefix}/${orgId}/${entityId}/${filename}`;
    // ... fetches from S3 and serves directly, no auth check
```

The URL structure is predictable: `/media/{prefix}/{orgId}/{entityId}/{filename}`

An attacker can:
1. Guess or enumerate org IDs (UUIDs, but if leaked anywhere they're permanent)
2. Access meal photos, weight log photos, client report documents
3. No rate limiting on this endpoint either

Additionally, line 58 logs full S3 errors: `console.error('Error fetching image:', error)` which could leak S3 bucket/key info.

---

## The Fix

### Option A: Signed URLs (Recommended - no proxy needed)

Instead of proxying through your server, generate time-limited signed URLs from S3 directly. This removes the media endpoint entirely:

```typescript
// backend/src/services/storage.service.ts - add method
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

static async getSignedMediaUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
    });
    return getSignedUrl(s3Client, command, { expiresIn });
}
```

Then in controllers/services, return signed URLs instead of `/media/...` paths:
```typescript
// When returning a meal log with photo
const signedPhotoUrl = mealLog.mealPhotoUrl
    ? await StorageService.getSignedMediaUrl(mealLog.mealPhotoUrl)
    : null;
```

### Option B: Add Auth to Media Proxy (Simpler migration)

If you want to keep the proxy pattern, add authentication:

```typescript
// backend/src/routes/media.routes.ts
import { requireClientAuth, ClientAuthRequest } from '../middleware/clientAuth.middleware';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';

// For authenticated web users (Clerk)
router.get('/web/:prefix/:orgId/:entityId/:filename',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const { prefix, orgId, entityId, filename } = req.params;

        // Verify the user belongs to this org
        if (req.user.organizationId !== orgId) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        const key = `${prefix}/${orgId}/${entityId}/${filename}`;
        // ... fetch and serve from S3
    }
);

// For authenticated mobile clients (JWT)
router.get('/client/:prefix/:orgId/:entityId/:filename',
    requireClientAuth,
    async (req: ClientAuthRequest, res: Response) => {
        if (!req.client) return res.status(401).json({ success: false, error: 'Unauthorized' });

        const { prefix, orgId, entityId, filename } = req.params;

        // Verify the client belongs to this org
        if (req.client.orgId !== orgId) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        const key = `${prefix}/${orgId}/${entityId}/${filename}`;
        // ... fetch and serve from S3
    }
);
```

---

## Additional Fix: Error Logging

```typescript
// Line 58 - replace:
console.error('Error fetching image:', error);

// With:
logger.error('Media fetch failed', { key, error: error.message });
```

---

## Files to Change

| File | Change |
|------|--------|
| `backend/src/routes/media.routes.ts` | Add auth middleware + org verification |
| `backend/src/app.ts:65` | Update route path if changing URL structure |
| `backend/src/services/storage.service.ts` | Add signed URL generation (Option A) |
| Frontend/mobile code | Update media URLs to use new authenticated paths |

---

## Migration Note

If existing data stores `/media/...` URLs in the database (e.g. `mealPhotoUrl` fields), you'll need to either:
1. Store only the S3 key (not the full URL) and generate signed URLs on read
2. Keep the old endpoint working temporarily with a deprecation warning

---

## Verification

1. Try accessing `/media/meal-photos/{orgId}/{entityId}/photo.jpg` without auth - should return 401
2. Access with valid auth token for correct org - should return the image
3. Access with valid auth token for wrong org - should return 403
4. Check that S3 error details are not leaked in responses
