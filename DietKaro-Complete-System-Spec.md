# DietKaro Complete System Specification

**Version:** 2.0 (Full Stack)  
**Date:** January 2026  
**Author:** DietKaro Engineering  
**Scope:** Client Mobile App + Dietitian Dashboard + Backend Services  

---

## Table of Contents

1. System Architecture Overview
2. Client-Side Onboarding Flow (Mobile App)
3. Dietitian-Side Diet Planning Flow (Dashboard)
4. Tag System & Validation Engine
5. RAG/AI Integration
6. Database Models
7. API Endpoints
8. Implementation Roadmap

---

# PART 1: SYSTEM ARCHITECTURE OVERVIEW

## 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          DietKaro Ecosystem                          │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐              ┌──────────────────────────┐
│   CLIENT MOBILE APP      │              │  DIETITIAN DASHBOARD     │
│  (React Native/Expo)     │              │  (Next.js Web App)       │
│                          │              │                          │
│ • Onboarding            │              │ • Client Management      │
│ • Medical Records       │              │ • Diet Plan Creation     │
│ • Food Preferences      │              │ • Real-time Validation   │
│ • Meal Logging          │              │ • Tag Review Queue       │
│ • Progress Tracking     │              │ • Reports & Analytics    │
└──────────────┬───────────┘              └──────────┬───────────────┘
               │                                     │
               │         Shared Backend APIs        │
               │                                     │
               └─────────────────┬───────────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │   Backend (Node.js/Express)     │
                │                                 │
                ├─ REST/GraphQL APIs             │
                ├─ Authentication (Clerk)         │
                ├─ File Upload Service            │
                ├─ Tag Generation Engine          │
                ├─ Validation Engine              │
                ├─ RAG/AI Services                │
                └─ Database Layer (Prisma)        │
                
               ┌───────────────────────────────────┐
               │     External Services             │
               │                                   │
               ├─ USDA FoodData API               │
               ├─ Open Food Facts API             │
               ├─ Gemini/Claude AI                │
               ├─ Vector DB (Pinecone/Chroma)     │
               ├─ PDF Processing                  │
               ├─ Image Processing                │
               └─ Email Service                    │
               
               ┌───────────────────────────────────┐
               │   Data Layer                      │
               │                                   │
               ├─ PostgreSQL (Main DB)            │
               ├─ Redis (Caching)                 │
               └─ S3 (File Storage)               │
```

## 1.2 Data Flow Overview

```
CLIENT JOURNEY:
1. Client downloads app & signs up
2. Client enters medical profile (onboarding)
3. Client uploads medical records (optional)
   └─ Backend: RAG extracts allergies → Stored as tags
4. Client sets dietary preferences & restrictions
5. Client data → Backend → Stored as CLIENT_TAGS
6. Dietitian invited → Views client profile in dashboard

DIETITIAN JOURNEY:
1. Dietitian logs in → Views client list
2. Selects client → Shows MEDICAL SUMMARY sidebar
3. Opens "Add Food Item" modal
4. Real-time validation: Food tags vs CLIENT_TAGS
5. Red borders = blocked, Yellow = warnings, Green = good match
6. Adds food to meal
```

---

# PART 2: CLIENT-SIDE ONBOARDING FLOW (Mobile App)

## 2.1 Onboarding Screens & Data Collection

### Screen 1: Basic Profile

**Captured Data:**
```json
{
  "fullName": "Gaurav Kumar",
  "dateOfBirth": "1979-01-15",
  "gender": "male",
  "phone": "+91-98765-43210",
  "heightCm": 178,
  "currentWeightKg": 92,
  "targetWeightKg": 82,
  "activityLevel": "moderate",
  "occupation": "homemaker",
  "referredBy": "BNI / Gaurav Kumar",
  "referrerDiscountCode": "BNI10"
}
```

**Technical Requirements:**
- Age/weight validation
- Image upload for profile photo
- Height/weight in metric (Indian standard)

---

### Screen 2: Medical History & Lab Reports

**Captured Data:**
```json
{
  "medicalHistory": {
    "conditions": ["belly_fat", "heart_pain", "pre_diabetes"],
    "pastDietHistory": "3 diet attempts: lost 8-10kg each, regained after 6-12 months",
    "currentMedications": [],
    "surgeries": [],
    "familyHistory": "diabetes on mother's side"
  },
  "labReports": {
    "tests": [
      {
        "name": "HbA1c",
        "value": 6.3,
        "unit": "%",
        "date": "2026-01-10",
        "referenceRange": "<5.7"
      },
      {
        "name": "Vitamin D",
        "value": 23.18,
        "unit": "ng/mL",
        "date": "2026-01-10",
        "referenceRange": "30-100"
      },
      {
        "name": "Vitamin B12",
        "value": 155,
        "unit": "pg/mL",
        "date": "2026-01-10",
        "referenceRange": "200-900"
      },
      {
        "name": "hs-CRP",
        "value": 4.1,
        "unit": "mg/L",
        "date": "2026-01-10",
        "referenceRange": "<3"
      }
    ]
  }
}
```

**UI Components:**
- Multi-select checkboxes for conditions
- Text input for medication names
- Lab value input (numeric)
- Date picker for lab date
- Reference range display for educational context

**Data Processing:**
- Validate lab ranges
- Auto-detect red flags (e.g., HbA1c > 6.5 = diabetic)
- Store raw values + derived risk tags

---

### Screen 3: Medical Records Upload

**Captured Data:**
```json
{
  "reports": [
    {
      "fileUrl": "s3://bucket/user_id/blood_test_2026_01.pdf",
      "fileName": "blood_test_2026_01.pdf",
      "fileType": "application/pdf",
      "uploadedAt": "2026-01-15T10:30:00Z",
      "extractedData": {
        "allergies": [],
        "intolerances": ["lactose"],  // RAG extracted
        "conditions": ["PCOS"],
        "medications": ["Metformin"],
        "confidenceScores": {
          "allergies": 0,
          "intolerances": 0.85,
          "conditions": 0.90,
          "medications": 0.95
        }
      }
    }
  ]
}
```

**Technical Implementation:**
- File upload to S3 with progress indicator
- Background job: RAG extraction (async)
- Show "Processing..." → "Extracted Data Ready for Review"
- Confidence scores shown to dietitian in review screen

**RAG Pipeline:**
```
User uploads PDF
    ↓
