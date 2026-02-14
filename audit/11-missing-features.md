# 11. Missing Features & Incomplete Implementations

**Severity**: Varies (per issue)
**Category**: Feature Gaps, Schema-Only Implementations, Testing

---

## 11.1 No Meal Log Auto-Creation on Plan Publish

### Description

When a dietitian publishes a diet plan via `dietPlanService.publishPlan()`, the status is set to `active` and `publishedAt` is timestamped, but no meal logs are created for the client. Meal logs are instead "lazy-created" when the client interacts with a meal through the mobile app.

### Current Code

```typescript
// backend/src/services/dietPlan.service.ts:149-169
async publishPlan(planId: string, orgId: string) {
    const plan = await prisma.dietPlan.findFirst({
        where: { id: planId, orgId },
        include: { meals: true },
    });

    if (!plan) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');

    const updated = await prisma.dietPlan.update({
        where: { id: planId },
        data: { status: 'active', publishedAt: new Date() },
    });

    logger.info('Diet plan published', { planId: updated.id });
    return {
        planId: updated.id,
        status: updated.status,
        publishedAt: updated.publishedAt,
        mealLogsCreated: plan.meals.length,  // <-- MISLEADING: reports count but creates nothing
    };
}
```

The return value `mealLogsCreated: plan.meals.length` is misleading -- it reports the number of meals as if logs were created, but no `MealLog` records are actually inserted.

### How Lazy Creation Works Currently

In `clientApi.routes.ts:160-211`, when a client tries to log a meal with a `pending-{mealId}` ID, the endpoint creates the `MealLog` on the fly:

```typescript
// backend/src/routes/clientApi.routes.ts:163-210
if (mealLogId.startsWith('pending-')) {
    const mealId = mealLogId.replace('pending-', '');
    // ... creates MealLog at this point
}
```

### Problems with Lazy Creation

1. **No meal logs exist for compliance queries**: `calculateDailyAdherence` queries `MealLog` records. If the client has not interacted with any meals, the query returns empty and adherence shows 0%, which is misleading (it should show "pending" not "0% adherent").

2. **Dietitian cannot see pending meals**: The dietitian dashboard showing meal logs for review will show nothing until the client acts, making it impossible to see the day's planned meals.

3. **The `/meals/today` endpoint uses a workaround**: It returns synthetic IDs like `pending-{mealId}` for meals without logs, which is fragile and requires special handling on the client.

### Fix: Create Meal Logs on Publish

```typescript
// backend/src/services/dietPlan.service.ts
async publishPlan(planId: string, orgId: string) {
    const plan = await prisma.dietPlan.findFirst({
        where: { id: planId, orgId },
        include: { meals: true, client: true },
    });

    if (!plan) throw AppError.notFound('Diet plan not found', 'PLAN_NOT_FOUND');
    if (!plan.clientId) throw AppError.badRequest('Cannot publish a template', 'TEMPLATE_PUBLISH');

    // Determine date range for meal log creation
    const startDate = plan.startDate;
    const endDate = plan.endDate || new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // Default 1 week

    const mealLogData: Array<{
        orgId: string;
        clientId: string;
        mealId: string;
        scheduledDate: Date;
        scheduledTime: string | null;
        status: 'pending';
    }> = [];

    // For each day in the plan range
    const current = new Date(startDate);
    while (current <= endDate) {
        const jsDay = current.getDay();
        const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1; // 0=Monday

        // Find meals for this day of week
        const todaysMeals = plan.meals.filter(
            m => m.dayOfWeek === dayOfWeek || m.dayOfWeek === null
        );

        for (const meal of todaysMeals) {
            mealLogData.push({
                orgId: plan.orgId,
                clientId: plan.clientId,
                mealId: meal.id,
                scheduledDate: new Date(current),
                scheduledTime: meal.timeOfDay,
                status: 'pending',
            });
        }

        current.setDate(current.getDate() + 1);
    }

    // Use transaction: update plan status + create all meal logs
    const [updated] = await prisma.$transaction([
        prisma.dietPlan.update({
            where: { id: planId },
            data: { status: 'active', publishedAt: new Date() },
        }),
        prisma.mealLog.createMany({
            data: mealLogData,
            skipDuplicates: true, // Respect the unique constraint [clientId, mealId, scheduledDate]
        }),
    ]);

    logger.info('Diet plan published with meal logs', {
        planId: updated.id,
        mealLogsCreated: mealLogData.length,
    });

    return {
        planId: updated.id,
        status: updated.status,
        publishedAt: updated.publishedAt,
        mealLogsCreated: mealLogData.length,
    };
}
```

