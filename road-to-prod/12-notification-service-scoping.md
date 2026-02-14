# 12 - Notification Service Tenant Scoping

## Priority: HIGH
## Effort: 45 minutes
## Risk if skipped: Push notifications and device tokens could be misdirected across organizations

---

## The Problem

### Issue 1: Device token registration has no org verification

```typescript
// backend/src/services/notification.service.ts:13-32
async registerDeviceToken(entityId: string, entityType: 'client' | 'user', token: string) {
    if (entityType === 'client') {
        const client = await prisma.client.findUnique({ where: { id: entityId } });
        // No check that client belongs to the requesting org
        if (!client) return;
        // ...
    } else {
        const user = await prisma.user.findUnique({ where: { id: entityId } });
        // No check that user belongs to the requesting org
        if (!user) return;
        // ...
    }
}
```

A request with a forged `entityId` could register a push token on someone else's profile, potentially receiving their notifications.

### Issue 2: Notification send trusts caller's orgId

```typescript
// backend/src/services/notification.service.ts:40-63
async sendNotification(
    recipientId: string,
    recipientType: 'client' | 'user',
    orgId: string,      // Passed but never validated against recipientId
    // ...
) {
    const notification = await prisma.notification.create({
        data: {
            recipientId,
            orgId,       // Could be mismatched - notification saved to wrong org
            // ...
        },
    });
```

### Issue 3: Push notification not implemented yet

```typescript
// Lines 80-89 - Expo push is commented out
// const messages = tokens.map(token => ({
//     to: token,
//     // ...
// }));
// await expo.sendPushNotificationsAsync(messages);
```

The `TODO: Install expo-server-sdk` on line 3 indicates this is incomplete.

---

## The Fix

### Fix registerDeviceToken

```typescript
async registerDeviceToken(
    entityId: string,
    entityType: 'client' | 'user',
    orgId: string,          // ADD orgId parameter
    token: string
) {
    if (entityType === 'client') {
        const client = await prisma.client.findFirst({
            where: { id: entityId, orgId, isActive: true },  // Verify org ownership
        });
        if (!client) {
            logger.warn('registerDeviceToken: client not found in org', { entityId, orgId });
            return;
        }
        const tokens = new Set(client.pushTokens);
        tokens.add(token);
        await prisma.client.update({
            where: { id: entityId },
            data: { pushTokens: Array.from(tokens) },
        });
    } else {
        const user = await prisma.user.findFirst({
            where: { id: entityId, organizationId: orgId, isActive: true },  // Verify org
        });
        if (!user) {
            logger.warn('registerDeviceToken: user not found in org', { entityId, orgId });
            return;
        }
        const tokens = new Set(user.pushTokens);
        tokens.add(token);
        await prisma.user.update({
            where: { id: entityId },
            data: { pushTokens: Array.from(tokens) },
        });
    }
    logger.info('Device token registered', { entityId, entityType, orgId });
}
```

### Fix sendNotification

```typescript
async sendNotification(
    recipientId: string,
    recipientType: 'client' | 'user',
    orgId: string,
    title: string,
    message: string,
    data: any = {},
    category?: string
) {
    // Verify recipient belongs to org
    let tokens: string[] = [];

    if (recipientType === 'client') {
        const client = await prisma.client.findFirst({
            where: { id: recipientId, orgId, isActive: true },
        });
        if (!client) {
            logger.warn('sendNotification: client not in org', { recipientId, orgId });
            return null;
        }
        tokens = client.pushTokens || [];
    } else {
        const user = await prisma.user.findFirst({
            where: { id: recipientId, organizationId: orgId, isActive: true },
        });
        if (!user) {
            logger.warn('sendNotification: user not in org', { recipientId, orgId });
            return null;
        }
        tokens = user.pushTokens || [];
    }

    // Save notification
    const notification = await prisma.notification.create({
        data: {
            recipientId,
            recipientType,
            orgId,
            type: 'push',
            category,
            title,
            message,
            relatedEntityType: data.entityType,
            relatedEntityId: data.entityId,
            deliveryStatus: tokens.length > 0 ? 'pending' : 'no_tokens',
        },
    });

    if (tokens.length === 0) {
        logger.warn('No push tokens for recipient', { recipientId });
        return notification;
    }

    // Send via Expo when ready
    // ...

    return notification;
}
```

### Fix: Add token cleanup

Add a method to remove stale/invalid tokens:

```typescript
async removeDeviceToken(entityId: string, entityType: 'client' | 'user', token: string) {
    if (entityType === 'client') {
        const client = await prisma.client.findUnique({ where: { id: entityId } });
        if (!client) return;
        const tokens = (client.pushTokens || []).filter(t => t !== token);
        await prisma.client.update({
            where: { id: entityId },
            data: { pushTokens: tokens },
        });
    } else {
        const user = await prisma.user.findUnique({ where: { id: entityId } });
        if (!user) return;
        const tokens = (user.pushTokens || []).filter(t => t !== token);
        await prisma.user.update({
            where: { id: entityId },
            data: { pushTokens: tokens },
        });
    }
}
```

---

## Update Callers

All callers of `registerDeviceToken` and `sendNotification` must now pass `orgId`:

```typescript
// Before:
await notificationService.registerDeviceToken(clientId, 'client', token);

// After:
await notificationService.registerDeviceToken(clientId, 'client', req.client.orgId, token);
```

---

## Files to Change

| File | Change |
|------|--------|
| `backend/src/services/notification.service.ts` | Add `orgId` validation to all methods |
| All callers of notification service | Pass `orgId` from auth context |
| `backend/src/routes/notification.routes.ts` | Ensure controller passes org context |

---

## Verification

1. Register device token with a clientId from wrong org - should silently fail
2. Send notification to recipientId from wrong org - should return null
3. Valid same-org operations should work as before