Backend job: Extract text (OCR) + structure with Gemini
    ↓
Parse into: [allergies, intolerances, conditions, medications]
    ↓
Score confidence per field
    ↓
Store in MedicalProfile.extractedReports
    ↓
Dietitian reviews + confirms
    ↓
Confirmed data → CLIENT_TAGS
```

---

### Screen 4: Dietary Preferences & Restrictions

**Captured Data:**
```json
{
  "dietPattern": "vegetarian_with_egg",  // Pure veg + egg allowed
  "eggRestrictions": {
    "allowed": true,
    "avoidDays": ["tuesday", "thursday"],
    "reason": "work_schedule"
  },
  "foodRestrictions": {
    "avoidFoods": [],
    "avoidCategories": ["fried_foods", "red_meat"],
    "preferrencesNotes": "prefer light breakfast, heavy lunch"
  },
  "religious": {
    "type": null,  // no specific restrictions
    "notes": ""
  },
  "medical": {
    "glutenSensitivity": false,
    "dairyIntolerance": false,
    "lactoseIntolerance": false,
    "notes": ""
  }
}
```

**UI Components:**
- Radio buttons: Veg / Non-veg / Vegan / Pescatarian
- If veg: Checkbox for "egg allowed"
- Day picker for egg restrictions (with reason)
- Multi-select for avoid categories
- Free-text for dietary notes

**Validation:**
- If vegan selected → egg automatically disabled
- If non-veg selected → all vegetarian restrictions grayed out

---

### Screen 5: Likes, Dislikes & Food Preferences

**Captured Data:**
```json
{
  "likes": {
    "foods": [
      "egg_roll",
      "chaap_roll",
      "dal_makhani",
      "paneer_tikka"
    ],
    "cuisines": ["indian", "mughlai"],
    "cookingMethods": ["grilled", "steamed"]
  },
  "dislikes": {
    "foods": ["bitter_gourd", "mushroom"],
    "flavors": ["very_spicy"],
    "textures": ["slippery"]
  },
  "mealTiming": {
    "breakfast": "6:00-7:00 AM",
    "lunch": "12:00-1:00 PM",
    "dinner": "7:30-8:00 PM",
    "snacks": "3:00 PM"
  },
  "activityPattern": {
    "weekday": "sedentary_office",
    "weekend": "early_morning_match"
  }
}
```

**UI Components:**
- Searchable multi-select for food items (auto-complete from database)
- Time picker for meal timings
- Activity pattern selector (sedentary, light, moderate, very active)

**Integration:**
- Sends food names to backend
- Backend finds matching FoodItems + retrieves their tags
- Stores preference links: `Client.likedFoods = [foodId, ...]`

---

### Screen 6: Body Measurements

**Captured Data:**
```json
{
  "measurements": {
    "upperArm": 12.5,        // inches
    "chest": 45,
    "waist": 39.5,
    "stomachAtNaval": 42,
    "belly2InchAbove": 41,
    "belly2InchBelow": 41,
    "hips": 41,
    "upperThigh": 24,
    "calf": 15,
    "measurementDate": "2026-01-15",
    "notes": "taken during morning fasting state"
  }
}
```

**UI Components:**
- Input fields for each measurement
- Unit selector (inches / cm)
- Photo upload for body measurements (optional)
- Notes field

**Storage:**
- Create `BodyMeasurement` record
- Calculate baseline for progress tracking

---

### Screen 7: Review & Submit

**UI:**
- Show summary of all entered data
- "Edit" buttons for each section
- Large "Confirm & Continue" button
- Privacy/terms acceptance checkbox

**Backend Processing:**
```
On submit:
1. Create Client record
2. Create MedicalProfile record
3. Create BodyMeasurement record
4. Create ClientPreferences record
5. Trigger RAG extraction job for uploaded documents
6. Generate initial CLIENT_TAGS from all inputs
7. Send notification to organization (dietitian review queue)
8. Return success screen
```

---

## 2.2 Client-Side Data Model (What Gets Stored)

### Database: Client Table

```prisma
model Client {
  id                    String      @id @default(cuid())
  orgId                 String
  primaryDietitianId    String
  
  // Basic Info
  email                 String      @unique
  phone                 String
  fullName              String
  dateOfBirth           DateTime
  gender                String
  profilePhotoUrl       String?
  
  // Physical
  heightCm              Decimal
  currentWeightKg       Decimal
  targetWeightKg        Decimal
  activityLevel         String      // sedentary, light, moderate, very_active
  
  // ╔════════════════════════════════════════════════╗
  // ║  CLIENT-LEVEL TAGS (Most Important!)          ║
  // ╚════════════════════════════════════════════════╝
  
  // What the client CAN'T eat
  allergies             String[]    @default([])      // ["shellfish", "sesame"]
  intolerances          String[]    @default([])      // ["lactose", "gluten"]
  
  // What the client WON'T eat
  dietPattern           String      // "vegetarian_with_egg"
  eggAvoidDays          String[]    @default([])      // ["tuesday", "thursday"]
  dislikes              String[]    @default([])      // ["bitter_gourd"]
  avoidCategories       String[]    @default([])      // ["fried_foods"]
  
  // Medical insights
  medicalConditions     String[]    @default([])      // ["pre_diabetes", "heart_pain"]
  labDerivedTags        String[]    @default([])      // ["vitamin_d_deficiency", "low_b12"]
  
  // What the client LIKES
  likedFoods            String[]    @default([])      // [foodId, foodId, ...]
  preferredCuisines     String[]    @default([])      // ["indian", "mughlai"]
  preferredCookMethods  String[]    @default([])      // ["grilled", "steamed"]
  
  // Context
  occupation            String?
  activityNotes         String?     // "Sat/Sun early morning match"
  referredBy            String?
  
  // Lifecycle
  onboardingCompleted   Boolean     @default(false)
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt
  
  // Relations
  medicalProfile        MedicalProfile?
  bodyMeasurements      BodyMeasurement[]
  dietPlans             DietPlan[]
  mealLogs              MealLog[]
  preferences           ClientPreferences?
  organization          Organization @relation(fields: [orgId], references: [id])
  primaryDietitian      User @relation(fields: [primaryDietitianId], references: [id])
}
```

### Database: MedicalProfile Table

```prisma
model MedicalProfile {
  id                    String      @id @default(cuid())
  clientId              String      @unique
  
  // Doctor-provided info
  diagnoses             String?     // Free text
  allergies             String[]    @default([])
  intolerances          String[]    @default([])
  medications           String?     // Free text or JSON
  supplements           String?
  surgeries             String?
  familyHistory         String?
  
  // Extracted from documents
  extractedReports      Json[]      // Array of extracted report data
  
  // Lab data (structured)
  labValues             Json        // {
                                    //   "hba1c": 6.3,
                                    //   "vitaminD": 23.18,
                                    //   "vitaminB12": 155,
                                    //   "hsCRP": 4.1
                                    // }
  
  // Derived flags (computed from labs)
  derivedRiskFlags      String[]    // ["pre_diabetes", "vitamin_d_deficiency"]
  
  // Medical notes
  healthNotes           String?
  dietaryRestrictions   String?
  
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt
  updatedByUserId       String?
  
  // Relation
  client                Client @relation(fields: [clientId], references: [id])
}
```

### Database: ClientPreferences Table

```prisma
model ClientPreferences {
  id                    String      @id @default(cuid())
  clientId              String      @unique
  
  // Food preferences
  likedFoods            String[]    @default([])      // Food IDs
  dislikedFoods         String[]    @default([])      // Food names/IDs
  preferredCuisines     String[]    @default([])
  
  // Meal timing
  breakfastTime         String      // "06:00"
  lunchTime             String      // "12:00"
  dinnerTime            String      // "19:30"
  snackTime             String?
  
  // Activity
  activityPattern       String      // "sedentary", "light", etc.
  sportOrHobby          String?     // "early_morning_match"
  
  // Cooking constraints
  canCook               Boolean     // Can client cook or needs ready meals?
  kitchenAvailable      Boolean
  dietaryCook           Boolean     // Is there a dietary cook at home?
  
  // Notes
  generalNotes          String?
  
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt
  
  // Relation
  client                Client @relation(fields: [clientId], references: [id])
}
```

---

# PART 3: DIETITIAN-SIDE DIET PLANNING FLOW (Dashboard)

## 3.1 Dashboard: Client List & Selection

**Screen: Client Management**

```
Left Sidebar:
├─ Search by client name
├─ Filter by status (Active, Pending, Completed)
└─ Sort by (Last Updated, New Clients)

