# 05 - Referral Code Tenant Scoping

## Priority: CRITICAL
## Effort: 20 minutes
## Risk if skipped: Referral codes leak client existence across orgs, cross-tenant referral attribution

---

## The Problem

```typescript
// backend/src/services/client.service.ts:43-48
if (data.referralCode) {
    const referrer = await prisma.client.findUnique({
        where: { referralCode: data.referralCode.toUpperCase() },
        select: { id: true },
    });
    if (referrer) referredByClientId = referrer.id;
}
```

This lookup has **no `orgId` filter**. Consequences:

1. **Cross-org referral attribution**: Org A enters a referral code that belongs to a client in Org B. The referral benefit goes to the wrong org's client.
2. **Information leakage**: By testing referral codes, an attacker can determine which codes are in use across all organizations.
3. **Data corruption**: The `referredByClientId` will point to a client in a different org, breaking org-scoped queries and reports.

Also, the referral code uniqueness check (line 27) searches globally:
```typescript
const existing = await prisma.client.findUnique({ where: { referralCode: code } });
```

---

## The Fix

### Step 1: Scope referral lookup to the same org

```typescript
// backend/src/services/client.service.ts - createClient method
if (data.referralCode) {
    const referrer = await prisma.client.findFirst({
        where: {
            referralCode: data.referralCode.toUpperCase(),
            orgId,           // Only match within the same organization
            isActive: true,  // Don't match deleted clients
        },
        select: { id: true },
    });
    if (referrer) referredByClientId = referrer.id;
}
```

### Step 2: Scope referral code uniqueness to org

Change the unique constraint in the Prisma schema:
```prisma
model Client {
    // Remove global unique on referralCode:
    // referralCode String? @unique

    // Replace with org-scoped unique:
    referralCode String?

    @@unique([orgId, referralCode])
}
```

Update the uniqueness check:
```typescript
// backend/src/services/client.service.ts - generateUniqueReferralCode
async generateUniqueReferralCode(orgId: string): Promise<string> {
    let attempts = 0;
    while (attempts < MAX_REFERRAL_ATTEMPTS) {
        const code = generateReferralCode();
        const existing = await prisma.client.findFirst({
            where: { referralCode: code, orgId },
        });
        if (!existing) return code;
        attempts++;
    }
    return generateReferralCode() + Date.now().toString(36).slice(-2).toUpperCase();
}
```

Update the call site:
```typescript
// Line 74
referralCode: await this.generateUniqueReferralCode(orgId),
```

---

## Also Check: Admin Referral Controller

```typescript
// backend/src/controllers/adminReferral.controller.ts
// The getClientReferrals query also needs orgId:

const [referrals, total] = await prisma.$transaction([
    prisma.client.findMany({
        where: {
            referredByClientId: clientId,
            orgId: req.user.organizationId,  // ADD THIS
            isActive: true,
        },
        // ...
    }),
    // ...
]);
```

---

## Files to Change

| File | Change |
|------|--------|
| `backend/src/services/client.service.ts:43-48` | Add `orgId` to referral code lookup |
| `backend/src/services/client.service.ts:23-31` | Pass `orgId` to uniqueness check |
| `backend/src/services/client.service.ts:74` | Pass `orgId` to `generateUniqueReferralCode` |
| `backend/prisma/schema.prisma` | Change unique constraint to `@@unique([orgId, referralCode])` |
| `backend/src/controllers/adminReferral.controller.ts` | Add `orgId` to referral queries |

---

## Migration

Run `npx prisma migrate dev --name scope-referral-to-org` after schema change. Existing data should be fine since referral codes are already unique globally.

---

## Verification

1. Create clients in two different orgs
2. Try using Org A client's referral code when creating a client in Org B - should not match
3. Two different orgs should be able to have the same referral code independently
