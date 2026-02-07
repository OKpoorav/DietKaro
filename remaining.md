DietKaro - Remaining Work Checklist
Last Updated: February 1, 2026
Current Completion: ~60%

🔴 P0: Critical (Must Have for MVP)
1. Food Validation Engine
The core differentiator - validates food against client restrictions in real-time

Backend:

 Create backend/src/services/validation.service.ts

interface ValidationResult {
  severity: 'RED' | 'YELLOW' | 'GREEN';
  allowed: boolean;
  messages: ValidationMessage[];
}
 Implement validation checks:

 Allergy matching (food allergens vs client allergies) → RED
 Intolerance matching (lactose, gluten) → YELLOW
 Diet pattern (veg/non-veg/vegan) → RED
 Egg day restrictions (avoid on specific days) → YELLOW/RED
 Food dislikes → YELLOW
 Category avoidance (fried foods) → YELLOW
 Health flags (diabetic_caution vs pre_diabetes) → YELLOW
 Meal suitability (heavy food at night) → YELLOW
 Create API endpoint:

POST /api/v1/clients/:clientId/validate-food
Body: { foodId, mealType, date }
Response: ValidationResult
 Create bulk validation endpoint:

POST /api/v1/clients/:clientId/validate-foods
Body: { foodIds: [], mealType, date }
Dashboard:

 Update food selection modal with colored borders
 Show validation messages in alert panel
 Disable "Add" button for RED items
 Add "Add Anyway" with confirmation for YELLOW items
2. Compliance Service
Calculates how well client followed their meal plan

Backend:

 Create 
backend/src/services/compliance.service.ts

 Implement scoring logic:

calculateMealCompliance(mealLog: MealLog): {
  score: number;      // 0-100
  color: 'GREEN' | 'YELLOW' | 'RED';
  issues: string[];   // ['portion_exceeded', 'forbidden_food']
}
 Score criteria:

 Meal eaten on time → +points
 Photo uploaded → +points
 Correct foods → +points
 Portion accuracy → +points
 Substitution made → -points (varies)
 Skipped meal → score = 0
 Daily adherence aggregation:

GET /api/v1/clients/:clientId/adherence/daily?date=
GET /api/v1/clients/:clientId/adherence/weekly
 Auto-trigger on meal log status change

Schema Update:

 Verify MealLog.complianceScore, complianceColor, complianceIssues are populated
3. Complete Onboarding Flow
Missing Screen: Medical History (Step 2)

 Mobile app screen: client-app/app/onboarding/medical-history.tsx
 Condition checkboxes: diabetes, heart disease, PCOS, thyroid, etc.
 Current medications input
 Past surgeries
 Family history text field
 Backend endpoint: POST /api/client/onboarding/step/2-medical
 Save to MedicalProfile table
Missing Screen: Body Measurements (Step 6)

 Mobile app screen: client-app/app/onboarding/body-measurements.tsx
 Chest, waist, hips, thighs, arms measurements
 Unit toggle (cm/inches)
 Optional photo upload
 Backend endpoint: POST /api/client/onboarding/step/6
 Save to BodyMeasurement table
Onboarding Controller Updates:

 Update onboarding.controller.ts for new steps
 Update step count and flow logic
🟡 P1: High Priority
4. Add ClientPreferences Model
Schema:

 Add to 
backend/prisma/schema.prisma
:
model ClientPreferences {
  id                String   @id @default(uuid())
  clientId          String   @unique
  
  // Meal timing
  breakfastTime     String?  // "06:00"
  lunchTime         String?  // "12:00"
  dinnerTime        String?  // "19:30"
  snackTime         String?
  
  // Cooking constraints
  canCook           Boolean  @default(true)
  kitchenAvailable  Boolean  @default(true)
  hasDietaryCook    Boolean  @default(false)
  
  // Activity
  weekdayActivity   String?  // "sedentary_office"
  weekendActivity   String?  // "active_sports"
  sportOrHobby      String?
  
  generalNotes      String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  client Client @relation(fields: [clientId], references: [id], onDelete: Cascade)
}
 Run npx prisma db push
 Add relation to Client model
 Create CRUD endpoints
5. Medical Summary Sidebar (Dashboard)
Backend:

 Create endpoint: GET /api/v1/clients/:id/medical-summary
{
  "allergies": ["shellfish"],
  "intolerances": ["lactose"],
  "conditions": ["pre_diabetes"],
  "labAlerts": [
    { "name": "Vitamin D", "value": 23, "status": "low" }
  ],
  "dietPattern": "vegetarian_with_egg",
  "eggAvoidDays": ["tuesday"],
  "likes": ["paneer tikka"],
  "dislikes": ["bitter gourd"]
}
Dashboard:

 Create frontend/components/MedicalSidebar.tsx
 Color-coded alerts (🔴 critical, 🟡 caution, ✅ ok)
 Always visible while creating diet plans
 Collapsible sections
