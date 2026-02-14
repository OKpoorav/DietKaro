# 08 - JWT Expiry & Refresh Token Cleanup

## Priority: HIGH
## Effort: 30 minutes (mostly already implemented)
## Risk if skipped: Stolen access token = long-lived unauthorized access to client data

---

## Current State

Good news: the codebase already has a proper refresh token system with rotation detection. The middleware at `backend/src/middleware/clientAuth.middleware.ts` already implements:

- Short-lived access tokens (15 minutes) - line 26: `ACCESS_TOKEN_EXPIRY = '15m'`
- 7-day refresh tokens stored as hashed values in DB - line 27: `REFRESH_TOKEN_EXPIRY_DAYS = 7`
- Token family tracking for rotation detection - line 52
- Automatic revocation of compromised token families - lines 90-96

This is solid. The remaining issues are minor cleanup items.

---

## Remaining Issues

### Issue 1: Deprecated `signClientToken` still exported

```typescript
// backend/src/middleware/clientAuth.middleware.ts:44-47
/**
 * @deprecated Use signClientAccessToken + createRefreshToken instead.
 * Kept for backward compatibility during migration.
 */
export const signClientToken = (clientId: string): string => {
    return signClientAccessToken(clientId);
};
```

**Fix:** Search for any callers of `signClientToken`. If none remain, remove it.

### Issue 2: Old tokens without `type` field still accepted

```typescript
// Line 148-154
// Accept both old tokens (no type) and new access tokens
if (decoded.type && decoded.type !== 'access') {
    return res.status(401).json({...});
}
```

**Fix:** After all clients have updated to the new token format, remove backward compatibility:
```typescript
if (decoded.type !== 'access') {
    return res.status(401).json({...});
}
```

Set a migration deadline (e.g., force app update after 30 days).

### Issue 3: Stale refresh tokens not cleaned up

Revoked/expired refresh tokens accumulate in `ClientRefreshToken` table forever.

**Fix:** Add a periodic cleanup job:
```typescript
// Add to a cron job or scheduled task
async function cleanupExpiredTokens() {
    const deleted = await prisma.clientRefreshToken.deleteMany({
        where: {
            OR: [
                { isRevoked: true, updatedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
                { expiresAt: { lt: new Date() } },
            ],
        },
    });
    logger.info(`Cleaned up ${deleted.count} expired refresh tokens`);
}
```

---

## Files to Change

| File | Change |
|------|--------|
| `backend/src/middleware/clientAuth.middleware.ts:44-47` | Remove deprecated `signClientToken` if unused |
| `backend/src/middleware/clientAuth.middleware.ts:148-154` | Plan removal of backward-compatible token acceptance |
| New: scheduled job or startup cleanup | Add expired token cleanup |

---

## Verification

1. Login via mobile app - should receive both `accessToken` and `refreshToken`
2. Access token should expire after 15 minutes
3. Refresh token rotation should issue new pair and revoke old token
4. Reusing a revoked refresh token should revoke the entire family