Main Grid:
├─ Client Card
│  ├─ Profile Photo
│  ├─ Name, Age, Weight (current/goal)
│  ├─ Status badge (Onboarding, Active, Completed)
│  ├─ Last diet plan date
│  └─ "Open Profile" button
└─ New Client button
```

**Functionality:**
- Click "Open Profile" → Navigate to client detail
- "New Diet Plan" button → Start diet creation for this client

---

## 3.2 Dashboard: Client Profile View with Medical Summary Sidebar

**Left Sidebar: Medical Summary (Always Visible)**

```
┌─────────────────────────────────────┐
│  Client Profile Card                │
├─────────────────────────────────────┤
│  👤 Gaurav Kumar                    │
│  178cm, 92kg → 82kg (Goal)          │
│  Age: 47, Male, Homemaker           │
├─────────────────────────────────────┤
│  Medical Summary                    │
├─────────────────────────────────────┤
│                                     │
│  Allergies: None recorded ✓         │
│                                     │
│  Intolerances:                      │
│  • Lactose (YELLOW)                │
│                                     │
│  Conditions (Medical):              │
│  • Pre-diabetes (HbA1c 6.3%)        │
│  • Heart pain (symptom)             │
│  • Belly fat                        │
│                                     │
│  Lab Alerts:                        │
│  🔴 Vitamin D: 23.18 (low)          │
│  🔴 Vitamin B12: 155 (low)          │
│  🟡 hs-CRP: 4.1 (elevated)          │
│                                     │
│  Dietary Pattern:                   │
│  Pure Veg + Egg                     │
│  (Avoid Tue/Thu)                    │
│                                     │
│  Likes: Egg roll, Chaap roll        │
│  Dislikes: Bitter gourd             │
│                                     │
│  Activity: Sat/Sun morning match    │
│                                     │
│  Past Diet History:                 │
│  3 diets attempted, lost 8-10kg     │
│  each time, regained after 6-12mo   │
│                                     │
└─────────────────────────────────────┘
```

**Technical Implementation:**
- Query `Client` + `MedicalProfile` + `ClientPreferences`
- Display all CLIENT_TAGS in human-readable format
- Color-code alerts (red = critical, yellow = caution, green = ok)
- Always visible while dietitian plans

---

## 3.3 Diet Plan Creation: Modal for Adding Foods

**Screen: "Add Food Item to Breakfast (Jan 17, Saturday)"**

```
┌─────────────────────────────────────────────────────────┐
│ Add to Breakfast                               ✕        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [Search food database...                    ] ← Focus   │
│                                                         │
│ ┌────────────────────────────────────────────────────┐ │
│ │  Food Cards (3 column grid)                       │ │
│ │                                                    │ │
│ │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐│
│ │  │ BROWN RICE  │  │   EGG       │  │    OATS     ││
│ │  │ 🟢 ──────── │  │ 🟡 ──────── │  │ 🟢 ──────── ││
│ │  │ Food Item   │  │ Food Item   │  │ Food Item   ││
│ │  │             │  │             │  │             ││
│ │  │ Grains•100g │  │ Protein•1g  │  │ Grain•100g  ││
│ │  │ 199Kcal     │  │ 0Kcal       │  │ 133Kcal     ││
│ │  │ P:0 C:0 F:0 │  │ P:0 C:0 F:0 │  │ P:0.1 C:3.. ││
│ │  │             │  │             │  │             ││
│ │  │ [Green]     │  │ [Yellow]    │  │ [Green]     ││
│ │  │ Border      │  │ Border      │  │ Border      ││
│ │  └─────────────┘  └─────────────┘  └─────────────┘│
│ │                                                    │
│ │ [More results below...]                           │
│ └────────────────────────────────────────────────────┘
│                                                         │
│ ┌─ Validation Alerts ─────────────────────────────────┐│
│ │                                                     ││
│ │ 🟡 CAUTION: Client avoids EGGS on Tue/Thu         ││
│ │    Today is Saturday → Allowed                     ││
│ │    But client has cholesterol concern (heart)      ││
│ │    Recommendation: Limit to 2-3 eggs/week          ││
│ │                                                     ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│                         [Add Anyway] [Cancel]          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key Features:**

