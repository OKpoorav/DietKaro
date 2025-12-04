

## Overview

- Base URL: `/v1`
- Auth: JWT Bearer tokens (`Authorization: Bearer <token>`)
- Multi‑tenant: every request is scoped to an `organization_id` in the token.[1][2]

Roles:

- `owner`, `admin`, `dietitian` (dashboard)  
- `client` (mobile app)

***

## Auth & Identity

### POST `/auth/dietitian/login`
Dietitian/admin login via email/password (Clerk or similar will wrap this).

**Response**

```json
{
  "accessToken": "jwt",
  "refreshToken": "refresh",
  "user": {
    "id": "user-uuid",
    "role": "dietitian",
    "organizationId": "org-uuid",
    "fullName": "Dr. Priya"
  }
}
```

### POST `/auth/client/login`
OTP login for clients (as earlier).

***

## Organizations & Users (Dietitian side)

### GET `/me`
Return current authenticated user + org.

### GET `/organization`
Owner/admin: organization info, subscription, limits.

### GET `/organization/users`
List team members (dietitians/admins) in org.

***

## Clients & Medical Profile

### GET `/clients`
Dietitian side – list clients in org with filters.

Query params: `search`, `status`, `primaryDietitianId`, `page`, `pageSize`.

### POST `/clients`
Create client.

Body (simplified):

```json
{
  "fullName": "Sarah Sharma",
  "email": "sarah@example.com",
  "phone": "+91...",
  "dateOfBirth": "1997-06-10",
  "gender": "female",
  "heightCm": 162,
  "currentWeightKg": 75,
  "targetWeightKg": 65,
  "primaryDietitianId": "user-uuid",
  "dietaryPreferences": ["vegetarian"],
  "allergies": ["Peanuts", "Dairy"]
}
```

### GET `/clients/{clientId}`
Full client profile + medical summary.

**Response (core):**

```json
{
  "id": "client-uuid",
  "organizationId": "org-uuid",
  "fullName": "Sarah Sharma",
  "dateOfBirth": "1997-06-10",
  "gender": "female",
  "heightCm": 162,
  "currentWeightKg": 73.5,
  "targetWeightKg": 65,
  "status": "active",
  "primaryDietitian": { "id": "user-uuid", "fullName": "Dr. Priya" },
  "dietaryPreferences": ["vegetarian"],
  "allergies": ["Peanuts", "Dairy"],
  "medical": {
    "diagnoses": ["Type 2 Diabetes", "PCOS"],
    "medications": ["Metformin 500mg", "Atorvastatin 10mg"],
    "notes": "Low GI focus, avoid fried food"
  }
}
```

### PATCH `/clients/{clientId}`
Update demographics, goals, assignments.

***

## Diet Plans (Dietitian side)

### GET `/clients/{clientId}/diet-plans`
List plans for a client.

Query: `status` (active/completed/draft/template).

### GET `/diet-plans/{planId}`
Get full plan including meals and items.

**Response (shape):**

```json
{
  "id": "plan-uuid",
  "organizationId": "org-uuid",
  "client": { "id": "client-uuid", "fullName": "Sarah" },
  "name": "Week 1 – PCOS & Diabetes Control",
  "description": "Focus on blood sugar control, moderate deficit.",
  "startDate": "2025-12-01",
  "endDate": "2025-12-07",
  "status": "active",
  "targetsPerDay": {
    "calories": 1800,
    "protein": 90,
    "carbs": 200,
    "fat": 60
  },
  "meals": [
    {
      "id": "meal-uuid-1",
      "dayIndex": 1,
      "date": "2025-12-01",
      "mealType": "breakfast",
      "timeOfDay": "08:00",
      "title": "Besan Chilla + Curd + Apple",
      "instructions": "Use minimal oil, no sugar in tea.",
      "items": [
        {
          "foodId": "food-uuid-1",
          "foodName": "Besan Chilla",
          "quantity": "2 pieces",
          "nutrition": {
            "calories": 200,
            "protein": 10,
            "carbs": 25,
            "fat": 6
          }
        }
      ],
      "totals": {
        "calories": 360,
        "protein": 14,
        "carbs": 51,
        "fat": 9
      }
    }
  ]
}
```

### POST `/diet-plans`
Create a plan (with nested meals + items).

**Body (simplified):**

```json
{
  "clientId": "client-uuid",
  "name": "Week 1 – PCOS & Diabetes Control",
  "startDate": "2025-12-01",
  "endDate": "2025-12-07",
  "targetsPerDay": {
    "calories": 1800,
    "protein": 90,
    "carbs": 200,
    "fat": 60
  },
  "meals": [
    {
      "dayIndex": 1,
      "mealType": "breakfast",
      "timeOfDay": "08:00",
      "title": "Besan Chilla + Curd + Apple",
      "instructions": "Use minimal oil.",
      "items": [
        {
          "foodId": "food-uuid-1",
          "quantity": 2,
          "unit": "piece"
        }
      ]
    }
  ],
  "options": {
    "saveAsTemplate": false,
    "status": "active"
  }
}
```

