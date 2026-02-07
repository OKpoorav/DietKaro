# Module 10: Session Notes, Invoicing & Activity Logging

**Priority:** P2
**Effort:** 4-5 days
**Impact:** Completes professional workflow tools for dietitians

---

## Current State

All three features have **database schemas ready** but no service layer, incomplete/missing controllers, and no frontend UI.

| Feature | Schema | Backend | Frontend | Mobile |
|---------|--------|---------|----------|--------|
| Session Notes (SOAP/DAP) | Yes | No service, no controller | No UI | N/A |
| Invoice System | Yes | No service, no controller | No UI | N/A |
| Activity Logging | Yes | No service | No UI | N/A |
| Tag Review Queue | Yes | No controller | No UI | N/A |

---

## Part A: Session Notes CRUD

### What Needs To Be Done

#### A1. Create Session Notes Service

**Create:** `backend/src/services/sessionNote.service.ts`

| Method | Purpose |
|--------|---------|
| `createNote(clientId, data, userId, orgId)` | Create SOAP/DAP note |
| `getNotes(clientId, orgId, filters)` | List notes with pagination |
| `getNote(noteId, orgId)` | Get single note with full content |
| `updateNote(noteId, data, orgId)` | Edit note |
| `deleteNote(noteId, orgId)` | Soft delete |

#### A2. Create Session Notes Controller & Routes

**Create:** `backend/src/controllers/sessionNote.controller.ts`
**Create:** `backend/src/routes/sessionNote.routes.ts`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/clients/:clientId/session-notes` | Create note |
| GET | `/api/v1/clients/:clientId/session-notes` | List notes for client |
| GET | `/api/v1/session-notes/:id` | Get full note |
| PATCH | `/api/v1/session-notes/:id` | Update note |
| DELETE | `/api/v1/session-notes/:id` | Soft delete |

**Register routes in `app.ts`.**

#### A3. Create Zod Schema

**Create:** `backend/src/schemas/sessionNote.schema.ts`

```typescript
const createSessionNoteSchema = z.object({
  noteType: z.enum(['SOAP', 'DAP', 'other']),
  title: z.string().min(1).max(255),
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  internalNotes: z.string().optional(),
});
```

#### A4. Create Frontend Hook

**Create:** `frontend/src/lib/hooks/use-session-notes.ts`

```typescript
useSessionNotes(clientId)     // List notes
useSessionNote(noteId)        // Single note
useCreateSessionNote()        // Create mutation
useUpdateSessionNote()        // Update mutation
useDeleteSessionNote()        // Delete mutation
```

#### A5. Create Frontend UI

**Add to:** `frontend/src/app/dashboard/clients/[id]/page.tsx`

Add a "Session Notes" tab in the client detail page:
- List of notes (date, type, title, author)
- Click to expand full SOAP content
- "New Note" button opening a form
- SOAP fields: Subjective, Objective, Assessment, Plan
- Internal notes field (not visible to client)
- Edit/delete existing notes

---

## Part B: Invoice System

### What Needs To Be Done

#### B1. Create Invoice Service

**Create:** `backend/src/services/invoice.service.ts`

| Method | Purpose |
|--------|---------|
| `createInvoice(clientId, data, userId, orgId)` | Create with auto-generated invoice number |
| `getInvoices(orgId, filters)` | List with status/client filtering |
| `getInvoice(invoiceId, orgId)` | Single invoice with line items |
| `updateInvoice(invoiceId, data, orgId)` | Edit (only if unpaid) |
| `markAsPaid(invoiceId, orgId)` | Change status to paid |
| `sendInvoice(invoiceId, recipientEmail, orgId)` | Email with PDF attachment |
| `generateInvoiceNumber(orgId)` | Auto-increment: `INV-2026-00001` |

#### B2. Create Invoice Controller & Routes

**Create:** `backend/src/controllers/invoice.controller.ts`
**Create:** `backend/src/routes/invoice.routes.ts`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/invoices` | Create invoice |
| GET | `/api/v1/invoices` | List invoices (org-level) |
| GET | `/api/v1/invoices/:id` | Get invoice detail |
| PATCH | `/api/v1/invoices/:id` | Update invoice |
| POST | `/api/v1/invoices/:id/mark-paid` | Mark as paid |
| POST | `/api/v1/invoices/:id/send` | Email to client |
| GET | `/api/v1/invoices/:id/pdf` | Download PDF |

**Register routes in `app.ts`.**

#### B3. Create Invoice PDF Generator

**Add to:** `backend/src/utils/pdfGenerator.ts` or create `invoicePdfGenerator.ts`