1. **Search & Filter**
   - Real-time search across food name, brand, category
   - Filter by: vegetarian, low-sugar, high-protein, etc.

2. **Food Card Color Coding**
   - 🟢 **GREEN border**: No conflicts, good match (e.g., high-protein for weight loss)
   - 🟡 **YELLOW border**: Warnings but allowed (e.g., high-sugar for diabetic)
   - 🔴 **RED border**: Blocked, cannot add (e.g., allergy, absolute restriction)

3. **Validation Alert Panel**
   - Shows reason for color coding
   - Multiple alerts possible (e.g., "allergy risk" + "day restriction")
   - Provides dietitian guidance/recommendation
   - RED alerts disable the "Add" button
   - YELLOW alerts show "Add Anyway" button (with confirmation)

4. **Real-time Validation Logic**
   - As dietitian types/hovers over food → API call to validation engine
   - Engine checks: `food_tags` vs `client_tags` + `current_day` + `meal_type`
   - Returns: severity + messages + blocking decision

---

## 3.4 Diet Plan View: Full Meal Breakdown

**Screen: "Create Diet Plan for Gaurav Kumar"**

```
┌─────────────────────────────────────────────────────────────┐
│ Diet Plan                                          ← Back   │
├────────────────────┬────────────────────────────────────────┤
│  Medical Summary   │  Plan Builder                          │
│  (Sidebar)         │                                        │
│                    │  Week: Jan 17 - Jan 23                │
│  🔴 Allergies: 0   │                                        │
│  🟡 Conditions: 2  │  ┌─ Jan 17 (Saturday) ──────────────┐ │
│  🟡 Lab Alerts: 3  │  │                                  │ │
│  ✓ Preferences     │  │ Breakfast (08:00 AM)       0Kcal │ │
│                    │  │                                  │ │
│  Likes:            │  │ ┌─ Add Food Item ────────────┐  │ │
│  • Egg roll        │  │ │ Brown Rice (100g)          │  │ │
│  • Chaap roll      │  │ │ 199 Kcal | P:0 C:0 F:0    │  │ │
│                    │  │ │                            │  │ │
│  Dislikes:         │  │ │ Egg (2x)                   │  │ │
│  • Bitter gourd    │  │ │ 0 Kcal | P:0 C:0 F:0      │  │ │
│                    │  │ │                            │  │ │
│  Pattern:          │  │ │ [+] Add More Foods         │  │ │
│  Veg + Egg         │  │ │ [×] Remove                 │  │ │
│  (Avoid Tue/Thu)   │  │ └────────────────────────────┘  │ │
│                    │  │                                  │ │
│                    │  │ Lunch (12:00 PM)          0Kcal │ │
│                    │  │ ├─ [+] Add Food Item             │ │
│                    │  │                                  │ │
│                    │  │ Dinner (07:30 PM)         0Kcal │ │
│                    │  │ ├─ [+] Add Food Item             │ │
│                    │  │                                  │ │
│                    │  └──────────────────────────────────┘ │
│                    │                                        │
│                    │  Daily Totals (Target: 300 Kcal)     │
│                    │  ├─ Calories: 199 / 300 Kcal         │
│                    │  ├─ Protein: 0 / 150g                │
│                    │  ├─ Carbs: 0 / 200g                  │
│                    │  └─ Fat: 0 / 70g                     │
│                    │                                        │
│                    │  [Save as Draft] [Publish] [Cancel]  │
│                    │                                        │
└────────────────────┴────────────────────────────────────────┘
```

**Features:**
- Drag-drop to reorder foods within meal
- Edit/remove each food item
- View nutrition breakdown per meal
- View daily totals vs targets
- Alert icons next to high-risk foods

---

## 3.5 Tag Review Queue (Dietitian Admin Task)

**Screen: "Food Tag Verification Queue"**

```
┌─────────────────────────────────────┐
│ Tag Review Queue (12 pending)       │
├─────────────────────────────────────┤
│                                     │
│ Priority: HIGH                      │
│ ├─ Godrej Real Bread               │
│ │  ├─ Issue: Low allergen conf.    │
│ │  ├─ Current: [wheat, soy]        │
│ │  ├─ Suggested: [wheat, soy,      │
│ │  │               sesame]          │
│ │  ├─ Confidence: 72%              │
│ │  └─ [Review] [Approve] [Reject]  │
│ │                                  │
│ │ Almonds (Unverified)             │
│ │ ├─ Issue: New food, manual       │
│ │ ├─ Allergens: [tree_nuts]        │
│ │ ├─ Confidence: 85%              │
│ │ └─ [Review] [Approve] [Reject]  │
│ │                                  │
│ Priority: MEDIUM                    │
│ ├─ Brown Rice (Needs recheck)      │
│ │ ...                               │
│ │                                  │
│ Priority: LOW                       │
│ ├─ Coconut Oil (Annual review)     │
│ │ ...                               │
│                                     │
└─────────────────────────────────────┘
```

**Workflow:**
1. Dietitian reviews food + suggested tags
2. Compares with package label / USDA data
3. Approves → Marks as verified (confidence 95%)
4. Requests changes → Updates tags + saves
5. Rejects → Removes from library / marks for escalation

---

# PART 4: TAG SYSTEM & VALIDATION ENGINE

## 4.1 Complete Tag Vocabulary

### 4.1.1 CLIENT-LEVEL TAGS (What we extract during onboarding)

```typescript
interface ClientTags {
  // HARD CONSTRAINTS (Red blocking)
  allergies: string[];              // ["shellfish", "sesame"]
  intolerances: string[];           // ["lactose", "gluten"]
  
  // DIETARY PATTERN (Red blocking)
  dietPattern: "vegetarian" | "vegan" | "non_veg" | "pescatarian";
  eggAllowed: boolean;
  eggAvoidDays: ("monday" | "tuesday" | ... )[];
  
  // SOFT CONSTRAINTS (Yellow warning)
  dislikes: string[];               // Food names
  avoidCategories: string[];        // ["fried_foods", "processed_meat"]
  
  // MEDICAL CONDITIONS (Yellow warning based on lab values)
  conditions: string[];             // ["pre_diabetes", "hypertension"]
  labDerivedTags: string[];         // ["vitamin_d_deficiency", "high_inflammation"]
  
  // POSITIVE NUDGES (Green info)
  likedFoods: string[];
  preferredCuisines: string[];
  
  // CONTEXT
  activityPattern: "sedentary" | "light" | "moderate" | "very_active";
  occupationalPattern: string;      // "office", "homemaker", etc.
}
```