**Response:** `{ "planId": "plan-uuid" }`

### PATCH `/diet-plans/{planId}`
Update plan metadata, dates or targets.

### POST `/diet-plans/{planId}/publish`
Mark as active and generate meal logs for the date range.

***

## Food & Recipe Database

### GET `/food-items`
Search foods.

Query: `q`, `category`, `orgScope=global|org`.

**Response example:**

```json
{
  "items": [
    {
      "id": "food-uuid-1",
      "name": "Paneer (cottage cheese)",
      "category": "protein",
      "servingSize": "100 g",
      "nutritionPerServing": {
        "calories": 265,
        "protein": 18,
        "carbs": 6,
        "fat": 20
      },
      "isGlobal": true
    }
  ]
}
```

### POST `/food-items`
Create org-specific food (dietitian).

***

## Meal Logs (Tracking)

### Dietitian: GET `/clients/{clientId}/meal-logs`
Filters: `date`, `status`.

### Dietitian: GET `/meal-logs/{mealLogId}`
Full view incl. photo, notes, feedback.

### Dietitian: PATCH `/meal-logs/{mealLogId}/review`
Mark reviewed, add feedback.

**Request:**

```json
{
  "status": "eaten",  // eaten | skipped | substituted
  "dietitianFeedback": "Great choice, portion looks good.",
  "overrideNutrition": null
}
```

**Response:** Updated meal log.

***

### Client: GET `/client/me/today-plan`
Already defined earlier (for mobile).

### Client: POST `/client/meal-logs/{mealLogId}/photo-upload-url`
Presigned URL (as earlier).

### Client: PATCH `/client/meal-logs/{mealLogId}`
Update status + photo + notes (as earlier).

***

## Weight & Progress

### Dietitian: GET `/clients/{clientId}/weight-logs?from=&to=`
List for charts.

### Dietitian: POST `/clients/{clientId}/weight-logs`
Log weight on behalf of client (clinic visit).

### Client: `/client/me/weight-logs` endpoints  
- `GET` history  
- `POST` add/update for a date (as defined before).

***

## Session Notes (SOAP/DAP)

### GET `/clients/{clientId}/session-notes`
List notes.

### POST `/clients/{clientId}/session-notes`

```json
{
  "noteType": "SOAP",
  "title": "Initial assessment",
  "content": "Subjective: ... Objective: ... Assessment: ... Plan: ..."
}
```

### GET `/session-notes/{noteId}`

***

## Grocery List (Phase 2 but define early)

### POST `/diet-plans/{planId}/grocery-list`

Body:

```json
{
  "dateFrom": "2025-12-01",
  "dateTo": "2025-12-07",
  "groupBy": "category"   // or "meal" or "none"
}
```

**Response:**

```json
{
  "planId": "plan-uuid",
  "dateFrom": "2025-12-01",
  "dateTo": "2025-12-07",
  "items": [
    {
      "name": "Besan (gram flour)",
      "category": "grains",
      "totalQuantity": "1.5 kg"
    },
    {
      "name": "Curd (low-fat)",
      "category": "dairy",
      "totalQuantity": "3 L"
    }
  ]
}
```

***

## Notifications

### GET `/client/me/notifications`
Client notifications (as before).

### PATCH `/client/me/notifications/{id}`
Mark as read.

### GET `/dietitian/notifications`
Dietitian notifications: photo uploaded, new client, etc.

***

## Activity & Audit (internal/admin)

### GET `/admin/activity-logs`
Org owner/admin queries activity: filters by `userId`, `clientId`, `action`, `dateRange`.

**Response entry:**

```json
{
  "id": "log-uuid",
  "user": { "id": "user-uuid", "role": "dietitian", "name": "Dr. Priya" },
  "action": "diet_plan_created",
  "entityType": "diet_plan",
  "entityId": "plan-uuid",
  "createdAt": "2025-12-04T10:00:00Z",
  "metadata": { "clientId": "client-uuid" }
}
```

***

## Billing & Invoicing (basic)

### GET `/invoices`
List invoices for org.

### POST `/invoices`
Create invoice for a client.

```json
{
  "clientId": "client-uuid",
  "issueDate": "2025-12-04",
  "dueDate": "2025-12-11",
  "currency": "INR",
  "lineItems": [
    { "description": "Consultation", "quantity": 1, "unitPrice": 800 }
  ]
}
```

**Response:** `{ "invoiceId": "inv-uuid", "totalAmount": 800, "status": "unpaid" }`

***

## Patterns & Conventions

- All list endpoints: `?page=&pageSize=` and return `{ data: [...], meta: { page, pageSize, total } }`.  
- Errors: JSON with `code`, `message`, `details`.  
- All date/times in ISO 8601 UTC.  
- Tenant context from JWT, not path param (`organizationId` never in URL).[3][2]

