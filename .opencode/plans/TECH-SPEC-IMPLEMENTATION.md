# DietKaro Technical Specification - Implementation Roadmap

**Version:** 1.0  
**Date:** January 21, 2026  
**Purpose:** Complete implementation guide for remaining features  
**Business Goal:** Enable dietitians to efficiently create personalized diet plans by collecting comprehensive client data and providing intelligent validation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Phase 1: Complete Client Onboarding](#3-phase-1-complete-client-onboarding)
4. [Phase 2: Validation Engine Enhancements](#4-phase-2-validation-engine-enhancements)
5. [Phase 3: Dashboard & Client Management](#5-phase-3-dashboard--client-management)
6. [Phase 4: Medical Log Analysis (AI)](#6-phase-4-medical-log-analysis-ai)
7. [Database Schema Changes](#7-database-schema-changes)
8. [API Endpoints Summary](#8-api-endpoints-summary)
9. [Technical Dependencies](#9-technical-dependencies)
10. [Risk Assessment & Mitigations](#10-risk-assessment--mitigations)

---

## 1. Executive Summary

### 1.1 Business Objective

DietKaro is a multi-tenant SaaS platform for dietitians. The core business value is:

1. **Collect comprehensive client health data** through mobile app onboarding
2. **Validate food choices in real-time** against client restrictions
3. **Enable efficient diet plan creation** with intelligent alerts
4. **Track client progress** through meal logging and measurements

### 1.2 Current Implementation Status

| Component | Completion | Critical Gaps |
|-----------|------------|---------------|
| Backend Infrastructure | 85% | Missing AI integration |
| Client Mobile App | 60% | Incomplete onboarding flow |
| Dietitian Dashboard | 70% | Missing medical summary sidebar |
| Validation Engine | 75% | Missing repetition & strength checks |
| AI/RAG Extraction | 0% | Not started (code in different branch, not merged) |

### 1.3 Priority Order

| Priority | Feature | Business Impact | Effort |
|----------|---------|-----------------|--------|
| **P1** | Complete Onboarding | Can't personalize plans without data | 4-5 days |
| **P2** | Validation Engine | Dietitians need accurate food alerts | 2 days |
| **P3** | Dashboard Enhancements | Better UX for diet planning | 3 days |
| **P4** | AI Medical Extraction | Nice-to-have automation | 5+ days |

---

## 2. Current State Analysis

### 2.1 What's Working

#### Backend (Node.js/Express)
- Authentication: Clerk (dietitian dashboard) + Custom JWT (client app)
- File Storage: S3-compatible (Garage) with image compression
- Validation Engine: Core rules implemented (allergies, diet patterns, day restrictions)
- API Structure: RESTful endpoints for all core entities
- Database: PostgreSQL with Prisma ORM, 18 models

#### Client Mobile App (React Native/Expo)
- Auth flow: OTP-based phone login
- Onboarding: 5 screens (basic info, diet pattern, allergies, restrictions, dislikes)
- Main tabs: Home (today's meals), Weight tracking, Progress, Profile
- Meal logging with photo upload

#### Dietitian Dashboard (Next.js)
- Client list and management
- Diet plan creation with meal scheduling
- Food item database with search
- Real-time validation alerts (RED/YELLOW/GREEN borders)

### 2.2 What's Missing

#### Database Models (Not Created)
- `LabReport` - For AI-extracted lab data
- `LabResult` - Individual biomarker records
- `ClientPreferences` - Meal timing, cooking constraints

#### Database Fields (Missing on Existing Models)
- `Client`: `occupation`, `activityNotes`, `preferredCookMethods`
- `MedicalProfile`: `extractedReports`, `labValues`, `derivedRiskFlags`
- `FoodItem`: `mayContainTraces`, numeric `confidence`, verification tracking

#### Client App Screens (Not Implemented)
- Medical History & Lab Reports input
- Body Measurements capture
- Review & Submit summary screen
- Likes & Preferred Cuisines (only dislikes captured)

#### Validation Rules (Not Implemented)
- Strong vs mild dislike differentiation
- Weekly food repetition warnings
- Ultra-processed food caution for diabetics
- Goal-aligned positive nudges
- `avoidCategories` checking

---

## 3. Phase 1: Complete Client Onboarding

### 3.1 Overview

**Goal:** Collect all necessary client data during mobile app onboarding to enable personalized diet planning.

**Current State:** 5 screens capturing partial data  
**Target State:** 7+ screens capturing comprehensive data

### 3.2 Screen-by-Screen Specification

---

#### Screen 1: Basic Profile (ENHANCE)

**Current:** Captures height, weight, target weight, gender, activity level  
**Enhancement Needed:** Add name, date of birth, phone

**UI Components:**

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| Full Name | Text Input | Min 2 chars | Yes |
| Date of Birth | Date Picker | Age 13-100 years | Yes |
| Phone | Phone Input | Valid Indian format (+91) | Pre-filled from login |
| Profile Photo | Image Picker | Max 5MB, JPEG/PNG | No |
| Height | Number + Unit | 100-250 cm | Yes |
| Current Weight | Number | 20-300 kg | Yes |
| Target Weight | Number | 20-300 kg | Yes |
| Gender | Radio (Male/Female/Other) | - | Yes |
| Activity Level | Picker | sedentary/light/moderate/very_active | Yes |

**Backend Endpoint:** `POST /api/v1/client/onboarding/step1`

**Logic:**
1. Validate all fields client-side before submission
2. Calculate age from DOB
3. Calculate BMI from height/weight
4. If age < 18, show parental consent notice
5. Store in `Client` table

**Data Stored:**
```typescript
{
  fullName: string,
  dateOfBirth: Date,
  phone: string,
  profilePhotoUrl?: string,
  heightCm: number,
  currentWeightKg: number,
  targetWeightKg: number,
  gender: "male" | "female" | "other",
  activityLevel: "sedentary" | "light" | "moderate" | "very_active"
}
```

---

#### Screen 2: Medical History (NEW)

**Purpose:** Capture health conditions, medications, and family history for medical-aware diet planning.

**Why Important:** 
- Pre-diabetes needs low-sugar recommendations
- Heart conditions need low-sodium, low-cholesterol
- Medications can have food interactions
- Family history indicates genetic predisposition

**UI Components:**

| Field | Type | Options | Required |
|-------|------|---------|----------|
| Medical Conditions | Multi-select Chips | [diabetes, pre_diabetes, hypertension, heart_disease, thyroid, PCOS, cholesterol, kidney_issues, liver_issues, anemia, obesity] | No |
| Custom Condition | Text Input | Free text | No |
| Current Medications | Tag Input | Free text, comma separated | No |
| Supplements | Tag Input | Free text | No |
| Past Surgeries | Text Area | Free text | No |
| Family History | Multi-select | [diabetes, heart_disease, hypertension, cancer, obesity] | No |
| Health Notes | Text Area | Free text for additional context | No |

**Backend Endpoint:** `POST /api/v1/client/onboarding/step2`

**Logic:**
1. For each selected condition, auto-generate `labDerivedTags`:
   - `pre_diabetes` → add tag `sugar_caution`
   - `heart_disease` → add tag `cholesterol_caution`
   - `hypertension` → add tag `sodium_caution`
2. Store medications for drug-food interaction checks (future)
3. Family history informs risk assessment

**Data Stored:**
```typescript
{
  medicalConditions: string[],
  medications: string[],
  supplements: string[],
  surgeries: string,
  familyHistory: string[],
  healthNotes: string
}
// Also updates MedicalProfile relation
```

---

#### Screen 3: Allergies & Intolerances (EXISTS - MINOR ENHANCEMENT)

**Current State:** Working, captures allergies and intolerances  
**Enhancement:** Add severity level for allergies (mild/severe/life-threatening)

**UI Components:**

| Field | Type | Options |
|-------|------|---------|
| Allergies | Multi-select + Custom | [peanuts, tree_nuts, milk, eggs, wheat, soy, fish, shellfish, sesame] |
| Allergy Severity | Per-item dropdown | mild/severe/life_threatening |
| Intolerances | Multi-select + Custom | [lactose, gluten, fructose, histamine, caffeine] |

**Logic:**
1. Life-threatening allergies → Always RED blocking
2. Severe allergies → RED blocking
3. Mild allergies → RED blocking but with different message
4. Intolerances → RED blocking (treat same as allergies for safety)

**Data Stored:**
```typescript
{
  allergies: Array<{ name: string, severity: "mild" | "severe" | "life_threatening" }>,
  intolerances: string[]
}
```

---

#### Screen 4: Diet Pattern & Restrictions (EXISTS - WORKING)

**Current State:** Working well with presets for religious fasting  
**No changes needed**

**Features:**
- Diet pattern selection (vegetarian, vegan, non-veg, pescatarian, eggetarian)
- Egg preference with day restrictions
- Religious presets (Hindu Fasting, Jain, Catholic Friday, Islamic Halal, Navratri)

---

#### Screen 5: Food Preferences (ENHANCE)

**Current State:** Only captures dislikes  
**Enhancement Needed:** Add likes, preferred cuisines, meal timing

**UI Components:**

| Section | Field | Type |
|---------|-------|------|
| **Likes** | Liked Foods | Searchable multi-select from FoodItem database |
| **Likes** | Preferred Cuisines | Multi-select chips: [indian, south_indian, mughlai, chinese, continental, mediterranean, thai] |
| **Likes** | Preferred Cooking Methods | Multi-select: [grilled, steamed, baked, stir_fried, raw] |
| **Dislikes** | Disliked Foods | Multi-select + custom (existing) |
| **Dislikes** | Dislike Strength | Per-item: mild (can eat if needed) / strong (never) |
| **Dislikes** | Avoid Categories | Multi-select: [fried_foods, processed_meat, canned_foods, sugary_drinks] |
| **Timing** | Breakfast Time | Time picker |
| **Timing** | Lunch Time | Time picker |
| **Timing** | Dinner Time | Time picker |
| **Timing** | Snack Time | Time picker (optional) |

**Backend Endpoint:** `POST /api/v1/client/onboarding/step5`

**Logic:**
1. Liked foods stored as `foodId[]` for GREEN nudges during planning
2. Dislike strength determines RED vs YELLOW in validation
3. Meal timing used for meal scheduling defaults
4. Preferred cuisines show GREEN badges on matching foods

**Data Stored:**
```typescript
{
  likedFoods: string[], // Food IDs
  preferredCuisines: string[],
  preferredCookMethods: string[],
  dislikes: Array<{ name: string, strength: "mild" | "strong" }>,
  avoidCategories: string[],
  mealTiming: {
    breakfast: string, // "07:00"
    lunch: string,
    dinner: string,
    snack?: string
  }
}
```

---

#### Screen 6: Body Measurements (NEW)

**Purpose:** Baseline measurements for progress tracking and goal setting.

**Why Important:**
- Track fat loss vs muscle gain (scale doesn't tell full story)
- Waist measurement indicates visceral fat (health risk indicator)
- Provides motivation when clients see inch loss

**UI Components:**

| Field | Type | Unit | Required |
|-------|------|------|----------|
| Chest | Number | cm/inches (toggle) | No |
| Waist | Number | cm/inches | Yes |
| Stomach at Navel | Number | cm/inches | No |
| Hips | Number | cm/inches | No |
| Upper Thighs | Number | cm/inches | No |
| Upper Arms | Number | cm/inches | No |
| Calves | Number | cm/inches | No |
| Body Fat % | Number | % | No |
| Measurement Date | Date | - | Yes (default: today) |
| Notes | Text | - | No |

**Backend Endpoint:** `POST /api/v1/client/onboarding/step6`

**Logic:**
1. Allow unit toggle (metric/imperial) - convert and store as cm
2. Waist measurement triggers health warnings if in danger zone:
   - Men: >102cm (40in) = high risk
   - Women: >88cm (35in) = high risk
3. Calculate waist-to-hip ratio for health indicator
4. Store as first `BodyMeasurement` record

**Data Stored:**
```typescript
{
  chestCm: number,
  waistCm: number,
  stomachCm: number,
  hipsCm: number,
  thighsCm: number,
  armsCm: number,
  calfCm: number,
  bodyFatPercentage?: number,
  logDate: Date,
  notes?: string
}
```

---

#### Screen 7: Review & Submit (NEW)

**Purpose:** Allow client to review all entered data before submission.

**Why Important:**
- Reduces errors from accidental selections
- Gives confidence that data is correct
- Required for medical data accuracy

**UI Layout:**
```
+------------------------------------------+
|  Review Your Profile                      |
+------------------------------------------+
|                                           |
|  Basic Info                        [Edit] |
|  - Name: Gaurav Kumar                     |
|  - Age: 47                                |
|  - Height: 178 cm                         |
|  - Weight: 92 kg -> 82 kg (Goal)          |
|  - Activity: Moderate                     |
|                                           |
|  Medical History                   [Edit] |
|  - Conditions: Pre-diabetes, Belly fat    |
|  - Medications: None                      |
|  - Family: Diabetes (mother's side)       |
|                                           |
|  Allergies                         [Edit] |
|  - None recorded                          |
|                                           |
|  Diet Pattern                      [Edit] |
|  - Vegetarian + Egg                       |
|  - Avoid eggs: Tuesday, Thursday          |
|                                           |
|  Preferences                       [Edit] |
|  - Likes: Egg roll, Dal makhani           |
|  - Dislikes: Bitter gourd                 |
|  - Cuisines: Indian, Mughlai              |
|                                           |
|  Measurements                      [Edit] |
|  - Waist: 39.5 inches                     |
|  - Date: Jan 15, 2026                     |
|                                           |
|  [ ] I confirm this information is        |
|      accurate to the best of my knowledge |
|                                           |
|  [       Submit & Continue        ]       |
|                                           |
+------------------------------------------+
```

**Backend Endpoint:** `POST /api/v1/client/onboarding/complete`

**Logic:**
1. Display all data grouped by category
2. Each section has [Edit] button → navigates back to that step
3. Checkbox for confirmation (required)
4. On submit:
   - Set `Client.onboardingCompleted = true`
   - Trigger notification to assigned dietitian
   - Generate initial `labDerivedTags` from conditions
   - Navigate to main app

---

### 3.3 Onboarding Navigation Flow

```
Login -> OTP Verify -> Check onboardingCompleted
                           |
                           +-- true -> Main App (Tabs)
                           |
                           +-- false -> Onboarding Flow
                                           |
    +--------------------------------------+
    |
    v
Step 1 (Basic) -> Step 2 (Medical) -> Step 3 (Allergies) -> Step 4 (Restrictions)
                                                                    |
                                                                    v
                              Step 7 (Review) <- Step 6 (Measurements) <- Step 5 (Preferences)
                                    |
                                    v
                              Submit -> Main App
```

### 3.4 Backend Service Changes

#### File: `backend/src/services/onboarding.service.ts`

**Current Methods:**
- `saveStep1()` - Basic info
- `saveStep2()` - Diet pattern
- `saveStep3()` - Allergies
- `saveStep4()` - Restrictions
- `saveStep5()` - Dislikes only

**Required Updates:**
1. `saveStep1()` - Add `fullName`, `dateOfBirth`
2. `saveStep2Medical()` - NEW: Medical history
3. `saveStep5()` - Add likes, cuisines, meal timing, dislike strength
4. `saveStep6()` - NEW: Body measurements
5. `completeOnboarding()` - Finalize and trigger notifications

**New Helper Methods:**
```typescript
// Generate lab-derived tags from conditions
generateDerivedTags(conditions: string[]): string[] {
  const tagMap = {
    'pre_diabetes': ['sugar_caution', 'high_gi_caution'],
    'diabetes': ['sugar_caution', 'high_gi_caution', 'diabetic'],
    'heart_disease': ['cholesterol_caution', 'sodium_caution'],
    'hypertension': ['sodium_caution'],
    'cholesterol': ['cholesterol_caution', 'saturated_fat_caution'],
    'kidney_issues': ['protein_caution', 'sodium_caution'],
    'anemia': ['iron_needed'],
    'PCOS': ['sugar_caution', 'insulin_resistance']
  };
  // Return unique tags
}

// Calculate health risk indicators
calculateRiskIndicators(client: Client): RiskIndicators {
  // BMI calculation
  // Waist-to-hip ratio
  // Age-adjusted targets
}
```

---

## 4. Phase 2: Validation Engine Enhancements

### 4.1 Overview

**Goal:** Improve the validation engine to provide more accurate and comprehensive food-client compatibility checks.

**File:** `backend/src/services/validationEngine.service.ts`

### 4.2 Gap Analysis

| Rule | Spec | Current Status | Priority |
|------|------|----------------|----------|
| Strong dislike blocking | RED | All dislikes are YELLOW | HIGH |
| Weekly repetition warning | YELLOW if >4x/week | Not implemented | MEDIUM |
| `avoidCategories` check | YELLOW | Field unused | MEDIUM |
| Ultra-processed + diabetes | YELLOW | Not implemented | MEDIUM |
| Goal-aligned nudge | GREEN | Not implemented | LOW |
| `mayContainTraces` check | YELLOW | Field doesn't exist | LOW |

### 4.3 Implementation Details

---

#### 4.3.1 Strong Dislike Blocking (HIGH)

**Current Behavior:** All dislikes return YELLOW (caution)  
**Required Behavior:** Strong dislikes return RED (blocking)

**Schema Change Needed:**
```prisma
// Client model - change dislikes from String[] to Json
dislikes  Json    @default("[]")  // Array<{ name: string, strength: "mild" | "strong" }>
```

**Validation Logic:**
```typescript
private checkDislikes(food: FoodTags, clientTags: ClientTags): ValidationAlert | null {
  for (const dislike of clientTags.dislikes) {
    if (food.name.toLowerCase().includes(dislike.name.toLowerCase())) {
      if (dislike.strength === 'strong') {
        return {
          type: 'dislike',
          severity: ValidationSeverity.RED,
          message: `STRONG DISLIKE: Client strongly dislikes ${food.name}`,
          canAdd: false
        };
      } else {
        return {
          type: 'dislike',
          severity: ValidationSeverity.YELLOW,
          message: `MILD DISLIKE: Client prefers to avoid ${food.name}`,
          recommendation: 'Consider alternatives if available',
          canAdd: true
        };
      }
    }
  }
  return null;
}
```

**UI Impact:**
- Onboarding step 5: Add strength toggle for each dislike
- Dashboard: Strong dislikes show RED border, mild shows YELLOW

---

#### 4.3.2 Weekly Repetition Warning (MEDIUM)

**Purpose:** Warn dietitians when a food item is used too frequently in a week.

**Why Important:**
- Nutritional variety is healthier
- Clients get bored of repetitive meals
- Some foods (eggs) have cholesterol limits

**Validation Context Addition:**
```typescript
interface ValidationContext {
  currentDay: string;
  mealType: string;
  weeklyUsage: Record<string, number>;  // { "food_id_123": 3, "food_id_456": 5 }
}
```

**Validation Logic:**
```typescript
private checkRepetition(food: FoodTags, context: ValidationContext): ValidationAlert | null {
  const usageCount = context.weeklyUsage?.[food.id] || 0;
  
  // Specific limits for certain foods
  const limits: Record<string, number> = {
    'eggs': 4,        // Cholesterol concern
    'red_meat': 2,    // Heart health
    'default': 5      // General variety
  };
  
  const limit = limits[food.category] || limits['default'];
  
  if (usageCount >= limit) {
    return {
      type: 'repetition',
      severity: ValidationSeverity.YELLOW,
      message: `REPETITION: ${food.name} used ${usageCount} times this week`,
      recommendation: `Consider variety. Limit: ${limit}x per week`,
      canAdd: true
    };
  }
  return null;
}
```

**API Change:**
The diet plan creation UI must pass `weeklyUsage` context when calling validation:
```typescript
// Frontend must calculate and send:
POST /api/v1/diet-validation/check
{
  clientId: "...",
  foodId: "...",
  context: {
    currentDay: "monday",
    mealType: "breakfast",
    weeklyUsage: {
      "food_eggs_001": 3  // Already used 3 times this week
    }
  }
}
```

---

#### 4.3.3 Avoid Categories Check (MEDIUM)

**Current Issue:** `client.avoidCategories` is loaded but never checked.

**Purpose:** Warn when food belongs to a category the client wants to avoid.

**Validation Logic:**
```typescript
private checkAvoidCategories(food: FoodTags, clientTags: ClientTags): ValidationAlert | null {
  if (!clientTags.avoidCategories?.length) return null;
  
  const categoryMapping: Record<string, string[]> = {
    'fried_foods': ['deep_fried', 'fried', 'crispy'],
    'processed_meat': ['sausage', 'bacon', 'ham', 'salami'],
    'sugary_drinks': ['soda', 'cola', 'sweetened_beverage'],
    'canned_foods': ['canned', 'preserved'],
    'ultra_processed': ['ultra_processed']
  };
  
  for (const avoidCat of clientTags.avoidCategories) {
    const keywords = categoryMapping[avoidCat] || [avoidCat];
    
    const matchesCategory = keywords.some(kw => 
      food.category?.includes(kw) || 
      food.processingLevel?.includes(kw) ||
      food.cuisineTags?.includes(kw)
    );
    
    if (matchesCategory) {
      return {
        type: 'category_avoid',
        severity: ValidationSeverity.YELLOW,
        message: `CATEGORY: Client prefers to avoid ${avoidCat}`,
        recommendation: 'Consider healthier alternatives',
        canAdd: true
      };
    }
  }
  return null;
}
```

---

#### 4.3.4 Ultra-Processed + Diabetes Warning (MEDIUM)

**Purpose:** Warn when ultra-processed foods are added for diabetic/pre-diabetic clients.

**Why Important:** Ultra-processed foods typically have high glycemic index.

**Validation Logic:**
```typescript
// Add to checkMedicalConditions method
if (
  (clientTags.medicalConditions.has('pre_diabetes') || 
   clientTags.medicalConditions.has('diabetes')) &&
  food.processingLevel === 'ultra_processed'
) {
  alerts.push({
    type: 'medical',
    severity: ValidationSeverity.YELLOW,
    message: 'ULTRA-PROCESSED: High glycemic impact for diabetic client',
    recommendation: 'Prefer whole foods or minimally processed alternatives',
    canAdd: true
  });
}
```

---

#### 4.3.5 Goal-Aligned Positive Nudge (LOW)

**Purpose:** Show GREEN badges for foods that align with client's health goal.

**Schema Addition:**
```prisma
// Client model
goal  String?  // "weight_loss" | "muscle_gain" | "maintenance" | "health_improvement"
```

**Validation Logic:**
```typescript
private checkGoalAlignment(food: FoodTags, clientTags: ClientTags): ValidationAlert | null {
  if (!clientTags.goal) return null;
  
  const goalFoodMatches: Record<string, { tags: string[], message: string }> = {
    'weight_loss': {
      tags: ['high_protein', 'low_calorie', 'high_fiber', 'low_fat'],
      message: 'GOAL-ALIGNED: Great for weight loss - high protein, low calorie'
    },
    'muscle_gain': {
      tags: ['high_protein', 'complex_carbs'],
      message: 'GOAL-ALIGNED: Good for muscle building - protein rich'
    },
    'health_improvement': {
      tags: ['vitamin_rich', 'antioxidant', 'heart_healthy', 'low_sodium'],
      message: 'GOAL-ALIGNED: Nutrient dense and heart healthy'
    }
  };
  
  const goalConfig = goalFoodMatches[clientTags.goal];
  if (!goalConfig) return null;
  
  const matchingTags = goalConfig.tags.filter(tag => 
    food.nutritionTags?.includes(tag)
  );
  
  if (matchingTags.length >= 2) {
    return {
      type: 'goal_match',
      severity: ValidationSeverity.GREEN,
      message: goalConfig.message,
      canAdd: true
    };
  }
  return null;
}
```

---

### 4.4 Validation Engine Testing Checklist

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Strong dislike | Client dislikes "mushroom" (strong), food = "Mushroom Curry" | RED, canAdd: false |
| Mild dislike | Client dislikes "okra" (mild), food = "Bhindi Masala" | YELLOW, canAdd: true |
| Repetition limit | Eggs used 4x this week, adding 5th | YELLOW warning |
| Avoid category | Client avoids "fried_foods", food = "Samosa" | YELLOW warning |
| Diabetic + processed | Client has pre_diabetes, food processingLevel = "ultra_processed" | YELLOW warning |
| Goal match | Client goal = "weight_loss", food = high protein + low calorie | GREEN badge |
| Allergy | Client allergic to peanuts, food contains peanuts | RED, canAdd: false |
| Day restriction | Client avoids eggs on Tuesday, today = Tuesday | RED, canAdd: false |

---

## 5. Phase 3: Dashboard & Client Management

### 5.1 Overview

**Goal:** Enhance the dietitian dashboard to show comprehensive client medical summary during diet planning.

### 5.2 Medical Summary Sidebar Component

**Purpose:** Always-visible sidebar showing client health data while creating diet plans.

**Location:** `frontend/src/components/clients/MedicalSummarySidebar.tsx`

**Layout:**
```
+-------------------------------------+
|  Client Photo & Name                |
|  178cm, 92kg -> 82kg (Goal: -10kg)  |
|  Age: 47, Male, Moderate Activity   |
+-------------------------------------+
|                                     |
|  RED - BLOCKING RESTRICTIONS        |
|  ----------------------------       |
|  Allergies: Peanuts (severe)        |
|  Intolerances: Lactose              |
|  Diet: Vegetarian + Egg             |
|  Egg Avoid: Tue, Thu                |
|  Strong Dislikes: Mushroom          |
|                                     |
|  YELLOW - CAUTION FLAGS             |
|  ----------------------------       |
|  Conditions:                        |
|  - Pre-diabetes (HbA1c 6.3%)        |
|  - Heart concerns                   |
|                                     |
|  Lab Alerts:                        |
|  - Vitamin D: 23 (low)              |
|  - B12: 155 (low)                   |
|  - hs-CRP: 4.1 (elevated)           |
|                                     |
|  Avoid Categories:                  |
|  - Fried foods                      |
|  - Ultra-processed                  |
|                                     |
|  GREEN - PREFERENCES                |
|  ----------------------------       |
|  Likes: Egg roll, Dal makhani       |
|  Cuisines: Indian, Mughlai          |
|  Cooking: Grilled, Steamed          |
|                                     |
|  CONTEXT                            |
|  ----------------------------       |
|  Mild Dislikes: Bitter gourd        |
|  Activity: Sat/Sun morning sport    |
|  Meal Times: B:7am L:12pm D:7:30pm  |
|                                     |
|  [View Full Profile]                |
|                                     |
+-------------------------------------+
```

**Data Sources:**
```typescript
interface MedicalSummaryData {
  // From Client
  fullName: string;
  profilePhotoUrl?: string;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  dateOfBirth: Date;
  gender: string;
  activityLevel: string;
  
  // Blocking (RED)
  allergies: Array<{ name: string, severity: string }>;
  intolerances: string[];
  dietPattern: string;
  eggAllowed: boolean;
  eggAvoidDays: string[];
  strongDislikes: string[];
  
  // Caution (YELLOW)
  medicalConditions: string[];
  labDerivedTags: string[];
  avoidCategories: string[];
  mildDislikes: string[];
  
  // Positive (GREEN)
  likedFoods: string[];
  preferredCuisines: string[];
  preferredCookMethods: string[];
  
  // Context
  mealTiming?: {
    breakfast: string;
    lunch: string;
    dinner: string;
  };
  activityNotes?: string;
  
  // From MedicalProfile
  labValues?: {
    hba1c?: number;
    vitaminD?: number;
    vitaminB12?: number;
    hsCRP?: number;
  };
}
```

**API Endpoint:** `GET /api/v1/clients/:clientId/medical-summary`

**Response:** Aggregated data from Client + MedicalProfile + ClientPreferences

### 5.3 Food Search with Validation Integration

**Current:** Food search shows basic food cards with nutrition  
**Enhancement:** Real-time validation badges on each food card

**UI Enhancement:**
```
+-------------------------------------------------------+
| Search Foods: [eggs________________]                   |
+-------------------------------------------------------+
|                                                        |
|  +--------------+  +--------------+  +--------------+ |
|  | YELLOW       |  | RED          |  | GREEN        | |
|  | ------------ |  | ------------ |  | ------------ | |
|  | Omelette     |  | Egg Curry    |  | Boiled Egg   | |
|  |              |  |              |  |              | |
|  | 155 kcal     |  | 180 kcal     |  | 78 kcal      | |
|  | P:11 C:1 F:12|  | P:12 C:8 F:11|  | P:6 C:0 F:5  | |
|  |              |  |              |  |              | |
|  | ! Cholesterol|  | X Tuesday    |  | + High prot  | |
|  | Used 3x      |  | restriction  |  | + Low cal    | |
|  |              |  |              |  |              | |
|  | [Add Anyway] |  | [Blocked]    |  | [+ Add]      | |
|  +--------------+  +--------------+  +--------------+ |
|                                                        |
+-------------------------------------------------------+
```

**Batch Validation:**
When loading food search results, call batch validation API:
```typescript
POST /api/v1/diet-validation/batch
{
  clientId: "...",
  foodIds: ["food1", "food2", "food3", ...],
  context: {
    currentDay: "tuesday",
    mealType: "breakfast",
    weeklyUsage: { ... }
  }
}
```

---

## 6. Phase 4: Medical Log Analysis (AI)

### 6.1 Overview

**Goal:** Automatically extract biomarker data from uploaded medical reports using AI/OCR.

**Priority:** P4 (Future enhancement - core workflow works without this)

**Dependencies:**
- OpenAI GPT-4o API (for vision/OCR)
- LabReport and LabResult database models

### 6.2 System Flow

```
Client uploads PDF/Image (blood_test.pdf)
           |
           v
+---------------------------+
|  1. Upload to S3          |  <- Existing functionality
+---------------------------+
           |
           v
+---------------------------+
|  2. Create ClientReport   |  <- Existing functionality
|     record                |
+---------------------------+
           |
           v (Manual trigger or auto)
+---------------------------+
|  3. Send to AI Service    |  <- NEW
|     - Download from S3    |
|     - Convert to base64   |
|     - Send to GPT-4o      |
+---------------------------+
           |
           v
+---------------------------+
|  4. Parse AI Response     |  <- NEW
|     - Extract biomarkers  |
|     - Normalize names     |
|     - Compare to ranges   |
|     - Score confidence    |
+---------------------------+
           |
           v
+---------------------------+
|  5. Store Results         |  <- NEW
|     - Create LabReport    |
|     - Create LabResults   |
|     - Status: REVIEW_NEEDED
+---------------------------+
           |
           v
+---------------------------+
|  6. Dietitian Reviews     |  <- NEW UI
|     - Verify values       |
|     - Approve/Correct     |
+---------------------------+
           |
           v
+---------------------------+
|  7. Update Client Tags    |
|     - Add labDerivedTags  |
|     - Update MedicalProfile
+---------------------------+
```

### 6.3 AI Service Implementation

**File:** `backend/src/services/labAnalysis.service.ts`

**Key Methods:**

```typescript
class LabAnalysisService {
  
  // Trigger analysis for a report
  async analyzeReport(reportId: string): Promise<LabReport>
  
  // Call OpenAI GPT-4o Vision API
  private async extractWithAI(imageBase64: string): Promise<RawExtraction>
  
  // Normalize biomarker names to standard keys
  private normalizeBiomarker(rawName: string): string
  
  // Compare value to reference range
  private assessStatus(value: number, low: number, high: number): Status
  
  // Generate client tags from results
  private generateLabDerivedTags(results: LabResult[]): string[]
  
  // Get historical trend for a biomarker
  async getBiomarkerTrend(clientId: string, biomarker: string): Promise<TrendData>
}
```

**AI Prompt Strategy:**

```typescript
const systemPrompt = `You are a medical laboratory report analyzer. 
Extract all test results from the provided medical report image.

For each test found, extract:
1. Test Name (exactly as written)
2. Value (numeric)
3. Unit (e.g., mg/dL, g/dL)
4. Reference Range (if shown)

Return as JSON array:
[
  {
    "testName": "Hemoglobin",
    "value": 14.2,
    "unit": "g/dL",
    "referenceLow": 13.0,
    "referenceHigh": 17.0
  }
]

If you cannot read a value clearly, set confidence < 0.7.
If reference range is missing, omit those fields.
Only return valid JSON, no explanations.`;
```

**Biomarker Normalization Map:**

```typescript
const biomarkerNormalization: Record<string, string> = {
  // Hemoglobin variants
  'hemoglobin': 'hemoglobin',
  'haemoglobin': 'hemoglobin',
  'hgb': 'hemoglobin',
  'hb': 'hemoglobin',
  
  // HbA1c variants
  'hba1c': 'hba1c',
  'glycated hemoglobin': 'hba1c',
  'glycosylated hemoglobin': 'hba1c',
  
  // Vitamin D variants
  'vitamin d': 'vitamin_d',
  'vit d': 'vitamin_d',
  '25-oh vitamin d': 'vitamin_d',
  '25-hydroxyvitamin d': 'vitamin_d',
  
  // ... extensive mapping
};
```

**Tag Generation Rules:**

| Biomarker | Condition | Generated Tag |
|-----------|-----------|---------------|
| HbA1c > 6.5% | Diabetic range | `diabetes`, `sugar_caution` |
| HbA1c 5.7-6.4% | Pre-diabetic | `pre_diabetes`, `sugar_caution` |
| Vitamin D < 20 | Deficiency | `vitamin_d_deficiency` |
| Vitamin D 20-30 | Insufficient | `vitamin_d_low` |
| B12 < 200 | Deficiency | `b12_deficiency` |
| Total Cholesterol > 200 | High | `high_cholesterol`, `cholesterol_caution` |
| Hemoglobin < 12 (F) / < 13 (M) | Anemia | `anemia`, `iron_needed` |
| TSH > 4.5 | Hypothyroid | `hypothyroid` |
| hs-CRP > 3 | High inflammation | `high_inflammation` |

### 6.4 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/reports/:id/analyze` | Trigger AI analysis |
| GET | `/api/v1/reports/:id/analysis` | Get analysis results |
| PATCH | `/api/v1/reports/:id/analysis/results/:resultId` | Correct a result |
| POST | `/api/v1/reports/:id/analysis/approve` | Approve and apply tags |
| GET | `/api/v1/clients/:clientId/biomarker-trends` | Historical biomarker data |

### 6.5 Dashboard UI Components

**1. Analysis Status Badge (on report list)**
```
[PENDING] - Not analyzed yet
[PROCESSING] - AI extraction in progress
[REVIEW_NEEDED] - Ready for dietitian review
[COMPLETED] - Approved and applied
[FAILED] - Analysis failed, needs manual entry
```

**2. Results Review Modal**
- Table of extracted biomarkers
- Inline editing for corrections
- Color-coded status (LOW/NORMAL/HIGH/CRITICAL)
- Confidence indicator
- Bulk approve button

**3. Trend Visualization**
- Line chart showing biomarker over time
- Reference range shaded area
- Date labels on x-axis
- Interactive tooltips

### 6.6 Cost Considerations

**OpenAI GPT-4o Vision Pricing:**
- ~$0.01 per image (standard quality)
- ~$0.03 per image (high quality for detailed reports)

**Estimated Monthly Cost:**
- 100 clients x 2 reports/month = 200 analyses
- 200 x $0.03 = ~$6/month

**Fallback Strategy:**
- If AI fails, show manual entry form
- Store failure reason for debugging
- Allow retry after 24 hours

---

## 7. Database Schema Changes

### 7.1 New Models

```prisma
// =======================================================
// LAB ANALYSIS MODELS (Phase 4)
// =======================================================

model LabReport {
  id              String        @id @default(uuid())
  clientReportId  String        @unique
  clientId        String
  
  // Analysis metadata
  status          LabReportStatus @default(PENDING)
  analyzedAt      DateTime?
  approvedAt      DateTime?
  approvedByUserId String?
  
  // Extracted metadata
  labName         String?
  collectionDate  DateTime?
  reportType      String?       // "blood_test", "urine_test", "thyroid_panel"
  
  // AI metadata
  aiProvider      String?       // "openai_gpt4o"
  aiModelVersion  String?
  rawExtraction   Json?         // Store raw AI response for debugging
  processingTimeMs Int?
  
  // Results
  results         LabResult[]
  
  // Timestamps
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  
  // Relations
  clientReport    ClientReport  @relation(fields: [clientReportId], references: [id])
  client          Client        @relation(fields: [clientId], references: [id])
  approvedBy      User?         @relation(fields: [approvedByUserId], references: [id])
  
  @@index([clientId])
  @@index([status])
}

enum LabReportStatus {
  PENDING
  PROCESSING
  REVIEW_NEEDED
  COMPLETED
  FAILED
}

model LabResult {
  id              String    @id @default(uuid())
  labReportId     String
  
  // Biomarker data
  biomarkerKey    String    // Normalized: "hemoglobin", "hba1c"
  displayName     String    // Original: "Haemoglobin", "HbA1c"
  value           Float
  unit            String?
  
  // Reference range
  referenceLow    Float?
  referenceHigh   Float?
  referenceNote   String?   // "Normal: 13-17 g/dL"
  
  // Assessment
  status          BiomarkerStatus
  severity        String?   // "mild", "moderate", "severe"
  
  // AI metadata
  confidence      Float     @default(1.0)  // 0-1
  wasManuallyEdited Boolean @default(false)
  
  // Generated tags
  generatedTags   String[]  @default([])
  
  // Timestamps
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // Relations
  labReport       LabReport @relation(fields: [labReportId], references: [id], onDelete: Cascade)
  
  @@index([labReportId])
  @@index([biomarkerKey])
}

enum BiomarkerStatus {
  CRITICAL_LOW
  LOW
  NORMAL
  HIGH
  CRITICAL_HIGH
}

// =======================================================
// CLIENT PREFERENCES MODEL (Phase 1)
// =======================================================

model ClientPreferences {
  id              String    @id @default(uuid())
  clientId        String    @unique
  
  // Meal timing
  breakfastTime   String?   // "07:00"
  lunchTime       String?   // "12:30"
  dinnerTime      String?   // "19:30"
  snackTime       String?   // "15:00"
  
  // Cooking constraints
  canCook         Boolean   @default(true)
  kitchenAvailable Boolean  @default(true)
  hasDietaryCook  Boolean   @default(false)
  
  // Activity context
  weekdayActivity String?   // "sedentary_office"
  weekendActivity String?   // "active_sports"
  sportOrHobby    String?   // "morning cricket match"
  
  // Notes
  generalNotes    String?
  
  // Timestamps
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // Relations
  client          Client    @relation(fields: [clientId], references: [id])
}
```

### 7.2 Model Updates

```prisma
// =======================================================
// CLIENT MODEL UPDATES
// =======================================================

model Client {
  // ... existing fields ...
  
  // ADD: Missing fields from spec
  occupation          String?
  activityNotes       String?
  preferredCookMethods String[]  @default([])
  goal                String?    // "weight_loss", "muscle_gain", "maintenance"
  
  // CHANGE: dislikes from String[] to Json for strength
  dislikes            Json       @default("[]")  // Array<{ name: string, strength: "mild" | "strong" }>
  
  // ADD: Relations
  labReports          LabReport[]
  preferences         ClientPreferences?
}

// =======================================================
// MEDICAL PROFILE MODEL UPDATES
// =======================================================

model MedicalProfile {
  // ... existing fields ...
  
  // ADD: AI extraction storage
  extractedReports    Json[]    @default([])  // Historical extractions
  
  // ADD: Structured lab values (latest)
  labValues           Json?     // { hba1c: 6.3, vitaminD: 23, ... }
  
  // ADD: Computed risk flags
  derivedRiskFlags    String[]  @default([])  // ["pre_diabetes", "vitamin_d_deficiency"]
  
  // ADD: Last lab update tracking
  labValuesUpdatedAt  DateTime?
}

// =======================================================
// FOOD ITEM MODEL UPDATES
// =======================================================

model FoodItem {
  // ... existing fields ...
  
  // ADD: Trace allergens (for cross-contamination warnings)
  mayContainTraces    String[]  @default([])
  
  // CHANGE: confidence from Boolean to Int
  // isVerified Boolean -> keep
  confidence          Int       @default(0)  // 0-100
  
  // ADD: Verification tracking
  verifiedByUserId    String?
  verifiedAt          DateTime?
  requiresReviewAt    DateTime?
  lastReviewReason    String?
  
  // Relations
  verifiedBy          User?     @relation(fields: [verifiedByUserId], references: [id])
}
```

### 7.3 Migration Strategy

**Step 1:** Add new columns with defaults (non-breaking)
**Step 2:** Migrate data where needed
**Step 3:** Create new models
**Step 4:** Add relations

```bash
# Generate migration
npx prisma migrate dev --name add_lab_analysis_and_preferences

# If data migration needed, create a script
npx tsx scripts/migrate-dislikes-to-json.ts
```

---

## 8. API Endpoints Summary

### 8.1 New Endpoints

| Method | Endpoint | Purpose | Phase |
|--------|----------|---------|-------|
| POST | `/api/v1/client/onboarding/step2-medical` | Save medical history | P1 |
| POST | `/api/v1/client/onboarding/step6-measurements` | Save body measurements | P1 |
| POST | `/api/v1/client/onboarding/complete` | Finalize onboarding | P1 |
| GET | `/api/v1/clients/:id/medical-summary` | Aggregated client health data | P3 |
| POST | `/api/v1/reports/:id/analyze` | Trigger AI analysis | P4 |
| GET | `/api/v1/reports/:id/analysis` | Get analysis results | P4 |
| PATCH | `/api/v1/reports/:id/analysis/results/:resultId` | Edit a result | P4 |
| POST | `/api/v1/reports/:id/analysis/approve` | Approve analysis | P4 |
| GET | `/api/v1/clients/:id/biomarker-trends` | Historical biomarker data | P4 |

### 8.2 Updated Endpoints

| Method | Endpoint | Changes | Phase |
|--------|----------|---------|-------|
| POST | `/api/v1/client/onboarding/step1` | Add fullName, dateOfBirth | P1 |
| POST | `/api/v1/client/onboarding/step5` | Add likes, cuisines, dislike strength | P1 |
| POST | `/api/v1/diet-validation/check` | Accept weeklyUsage in context | P2 |
| POST | `/api/v1/diet-validation/batch` | Accept weeklyUsage in context | P2 |

---

## 9. Technical Dependencies

### 9.1 Current Dependencies (No Changes Needed for P1-P3)

The existing stack is sufficient for Phases 1-3:
- Express 5.x (Backend)
- Prisma 6.x (ORM)
- React Native/Expo (Mobile)
- Next.js 14 (Dashboard)

### 9.2 New Dependencies for Phase 4 (AI)

```json
{
  "dependencies": {
    "openai": "^4.x"           // GPT-4o Vision API
  }
}
```

**Environment Variables (Phase 4):**
```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
LAB_ANALYSIS_ENABLED=true
```

### 9.3 Optional Future Dependencies

```json
{
  "dependencies": {
    "@pinecone-database/pinecone": "^2.x",  // Vector DB for RAG
    "langchain": "^0.1.x"                    // LLM orchestration
  }
}
```

---

## 10. Risk Assessment & Mitigations

### 10.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| AI extraction accuracy | HIGH | MEDIUM | Mandatory dietitian review, manual override |
| Schema migration breaks app | HIGH | LOW | Test migrations in staging, backup data |
| Mobile app update required | MEDIUM | HIGH | Version API, support old clients temporarily |
| Performance with batch validation | MEDIUM | MEDIUM | LRU cache already implemented, monitor latency |

### 10.2 Business Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Clients abandon long onboarding | MEDIUM | Add progress indicator, save partial data |
| Dietitians overwhelmed with reviews | MEDIUM | Priority queue, batch approval |
| Wrong tag causes health issue | HIGH | Conservative defaults (YELLOW not GREEN), disclaimer |

### 10.3 Security Considerations

| Concern | Current Status | Action Needed |
|---------|----------------|---------------|
| Medical data privacy (HIPAA) | Basic encryption | Add audit logging, data retention policies |
| AI sending data to OpenAI | N/A | Anonymize data before sending, use EU endpoint |
| Allergy data accuracy | Manual entry | Mark AI-extracted as "unverified" until approved |

---

## 11. Timeline Estimate

| Phase | Tasks | Duration | Dependencies |
|-------|-------|----------|--------------|
| **P1** | Onboarding screens + backend | 4-5 days | None |
| **P2** | Validation engine updates | 2 days | P1 (for dislike strength) |
| **P3** | Dashboard sidebar + batch validation | 3 days | P1, P2 |
| **P4** | AI lab analysis | 5+ days | P1 schema changes |

**Total:** ~2-3 weeks for P1-P3, +1 week for P4

---

## 12. Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Onboarding completion rate | Unknown | >80% | Analytics on step dropoff |
| Validation accuracy | ~75% | >95% | Compare AI validation vs dietitian corrections |
| Diet plan creation time | Unknown | <10 min | Track time from start to publish |
| AI extraction accuracy | N/A | >85% | Compare AI vs approved values |

---

## Appendix A: File Structure Changes

```
backend/src/
├── controllers/
│   ├── onboarding.controller.ts    # UPDATE: new steps
│   └── labAnalysis.controller.ts   # NEW: AI analysis endpoints
├── services/
│   ├── onboarding.service.ts       # UPDATE: new methods
│   ├── validationEngine.service.ts # UPDATE: new rules
│   └── labAnalysis.service.ts      # NEW: AI integration
├── schemas/
│   ├── onboarding.schema.ts        # UPDATE: new validations
│   └── labAnalysis.schema.ts       # NEW: request/response schemas
├── routes/
│   └── labAnalysis.routes.ts       # NEW: analysis endpoints
└── types/
    ├── validation.types.ts         # UPDATE: weeklyUsage, goal
    └── labAnalysis.types.ts        # NEW: AI types

client-app/app/(onboarding)/
├── step1.tsx                       # UPDATE: add name, DOB
├── step2-medical.tsx               # NEW: medical history
├── step3.tsx                       # Minor: allergy severity
├── step4.tsx                       # No changes
├── step5.tsx                       # UPDATE: likes, cuisines, strength
├── step6-measurements.tsx          # NEW: body measurements
├── step7-review.tsx                # NEW: review screen
└── complete.tsx                    # No changes

frontend/src/components/
├── clients/
│   └── MedicalSummarySidebar.tsx   # NEW: sidebar component
└── lab-analysis/
    ├── AnalysisResultsTable.tsx    # NEW: results display
    ├── BiomarkerTrendChart.tsx     # NEW: trend visualization
    └── ReviewApprovalModal.tsx     # NEW: approval UI
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Biomarker** | Measurable health indicator (e.g., HbA1c, Vitamin D) |
| **Client Tags** | Stored restrictions/preferences used for validation |
| **Food Tags** | Stored attributes of food items (allergens, nutrition) |
| **Lab Derived Tags** | Auto-generated tags from lab results |
| **Validation Engine** | Real-time service that checks food-client compatibility |
| **RAG** | Retrieval-Augmented Generation (AI + knowledge base) |
| **Severity** | RED (blocking), YELLOW (warning), GREEN (positive) |

---

*End of Technical Specification*