### 4.1.2 FOOD-LEVEL TAGS (What we tag each FoodItem with)

```typescript
interface FoodItemTags {
  // Safety
  allergenFlags: string[];          // ["eggs", "milk", "sesame"]
  mayContainTraces: string[];       // ["tree_nuts", "peanuts"]
  
  // Dietary
  dietaryCategory: "vegan" | "vegetarian" | "veg_with_egg" | "non_veg";
  cuisineOrigin: string[];          // ["indian", "mughlai"]
  
  // Nutritional Characteristics
  nutritionTags: string[];          // ["high_protein", "low_carb", "high_sugar"]
  
  // Medical Relevance
  medicalFlags: string[];           // ["diabetic_caution", "heart_caution"]
  
  // Processing
  processingLevel: "raw" | "minimally_processed" | "processed" | "ultra_processed";
  
  // Meal Suitability
  mealSuitability: string[];        // ["good_for_breakfast", "too_heavy_for_night"]
  
  // Source & Confidence
  source: "usda" | "barcode" | "manual" | "ai";
  confidence: number;               // 0-100
}
```

---

## 4.2 Validation Rule Engine

### 4.2.1 RED (Blocking) Rules

```typescript
interface BlockingRules {
  
  // Rule 1: Hard Allergy
  if (client.allergies.includes(food.allergenFlags)) {
    return {
      severity: "RED",
      message: `⛔ ALLERGY: Client allergic to ${allergen}`,
      canAdd: false
    };
  }
  
  // Rule 2: Hard Intolerance
  if (client.intolerances.includes(food.allergenFlags)) {
    return {
      severity: "RED",
      message: `⛔ INTOLERANCE: Client intolerant to ${item}`,
      canAdd: false
    };
  }
  
  // Rule 3: Diet Pattern Violation
  if (client.dietPattern === "vegetarian" && food.dietaryCategory === "non_veg") {
    return {
      severity: "RED",
      message: `⛔ VEGETARIAN: Client doesn't eat meat/fish`,
      canAdd: false
    };
  }
  
  // Rule 4: Day-based Restriction
  if (client.eggAvoidDays.includes(TODAY) && food.allergenFlags.includes("eggs")) {
    return {
      severity: "RED",
      message: `⛔ DAY RESTRICTION: Client avoids eggs on ${TODAY}`,
      canAdd: false
    };
  }
  
  // Rule 5: Specific Food Ban
  if (client.dislikes.includes(food.name)) {
    // Check if dislike is STRONG (vs just preference)
    if (dislike.strength === "strong") {
      return {
        severity: "RED",
        message: `⛔ STRONG DISLIKE: Client dislikes ${food.name}`,
        canAdd: false
      };
    }
  }
}
```

### 4.2.2 YELLOW (Caution) Rules

```typescript
interface CautionRules {
  
  // Rule 1: Medical Condition Conflict
  if (client.conditions.includes("pre_diabetes") && 
      food.nutritionTags.includes("high_sugar")) {
    return {
      severity: "YELLOW",
      message: `🟡 DIABETES CAUTION: ${food.name} has high sugar (${food.sugarG}g)`,
      recommendation: "Consider lower-sugar alternative",
      canAdd: true
    };
  }
  
  // Rule 2: Lab-derived Warning
  if (client.labDerivedTags.includes("vitamin_d_deficiency") &&
      !food.medicalFlags.includes("vitamin_d_source")) {
    // Don't block, but nudge towards fortified foods
  }
  
  // Rule 3: Lab Value-based Warning (e.g., high cholesterol)
  if (client.medicalProfile.labValues.totalCholesterol > 200 &&
      food.nutritionTags.includes("high_saturated_fat")) {
    return {
      severity: "YELLOW",
      message: `🟡 CHOLESTEROL: ${food.name} is high in saturated fat`,
      recommendation: "Limit to 2-3 per week",
      canAdd: true
    };
  }
  
  // Rule 4: Soft Dislike
  if (client.dislikes.includes(food.name) && dislike.strength === "mild") {
    return {
      severity: "YELLOW",
      message: `🟡 MILD DISLIKE: Client prefers other options`,
      canAdd: true
    };
  }
  
  // Rule 5: Processing-related caution
  if (client.conditions.includes("pre_diabetes") &&
      food.processingLevel === "ultra_processed") {
    return {
      severity: "YELLOW",
      message: `🟡 ULTRA-PROCESSED: High GI, consider whole-grain alternative`,
      canAdd: true
    };
  }
  
  // Rule 6: Repetition Caution
  if (foodCountThisWeek > 4 && food === "eggs") {
    return {
      severity: "YELLOW",
      message: `🟡 REPETITION: Eggs used ${foodCountThisWeek} times this week`,
      recommendation: "Consider variety",
      canAdd: true
    };
  }
}
```

### 4.2.3 GREEN (Positive) Rules

```typescript
interface PositiveRules {
  
  // Rule 1: Liked Food
  if (client.likedFoods.includes(food.id)) {
    return {
      severity: "GREEN",
      message: `✅ CLIENT FAVORITE: Client likes ${food.name}`,
      icon: "heart"
    };
  }
  
  // Rule 2: Goal-aligned Food
  if (client.goal === "weight_loss" &&
      food.nutritionTags.includes("high_protein") &&
      food.nutritionTags.includes("low_calorie")) {
    return {
      severity: "GREEN",
      message: `✅ GOAL-ALIGNED: High protein, low calorie - good for weight loss`,
      icon: "target"
    };
  }
  
  // Rule 3: Nutrient-deficiency solution
  if (client.labDerivedTags.includes("vitamin_d_deficiency") &&
      food.medicalFlags.includes("vitamin_d_rich")) {
    return {
      severity: "GREEN",
      message: `✅ NUTRIENT MATCH: Good source of Vitamin D for client`,
      icon: "star"
    };
  }
  