6. Lab Values Tracking
Schema:

 Add to MedicalProfile:
labValues Json?  // { "hba1c": 6.3, "vitaminD": 23 }
derivedRiskFlags String[]  // ["pre_diabetes", "vitamin_d_deficiency"]
Backend:

 Lab value input endpoint
 Auto-derive risk flags from values:
HbA1c > 6.5 → "diabetic"
HbA1c 5.7-6.5 → "pre_diabetic"
Vitamin D < 30 → "vitamin_d_deficiency"
B12 < 200 → "b12_deficiency"
Mobile:

 Lab values input screen in onboarding
 Reference ranges display
🟢 P2: Medium Priority
7. Session Notes CRUD
Backend:

 Create backend/src/controllers/sessionNote.controller.ts
 Create backend/src/routes/sessionNote.routes.ts
 Endpoints:
 POST /api/v1/clients/:clientId/session-notes
 GET /api/v1/clients/:clientId/session-notes
 PUT /api/v1/session-notes/:id
 DELETE /api/v1/session-notes/:id
Dashboard:

 Session notes tab in client profile
 SOAP note form
8. Invoice System
Backend:

 Create backend/src/controllers/invoice.controller.ts

 Endpoints:

 POST /api/v1/clients/:clientId/invoices
 GET /api/v1/invoices (org-level)
 GET /api/v1/invoices/:id
 PUT /api/v1/invoices/:id/mark-paid
 POST /api/v1/invoices/:id/send (email)
 PDF generation (use @react-pdf/renderer or similar)

 Invoice number auto-generation

Dashboard:

 Invoices list page
 Create invoice form
 Print/download PDF
9. Tag Review Queue (Dietitian Admin)
Backend:

 Create backend/src/controllers/tagReview.controller.ts
 Endpoints:
GET /api/v1/food-items/unverified
PUT /api/v1/food-items/:id/verify
PUT /api/v1/food-items/:id/reject
Dashboard:

 Tag review queue page
 Show food with suggested tags
 Approve/reject/edit actions
10. Activity Logging Service
Backend:

 Create backend/src/services/activityLog.service.ts
 Auto-log on:
 Client created/updated
 Diet plan published
 Meal log reviewed
 User login
 Store in ActivityLog table
Dashboard:

 Activity feed on client profile
 Org-level audit log page
🔵 P3: Nice to Have
11. AI/RAG Document Extraction
 Set up Gemini API integration
 PDF text extraction (pdfjs-dist)
 Structured data extraction prompt
 Confidence scoring
 Store in MedicalProfile.extractedReports
 Dietitian review flow
12. AI Food Recognition
 Integrate vision model for meal photos
 Auto-suggest food items from photo
 Population of MealLog.aiFoodRecognition
13. Redis Caching
 Set up Redis connection
 Cache frequently accessed:
 Food items list
 Client tags (for validation)
 Dashboard stats
14. Test Coverage
Backend:

 Unit tests for ValidationService
 Unit tests for ComplianceService
 Integration tests for auth flow
 Integration tests for meal logging
Frontend:

 Component tests for key UI elements
 E2E tests with Playwright
15. Expand Food Database
 Add 200+ more Indian foods
 Regional cuisines (South Indian, Gujarati, Bengali)
 Street foods with accurate nutrition
 Brand-specific items
⏳ Technical Debt
Schema Sync
 Add ClientPreferences model
 Add labValues to MedicalProfile
 Remove any unused fields
Code Cleanup
 Remove any types in controllers
 Add JSDoc comments to services
 Standardize error messages
Documentation
 Update 
Docs/APIroutes.md
 to match implementation
 Add README for each directory
 API documentation with Swagger/OpenAPI
Summary Table
Priority	Task	Effort	Impact
🔴 P0	Validation Engine	3 days	Critical
🔴 P0	Compliance Service	2 days	Critical
🔴 P0	Complete Onboarding	2 days	Critical
🟡 P1	ClientPreferences Model	0.5 day	High
🟡 P1	Medical Summary Sidebar	1 day	High
🟡 P1	Lab Values Tracking	1 day	High
🟢 P2	Session Notes CRUD	1 day	Medium
🟢 P2	Invoice System	2 days	Medium
🟢 P2	Tag Review Queue	1 day	Medium
🟢 P2	Activity Logging	1 day	Medium
🔵 P3	AI Document Extraction	3 days	Nice
🔵 P3	AI Food Recognition	2 days	Nice
🔵 P3	Redis Caching	1 day	Nice
🔵 P3	Test Coverage	3 days	Nice
Total Estimated Effort: ~24 days for full completion MVP Critical Path: ~7 days (P0 items)


Comment
⌥⌘M