### Effort Estimate

Medium -- requires creating the auto-creation logic and updating the `/meals/today` endpoint to stop generating synthetic `pending-*` IDs.

---

## 11.2 No Subscription Enforcement

### Description

The `Organization` model has `subscriptionTier`, `subscriptionStatus`, `subscriptionExpiresAt`, and `maxClients` fields, but no middleware or service logic checks these values. Any organization can create unlimited clients regardless of their subscription tier.

### Schema Evidence

```prisma
// backend/prisma/schema.prisma:110-147
model Organization {
    subscriptionTier      SubscriptionTier   @default(free)
    subscriptionStatus    SubscriptionStatus @default(active)
    subscriptionExpiresAt DateTime?
    maxClients            Int                @default(10)
    // ...
}
```

### What Is Missing

1. **No client count check on `createClient`**: The `ClientService.createClient` method does not compare the current client count against `maxClients`.

2. **No subscription status check**: No middleware validates that `subscriptionStatus` is `active` before allowing API operations. An organization with `subscriptionStatus: 'cancelled'` can still use all features.

3. **No expiration check**: `subscriptionExpiresAt` is never compared to the current date.

### Fix: Add Subscription Enforcement Middleware

```typescript
// backend/src/middleware/subscription.middleware.ts
import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';
import { AuthenticatedRequest } from '../types/auth.types';
import { NextFunction, Response } from 'express';

export async function requireActiveSubscription(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    if (!req.user) throw AppError.unauthorized();

    const org = await prisma.organization.findUnique({
        where: { id: req.user.organizationId },
        select: {
            subscriptionStatus: true,
            subscriptionExpiresAt: true,
            subscriptionTier: true,
        },
    });

    if (!org) throw AppError.notFound('Organization not found');

    if (org.subscriptionStatus === 'cancelled') {
        throw AppError.forbidden(
            'Subscription cancelled. Please renew to continue.',
            'SUBSCRIPTION_CANCELLED'
        );
    }

    if (org.subscriptionStatus === 'paused') {
        throw AppError.forbidden(
            'Subscription paused. Please reactivate to continue.',
            'SUBSCRIPTION_PAUSED'
        );
    }

    if (org.subscriptionExpiresAt && org.subscriptionExpiresAt < new Date()) {
        throw AppError.forbidden(
            'Subscription expired. Please renew.',
            'SUBSCRIPTION_EXPIRED'
        );
    }

    next();
}

export async function requireClientCapacity(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) {
    if (!req.user) throw AppError.unauthorized();

    const org = await prisma.organization.findUnique({
        where: { id: req.user.organizationId },
        select: { maxClients: true },
    });

    if (!org) throw AppError.notFound('Organization not found');

    const currentCount = await prisma.client.count({
        where: { orgId: req.user.organizationId, isActive: true },
    });

    if (currentCount >= org.maxClients) {
        throw AppError.forbidden(
            `Client limit reached (${org.maxClients}). Upgrade your plan to add more clients.`,
            'CLIENT_LIMIT_REACHED'
        );
    }

    next();
}
```

**Apply to routes:**

```typescript
// backend/src/routes/client.routes.ts
import { requireActiveSubscription, requireClientCapacity } from '../middleware/subscription.middleware';

router.use(requireActiveSubscription);  // All client routes require active subscription
router.post('/', requireClientCapacity, asyncHandler(createClient));  // Check capacity on create
```

### Effort Estimate

Medium -- new middleware file plus applying it to route definitions.

---

## 11.3 No Push Notification Implementation

### Description

The notification infrastructure is partially built but the actual push sending is commented out. The system saves notifications to the database and manages push tokens, but never delivers them to devices.

### Current State

```typescript
// backend/src/services/notification.service.ts:1-3
import prisma from '../utils/prisma';
import logger from '../utils/logger';
// import { Expo } from 'expo-server-sdk'; // TODO: Install expo-server-sdk

// const expo = new Expo();
```

The `sendNotification` method saves to DB and retrieves tokens, but the actual sending is a commented-out placeholder:

```typescript
// backend/src/services/notification.service.ts:80-89
// 3. Send via Expo (Placeholder)
// const messages = tokens.map(token => ({
//     to: token,
//     sound: 'default',
//     title,
//     body: message,
//     data: { ...data, notificationId: notification.id },
// }));

// await expo.sendPushNotificationsAsync(messages);

logger.info('Notification sent (simulated)', { recipientId, title });
```

### What Exists vs What Is Missing

| Component | Status |
|-----------|--------|
| `pushTokens` field on `User` model | Exists in schema |
| `pushTokens` field on `Client` model | Exists in schema |
| `Notification` model in Prisma | Exists with full schema |
| `registerDeviceToken` method | Implemented and functional |
| `sendNotification` method | Saves to DB, does NOT send push |
| `expo-server-sdk` package | Not installed |
| Notification routes/API | Not found |
| Client-app token registration | Not found |

### Fix: Complete the Push Notification Implementation

**Step 1: Install expo-server-sdk**

```bash
cd backend && npm install expo-server-sdk
```

**Step 2: Implement actual sending**

```typescript
// backend/src/services/notification.service.ts
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

const expo = new Expo();

export class NotificationService {
    async sendNotification(
        recipientId: string,
        recipientType: 'client' | 'user',
        orgId: string,
        title: string,
        message: string,
        data: any = {},
        category?: string
    ) {
        // 1. Save to DB (existing code)
        const notification = await prisma.notification.create({ /* ... */ });

        // 2. Get tokens (existing code)
        let tokens: string[] = [];
        if (recipientType === 'client') {
            const client = await prisma.client.findUnique({ where: { id: recipientId } });
            tokens = client?.pushTokens || [];
        } else {
            const user = await prisma.user.findUnique({ where: { id: recipientId } });
            tokens = user?.pushTokens || [];
        }

        if (tokens.length === 0) {
            logger.warn('No push tokens for recipient', { recipientId });
            return notification;
        }

        // 3. Filter valid Expo tokens
        const validTokens = tokens.filter(t => Expo.isExpoPushToken(t));
        if (validTokens.length === 0) {
            logger.warn('No valid Expo push tokens', { recipientId, tokens });
            return notification;
        }

        // 4. Build messages
        const messages: ExpoPushMessage[] = validTokens.map(token => ({
            to: token,
            sound: 'default',
            title,
            body: message,
            data: { ...data, notificationId: notification.id },
            categoryId: category,
        }));

        // 5. Send in chunks (Expo recommends max 100 per request)
        const chunks = expo.chunkPushNotifications(messages);
        const tickets: ExpoPushTicket[] = [];

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (err) {
                logger.error('Push notification send failed', { error: err, recipientId });
            }
        }

        // 6. Update delivery status
        const allDelivered = tickets.every(t => t.status === 'ok');
        await prisma.notification.update({
            where: { id: notification.id },
            data: {
                deliveryStatus: allDelivered ? 'delivered' : 'failed',
                sentViaChannels: ['push'],
            },
        });

        // 7. Handle invalid tokens (remove from profile)
        for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
                await this.removeInvalidToken(recipientId, recipientType, validTokens[i]);
            }
        }

        logger.info('Push notification sent', {
            recipientId,
            title,
            ticketCount: tickets.length,
            delivered: allDelivered,
        });

        return notification;
    }

    private async removeInvalidToken(entityId: string, entityType: 'client' | 'user', token: string) {
        const model = entityType === 'client' ? prisma.client : prisma.user;
        const entity = await (model as any).findUnique({ where: { id: entityId } });
        if (!entity) return;

        const updatedTokens = entity.pushTokens.filter((t: string) => t !== token);
        await (model as any).update({
            where: { id: entityId },
            data: { pushTokens: updatedTokens },
        });
        logger.info('Removed invalid push token', { entityId, token });
    }
}
```

**Step 3: Add notification API routes for client-app**

```typescript
// backend/src/routes/clientApi.routes.ts -- add these endpoints

// Register device token
router.post('/device-token', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const { token } = req.body;
    if (!token) throw AppError.badRequest('Token is required');

    await notificationService.registerDeviceToken(req.client.id, 'client', token);
    res.status(200).json({ success: true });
}));

// Get notifications
router.get('/notifications', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const notifications = await prisma.notification.findMany({
        where: { recipientId: req.client.id, recipientType: 'client' },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    res.status(200).json({ success: true, data: notifications });
}));
```

### Effort Estimate