  // Rule 4: Preferred Cuisine
  if (client.preferredCuisines.includes(food.cuisineOrigin)) {
    return {
      severity: "GREEN",
      message: `✅ PREFERRED CUISINE: Client likes ${food.cuisineOrigin}`,
      icon: "sparkle"
    };
  }
}
```

---

## 4.3 Validation Engine API

### Endpoint: POST `/api/diet-validation/check`

**Request:**
```json
{
  "clientId": "client_123",
  "foodId": "food_456",
  "context": {
    "currentDay": "saturday",
    "mealType": "breakfast",
    "daysOfWeekUsed": { "eggs": ["friday", "wednesday"] }
  }
}
```

**Response:**
```json
{
  "foodId": "food_456",
  "foodName": "Eggs",
  "severity": "YELLOW",
  "borderColor": "yellow",
  "canAdd": true,
  "alerts": [
    {
      "type": "medical",
      "message": "Client has heart issues - eggs have cholesterol",
      "recommendation": "Limit to 2-3 per week",
      "severity": "YELLOW"
    },
    {
      "type": "preference_match",
      "message": "Client LIKES egg roll",
      "severity": "GREEN"
    }
  ],
  "confidenceScore": 0.95
}
```

---

# PART 5: RAG/AI INTEGRATION

## 5.1 RAG Pipeline for Medical Document Extraction

### Flow Diagram

```
CLIENT UPLOADS MEDICAL REPORT
            ↓
    Extract Text (OCR)
            ↓
   Split into chunks (500 tokens)
            ↓
  Embed chunks (Gemini Embeddings)
            ↓
   Store in Vector DB (Pinecone)
            ↓
   Query with structured prompt
   (What are allergies, conditions, medications?)
            ↓
   LLM response → Parse JSON
            ↓
   Normalize to canonical terms
            ↓
   Score confidence per field
            ↓
   Store in MedicalProfile.extractedReports
            ↓
   Dietitian reviews in UI
            ↓
   Approve → Move to Client.allergies, conditions, etc.
```

### 5.2 RAG Service Implementation (Conceptual)

```typescript
interface RAGExtractionService {
  
  // Input: PDF/Image of medical report
  async extractMedicalData(
    fileUrl: string,
    fileType: "pdf" | "image"
  ): Promise<ExtractionResult>;
  
  // Output: Structured medical data
  type ExtractionResult = {
    allergies: { items: string[], confidence: number },
    intolerances: { items: string[], confidence: number },
    conditions: { items: string[], confidence: number },
    medications: { items: string[], confidence: number },
    labValues: { name: string, value: number, unit: string }[],
    rawText: string,  // For dietitian to verify
    extractionTime: number
  }
}

// Implementation
class MedicalDocRAG implements RAGExtractionService {
  
  private vectorStore: Pinecone;
  private llm: Gemini | Claude;
  
  async extractMedicalData(fileUrl: string): Promise<ExtractionResult> {
    
    // Step 1: OCR - Extract raw text
    const rawText = await this.ocr.extractText(fileUrl);
    
    // Step 2: Chunk document
    const chunks = this.chunk(rawText, 500);  // 500 token chunks
    
    // Step 3: Embed chunks (for context retrieval later)
    const embeddings = await this.embed(chunks);
    
    // Step 4: Store in vector DB for future reference
    await this.vectorStore.upsert(embeddings);
    
    // Step 5: Query LLM with structured prompt
    const systemPrompt = `
      You are a medical document analyzer.
      Extract the following from medical reports:
      1. Allergies (food and drug)
      2. Intolerances
      3. Medical conditions / diagnoses
      4. Current medications
      5. Lab values with normal ranges
      
      Be precise. If unsure, mark confidence < 80%.
      Return ONLY valid JSON.
    `;
    
    const userPrompt = `
      Extract medical data from this report:
      ${rawText}
      
      Return JSON:
      {
        "allergies": ["item1", "item2"],
        "allergyConfidence": 0.95,
        "intolerances": ["item1"],
        "intoleranceConfidence": 0.85,
        "conditions": ["diabetes", "heart_disease"],
        "conditionConfidence": 0.90,
        "medications": ["metformin"],
        "medicationConfidence": 0.95,
        "labValues": [
          {"name": "HbA1c", "value": 6.3, "unit": "%"}
        ]
      }
    `;
    
    const response = await this.llm.generate({
      system: systemPrompt,
      user: userPrompt
    });
    
    // Step 6: Parse & validate JSON
    const extracted = JSON.parse(response);
    
    // Step 7: Normalize to canonical terms
    const normalized = {
      allergies: this.normalizeAllergens(extracted.allergies),
      intolerances: this.normalizeIntolerances(extracted.intolerances),
      conditions: this.normalizeConditions(extracted.conditions),
      medications: this.normalizeMedications(extracted.medications),
      labValues: extracted.labValues
    };
    
    return {
      ...normalized,
      confidence: {
        allergies: extracted.allergyConfidence,
        intolerances: extracted.intoleranceConfidence,
        conditions: extracted.conditionConfidence,
        medications: extracted.medicationConfidence
      },
      rawText,
      extractionTime: Date.now()
    };
  }
  
  private normalizeAllergens(items: string[]): string[] {
    // Map common names to canonical allergen names
    const mapping = {
      "peanut": "peanuts",
      "groundnut": "peanuts",
      "shellfish": "crustacean_shellfish",
      "shrimp": "crustacean_shellfish",
      "milk allergy": "milk",
      "dairy": "milk",
      ...
    };
    
    return items.map(item => 
      mapping[item.toLowerCase()] || item.toLowerCase()
    );
  }
  
  // Similar methods for normalize*
}
```

---

## 5.3 Medical Document Review Screen (Dietitian)

**Screen: "Review Extracted Medical Data"**

```
┌─────────────────────────────────────────────────────────┐
│ Review Medical Extract                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Document: blood_test_2026_01.pdf                       │
│ Extracted: 2 min ago                                   │
│                                                         │
│ ┌─── ALLERGIES ──────────────────────────────────────┐ │
│ │ Confidence: 95%                                    │ │
│ │ Extracted: []                                      │ │
│ │ Status: ✓ No allergies detected                    │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─── INTOLERANCES ───────────────────────────────────┐ │
│ │ Confidence: 85%                                    │ │
│ │ Extracted: [lactose]                               │ │
│ │ Review: ☑ Lactose intolerance found               │ │
│ │ Notes: "Patient reports bloating after dairy"     │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─── CONDITIONS ──────────────────────────────────────┐ │
│ │ Confidence: 90%                                    │ │
│ │ Extracted: [PCOS, hypertension]                    │ │
│ │ Review: ☑ PCOS                                     │ │
│ │         ☑ Hypertension                             │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─── LAB VALUES ──────────────────────────────────────┐ │
│ │ HbA1c: 6.3% (Ref: <5.7%) → PRE-DIABETES ⚠️         │ │
│ │ Vitamin D: 23.18 ng/mL (Ref: 30-100) → LOW 🔴     │ │
│ │ B12: 155 pg/mL (Ref: 200-900) → LOW 🔴            │ │
│ │ hs-CRP: 4.1 mg/L (Ref: <3) → ELEVATED 🟡          │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
│ [✓ Approve & Save to Profile]  [Edit] [Reject]       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

