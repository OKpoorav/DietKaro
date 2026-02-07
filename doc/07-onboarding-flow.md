# Module 7: Onboarding Flow Completion

**Priority:** P0 (Critical)
**Effort:** 2-3 days
**Impact:** Blocks user acquisition - clients can't fully onboard without all steps

---

## Current State

The mobile app onboarding has 5 step screens (`step1.tsx` through `step5.tsx`) plus a `complete.tsx` screen. The backend has an `onboarding.service.ts` (341 lines) with step definitions and preset data.

However, based on the spec:
- **Step 2 (Medical History)** - screen exists but needs verification of completeness
- **Step 6 (Body Measurements)** - screen does not exist
- Some steps may have incomplete submission logic (saving to API)

---

## What Needs To Be Done

### 1. Audit Existing Onboarding Steps

Review each step file for completeness:

| Step | File | Expected Content | Status |
|------|------|-----------------|--------|
| Step 1 - Basic Info | `step1.tsx` | Name, DOB, gender, height, weight, activity level | Verify |
| Step 2 - Medical History | `step2.tsx` | Conditions, medications, surgeries, family history | Verify |
| Step 3 - Allergies & Diet | `step3.tsx` | Allergies, intolerances, dietary preferences, dislikes | Verify |
| Step 4 - Goals | `step4.tsx` | Target weight, timeline, motivation | Verify |
| Step 5 - Lifestyle | `step5.tsx` | Meal timings, cooking ability, activity schedule | Verify |
| Step 6 - Body Measurements | **Missing** | Chest, waist, hips, thighs, arms, body fat % | **Create** |
| Complete | `complete.tsx` | Success screen with next steps | Verify |

**For each existing step, verify:**
- Form fields match what the backend `onboarding.service.ts` expects
- Data is saved to the correct API endpoint
- Validation is present on required fields
- Navigation to next step works after save
- Back navigation works without losing data
- Loading state shown during API calls
- Error handling with retry option

---

### 2. Create Step 6 - Body Measurements

**Create:** `client-app/app/(onboarding)/step6.tsx`

**UI Requirements:**

```
Title: "Body Measurements (Optional)"
Subtitle: "Help your dietitian track your progress more accurately"

Fields:
- Chest (cm): numeric input
- Waist (cm): numeric input
- Hips (cm): numeric input
- Thighs (cm): numeric input
- Arms (cm): numeric input
- Body Fat % (optional): numeric input with decimal

Unit Toggle: cm / inches (convert on submit)

Buttons:
- "Skip for now" -> navigate to complete
- "Save & Continue" -> save to API -> navigate to complete
```

**API Call:**
```
POST /api/v1/client/onboarding/step6
Body: {
  chestCm: number | null,
  waistCm: number | null,
  hipsCm: number | null,
  thighsCm: number | null,
  armsCm: number | null,
  bodyFatPercentage: number | null
}
```

**Validation:**
- All fields optional (step is skippable)
- If provided: min 20, max 200 for cm measurements
- Body fat: min 3, max 60

---

### 3. Ensure Backend Handles All Steps

**File:** `backend/src/services/onboarding.service.ts`

Verify the service has handlers for all 6 steps:

| Method | Saves To | Fields |
|--------|----------|--------|
| `saveStep1(clientId, data)` | Client table | fullName, dateOfBirth, gender, heightCm, currentWeightKg, activityLevel |
| `saveStep2(clientId, data)` | MedicalProfile | diagnoses, medications, surgeries, familyHistory |
| `saveStep3(clientId, data)` | Client + MedicalProfile | allergies, intolerances, dietaryPreferences, dislikes |
| `saveStep4(clientId, data)` | Client | targetWeightKg, goals, motivation |
| `saveStep5(clientId, data)` | ClientPreferences (if model exists) | mealTimings, canCook, activity |
| `saveStep6(clientId, data)` | BodyMeasurement | chest, waist, hips, thighs, arms, bodyFat |

**If Step 6 handler is missing, add it:**

```typescript
async saveStep6(clientId: string, data: Step6Data) {
  await prisma.bodyMeasurement.create({
    data: {
      clientId,
      orgId: client.orgId, // fetch from client
      logDate: new Date(),
      chestCm: data.chestCm,
      waistCm: data.waistCm,
      hipsCm: data.hipsCm,
      thighsCm: data.thighsCm,
      armsCm: data.armsCm,
      bodyFatPercentage: data.bodyFatPercentage,
    }
  });
}
```

---

### 4. Ensure Backend Endpoint Exists for Each Step

**File:** `backend/src/routes/onboarding.routes.ts`

Verify these endpoints exist:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/client/onboarding/status` | Get current progress (which steps complete) |
| POST | `/api/v1/client/onboarding/step1` | Save basic info |
| POST | `/api/v1/client/onboarding/step2` | Save medical history |
| POST | `/api/v1/client/onboarding/step3` | Save allergies/preferences |
| POST | `/api/v1/client/onboarding/step4` | Save goals |
| POST | `/api/v1/client/onboarding/step5` | Save lifestyle |
| POST | `/api/v1/client/onboarding/step6` | Save body measurements |
| POST | `/api/v1/client/onboarding/complete` | Mark onboarding as done |

---

### 5. Fix Step 5 Dependency on ClientPreferences Model

Step 5 (Lifestyle) saves meal timings, cooking ability, and activity schedule. This data should go to the `ClientPreferences` model.

**If `ClientPreferences` model doesn't exist yet** (see Module 4), Step 5 data may be getting lost or saved to the wrong table.

**Action:** Coordinate with Module 4 (Database Schema) to ensure `ClientPreferences` model exists before Step 5 can save correctly.

---

### 6. Add Progress Indicator

Both the mobile app and the onboarding service should track progress:

**Mobile app:** Show step progress bar (e.g., "Step 3 of 6") at top of each onboarding screen.

**Backend:** `getOnboardingStatus()` should return:
```json
{
  "currentStep": 3,
  "totalSteps": 6,
  "completedSteps": [1, 2],
  "skippedSteps": [],
  "percentComplete": 33
}
```

---

### 7. Handle Partial Onboarding

**Problem:** What if a user completes steps 1-3, closes the app, and returns?

**Expected behavior:**
1. On app open, check onboarding status via API
2. If `onboardingCompleted` is false, redirect to the next incomplete step
3. Allow going back to edit previously completed steps
4. Show previously entered data pre-filled in forms

**Files to update:**
- `client-app/app/index.tsx` (root router) - check onboarding status
- `client-app/app/(onboarding)/_layout.tsx` - determine starting step

---

### 8. Style Consistency

All onboarding screens should share the same visual style:
- Consistent header/progress bar
- Same button styles (primary green, secondary gray)
- Same input field styles
- Same spacing/padding
- Import from shared theme (see Module 3)

---

## Definition of Done

- [ ] All 6 step screens exist and render correctly
- [ ] Step 6 (Body Measurements) created with proper form and validation
- [ ] All steps save data to correct backend endpoints
- [ ] Backend has handlers for all 6 steps in onboarding.service.ts
- [ ] All 8 API endpoints exist and work correctly
- [ ] Progress indicator shows current step (e.g., "3 of 6")
- [ ] Partial onboarding resumes from correct step after app restart
- [ ] Previously entered data pre-fills when going back to a step
- [ ] Loading states shown during API calls
- [ ] Error handling with retry on each step
- [ ] Consistent styling across all onboarding screens
- [ ] Step 5 correctly saves to ClientPreferences model
- [ ] `onboardingCompleted` flag set to true after step 6 or complete
