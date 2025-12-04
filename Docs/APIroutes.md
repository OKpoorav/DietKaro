
# DietConnect API v1 Documentation

**Version:** 1.0.0  
**Last Updated:** December 4, 2025  
**Status:** MVP

***

## Table of Contents

1. [Overview & Core Concepts](#overview)
2. [Authentication & Authorization](#auth)
3. [Base Patterns & Conventions](#patterns)
4. [Organizations](#organizations)
5. [Users (Dietitians/Admins)](#users)
6. [Clients & Medical Profiles](#clients)
7. [Diet Plans](#diet-plans)
8. [Meals](#meals)
9. [Food Items & Database](#food-items)
10. [Meal Logs (Tracking)](#meal-logs)
11. [Weight Logs](#weight-logs)
12. [Body Measurements](#body-measurements)
13. [Session Notes (SOAP/DAP)](#session-notes)
14. [Notifications](#notifications)
15. [Activity Logs (Audit)](#activity-logs)
16. [Grocery Lists](#grocery-lists)
17. [Invoices & Billing](#invoices)
18. [Error Handling](#errors)
19. [Rate Limiting & Pagination](#limits)

***

## Overview & Core Concepts {#overview}

### Base URL
```
https://api.dietconnect.com/v1
```

### Environment
- Development: `https://dev-api.dietconnect.com/v1`
- Staging: `https://staging-api.dietconnect.com/v1`
- Production: `https://api.dietconnect.com/v1`

### Multi-Tenancy Model
- Every authenticated request is scoped to an `organization_id` derived from the JWT token.
- **No `organization_id` in URLs** — it's extracted from the token server-side.
- Row-Level Security (RLS) enforced at the database layer ensures data isolation.

### API Philosophy
- **Thin, focused endpoints** per screen/use-case (not "one mega-object").
- **Structured responses** with nested entities only where logically grouped.
- **Immutable audit trails** for all critical operations.
- **Soft deletes** by default (deleted_at timestamp).

***

## Authentication & Authorization {#auth}

### Roles
- `owner` — Organization creator; can manage billing, team, all data.
- `admin` — Can manage team, all clients, but not billing.
- `dietitian` — Can manage assigned clients, create diet plans, log reviews.
- `client` — End user; read-only to own data.

### JWT Token Structure

**Dietitian/Admin token:**
```json
{
  "sub": "user-uuid",
  "organizationId": "org-uuid",
  "role": "dietitian",
  "email": "priya@clinic.com",
  "fullName": "Dr. Priya",
  "iat": 1733332800,
  "exp": 1733336400
}
```

**Client token:**
```json
{
  "sub": "client-uuid",
  "organizationId": "org-uuid",
  "role": "client",
  "email": "sarah@example.com",
  "iat": 1733332800,
  "exp": 1733336400
}
```

### Login Endpoints

#### POST `/auth/dietitian/login`
Dietitian/admin login via email + password (Clerk integration handles).

**Request**
```json
{
  "email": "priya@clinic.com",
  "password": "secure_password"
}
```

**Response (200 OK)**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "user-uuid-1",
    "organizationId": "org-uuid-1",
    "role": "dietitian",
    "email": "priya@clinic.com",
    "fullName": "Dr. Priya",
    "profilePhotoUrl": "https://cdn.dietconnect.com/user-uuid-1.jpg",
    "specialization": "Weight Loss, PCOS"
  }
}
```

**Error (401 Unauthorized)**
```json
{
  "code": "INVALID_CREDENTIALS",
  "message": "Email or password is incorrect."
}
```

***

#### POST `/auth/client/login`
Client OTP-based login.

**Request**
```json
{
  "phone": "+919876543210"
}
```

**Response (200 OK)** — OTP sent via SMS/email
```json
{
  "message": "OTP sent to phone",
  "sessionToken": "session-token-for-verification"
}
```

#### POST `/auth/client/verify-otp`
Verify OTP and get tokens.

**Request**
```json
{
  "sessionToken": "session-token-from-above",
  "otp": "123456"
}
```

**Response (200 OK)**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "client": {
    "id": "client-uuid-1",
    "organizationId": "org-uuid-1",
    "fullName": "Sarah Sharma",
    "email": "sarah@example.com",
    "phone": "+919876543210"
  }
}
```

***

#### POST `/auth/refresh`
Refresh access token using refresh token.

**Request**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response (200 OK)**
```json
{
  "accessToken": "eyJhbGc...",
  "expiresIn": 3600
}
```

***

#### POST `/auth/logout`
Invalidate tokens (optional, mainly for audit).

**Request** (authenticated)
```
No body
```

**Response (204 No Content)**

***

## Base Patterns & Conventions {#patterns}

### Standard Headers

**Request**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
X-Request-ID: unique-request-id (optional, for tracing)
```

**Response**
```
Content-Type: application/json
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1733336400
```

### Standard Response Envelope

**Success (200, 201, etc.)**
```json
{
  "success": true,
  "data": { /* actual payload */ },
  "meta": { /* pagination, counts, etc. */ }
}
```

**Error (4xx, 5xx)**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* optional additional context */ }
  }
}
```

### Timestamps
- All timestamps in **ISO 8601 UTC** format: `2025-12-04T14:30:00Z`.
- Client should assume UTC; never include timezone offset in request body unless explicitly needed.

### IDs
- All IDs are **UUIDs v4** (e.g., `550e8400-e29b-41d4-a716-446655440000`).
- IDs are immutable and never reused.

### Pagination

**Query Parameters**
```
?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc
```

**Response Meta**
```json
{
  "success": true,
  "data": [ /* array of items */ ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

Defaults: `page=1`, `pageSize=20`, `sortOrder=asc`.

### Filtering & Search

**Query Parameters**
```
?search=sarah&status=active&sortBy=createdAt
```

Field-specific filters are per-endpoint; `search` is a general text search on relevant fields.

### Soft Delete Pattern

Every entity has `deletedAt` (nullable TIMESTAMP).

- Active records: `deletedAt IS NULL`.
- Deleted records: `deletedAt IS NOT NULL`.
- List endpoints by default exclude deleted records unless `?includeDeleted=true`.

### Audit Fields (on all entities)

```json
{
  "id": "uuid",
  "createdAt": "2025-12-01T10:00:00Z",
  "updatedAt": "2025-12-04T14:30:00Z",
  "createdByUserId": "user-uuid",
  "isActive": true,
  "deletedAt": null
}
```

***

## Organizations {#organizations}

### GET `/organization`
Get current organization (authenticated user's org).

**Query Parameters**
None

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "id": "org-uuid-1",
    "name": "HealthFirst Nutrition Clinic",
    "ownerUserId": "user-uuid-1",
    "subscriptionTier": "clinic",
    "subscriptionStatus": "active",
    "subscriptionExpiresAt": "2026-01-01T00:00:00Z",
    "maxClients": 250,
    "currentClientCount": 120,
    "logoUrl": "https://cdn.dietconnect.com/org-uuid-1-logo.png",
    "description": "Leading nutrition clinic in Mumbai",
    "phone": "+91-9876543210",
    "email": "contact@healthfirst.com",
    "address": "123 Medical Plaza, Bandra, Mumbai",
    "city": "Mumbai",
    "country": "IN",
    "timezone": "Asia/Kolkata",
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-12-04T14:30:00Z",
    "isActive": true
  }
}
```

***

### PATCH `/organization`
Update organization settings (owner/admin only).

**Request**
```json
{
  "name": "HealthFirst Nutrition Clinic",
  "description": "Updated description",
  "phone": "+91-9876543211",
  "email": "newemail@healthfirst.com",
  "address": "456 Medical Plaza, Bandra, Mumbai",
  "timezone": "Asia/Kolkata"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    /* updated organization object */
  }
}
```

***

### GET `/organization/subscription`
Get detailed subscription info (owner only).

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "id": "sub-uuid-1",
    "organizationId": "org-uuid-1",
    "planTier": "clinic",
    "status": "active",
    "billingCycleStart": "2025-11-01",
    "billingCycleEnd": "2025-12-01",
    "amountPerMonth": 4999,
    "currency": "INR",
    "paymentMethodId": "pm-xyz",
    "autoRenew": true,
    "cancelledAt": null,
    "createdAt": "2025-11-01T00:00:00Z",
    "updatedAt": "2025-12-04T14:30:00Z"
  }
}
```

***

## Users (Dietitians/Admins) {#users}

### GET `/me`
Get current authenticated user.

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid-1",
    "organizationId": "org-uuid-1",
    "role": "dietitian",
    "email": "priya@clinic.com",
    "fullName": "Dr. Priya Sharma",
    "phone": "+91-9876543210",
    "profilePhotoUrl": "https://cdn.dietconnect.com/user-uuid-1.jpg",
    "licenseNumber": "DAN-12345",
    "specialization": "Weight Loss, PCOS Management",
    "bio": "10+ years of clinical experience",
    "isActive": true,
    "mfaEnabled": false,
    "lastLoginAt": "2025-12-04T14:00:00Z",
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-12-04T14:30:00Z"
  }
}
```

***

### PATCH `/me`
Update current user profile.

**Request**
```json
{
  "fullName": "Dr. Priya Sharma",
  "phone": "+91-9876543211",
  "specialization": "Weight Loss, PCOS, Diabetes",
  "bio": "Certified nutritionist with 10+ years experience"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": { /* updated user object */ }
}
```

***

### POST `/me/profile-photo`
Upload profile photo (multipart form-data).

**Request**
```
Content-Type: multipart/form-data

file: <image file, max 5MB>
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "profilePhotoUrl": "https://cdn.dietconnect.com/user-uuid-1-new.jpg"
  }
}
```

***

### GET `/organization/users`
List all users in organization (admin/owner only).

**Query Parameters**
```
?page=1&pageSize=20&sortBy=createdAt&role=dietitian&search=priya
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-uuid-1",
      "role": "dietitian",
      "email": "priya@clinic.com",
      "fullName": "Dr. Priya",
      "phone": "+91-9876543210",
      "specialization": "Weight Loss",
      "isActive": true,
      "lastLoginAt": "2025-12-04T14:00:00Z",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 5,
    "totalPages": 1,
    "hasNextPage": false
  }
}
```

***

### POST `/organization/users/invite`
Invite a new user to the organization (admin/owner only).

**Request**
```json
{
  "email": "newdietitian@clinic.com",
  "fullName": "Dr. Amit Kumar",
  "role": "dietitian"
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid-2",
    "email": "newdietitian@clinic.com",
    "fullName": "Dr. Amit Kumar",
    "role": "dietitian",
    "inviteSent": true,
    "invitedAt": "2025-12-04T14:30:00Z"
  }
}
```

An invite email is sent to the email with a sign-up link.

***

### PATCH `/organization/users/{userId}`
Update a user (admin/owner only).

**Request**
```json
{
  "role": "admin",
  "isActive": true
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": { /* updated user object */ }
}
```

***

### DELETE `/organization/users/{userId}`
Remove user from organization (soft delete, admin/owner only).

**Response (204 No Content)**

***

## Clients & Medical Profiles {#clients}

### POST `/clients`
Create a new client (dietitian/admin).

**Request**
```json
{
  "fullName": "Sarah Sharma",
  "email": "sarah@example.com",
  "phone": "+919876543210",
  "dateOfBirth": "1997-06-10",
  "gender": "female",
  "heightCm": 162,
  "currentWeightKg": 75,
  "targetWeightKg": 65,
  "activityLevel": "moderately_active",
  "primaryDietitianId": "user-uuid-1",
  "dietaryPreferences": ["vegetarian"],
  "allergies": ["peanuts", "dairy"],
  "medicalConditions": ["PCOS", "Type 2 Diabetes"],
  "medications": ["Metformin 500mg (morning)", "Atorvastatin 10mg (night)"],
  "healthNotes": "Prefers Indian cuisine, eats out twice weekly"
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "client-uuid-1",
    "organizationId": "org-uuid-1",
    "fullName": "Sarah Sharma",
    "email": "sarah@example.com",
    "phone": "+919876543210",
    "dateOfBirth": "1997-06-10",
    "gender": "female",
    "heightCm": 162,
    "currentWeightKg": 75,
    "targetWeightKg": 65,
    "activityLevel": "moderately_active",
    "primaryDietitian": {
      "id": "user-uuid-1",
      "fullName": "Dr. Priya"
    },
    "dietaryPreferences": ["vegetarian"],
    "allergies": ["peanuts", "dairy"],
    "medicalConditions": ["PCOS", "Type 2 Diabetes"],
    "medications": ["Metformin 500mg (morning)", "Atorvastatin 10mg (night)"],
    "healthNotes": "Prefers Indian cuisine, eats out twice weekly",
    "onboardingCompleted": false,
    "isActive": true,
    "createdAt": "2025-12-04T14:30:00Z",
    "updatedAt": "2025-12-04T14:30:00Z",
    "createdByUserId": "user-uuid-1"
  }
}
```

***

### GET `/clients`
List all clients in organization (dietitian/admin).

**Query Parameters**
```
?page=1&pageSize=20&search=sarah&status=active&primaryDietitianId=user-uuid-1&sortBy=createdAt
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    {
      "id": "client-uuid-1",
      "fullName": "Sarah Sharma",
      "email": "sarah@example.com",
      "phone": "+919876543210",
      "currentWeightKg": 73.5,
      "targetWeightKg": 65,
      "primaryDietitian": {
        "id": "user-uuid-1",
        "fullName": "Dr. Priya"
      },
      "isActive": true,
      "createdAt": "2025-12-04T14:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 120,
    "totalPages": 6,
    "hasNextPage": true
  }
}
```

***

### GET `/clients/{clientId}`
Get client summary (demographics + medical overview).

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "id": "client-uuid-1",
    "organizationId": "org-uuid-1",
    "fullName": "Sarah Sharma",
    "email": "sarah@example.com",
    "phone": "+919876543210",
    "dateOfBirth": "1997-06-10",
    "gender": "female",
    "heightCm": 162,
    "currentWeightKg": 73.5,
    "targetWeightKg": 65,
    "bmi": 22.2,
    "activityLevel": "moderately_active",
    "primaryDietitian": {
      "id": "user-uuid-1",
      "fullName": "Dr. Priya"
    },
    "dietaryPreferences": ["vegetarian"],
    "onboardingCompleted": true,
    "isActive": true,
    "createdAt": "2025-12-01T10:00:00Z",
    "updatedAt": "2025-12-04T14:30:00Z",
    "createdByUserId": "user-uuid-1"
  }
}
```

***

### PATCH `/clients/{clientId}`
Update client demographics or assignment.

**Request**
```json
{
  "currentWeightKg": 73.2,
  "targetWeightKg": 64,
  "primaryDietitianId": "user-uuid-2",
  "activityLevel": "lightly_active",
  "healthNotes": "Updated notes after consultation"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": { /* updated client */ }
}
```

***

### GET `/clients/{clientId}/medical-profile`
Get full medical history (diagnoses, allergies, medications, notes).

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "clientId": "client-uuid-1",
    "diagnoses": ["PCOS (diagnosed 2019)", "Type 2 Diabetes (diagnosed 2022)"],
    "allergies": ["peanuts", "dairy", "shellfish"],
    "intolerances": ["lactose"],
    "medications": [
      "Metformin 500mg (morning, for diabetes)",
      "Atorvastatin 10mg (night, for cholesterol)"
    ],
    "supplements": ["Vitamin D 2000IU (daily)", "Inositol 2g (daily)"],
    "surgeries": ["Appendectomy (2015)"],
    "familyHistory": "Mother: diabetes, Father: hypertension",
    "healthNotes": "Prefers Indian cuisine, eats out twice weekly, limited time for cooking.",
    "dietaryRestrictions": "No beef (cultural), no pork",
    "updatedAt": "2025-12-04T14:30:00Z",
    "updatedByUserId": "user-uuid-1"
  }
}
```

***

### PATCH `/clients/{clientId}/medical-profile`
Update medical information (dietitian only).

**Request**
```json
{
  "diagnoses": ["PCOS", "Type 2 Diabetes"],
  "allergies": ["peanuts", "dairy"],
  "medications": ["Metformin 500mg (morning)"],
  "healthNotes": "Updated after recent consultation"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": { /* updated medical profile */ }
}
```

***

### DELETE `/clients/{clientId}`
Soft delete a client (admin only).

**Response (204 No Content)**

***

## Diet Plans {#diet-plans}

### POST `/diet-plans`
Create a new diet plan for a client (with nested meals and items).

**Request**
```json
{
  "clientId": "client-uuid-1",
  "name": "Week 1 – PCOS & Diabetes Control",
  "description": "Focus on blood sugar stability and weight management.",
  "startDate": "2025-12-01",
  "endDate": "2025-12-07",
  "targetsPerDay": {
    "calories": 1800,
    "proteinG": 90,
    "carbsG": 200,
    "fatsG": 60,
    "fiberG": 25
  },
  "meals": [
    {
      "dayIndex": 1,
      "mealType": "breakfast",
      "timeOfDay": "08:00",
      "title": "Besan Chilla + Curd + Apple",
      "instructions": "Use minimal oil. Avoid sugar in tea.",
      "foodItems": [
        {
          "foodId": "food-uuid-1",
          "quantity": 2,
          "unit": "piece"
        },
        {
          "foodId": "food-uuid-2",
          "quantity": 100,
          "unit": "g"
        }
      ]
    }
  ],
  "options": {
    "saveAsTemplate": false,
    "templateCategory": null
  }
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "plan-uuid-1",
    "organizationId": "org-uuid-1",
    "client": {
      "id": "client-uuid-1",
      "fullName": "Sarah Sharma"
    },
    "createdByUser": {
      "id": "user-uuid-1",
      "fullName": "Dr. Priya"
    },
    "name": "Week 1 – PCOS & Diabetes Control",
    "description": "Focus on blood sugar stability and weight management.",
    "startDate": "2025-12-01",
    "endDate": "2025-12-07",
    "durationDays": 7,
    "status": "draft",
    "targetsPerDay": {
      "calories": 1800,
      "proteinG": 90,
      "carbsG": 200,
      "fatsG": 60,
      "fiberG": 25
    },
    "isTemplate": false,
    "publishedAt": null,
    "createdAt": "2025-12-04T14:30:00Z",
    "updatedAt": "2025-12-04T14:30:00Z"
  }
}
```

***

### GET `/diet-plans/{planId}`
Get full diet plan with all meals and food items.

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "id": "plan-uuid-1",
    "organizationId": "org-uuid-1",
    "client": {
      "id": "client-uuid-1",
      "fullName": "Sarah Sharma",
      "currentWeightKg": 73.5,
      "targetWeightKg": 65
    },
    "createdByUser": {
      "id": "user-uuid-1",
      "fullName": "Dr. Priya"
    },
    "name": "Week 1 – PCOS & Diabetes Control",
    "description": "Focus on blood sugar stability and weight management.",
    "startDate": "2025-12-01",
    "endDate": "2025-12-07",
    "status": "active",
    "targetsPerDay": {
      "calories": 1800,
      "proteinG": 90,
      "carbsG": 200,
      "fatsG": 60,
      "fiberG": 25
    },
    "meals": [
      {
        "id": "meal-uuid-1",
        "dayIndex": 1,
        "mealDate": "2025-12-01",
        "mealType": "breakfast",
        "timeOfDay": "08:00",
        "title": "Besan Chilla + Curd + Apple",
        "instructions": "Use minimal oil. Avoid sugar in tea.",
        "items": [
          {
            "foodId": "food-uuid-1",
            "foodName": "Besan Chilla",
            "quantity": 2,
            "unit": "piece",
            "nutritionPerItem": {
              "calories": 100,
              "proteinG": 5,
              "carbsG": 12.5,
              "fatsG": 3
            },
            "totalNutrition": {
              "calories": 200,
              "proteinG": 10,
              "carbsG": 25,
              "fatsG": 6
            }
          }
        ],
        "totals": {
          "calories": 360,
          "proteinG": 14,
          "carbsG": 51,
          "fatsG": 9,
          "fiberG": 3
        }
      }
    ],
    "dailyTotalsIfFollowed": {
      "calories": 1750,
      "proteinG": 92,
      "carbsG": 185,
      "fatsG": 58,
      "fiberG": 24
    },
    "isTemplate": false,
    "publishedAt": "2025-12-01T10:00:00Z",
    "createdAt": "2025-12-01T10:00:00Z",
    "updatedAt": "2025-12-04T14:30:00Z"
  }
}
```

***

### GET `/clients/{clientId}/diet-plans`
List all diet plans for a client (with basic details only).

**Query Parameters**
```
?status=active&sortBy=createdAt&page=1&pageSize=20
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    {
      "id": "plan-uuid-1",
      "name": "Week 1 – PCOS & Diabetes Control",
      "startDate": "2025-12-01",
      "endDate": "2025-12-07",
      "status": "active",
      "createdByUser": {
        "id": "user-uuid-1",
        "fullName": "Dr. Priya"
      },
      "mealCount": 35,
      "publishedAt": "2025-12-01T10:00:00Z",
      "createdAt": "2025-12-01T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

***

### PATCH `/diet-plans/{planId}`
Update diet plan metadata (name, dates, targets).

**Request**
```json
{
  "name": "Week 1 – Updated Plan",
  "description": "Revised targets",
  "startDate": "2025-12-01",
  "endDate": "2025-12-07",
  "targetsPerDay": {
    "calories": 1750,
    "proteinG": 95
  }
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": { /* updated plan */ }
}
```

***

### POST `/diet-plans/{planId}/publish`
Mark plan as active and generate meal logs.

**Request**
```json
{
  "publishDate": "2025-12-01"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "planId": "plan-uuid-1",
    "status": "active",
    "publishedAt": "2025-12-04T14:30:00Z",
    "mealLogsCreated": 35
  }
}
```

***

### POST `/diet-plans/{planId}/save-as-template`
Save plan as a reusable template (dietitian/admin).

**Request**
```json
{
  "templateCategory": "pcos_weight_loss",
  "templateName": "PCOS Weight Loss – 1800 kcal",
  "visibility": "org_shared"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "planId": "plan-uuid-1",
    "isTemplate": true,
    "templateCategory": "pcos_weight_loss"
  }
}
```

***

### DELETE `/diet-plans/{planId}`
Soft delete a plan (admin only).

**Response (204 No Content)**

***

## Meals {#meals}

### GET `/diet-plans/{planId}/meals`
Get all meals for a plan (nested in plan details, but available separately if needed).

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    {
      "id": "meal-uuid-1",
      "dayIndex": 1,
      "mealDate": "2025-12-01",
      "mealType": "breakfast",
      "timeOfDay": "08:00",
      "title": "Besan Chilla + Curd + Apple",
      "instructions": "Use minimal oil.",
      "totals": {
        "calories": 360,
        "proteinG": 14
      }
    }
  ]
}
```

***

### PATCH `/meals/{mealId}`
Update meal details (title, instructions, time).

**Request**
```json
{
  "title": "Masala Dosa + Sambhar",
  "instructions": "Use coconut oil, low salt.",
  "timeOfDay": "08:30"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": { /* updated meal */ }
}
```

***

### POST `/meals/{mealId}/add-food-item`
Add a food item to a meal.

**Request**
```json
{
  "foodId": "food-uuid-3",
  "quantity": 150,
  "unit": "g"
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "mealId": "meal-uuid-1",
    "foodId": "food-uuid-3",
    "quantity": 150,
    "unit": "g",
    "nutrition": {
      "calories": 150,
      "proteinG": 12
    }
  }
}
```

***

### PATCH `/meals/{mealId}/food-items/{foodItemId}`
Update quantity of a food in a meal.

**Request**
```json
{
  "quantity": 200,
  "unit": "g"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": { /* updated meal-food-item */ }
}
```

***

### DELETE `/meals/{mealId}/food-items/{foodItemId}`
Remove a food item from a meal.

**Response (204 No Content)**

***

## Food Items & Database {#food-items}

### GET `/food-items`
Search and list food items (global + org-specific).

**Query Parameters**
```
?q=paneer&category=protein&orgScope=all&isVerified=true&page=1&pageSize=20
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    {
      "id": "food-uuid-1",
      "name": "Paneer (cottage cheese)",
      "category": "protein",
      "subCategory": "dairy",
      "servingSize": "100 g",
      "brand": "Amul",
      "isGlobal": true,
      "isVerified": true,
      "nutrition": {
        "calories": 265,
        "proteinG": 18,
        "carbsG": 6,
        "fatsG": 20,
        "fiberG": 0,
        "sodiumMg": 200,
        "sugarG": 1
      },
      "allergenFlags": ["dairy"],
      "dietaryTags": ["vegetarian"],
      "barcode": "8901234567890"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

***

### POST `/food-items`
Create organization-specific food (dietitian/admin).

**Request**
```json
{
  "name": "Priya's Special Dal Mix",
  "category": "legumes",
  "servingSize": "100 g",
  "nutrition": {
    "calories": 150,
    "proteinG": 12,
    "carbsG": 20,
    "fatsG": 2
  },
  "allergenFlags": [],
  "dietaryTags": ["vegan", "organic"]
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "food-uuid-custom-1",
    "organizationId": "org-uuid-1",
    "name": "Priya's Special Dal Mix",
    "category": "legumes",
    "isGlobal": false,
    "isVerified": false,
    "createdByUserId": "user-uuid-1",
    "createdAt": "2025-12-04T14:30:00Z"
  }
}
```

***

### GET `/food-items/{foodId}`
Get single food item details.

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "id": "food-uuid-1",
    "name": "Paneer (cottage cheese)",
    "category": "protein",
    "subCategory": "dairy",
    "servingSize": "100 g",
    "brand": "Amul",
    "isGlobal": true,
    "isVerified": true,
    "nutrition": {
      "calories": 265,
      "proteinG": 18,
      "carbsG": 6,
      "fatsG": 20,
      "fiberG": 0,
      "sodiumMg": 200,
      "sugarG": 1
    },
    "allergenFlags": ["dairy"],
    "dietaryTags": ["vegetarian"],
    "barcode": "8901234567890",
    "createdAt": "2025-06-01T00:00:00Z"
  }
}
```

***

### PATCH `/food-items/{foodId}`
Update food item (org-specific only).

**Request**
```json
{
  "name": "Updated name",
  "nutrition": {
    "calories": 160,
    "proteinG": 13
  }
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": { /* updated food item */ }
}
```

***

### DELETE `/food-items/{foodId}`
Delete org-specific food (soft delete).

**Response (204 No Content)**

***

## Meal Logs (Tracking) {#meal-logs}

### GET `/clients/{clientId}/meal-logs`
List meal logs for a client (dietitian view).

**Query Parameters**
```
?dateFrom=2025-12-01&dateTo=2025-12-07&status=pending&sortBy=scheduledDate
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    {
      "id": "meal-log-uuid-1",
      "mealId": "meal-uuid-1",
      "scheduledDate": "2025-12-01",
      "scheduledTime": "08:00",
      "meal": {
        "title": "Besan Chilla + Curd + Apple",
        "mealType": "breakfast"
      },
      "status": "pending",
      "photoUrl": null,
      "photoThumbnailUrl": null,
      "clientNotes": null,
      "dietitianFeedback": null,
      "reviewedByUser": null,
      "dietitianReviewedAt": null,
      "substituteDescription": null,
      "loggedAt": null,
      "createdAt": "2025-12-01T00:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 35
  }
}
```

***

### GET `/meal-logs/{mealLogId}`
Get full meal log details (with photos, feedback).

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "id": "meal-log-uuid-1",
    "organizationId": "org-uuid-1",
    "client": {
      "id": "client-uuid-1",
      "fullName": "Sarah Sharma"
    },
    "mealId": "meal-uuid-1",
    "scheduledDate": "2025-12-01",
    "scheduledTime": "08:00",
    "meal": {
      "title": "Besan Chilla + Curd + Apple",
      "mealType": "breakfast",
      "instructions": "Use minimal oil.",
      "items": [ /* food items */ ],
      "totals": {
        "calories": 360,
        "proteinG": 14
      }
    },
    "status": "eaten",
    "photoUrl": "https://cdn.dietconnect.com/meal-logs/meal-log-uuid-1.jpg",
    "photoThumbnailUrl": "https://cdn.dietconnect.com/meal-logs/meal-log-uuid-1-thumb.jpg",
    "photoUploadedAt": "2025-12-01T08:35:00Z",
    "clientNotes": "Used less oil, added extra veggies.",
    "dietitianFeedback": "Great choice! Good portion control.",
    "reviewedByUser": {
      "id": "user-uuid-1",
      "fullName": "Dr. Priya"
    },
    "dietitianReviewedAt": "2025-12-01T09:00:00Z",
    "substituteDescription": null,
    "loggedAt": "2025-12-01T08:35:00Z",
    "createdAt": "2025-12-01T00:00:00Z",
    "updatedAt": "2025-12-01T09:00:00Z"
  }
}
```

***

### POST `/meal-logs/{mealLogId}/photo-upload-url`
Get presigned S3 URL for photo upload (client).

**Request**
```json
{
  "fileName": "breakfast-2025-12-01.jpg",
  "fileType": "image/jpeg",
  "fileSizeBytes": 1500000
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://s3.amazonaws.com/bucket/presigned-url?...",
    "fileUrl": "https://cdn.dietconnect.com/meal-logs/meal-log-uuid-1.jpg",
    "expiresIn": 900
  }
}
```

Client uploads directly to `uploadUrl`, then calls `/meal-logs/{id}` to confirm.

***

### PATCH `/meal-logs/{mealLogId}`
Client logs/updates meal status (client app).

**Request**
```json
{
  "status": "eaten",
  "photoUrl": "https://cdn.dietconnect.com/meal-logs/meal-log-uuid-1.jpg",
  "clientNotes": "Used less oil, added extra veggies.",
  "substituteDescription": null
}
```

If status = "substituted":
```json
{
  "status": "substituted",
  "photoUrl": "https://cdn.dietconnect.com/meal-logs/meal-log-uuid-2.jpg",
  "clientNotes": "Had upma instead",
  "substituteDescription": "1 bowl vegetable upma, no chutney"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "id": "meal-log-uuid-1",
    "status": "eaten",
    "photoUrl": "https://cdn.dietconnect.com/meal-logs/meal-log-uuid-1.jpg",
    "clientNotes": "Used less oil, added extra veggies.",
    "loggedAt": "2025-12-01T08:35:00Z"
  }
}
```

***

### PATCH `/meal-logs/{mealLogId}/review`
Dietitian reviews and provides feedback (dietitian app).

**Request**
```json
{
  "status": "eaten",
  "dietitianFeedback": "Great choice! Good portion control and macro balance.",
  "overrideCalories": null
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "id": "meal-log-uuid-1",
    "status": "eaten",
    "dietitianFeedback": "Great choice! Good portion control and macro balance.",
    "reviewedByUser": {
      "id": "user-uuid-1",
      "fullName": "Dr. Priya"
    },
    "dietitianReviewedAt": "2025-12-01T09:00:00Z"
  }
}
```

***

## Weight Logs {#weight-logs}

### POST `/clients/{clientId}/weight-logs`
Dietitian logs weight on behalf of client (clinic visit).

**Request**
```json
{
  "logDate": "2025-12-04",
  "logTime": "10:00",
  "weightKg": 73.5,
  "notes": "Post-consultation measurement"
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "weight-log-uuid-1",
    "clientId": "client-uuid-1",
    "logDate": "2025-12-04",
    "logTime": "10:00",
    "weightKg": 73.5,
    "bmi": 22.2,
    "notes": "Post-consultation measurement",
    "createdAt": "2025-12-04T14:30:00Z",
    "createdByUserId": "user-uuid-1"
  }
}
```

***

### GET `/clients/{clientId}/weight-logs`
Get weight history for a client (dietitian & client).

**Query Parameters**
```
?dateFrom=2025-11-01&dateTo=2025-12-04&sortBy=logDate&page=1&pageSize=100
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    {
      "id": "weight-log-uuid-1",
      "logDate": "2025-11-10",
      "weightKg": 75.0,
      "bmi": 22.7,
      "notes": null
    },
    {
      "id": "weight-log-uuid-2",
      "logDate": "2025-11-17",
      "weightKg": 74.2,
      "bmi": 22.4,
      "notes": null,
      "weightChange": -0.8
    },
    {
      "id": "weight-log-uuid-3",
      "logDate": "2025-12-04",
      "weightKg": 73.5,
      "bmi": 22.2,
      "notes": "Post-consultation",
      "weightChange": -0.7
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 100,
    "total": 10,
    "totalStartWeight": 75.0,
    "totalEndWeight": 73.5,
    "totalWeightLoss": 1.5,
    "averageWeightLossPerWeek": 0.5
  }
}
```

***

### POST `/client/me/weight-logs`
Client logs their own weight (client app).

**Request**
```json
{
  "logDate": "2025-12-04",
  "weightKg": 73.5,
  "notes": "Feeling lighter today"
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "weight-log-uuid-1",
    "logDate": "2025-12-04",
    "weightKg": 73.5,
    "notes": "Feeling lighter today",
    "createdAt": "2025-12-04T14:30:00Z"
  }
}
```

***

### GET `/client/me/weight-logs`
Client views their weight history (client app).

**Query Parameters**
```
?dateFrom=2025-11-01&dateTo=2025-12-04
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    { "logDate": "2025-11-10", "weightKg": 75.0 },
    { "logDate": "2025-11-17", "weightKg": 74.2 },
    { "logDate": "2025-12-04", "weightKg": 73.5 }
  ],
  "meta": {
    "currentWeight": 73.5,
    "targetWeight": 65,
    "totalWeightLoss": 1.5,
    "remainingToGoal": 8.5,
    "progressPercentage": 15
  }
}
```

***

## Body Measurements {#body-measurements}

### POST `/clients/{clientId}/body-measurements`
Log body measurements (chest, waist, hips, etc.).

**Request**
```json
{
  "logDate": "2025-12-04",
  "chestCm": 92,
  "waistCm": 78,
  "hipsCm": 96,
  "thighsCm": 58,
  "armsCm": 28,
  "bodyFatPercentage": 28,
  "notes": "After 4 weeks of diet"
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "measurement-uuid-1",
    "clientId": "client-uuid-1",
    "logDate": "2025-12-04",
    "measurements": {
      "chestCm": 92,
      "waistCm": 78,
      "hipsCm": 96,
      "thighsCm": 58,
      "armsCm": 28,
      "bodyFatPercentage": 28
    },
    "createdAt": "2025-12-04T14:30:00Z"
  }
}
```

***

### GET `/clients/{clientId}/body-measurements`
Get measurement history.

**Query Parameters**
```
?dateFrom=2025-11-01&dateTo=2025-12-04&sortBy=logDate
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    {
      "id": "measurement-uuid-1",
      "logDate": "2025-11-10",
      "measurements": {
        "waistCm": 80,
        "bodyFatPercentage": 30
      }
    },
    {
      "id": "measurement-uuid-2",
      "logDate": "2025-12-04",
      "measurements": {
        "waistCm": 78,
        "bodyFatPercentage": 28
      },
      "changes": {
        "waistCm": -2,
        "bodyFatPercentage": -2
      }
    }
  ]
}
```

***

## Session Notes (SOAP/DAP) {#session-notes}

### POST `/clients/{clientId}/session-notes`
Create a session note (SOAP/DAP format).

**Request**
```json
{
  "noteType": "SOAP",
  "title": "Initial Assessment – PCOS & Weight Management",
  "subjective": "Client reports wanting to lose 10kg over 3 months. No recent injuries. Exercises 2-3x/week.",
  "objective": "Height: 162cm, Weight: 75kg, BMI: 28.5. Labs: HbA1C 6.8%, Fasting glucose 110.",
  "assessment": "Type 2 Diabetes risk, PCOS confirmed. Overweight. Good exercise baseline.",
  "plan": "Start 1800 kcal diet plan, high protein focus. Weekly weight logs. Follow-up in 2 weeks.",
  "internalNotes": "Client motivated. Referred by Dr. Smith. Prefers evening consultations."
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "note-uuid-1",
    "clientId": "client-uuid-1",
    "noteType": "SOAP",
    "title": "Initial Assessment – PCOS & Weight Management",
    "createdByUser": {
      "id": "user-uuid-1",
      "fullName": "Dr. Priya"
    },
    "createdAt": "2025-12-04T14:30:00Z",
    "updatedAt": "2025-12-04T14:30:00Z"
  }
}
```

***

### GET `/clients/{clientId}/session-notes`
List session notes for a client.

**Query Parameters**
```
?noteType=SOAP&sortBy=createdAt&page=1&pageSize=20
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    {
      "id": "note-uuid-1",
      "noteType": "SOAP",
      "title": "Initial Assessment – PCOS & Weight Management",
      "createdByUser": {
        "id": "user-uuid-1",
        "fullName": "Dr. Priya"
      },
      "createdAt": "2025-12-01T10:00:00Z"
    },
    {
      "id": "note-uuid-2",
      "noteType": "DAP",
      "title": "Follow-up Consultation – Week 2",
      "createdByUser": {
        "id": "user-uuid-1",
        "fullName": "Dr. Priya"
      },
      "createdAt": "2025-12-04T14:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 2
  }
}
```

***

### GET `/session-notes/{noteId}`
Get full session note (with all sections).

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "id": "note-uuid-1",
    "clientId": "client-uuid-1",
    "client": {
      "id": "client-uuid-1",
      "fullName": "Sarah Sharma"
    },
    "noteType": "SOAP",
    "title": "Initial Assessment – PCOS & Weight Management",
    "subjective": "Client reports wanting to lose 10kg over 3 months...",
    "objective": "Height: 162cm, Weight: 75kg...",
    "assessment": "Type 2 Diabetes risk, PCOS confirmed...",
    "plan": "Start 1800 kcal diet plan...",
    "internalNotes": "Client motivated...",
    "createdByUser": {
      "id": "user-uuid-1",
      "fullName": "Dr. Priya"
    },
    "createdAt": "2025-12-01T10:00:00Z",
    "updatedAt": "2025-12-01T10:00:00Z"
  }
}
```

***

### PATCH `/session-notes/{noteId}`
Update session note.

**Request**
```json
{
  "title": "Initial Assessment (Updated)",
  "plan": "Updated plan details..."
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": { /* updated note */ }
}
```

***

### DELETE `/session-notes/{noteId}`
Soft delete a session note.

**Response (204 No Content)**

***

## Notifications {#notifications}

### GET `/client/me/notifications`
Get notifications for logged-in client (client app).

**Query Parameters**
```
?isRead=false&sortBy=createdAt&page=1&pageSize=50
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    {
      "id": "notif-uuid-1",
      "type": "meal_reminder",
      "title": "Time for breakfast",
      "message": "Don't forget to log your 8 AM breakfast. You're doing great!",
      "icon": "📍",
      "deepLink": "/meals/today?mealType=breakfast",
      "isRead": false,
      "createdAt": "2025-12-04T07:30:00Z"
    },
    {
      "id": "notif-uuid-2",
      "type": "dietitian_feedback",
      "title": "Dr. Priya reviewed your lunch",
      "message": "Great choice! Keep it up.",
      "icon": "✅",
      "deepLink": "/meals/2025-12-03?mealType=lunch",
      "isRead": false,
      "createdAt": "2025-12-03T14:10:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 50,
    "total": 10,
    "unreadCount": 5
  }
}
```

***

### PATCH `/notifications/{notificationId}`
Mark notification as read.

**Request**
```json
{
  "isRead": true
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": { /* updated notification */ }
}
```

***

### GET `/dietitian/notifications`
Get notifications for dietitian (dashboard).

**Query Parameters**
```
?type=photo_uploaded&isRead=false&page=1&pageSize=20
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    {
      "id": "notif-uuid-3",
      "type": "photo_uploaded",
      "title": "Sarah uploaded her lunch photo",
      "message": "Review and provide feedback",
      "icon": "📷",
      "deepLink": "/meal-logs/meal-log-uuid-1",
      "relatedEntity": {
        "type": "meal_log",
        "id": "meal-log-uuid-1"
      },
      "isRead": false,
      "createdAt": "2025-12-04T13:00:00Z"
    }
  ]
}
```

***

## Activity Logs (Audit) {#activity-logs}

### GET `/admin/activity-logs`
Get organization activity logs (admin/owner only).

**Query Parameters**
```
?userId=user-uuid-1&clientId=client-uuid-1&action=diet_plan_created&dateFrom=2025-12-01&dateTo=2025-12-04&page=1&pageSize=50
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    {
      "id": "activity-uuid-1",
      "user": {
        "id": "user-uuid-1",
        "role": "dietitian",
        "fullName": "Dr. Priya"
      },
      "action": "diet_plan_created",
      "entityType": "diet_plan",
      "entityId": "plan-uuid-1",
      "description": "Created diet plan 'Week 1 – PCOS & Diabetes Control' for Sarah Sharma",
      "metadata": {
        "clientId": "client-uuid-1",
        "planName": "Week 1 – PCOS & Diabetes Control"
      },
      "ipAddress": "203.0.113.42",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2025-12-04T10:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 50,
    "total": 250
  }
}
```

***

## Grocery Lists {#grocery-lists}

### POST `/diet-plans/{planId}/grocery-list`
Generate grocery list from a diet plan.

**Request**
```json
{
  "dateFrom": "2025-12-01",
  "dateTo": "2025-12-07",
  "groupBy": "category",
  "format": "json"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "planId": "plan-uuid-1",
    "dateRange": {
      "from": "2025-12-01",
      "to": "2025-12-07"
    },
    "items": [
      {
        "category": "grains",
        "items": [
          {
            "name": "Wheat Flour",
            "quantity": 2.5,
            "unit": "kg",
            "estimatedCost": 150
          },
          {
            "name": "Brown Rice",
            "quantity": 1.5,
            "unit": "kg",
            "estimatedCost": 120
          }
        ]
      },
      {
        "category": "proteins",
        "items": [
          {
            "name": "Paneer (Amul)",
            "quantity": 1,
            "unit": "kg",
            "estimatedCost": 400
          },
          {
            "name": "Chicken Breast",
            "quantity": 1.5,
            "unit": "kg",
            "estimatedCost": 450
          }
        ]
      }
    ],
    "totalEstimatedCost": 1750,
    "generatedAt": "2025-12-04T14:30:00Z"
}
```

***

### GET `/diet-plans/{planId}/grocery-list`
Retrieve a previously generated grocery list.

**Response (200 OK)**
```json
{
  "success": true,
  "data": { /* grocery list structure */ }
}
```

***

### POST `/diet-plans/{planId}/grocery-list/export`
Export grocery list as PDF or CSV.

**Request**
```json
{
  "format": "pdf"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://cdn.dietconnect.com/grocery-lists/list-uuid-1.pdf",
    "expiresIn": 3600
  }
}
```

***

## Invoices & Billing {#invoices}

### POST `/invoices`
Create an invoice (admin/owner).

**Request**
```json
{
  "clientId": "client-uuid-1",
  "issueDate": "2025-12-04",
  "dueDate": "2025-12-11",
  "currency": "INR",
  "lineItems": [
    {
      "description": "Initial Nutrition Consultation",
      "quantity": 1,
      "unitPrice": 1500,
      "taxPercentage": 0
    },
    {
      "description": "4-Week Meal Plan",
      "quantity": 1,
      "unitPrice": 2000,
      "taxPercentage": 0
    }
  ],
  "notes": "Thank you for your trust. Payment due by 11 Dec."
}
```

**Response (201 Created)**
```json
{
  "success": true,
  "data": {
    "id": "invoice-uuid-1",
    "organizationId": "org-uuid-1",
    "clientId": "client-uuid-1",
    "client": {
      "id": "client-uuid-1",
      "fullName": "Sarah Sharma",
      "email": "sarah@example.com"
    },
    "invoiceNumber": "INV-2025-00001",
    "issueDate": "2025-12-04",
    "dueDate": "2025-12-11",
    "currency": "INR",
    "subtotal": 3500,
    "tax": 0,
    "total": 3500,
    "status": "unpaid",
    "createdByUser": {
      "id": "user-uuid-1",
      "fullName": "Dr. Priya"
    },
    "createdAt": "2025-12-04T14:30:00Z"
  }
}
```

***

### GET `/invoices`
List invoices for organization (admin/owner).

**Query Parameters**
```
?clientId=client-uuid-1&status=unpaid&dateFrom=2025-11-01&page=1&pageSize=20
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": [
    {
      "id": "invoice-uuid-1",
      "invoiceNumber": "INV-2025-00001",
      "client": {
        "id": "client-uuid-1",
        "fullName": "Sarah Sharma"
      },
      "issueDate": "2025-12-04",
      "dueDate": "2025-12-11",
      "total": 3500,
      "status": "unpaid",
      "createdAt": "2025-12-04T14:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 5,
    "totalUnpaid": 10500
  }
}
```

***

### GET `/invoices/{invoiceId}`
Get invoice details.

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "id": "invoice-uuid-1",
    "invoiceNumber": "INV-2025-00001",
    "client": {
      "id": "client-uuid-1",
      "fullName": "Sarah Sharma",
      "email": "sarah@example.com"
    },
    "issueDate": "2025-12-04",
    "dueDate": "2025-12-11",
    "lineItems": [
      {
        "description": "Initial Nutrition Consultation",
        "quantity": 1,
        "unitPrice": 1500,
        "total": 1500
      }
    ],
    "subtotal": 3500,
    "tax": 0,
    "total": 3500,
    "status": "unpaid",
    "paymentHistory": [],
    "notes": "Thank you for your trust..."
  }
}
```