# PART 6: DATABASE MODELS (Complete Schema)

## 6.1 Core Tables

```prisma
// Already defined: Client, MedicalProfile, ClientPreferences

model FoodItem {
  id                 String   @id @default(cuid())
  orgId              String?
  
  // Basic Info
  name               String
  brand              String?
  barcode            String?  @unique
  category           String
  subCategory        String?
  
  // Nutrition (per 100g)
  servingSizeG       Decimal  @default(100)
  calories           Int
  proteinG           Decimal
  carbsG             Decimal
  fatsG              Decimal
  fiberG             Decimal
  sodiumMg           Decimal
  sugarG             Decimal
  
  // TAGS
  allergenFlags      String[] @default([])
  dietaryTags        String[] @default([])
  nutritionTags      String[] @default([])
  healthFlags        String[] @default([])
  cuisineTags        String[] @default([])
  processingTags     String[] @default([])
  mealSuitabilityTags String[] @default([])
  
  // Metadata
  isVerified         Boolean  @default(false)
  source             String   // "manual" | "barcode" | "usda" | "ai"
  confidence         Int      @default(0)
  verifiedByUserId   String?
  verifiedAt         DateTime?
  lastUpdated        DateTime @updatedAt
  requiresReviewAt   DateTime?
  
  createdByUserId    String?
  createdAt          DateTime @default(now())
  
  // Relations
  mealFoodItems      MealFoodItem[]
  organization       Organization? @relation(fields: [orgId], references: [id])
  
  @@index([orgId])
  @@index([category])
  @@index([isVerified])
}

model DietPlan {
  id                 String   @id @default(cuid())
  orgId              String
  clientId           String
  createdByUserId    String
  
  // Plan info
  name               String
  description        String?
  startDate          DateTime
  endDate            DateTime?
  
  // Targets
  targetCalories     Int?
  targetProteinG     Decimal?
  targetCarbsG       Decimal?
  targetFatsG        Decimal?
  targetFiberG       Decimal?
  
  // Status
  status             String   // "draft", "active", "completed", "paused"
  isTemplate         Boolean  @default(false)
  visibility         String   // "private", "orgshared", "public"
  publishedAt        DateTime?
  
  // Notes
  notesForClient     String?
  internalNotes      String?
  
  // Timestamps
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  deletedAt          DateTime?
  
  // Relations
  meals              Meal[]
  mealLogs           MealLog[]
  client             Client @relation(fields: [clientId], references: [id])
  organization       Organization @relation(fields: [orgId], references: [id])
  createdBy          User @relation(fields: [createdByUserId], references: [id])
  
  @@index([clientId])
  @@index([status])
}

model Meal {
  id                 String   @id @default(cuid())
  planId             String
  
  // Timing
  dayOfWeek          Int?     // 0-6 (Monday = 0)
  mealDate           DateTime?
  sequenceNumber     Int?     // 1st meal, 2nd meal, etc.
  
  // Type
  mealType           String   // "breakfast", "lunch", "dinner", "snack"
  timeOfDay          String?  // "08:00 AM"
  name               String
  description        String?
  instructions       String?
  
  // Nutrition
  totalCalories      Int?
  totalProteinG      Decimal?
  totalCarbsG        Decimal?
  totalFatsG         Decimal?
  totalFiberG        Decimal?
  servingSizeNotes   String?
  
  // Timestamps
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  
  // Relations
  foodItems          MealFoodItem[]
  mealLogs           MealLog[]
  dietPlan           DietPlan @relation(fields: [planId], references: [id])
  
  @@index([planId])
  @@index([mealDate])
}

model MealFoodItem {
  id                 String   @id @default(cuid())
  mealId             String
  foodId             String
  
  // Quantity
  quantityG          Decimal
  
  // Calculated nutrition
  calories           Int?
  proteinG           Decimal?
  carbsG             Decimal?
  fatsG              Decimal?
  fiberG             Decimal?
  
  // Order
  sortOrder          Int      @default(0)
  notes              String?  // e.g., validation alerts
  
  // Timestamps
  createdAt          DateTime @default(now())
  
  // Relations
  meal               Meal @relation(fields: [mealId], references: [id])
  foodItem           FoodItem @relation(fields: [foodId], references: [id])
  
  @@unique([mealId, foodId, sortOrder])
}

model BodyMeasurement {
  id                 String   @id @default(cuid())
  clientId           String
  
  // Measurements
  logDate            DateTime
  upperArmCm         Decimal?
  chestCm            Decimal?
  waistCm            Decimal?
  hipsCm             Decimal?
  thighsCm           Decimal?
  calfCm             Decimal?
  bodyFatPercentage  Decimal?
  
  notes              String?
  
  createdAt          DateTime @default(now())
  
  client             Client @relation(fields: [clientId], references: [id])
  
  @@index([clientId])
  @@index([logDate])
}

model MealLog {
  id                 String   @id @default(cuid())
  clientId           String
  mealId             String
  
  // When it was supposed to be eaten
  scheduledDate      DateTime
  scheduledTime      String?
  
  // What happened
  status             String   // "pending", "eaten", "skipped", "substituted"
  
  // Evidence
  mealPhotoUrl       String?
  photoUploadedAt    DateTime?
  
  // AI Recognition
  aiFoodRecognition  Json?    // { confidence: 0.8, detectedFoods: [...] }
  
  // Feedback
  clientNotes        String?
  dietitianFeedback  String?
  dietitianFeedbackAt DateTime?
  reviewedByUserId   String?
  
  // Substitution tracking
  substituteDescription String?
  substituteCaloriesEst Int?
  
  // Timestamps
  loggedAt           DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  
  // Relations
  client             Client @relation(fields: [clientId], references: [id])
  meal               Meal @relation(fields: [mealId], references: [id])
  reviewedBy         User? @relation(fields: [reviewedByUserId], references: [id])
  
  @@index([clientId])
  @@index([status])
  @@index([scheduledDate])
}
```

