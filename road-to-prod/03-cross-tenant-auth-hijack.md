# 03 - Cross-Tenant Client Auth Hijack

## Priority: CRITICAL
## Effort: 30 minutes
## Risk if skipped: Client from Org A can accidentally authenticate as client from Org B if they share the same phone number

---

## The Problem

```typescript
// backend/src/controllers/clientAuth.controller.ts:30-32
const client = await prisma.client.findFirst({
    where: { phone, isActive: true },  // NO orgId filter!
});
```

And again on line 81-82:
```typescript
const client = await prisma.client.findFirst({
    where: { phone, isActive: true },  // NO orgId filter!
    // ...
});
```

In a multi-tenant system, two different organizations can each have a client with the same phone number (e.g. `+91-9999999999`). `findFirst` returns whichever record Prisma finds first - which could be from either org.

**Attack scenario:**
1. Org A creates client with phone `+91-9999999999`
2. Org B creates client with phone `+91-9999999999`
3. Client requests OTP for that phone
4. `findFirst` returns Org A's client
5. Client verifies OTP and gets a JWT for Org A's client
6. Client now has full access to Org A's data through the client API

---

## The Fix

The client login flow needs to know **which organization** the client belongs to. Two approaches:

### Option A: Require org identifier in login (Recommended)

The mobile app should pass an org slug or org ID during login:

```typescript
export const requestOTP = asyncHandler(async (req: Request, res: Response) => {
    const { phone, orgSlug } = req.body;  // orgSlug identifies the org

    if (!phone || phone.length < 10) {
        throw AppError.badRequest('Valid phone number required', 'INVALID_PHONE');
    }

    if (!orgSlug) {
        throw AppError.badRequest('Organization identifier required', 'MISSING_ORG');
    }

    // Resolve org
    const org = await prisma.organization.findFirst({
        where: { slug: orgSlug, isActive: true },
    });
    if (!org) {
        throw AppError.notFound('Organization not found', 'ORG_NOT_FOUND');
    }

    // Now phone + orgId is unique
    const client = await prisma.client.findFirst({
        where: { phone, orgId: org.id, isActive: true },
    });

    if (!client) {
        throw AppError.notFound('No account found', 'CLIENT_NOT_FOUND');
    }

    // ... rest of OTP generation
});
```

Apply the same fix to `verifyOTP` (line 81):
```typescript
export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
    const { phone, otp, orgSlug } = req.body;

    // ... OTP verification logic ...

    // Use the same org-scoped lookup
    const org = await prisma.organization.findFirst({
        where: { slug: orgSlug, isActive: true },
    });
    if (!org) throw AppError.notFound('Organization not found', 'ORG_NOT_FOUND');

    const client = await prisma.client.findFirst({
        where: { phone, orgId: org.id, isActive: true },
        include: { primaryDietitian: { select: { fullName: true, email: true } } },
    });

    // ... rest of token generation
});
```

### Option B: Unique phone across all orgs (Simpler but restrictive)

Add a unique constraint on phone globally:
```prisma
model Client {
    phone String? @unique  // Only one client per phone globally
}
```

This is simpler but prevents the same person from being a client at two different diet clinics.

---

## Mobile App Changes Required (Option A)

The mobile app needs to capture the organization context before login:
- Add an org selection screen or deep-link with org slug
- Pass `orgSlug` in the OTP request body
- Each dietitian/org gives their clients a branded login link: `dietkaro.com/login/my-clinic-slug`

---

## Files to Change

| File | Change |
|------|--------|
| `backend/src/controllers/clientAuth.controller.ts:30-32` | Add `orgId` to `findFirst` where clause |
| `backend/src/controllers/clientAuth.controller.ts:81-82` | Same - add `orgId` to verification lookup |
| `backend/src/schemas/clientApi.schema.ts` | Add `orgSlug` to OTP request schema |
| Mobile app login screen | Add org identifier field/selection |

---

## Database Consideration

Consider adding a composite unique constraint:
```prisma
model Client {
    @@unique([orgId, phone])  // Same phone can exist in different orgs, but not twice in same org
}
```

---

## Verification

1. Create two orgs, each with a client having the same phone number
2. Request OTP with org slug for Org A - should only find Org A's client
3. Request OTP with org slug for Org B - should only find Org B's client
4. Request OTP without org slug - should return 400 error