***

### PATCH `/invoices/{invoiceId}`
Update invoice (before payment only).

**Request**
```json
{
  "dueDate": "2025-12-15",
  "status": "sent",
  "notes": "Gentle reminder..."
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": { /* updated invoice */ }
}
```

***

### POST `/invoices/{invoiceId}/send`
Send invoice to client via email.

**Request**
```json
{
  "recipientEmail": "sarah@example.com",
  "message": "Your nutrition consultation invoice"
}
```

**Response (200 OK)**
```json
{
  "success": true,
  "data": {
    "invoiceId": "invoice-uuid-1",
    "sentAt": "2025-12-04T14:35:00Z",
    "status": "sent"
  }
}
```

***

## Error Handling {#errors}

### Error Response Format

**4xx Client Errors**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The email is already in use.",
    "details": {
      "field": "email",
      "constraint": "unique"
    }
  }
}
```

**Common Error Codes**
```
UNAUTHORIZED            → 401 Unauthorized
FORBIDDEN               → 403 Forbidden (insufficient permissions)
NOT_FOUND               → 404 Not Found
VALIDATION_ERROR        → 400 Bad Request
CONFLICT                → 409 Conflict (resource already exists)
RATE_LIMIT_EXCEEDED     → 429 Too Many Requests
INTERNAL_SERVER_ERROR   → 500 Internal Server Error
```

***

## Rate Limiting & Pagination {#limits}

### Rate Limits

- **Authenticated users:** 1000 requests/hour
- **Unauthenticated:** 100 requests/hour
- **File uploads:** 50 MB/file

**Headers**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1733336400
```

***

### Pagination Defaults

```
?page=1&pageSize=20&sortBy=createdAt&sortOrder=asc
```

- Max `pageSize`: 100
- Cursor-based pagination coming in v2

***

## Summary

This is a **complete, production-ready API v1 spec** covering:

✅ Multi-tenant architecture with org scoping  
✅ Full CRUD for clients, diet plans, meals, tracking  
✅ Medical history management  
✅ Meal logging with photo uploads  
✅ Weight & progress tracking  
✅ SOAP/DAP session notes  
✅ Notifications & activity logs  
✅ Grocery lists (Phase 2)  
✅ Billing & invoicing  
✅ Best practices (error handling, rate limiting, pagination, soft deletes, audit trails)

*