Medium -- the structure is already in place, needs `expo-server-sdk` installation and uncommenting/completing the send logic.

---

## 11.4 No File Upload Validation

### Description

The upload middleware exists and has basic validation, but there are gaps.

### Current State

```typescript
// backend/src/middleware/upload.middleware.ts
const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError('Only image files are allowed (JPEG, PNG, WebP, HEIC)', 400, 'INVALID_FILE_TYPE'));
    }
};

export const upload = multer({
    storage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
        files: 1
    }
});
```

### What Is Present

- MIME type whitelist (`image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`)
- File size limit (10MB)
- Single file limit

### What Is Missing

1. **MIME type can be spoofed**: The `file.mimetype` is based on the `Content-Type` header sent by the client, not the actual file contents. An attacker can send a malicious file with `Content-Type: image/jpeg`.

2. **No magic byte validation**: The actual file contents are not inspected to verify the file is a real image.

3. **No image dimension limits**: A valid JPEG that is 50,000 x 50,000 pixels could consume excessive memory during processing.

4. **No malware scanning**: No virus/malware scanning of uploaded content.

5. **Client reports upload has no validation**: The `ClientReport` model supports `pdf` and `image` types, but there is no dedicated upload middleware for reports (blood tests, prescriptions, etc.).

### Fix: Add Magic Byte Validation

```typescript
// backend/src/middleware/upload.middleware.ts
import multer from 'multer';
import { Request } from 'express';
import { AppError } from '../errors/AppError';
import { fileTypeFromBuffer } from 'file-type';

const storage = multer.memoryStorage();

const IMAGE_MIMES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
]);

const REPORT_MIMES = new Set([
    ...IMAGE_MIMES,
    'application/pdf',
]);

const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (IMAGE_MIMES.has(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError('Only image files are allowed (JPEG, PNG, WebP, HEIC)', 400, 'INVALID_FILE_TYPE'));
    }
};

const reportFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (REPORT_MIMES.has(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new AppError('Only image and PDF files are allowed', 400, 'INVALID_FILE_TYPE'));
    }
};

export const upload = multer({
    storage,
    fileFilter: imageFilter,
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

export const uploadReport = multer({
    storage,
    fileFilter: reportFilter,
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },  // 25MB for PDFs
});

/**
 * Validate actual file content matches declared MIME type.
 * Call AFTER multer has parsed the file into req.file.buffer.
 */
export async function validateFileContent(buffer: Buffer, allowedMimes: Set<string>): Promise<void> {
    const detected = await fileTypeFromBuffer(buffer);

    if (!detected) {
        throw new AppError('Could not determine file type', 400, 'UNKNOWN_FILE_TYPE');
    }

    if (!allowedMimes.has(detected.mime)) {
        throw new AppError(
            `File content does not match an allowed type. Detected: ${detected.mime}`,
            400,
            'FILE_CONTENT_MISMATCH'
        );
    }
}

export const uploadSinglePhoto = upload.single('photo');
export const uploadSingleReport = uploadReport.single('file');
```

**Usage in route handler:**

```typescript
router.post('/meals/:mealLogId/photo', uploadSinglePhoto, asyncHandler(async (req, res) => {
    if (!req.file) throw AppError.badRequest('No file provided');

    // Validate actual file content
    await validateFileContent(req.file.buffer, IMAGE_MIMES);

    // ... proceed with upload
}));
```

### Effort Estimate

Low -- install `file-type` package, add validation function, call it in route handlers.

---

## 11.5 Invoice System Is Schema-Only

### Description

The `Invoice` model is fully defined in the Prisma schema with fields for invoice number, dates, amounts, status, and relations. However, there are no routes, controllers, or services that implement invoice functionality.

### Schema Definition

```prisma
// backend/prisma/schema.prisma:611-638
model Invoice {
    id              String        @id @default(uuid())
    orgId           String
    clientId        String
    createdByUserId String
    invoiceNumber   String        @unique
    issueDate       DateTime      @db.Date
    dueDate         DateTime      @db.Date
    currency        String        @default("INR")
    subtotal        Decimal       @db.Decimal(10, 2)
    tax             Decimal       @default(0) @db.Decimal(10, 2)
    total           Decimal       @db.Decimal(10, 2)
    status          InvoiceStatus @default(unpaid)
    notes           String?
    sentAt          DateTime?
    createdAt       DateTime      @default(now())
    updatedAt       DateTime      @updatedAt
    deletedAt       DateTime?
    // Relations...
}
```