Generate professional PDF invoice with:
- Organization logo and details
- Client name and details
- Invoice number, issue date, due date
- Line items table (description, quantity, unit price, total)
- Subtotal, tax, grand total
- Payment terms and notes
- "Paid" watermark stamp when status is paid

#### B4. Create Zod Schema

**Create:** `backend/src/schemas/invoice.schema.ts`

```typescript
const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  issueDate: z.string(),
  dueDate: z.string(),
  currency: z.enum(['INR', 'USD']).default('INR'),
  lineItems: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    taxPercentage: z.number().nonnegative().default(0),
  })).min(1),
  notes: z.string().optional(),
});
```

#### B5. Create Frontend UI

**Create:** `frontend/src/app/dashboard/invoices/page.tsx`

Invoice list page:
- Table: invoice number, client name, date, amount, status (unpaid/sent/paid)
- Status badge (color-coded)
- Filter by status, client, date range
- "Create Invoice" button

**Create:** `frontend/src/app/dashboard/invoices/new/page.tsx`

Create invoice form:
- Client selector dropdown
- Date pickers (issue, due)
- Dynamic line items (add/remove rows)
- Auto-calculate subtotal and total
- Notes field
- Preview PDF button
- Save as draft / Send now

**Create:** `frontend/src/app/dashboard/invoices/[id]/page.tsx`

Invoice detail page:
- Full invoice preview (styled like PDF)
- Action buttons: Edit, Send, Mark Paid, Download PDF
- Payment history

#### B6. Create Frontend Hook

**Create:** `frontend/src/lib/hooks/use-invoices.ts`

#### B7. Add Navigation

Add "Invoices" to the dashboard sidebar navigation.

---

## Part C: Activity Logging

### What Needs To Be Done

#### C1. Create Activity Logging Service

**Create:** `backend/src/services/activityLog.service.ts`

| Method | Purpose |
|--------|---------|
| `log(action, entityType, entityId, userId, orgId, metadata?)` | Create log entry |
| `getActivityLogs(orgId, filters)` | List with pagination |
| `getClientActivity(clientId, orgId)` | Activity for a specific client |

#### C2. Add Activity Logging Triggers

Insert `activityLogService.log()` calls in these existing controllers:

| Action | Controller | Event |
|--------|-----------|-------|
| `client_created` | client.controller | After client creation |
| `client_updated` | client.controller | After client update |
| `diet_plan_created` | dietPlan.controller | After plan creation |
| `diet_plan_published` | dietPlan.controller | After publish |
| `meal_log_reviewed` | mealLog.controller | After dietitian review |
| `user_login` | auth.controller | After successful login |
| `food_item_created` | foodItem.controller | After food creation |
| `invoice_created` | invoice.controller | After invoice creation |

#### C3. Create Activity Log Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/admin/activity-logs` | Org-level audit log (admin/owner) |
| GET | `/api/v1/clients/:clientId/activity` | Client-specific activity feed |

#### C4. Frontend UI

Add an activity feed in two places:
1. **Client detail page:** "Activity" tab showing recent actions for that client
2. **Admin settings:** "Audit Log" page showing all org activity (admin/owner only)

---

## Part D: Tag Review Queue

### What Needs To Be Done

#### D1. Add Tag Review Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/food-items/unverified` | List food items with auto-tags pending review |
| PATCH | `/api/v1/food-items/:id/verify` | Approve auto-generated tags |
| PATCH | `/api/v1/food-items/:id/reject` | Reject and reset tags |

#### D2. Frontend UI

**Create:** `frontend/src/app/dashboard/food-library/review/page.tsx`

Or add a "Review Queue" tab to the existing food library page:
- List of unverified food items with their auto-generated tags
- Show each tag with approve/reject buttons
- Allow editing tags before approving
- Bulk approve/reject actions

---

## Definition of Done

### Session Notes
- [ ] Service, controller, routes created and registered
- [ ] Zod validation schema applied
- [ ] Frontend hook created
- [ ] "Session Notes" tab in client detail page
- [ ] SOAP/DAP form with all fields
- [ ] Edit and soft-delete working

### Invoicing
- [ ] Service with auto-numbering, controller, routes created
- [ ] Invoice PDF generation working
- [ ] Email sending with PDF attachment working
- [ ] Invoices list page with filtering
- [ ] Create invoice form with dynamic line items
- [ ] Invoice detail page with actions (send, mark paid, download)
- [ ] "Invoices" added to sidebar navigation

### Activity Logging
- [ ] Service created with generic log method
- [ ] Logging triggers added to 8+ existing controllers
- [ ] Admin audit log page created
- [ ] Client activity feed in client detail page

### Tag Review
- [ ] 3 endpoints created (list unverified, verify, reject)
- [ ] Review queue UI in food library