---

# PART 7: API ENDPOINTS

## 7.1 Client-Side APIs (Mobile App)

### Authentication
```
POST   /api/auth/register          - Register new client
POST   /api/auth/login              - Login with email/password
POST   /api/auth/logout             - Logout
GET    /api/auth/me                 - Get current user profile
```

### Onboarding
```
POST   /api/onboarding/step1        - Save basic profile
POST   /api/onboarding/step2        - Save medical history
POST   /api/onboarding/step3        - Upload medical documents
POST   /api/onboarding/step4        - Set dietary preferences
POST   /api/onboarding/step5        - Set food likes/dislikes
POST   /api/onboarding/step6        - Save body measurements
POST   /api/onboarding/complete     - Mark onboarding done
GET    /api/onboarding/progress     - Get onboarding progress
```

### Client Profile
```
GET    /api/client/profile          - Get own profile + medical summary
PUT    /api/client/profile          - Update profile
GET    /api/client/medical-summary  - Get medical summary (for sidebar)
```

### Medical Records
```
POST   /api/medical-records/upload  - Upload medical document
GET    /api/medical-records         - List uploaded records
DELETE /api/medical-records/:id     - Delete record
```

### Meal Logging (Client)
```
GET    /api/meals/today             - Get today's meal plan
POST   /api/meal-logs               - Log a meal
PUT    /api/meal-logs/:id           - Update meal log
POST   /api/meal-logs/:id/photo     - Upload meal photo
GET    /api/progress/weight         - Get weight progress
POST   /api/progress/weight         - Log weight
```

---

## 7.2 Dietitian-Side APIs (Dashboard)

### Client Management
```
GET    /api/dietitian/clients       - List all clients
GET    /api/dietitian/clients/:id   - Get client detail + medical summary
POST   /api/dietitian/clients       - Add new client (manual)
PUT    /api/dietitian/clients/:id   - Update client profile
```

### Diet Planning
```
POST   /api/diet-plans              - Create new diet plan
GET    /api/diet-plans/:id          - Get diet plan detail
PUT    /api/diet-plans/:id          - Update diet plan
DELETE /api/diet-plans/:id          - Delete diet plan
POST   /api/diet-plans/:id/publish  - Publish to client
```

### Meals
```
POST   /api/meals                   - Add meal to plan
PUT    /api/meals/:id               - Update meal
DELETE /api/meals/:id               - Delete meal
POST   /api/meal-foods              - Add food item to meal
```

### Real-Time Validation
```
POST   /api/diet-validation/check   - Check food vs client
GET    /api/diet-validation/alerts  - Get all alerts for client
```

### Food Management
```
GET    /api/foods                   - Search food database
GET    /api/foods/:id               - Get food detail + tags
POST   /api/foods                   - Create new food item
PUT    /api/foods/:id               - Update food item
GET    /api/foods/tag-review-queue  - Get foods needing verification
POST   /api/foods/:id/verify        - Verify food tags
```

### Reports & Analytics
```
GET    /api/reports/client/:id      - Get client progress report
GET    /api/reports/compliance      - Get diet compliance metrics
GET    /api/reports/trending-foods  - Which foods are most used
```

---

# PART 8: IMPLEMENTATION ROADMAP

## Phase 1: Foundation (Week 1-2)

### Backend Setup
- [ ] Database: Prisma schema setup
- [ ] Authentication: Clerk integration
- [ ] File Upload: S3 setup
- [ ] USDA API: Integration & caching
- [ ] Tag Generation: Basic algorithms
- [ ] Validation Engine: Rule matrix implementation

### Frontend (Mobile)
- [ ] Auth screens: Login/Register
- [ ] Onboarding screens 1-3: Profile, Medical History, Document Upload
- [ ] Basic styling & navigation

### Frontend (Dashboard)
- [ ] Auth screens
- [ ] Client list page
- [ ] Client detail page (sidebar + basic info)

---

## Phase 2: Core Features (Week 3-4)

### Backend
- [ ] Complete food tagging pipeline (USDA + Manual)
- [ ] RAG service for medical document extraction
- [ ] Validation engine API (`POST /api/diet-validation/check`)
- [ ] Food search endpoint

### Frontend (Mobile)
- [ ] Complete onboarding (screens 4-7)
- [ ] Medical record upload with extraction review
- [ ] Profile management

### Frontend (Dashboard)
- [ ] Diet plan creation page
- [ ] "Add Food Item" modal with real-time validation
- [ ] Color-coded food cards (RED/YELLOW/GREEN)
- [ ] Medical summary sidebar

---

## Phase 3: Refinement (Week 5-6)

### Backend
- [ ] Tag verification queue system
- [ ] Dietitian review endpoints
- [ ] Tag accuracy metrics
- [ ] Caching optimization

### Frontend (Mobile)
- [ ] Meal logging
- [ ] Progress tracking
- [ ] Notifications

### Frontend (Dashboard)
- [ ] Tag review queue UI
- [ ] Batch food upload
- [ ] Template diet plans
- [ ] Reports & analytics

---

## Phase 4: Polish & Launch (Week 7+)

- [ ] Performance optimization
- [ ] Security audit
- [ ] User testing
- [ ] Mobile app store submission
- [ ] Production deployment
- [ ] Monitoring & alerting
- [ ] Indian food database expansion

---

## Success Metrics

**Client Side:**
- Onboarding completion rate: >85%
- Time to complete onboarding: <10 minutes
- Medical document extraction accuracy: >90%

**Dietitian Side:**
- False positive alerts (red): <2%
- False negative alerts (missed allergies): <0.1%
- Tag verification turnaround: <24 hours
- Diet plan creation time: <15 minutes per client

**Data Quality:**
- Food tag coverage: >95%
- Tag confidence average: >85%
- Validation engine accuracy: >95%

---

**Document Status:** COMPLETE  
**Last Updated:** January 17, 2026  
**Ready for:** Development Sprint Planning