### What Exists vs What Is Missing

| Component | Status |
|-----------|--------|
| Prisma model | Complete |
| `InvoiceStatus` enum (unpaid, sent, paid, cancelled) | Complete |
| Invoice routes | Not found |
| Invoice service | Not found |
| Invoice controller | Not found |
| Frontend invoice pages | Not found |
| PDF generation for invoices | Not found |

A grep for `invoice` across `backend/src/routes/` returns zero matches.

### Fix: Implement Invoice Service (if needed)

If invoicing is planned for a future release, document it as such. If it is needed now:

```typescript
// backend/src/services/invoice.service.ts
import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';

export class InvoiceService {
    async createInvoice(data: {
        clientId: string;
        issueDate: string;
        dueDate: string;
        subtotal: number;
        tax?: number;
        notes?: string;
    }, orgId: string, userId: string) {
        // Generate invoice number: INV-YYYYMM-XXXX
        const count = await prisma.invoice.count({ where: { orgId } });
        const now = new Date();
        const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

        const tax = data.tax ?? 0;
        const total = data.subtotal + tax;

        return prisma.invoice.create({
            data: {
                orgId,
                clientId: data.clientId,
                createdByUserId: userId,
                invoiceNumber,
                issueDate: new Date(data.issueDate),
                dueDate: new Date(data.dueDate),
                subtotal: data.subtotal,
                tax,
                total,
                notes: data.notes,
                status: 'unpaid',
            },
        });
    }

    async listInvoices(orgId: string, query: { clientId?: string; status?: string }) {
        const where: any = { orgId };
        if (query.clientId) where.clientId = query.clientId;
        if (query.status) where.status = query.status;

        return prisma.invoice.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                client: { select: { id: true, fullName: true, email: true } },
                creator: { select: { id: true, fullName: true } },
            },
        });
    }

    async markAsPaid(invoiceId: string, orgId: string) {
        const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, orgId } });
        if (!invoice) throw AppError.notFound('Invoice not found');

        return prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: 'paid' },
        });
    }
}
```

### Effort Estimate

Medium-High -- requires service, routes, controller, and frontend pages. Consider whether this is needed for MVP or should be deferred.

---

## 11.6 No Test Coverage

### Description

The project has zero test files in the application source code. A search for `*.test.*` files in `backend/src/` returns no results. The only test file found is `backend/tests/validationEngine.test.ts`, which covers the diet plan validation engine only.

### Current Test File

```
backend/tests/validationEngine.test.ts  -- ONLY test file in the entire project
```

### What Is Not Tested

| Layer | Examples | Risk |
|-------|----------|------|
| **API Integration** | All route handlers in `clientApi.routes.ts`, client/diet-plan/meal-log routes | High -- no verification that endpoints return correct status codes or response shapes |
| **Service Logic** | `ComplianceService.calculateMealCompliance` (7-factor scoring), `ClientService.processReferralBenefit` | High -- complex business logic with no automated verification |
| **Middleware** | Auth middleware, subscription checks, file upload validation | Medium -- security-critical code without tests |
| **Frontend Components** | Diet plan builder, meal editor, client detail pages | Medium -- UI logic untested |
| **Client App** | Meal logging flow, weight tracking, adherence display | Medium -- core user-facing flows untested |
| **Schema Validation** | Zod schemas (`createDietPlanSchema`, `updateMealLogSchema`) | Low -- Zod provides runtime validation but edge cases are untested |

### Recommended Testing Strategy

**Phase 1: Critical path API tests (highest impact)**

