# 11 - orgId Enforcement in Services

## Priority: HIGH
## Effort: 2-3 hours
## Risk if skipped: Service methods can be called with arbitrary clientId, leaking data across tenants

---

## The Problem

Several services accept `clientId` as a parameter but don't verify that the client belongs to the calling user's organization. They rely entirely on the controller passing the correct context, with no safety net.

### Affected Services

#### 1. Compliance Service - No orgId at all

```typescript
// backend/src/services/compliance.service.ts:208
async calculateDailyAdherence(clientId: string, date: Date): Promise<DailyAdherence> {
    const logs = await prisma.mealLog.findMany({
        where: {
            clientId,           // No orgId check
            scheduledDate: { gte: start, lte: end },
        },
    });

// Line 278
async calculateWeeklyAdherence(clientId: string, weekStartDate?: Date): Promise<WeeklyAdherence> {
    // Calls calculateDailyAdherence(clientId, day) — no orgId

// Line 335
async getClientComplianceHistory(clientId: string, days: number = 30): Promise<ComplianceHistory> {
    const logs = await prisma.mealLog.findMany({
        where: {
            clientId,           // No orgId check
            // ...
        },
    });
```

#### 2. Compliance - calculateMealCompliance

```typescript
// backend/src/services/compliance.service.ts:88
async calculateMealCompliance(mealLogId: string): Promise<ComplianceResult> {
    const mealLog = await prisma.mealLog.findUnique({
        where: { id: mealLogId },  // No orgId check
    });
```

#### 3. Notification Service - Trusts caller's orgId

```typescript
// backend/src/services/notification.service.ts:40-63
async sendNotification(
    recipientId: string,
    recipientType: 'client' | 'user',
    orgId: string,           // Passed in but never validated
    title: string,
    message: string,
) {
    // No check that recipientId belongs to orgId
    const notification = await prisma.notification.create({
        data: {
            recipientId,
            orgId,           // Could be wrong org
            // ...
        },
    });
```

#### 4. Lab Service

```typescript
// backend/src/services/lab.service.ts
const profile = await prisma.medicalProfile.findUnique({
    where: { clientId },     // No orgId check
});
```

---

## The Fix

### Pattern: Add orgId to all tenant-scoped service methods

#### Fix Compliance Service

```typescript
// backend/src/services/compliance.service.ts

async calculateDailyAdherence(clientId: string, orgId: string, date: Date): Promise<DailyAdherence> {
    const logs = await prisma.mealLog.findMany({
        where: {
            clientId,
            orgId,              // ADD orgId filter
            scheduledDate: { gte: start, lte: end },
        },
        // ...
    });

    const activePlan = await prisma.dietPlan.findFirst({
        where: {
            clientId,
            orgId,              // ADD orgId filter
            status: 'active',
            isActive: true,
        },
        // ...
    });
    // ...
}

async calculateWeeklyAdherence(clientId: string, orgId: string, weekStartDate?: Date): Promise<WeeklyAdherence> {
    // Pass orgId through to calculateDailyAdherence
    const daily = await this.calculateDailyAdherence(clientId, orgId, day);
    // ...

    const prevLogs = await prisma.mealLog.findMany({
        where: {
            clientId,
            orgId,              // ADD orgId filter
            // ...
        },
    });
}

async getClientComplianceHistory(clientId: string, orgId: string, days: number = 30): Promise<ComplianceHistory> {
    const logs = await prisma.mealLog.findMany({
        where: {
            clientId,
            orgId,              // ADD orgId filter
            scheduledDate: { gte: startDate },
            complianceScore: { not: null },
        },
    });
}
```

#### Fix Notification Service

```typescript
// backend/src/services/notification.service.ts

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
    if (recipientType === 'client') {
        const client = await prisma.client.findFirst({
            where: { id: recipientId, orgId, isActive: true },
        });
        if (!client) {
            logger.warn('Notification: recipient not found in org', { recipientId, orgId });
            return null;
        }
    } else {
        const user = await prisma.user.findFirst({
            where: { id: recipientId, organizationId: orgId, isActive: true },
        });
        if (!user) {
            logger.warn('Notification: recipient not found in org', { recipientId, orgId });
            return null;
        }
    }

    // ... proceed with creating notification
}
```

---

## Update All Callers

After adding `orgId` to service method signatures, update all call sites:

```typescript
// Example: compliance.routes.ts or compliance.controller.ts
// Before:
const result = await complianceService.calculateDailyAdherence(clientId, date);

// After:
const result = await complianceService.calculateDailyAdherence(clientId, req.user.organizationId, date);
```

Search for all callers:
```bash
grep -rn "calculateDailyAdherence\|calculateWeeklyAdherence\|getClientComplianceHistory\|sendNotification" backend/src/
```

---

## Longer-Term: Automatic orgId Injection

Consider a Prisma middleware that automatically injects `orgId` into tenant-scoped queries:

```typescript
// backend/src/utils/prisma.ts - add middleware
prisma.$use(async (params, next) => {
    const tenantModels = ['Client', 'DietPlan', 'MealLog', 'WeightLog', 'Notification'];

    if (tenantModels.includes(params.model || '') && params.action.startsWith('find')) {
        // Log warning if orgId is missing from where clause
        const where = params.args?.where;
        if (where && !where.orgId) {
            logger.warn(`Query on ${params.model} without orgId filter`, {
                action: params.action,
                where: JSON.stringify(where),
            });
        }
    }

    return next(params);
});
```

This won't block queries but will log warnings during development, helping catch missing scoping.

---

## Files to Change

| File | Change |
|------|--------|
| `backend/src/services/compliance.service.ts` | Add `orgId` param to all public methods, filter queries |
| `backend/src/services/notification.service.ts` | Verify recipientId belongs to orgId |
| `backend/src/services/lab.service.ts` | Add `orgId` to medical profile queries |
| All controllers calling these services | Pass `req.user.organizationId` or `req.client.orgId` |
| `backend/src/routes/compliance.routes.ts` | Update controller call sites |

---

## Verification

1. Call compliance endpoint with a clientId from a different org - should return 404/empty
2. Notification creation with mismatched recipientId/orgId - should be rejected
3. Run the Prisma warning middleware in dev - check logs for unscoped queries