```typescript
// backend/tests/api/clientApi.test.ts
import request from 'supertest';
import app from '../../src/app';

describe('GET /client/meals/today', () => {
    it('returns meals for today only', async () => {
        const res = await request(app)
            .get('/api/client/meals/today')
            .set('Authorization', `Bearer ${clientToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
        res.body.data.forEach((meal: any) => {
            expect(meal.meal).toBeDefined();
            expect(meal.scheduledDate).toBe(todayStr);
        });
    });

    it('returns empty array when no active plan', async () => {
        const res = await request(app)
            .get('/api/client/meals/today')
            .set('Authorization', `Bearer ${clientWithNoPlanToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
    });
});
```

**Phase 2: Service unit tests**

```typescript
// backend/tests/services/compliance.test.ts
import { complianceService } from '../../src/services/compliance.service';

describe('ComplianceService', () => {
    describe('calculateMealCompliance', () => {
        it('returns score 0 for skipped meals', async () => {
            const result = await complianceService.calculateMealCompliance(skippedMealLogId);
            expect(result.score).toBe(0);
            expect(result.color).toBe('RED');
            expect(result.issues).toContain('Meal was skipped');
        });

        it('gives on-time bonus when logged within window', async () => {
            const result = await complianceService.calculateMealCompliance(onTimeMealLogId);
            expect(result.score).toBeGreaterThanOrEqual(20); // ON_TIME weight
        });

        it('gives photo bonus when photo is uploaded', async () => {
            const result = await complianceService.calculateMealCompliance(withPhotoMealLogId);
            expect(result.score).toBeGreaterThanOrEqual(15); // PHOTO weight
        });
    });
});
```

**Phase 3: Schema validation tests**

```typescript
// backend/tests/schemas/dietPlan.test.ts
import { createDietPlanSchema } from '../../src/schemas/dietPlan.schema';

describe('createDietPlanSchema', () => {
    it('rejects missing name', () => {
        const result = createDietPlanSchema.safeParse({
            clientId: '550e8400-e29b-41d4-a716-446655440000',
            startDate: '2025-01-01',
        });
        expect(result.success).toBe(false);
    });

    it('rejects calories below 500', () => {
        const result = createDietPlanSchema.safeParse({
            clientId: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Test Plan',
            startDate: '2025-01-01',
            targetCalories: 100,
        });
        expect(result.success).toBe(false);
    });

    it('accepts valid plan with meals', () => {
        const result = createDietPlanSchema.safeParse({
            clientId: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Test Plan',
            startDate: '2025-01-01',
            meals: [{
                mealType: 'breakfast',
                title: 'Oatmeal',
                foodItems: [{
                    foodId: '550e8400-e29b-41d4-a716-446655440001',
                    quantity: 100,
                }],
            }],
        });
        expect(result.success).toBe(true);
    });
});
```

### Effort Estimate

High -- establishing test infrastructure, writing tests for critical paths, and setting up CI. Recommend starting with API integration tests for the highest-risk endpoints.

---

## 11.7 Soft Delete Is Inconsistent

### Description

The codebase has a Prisma extension that intercepts `findMany`, `findFirst`, `count`, and `delete` operations for models in a whitelist (`SOFT_DELETE_MODELS`). However, the actual schema models have inconsistent soft-delete fields, and some service-level queries add their own `isActive` filters, creating double-filtering or missed filtering.

### Prisma Extension (Source of Truth)

```typescript
// backend/src/utils/prisma.ts:3-16
const SOFT_DELETE_MODELS: Prisma.ModelName[] = [
    'Organization',
    'User',
    'Client',
    'DietPlan',
    'SessionNote',
    'Meal',
    'MealLog',
    'WeightLog',
    'BodyMeasurement',
    'FoodItem',
    'MealFoodItem',
    'Invoice',
];
```

The extension adds `deletedAt: null` to all queries for these models and converts `delete` operations to `update { deletedAt: new Date() }`.

### Schema Inconsistencies

| Model | Has `deletedAt` | Has `isActive` | In `SOFT_DELETE_MODELS` | Notes |
|-------|:---:|:---:|:---:|-------|
| Organization | Yes | Yes | Yes | Both fields, double filtering possible |
| User | Yes | Yes | Yes | Both fields |
| Client | Yes | Yes | Yes | Both fields |
| DietPlan | Yes | Yes | Yes | Both fields, services check `isActive: true` AND `deletedAt` is auto-filtered |
| Meal | Yes | No | Yes | Only `deletedAt` |
| MealLog | Yes | No | Yes | Only `deletedAt` |
| WeightLog | Yes | No | Yes | Only `deletedAt` |
| BodyMeasurement | Yes | No | Yes | Only `deletedAt` |
| SessionNote | Yes | No | Yes | Only `deletedAt` |
| FoodItem | Yes | No | Yes | Only `deletedAt` |
| MealFoodItem | Yes | No | Yes | Only `deletedAt` |
| Invoice | Yes | No | Yes | Only `deletedAt` |
| Notification | No | No | No | Not soft-deletable |
| ActivityLog | No | No | No | Not soft-deletable |
| Invitation | No | No | No | Not soft-deletable |
| ReferralBenefit | No | No | No | Not soft-deletable |
| ClientReport | No | No | No | Not soft-deletable |
| ClientPreferences | No | No | No | Not soft-deletable |
| MedicalProfile | No | No | No | Not soft-deletable |

### Double-Filtering Problem

For models with both `deletedAt` and `isActive`, the Prisma extension adds `deletedAt: null` automatically, and the service code explicitly checks `isActive: true`. This means:

```typescript
// backend/src/services/dietPlan.service.ts:79
// Service code adds isActive: true
const dietPlan = await prisma.dietPlan.findFirst({
    where: { id: planId, orgId, isActive: true },
});
// Prisma extension ALSO adds: deletedAt: null

// Effective query becomes:
// WHERE id = ? AND orgId = ? AND isActive = true AND deletedAt IS NULL
```

This works but is redundant and confusing. It also means `isActive` and `deletedAt` can go out of sync. For example, in `deleteClient`:

```typescript
// backend/src/services/client.service.ts:175-178
await prisma.client.update({
    where: { id: clientId },
    data: { isActive: false, deletedAt: new Date() },  // Sets BOTH
});
```

But what if someone sets `isActive: false` without setting `deletedAt`? The record would still appear in Prisma queries (since `deletedAt` is null) but would be filtered out by service-level `isActive: true` checks. Or vice versa.

### Missing Filters

Some queries for models in the soft-delete list do NOT check `isActive`, relying solely on the Prisma extension's `deletedAt: null` filter:

```typescript
// backend/src/services/meal.service.ts:49-52
// No isActive check -- relies on Prisma extension only
const meal = await prisma.meal.findUnique({
    where: { id: mealId },
    include: { dietPlan: true },
});

// But Meal doesn't have isActive, only deletedAt -- this is correct
// DietPlan HAS isActive but the nested include doesn't filter on it
```

### Fix: Standardize on One Mechanism

**Recommended approach**: Use `deletedAt` only (via the Prisma extension) and remove `isActive` from models where it is redundant.

**Step 1**: For Organization, User, Client, DietPlan -- determine if `isActive` serves a different purpose than "deleted":

- If `isActive = false` means "temporarily disabled" (not deleted), keep it.
- If `isActive = false` always accompanies `deletedAt != null` (i.e., it is just a soft delete), remove `isActive`.

**Step 2**: If keeping `isActive` for "disabled but not deleted" semantics, document the distinction:

```typescript
// Document the difference clearly
// deletedAt != null  -->  Record is soft-deleted, hidden from all queries by Prisma extension
// isActive = false   -->  Record is deactivated but still visible to admins
//                         Used for: paused subscriptions, suspended clients, etc.
```

**Step 3**: Remove redundant `isActive` checks from service queries where `deletedAt` filtering is sufficient:

```typescript
// Before (redundant)
const dietPlan = await prisma.dietPlan.findFirst({
    where: { id: planId, orgId, isActive: true },
    // Prisma extension already adds: deletedAt: null
});

// After (if isActive means "not deleted")
const dietPlan = await prisma.dietPlan.findFirst({
    where: { id: planId, orgId },
    // Prisma extension handles deletedAt: null
});

// After (if isActive means "active, not paused/disabled")
// Keep the isActive check, but rename for clarity:
const dietPlan = await prisma.dietPlan.findFirst({
    where: { id: planId, orgId, isActive: true },
    // isActive here means "not paused", distinct from "not deleted"
});
```

### Effort Estimate

Low-Medium -- audit each model to determine if `isActive` serves a distinct purpose, then remove or document accordingly.

---

## Summary

| Issue | Category | Effort | Priority |
|-------|----------|--------|----------|
| 11.1 No meal log auto-creation on publish | Feature Gap | Medium | High -- affects compliance accuracy |
| 11.2 No subscription enforcement | Business Logic | Medium | High -- revenue impact |
| 11.3 No push notifications | Feature Gap | Medium | Medium -- engagement impact |
| 11.4 No file upload validation (magic bytes) | Security | Low | Medium -- attack surface |
| 11.5 Invoice system schema-only | Feature Gap | Medium-High | Low -- can defer |
| 11.6 No test coverage | Quality | High | High -- technical debt |
| 11.7 Soft delete inconsistency | Maintenance | Low-Medium | Low -- functional but confusing |
