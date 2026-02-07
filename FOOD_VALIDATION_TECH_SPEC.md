# Food Validation System - Technical Implementation Specification

**Version:** 1.0  
**Date:** February 1, 2026  
**Project:** DietKaro  
**Status:** Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Database Schema](#3-database-schema)
4. [Backend Implementation](#4-backend-implementation)
5. [API Contracts](#5-api-contracts)
6. [Frontend Implementation](#6-frontend-implementation)
7. [Testing Strategy](#7-testing-strategy)
8. [Deployment Plan](#8-deployment-plan)
9. [Implementation Phases](#9-implementation-phases)

---

## 1. Executive Summary

### Purpose
Implement a real-time food validation system that prevents dietitians from adding unsafe or unsuitable foods to client meal plans by checking against allergies, dietary restrictions, medical conditions, and preferences.

### Core Components
- **ValidationService** - Core business logic for rule evaluation
- **Validation API** - RESTful endpoints for single/bulk validation
- **UI Components** - Visual feedback system with color-coded alerts
- **Auto-tagging Pipeline** - Automated tag generation from nutrition data

### Success Criteria
- ✅ Block all foods matching client allergies (100% prevention)
- ✅ Warn on foods conflicting with medical conditions
- ✅ Provide clear, actionable feedback to dietitians
- ✅ Validate in <200ms for individual foods, <1s for bulk operations

---

## 2. System Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────┤
│  AddFoodModal → ValidationDisplay → ValidationAlerts        │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP REST
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  API LAYER (Express)                        │
├─────────────────────────────────────────────────────────────┤
│  POST /api/validation/single                                │
│  POST /api/validation/bulk                                  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              BUSINESS LOGIC (Services)                      │
├─────────────────────────────────────────────────────────────┤
│  ValidationService                                          │
│  ├── validateFood()                                         │
│  ├── validateFoodsBulk()                                    │
│  ├── checkAllergyRules()                                    │
│  ├── checkDietPatternRules()                                │
│  ├── checkMedicalRules()                                    │
│  └── determineSeverity()                                    │
│                                                              │
│  FoodTaggingService (existing)                              │
│  ├── deriveNutritionTags()                                  │
│  └── deriveHealthFlags()                                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 DATA LAYER (Prisma ORM)                     │
├─────────────────────────────────────────────────────────────┤
│  Client (with validation tags)                              │
│  FoodItem (with safety/nutrition tags)                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

**Single Food Validation:**
```
1. Dietitian searches food in modal
2. Frontend calls GET /api/validation/single?clientId=X&foodId=Y&mealType=breakfast
3. ValidationService:
   a. Fetch Client and FoodItem from DB
   b. Run rule checks (allergy → diet → medical → preferences)
   c. Aggregate messages and determine severity
4. API returns { severity, blocked, messages[], allowed }
5. Frontend displays color-coded border and alert panel
```

**Bulk Validation (optimized):**
```
1. Frontend sends POST /api/validation/bulk with { clientId, foodIds[], mealType, date }
2. Service fetches client once
3. Parallel validation of all foods
4. Returns array of validation results
5. Frontend caches results for quick display
```

---

## 3. Database Schema

### 3.1 Existing Schema (Already Implemented ✅)

**Client Model** - Located in `backend/prisma/schema.prisma`

```prisma
model Client {
  // ... existing fields
  
  // Hard Constraints (RED blocking)
  allergies         String[]  @default([])
  dietPattern       String?   // "vegetarian" | "vegan" | "non_veg" | "pescatarian"
  
  // Soft Constraints (YELLOW warnings)
  intolerances      String[]  @default([])
  eggAllowed        Boolean   @default(true)
  eggAvoidDays      String[]  @default([])  // ["tuesday", "saturday"]
  dislikes          String[]  @default([])
  avoidCategories   String[]  @default([])
  labDerivedTags    String[]  @default([])  // ["pre_diabetes", "vitamin_d_deficiency"]
  medicalConditions String[]  @default([])  // ["PCOS", "thyroid"]
  
  // Preferences (GREEN positive)
  likedFoods        String[]  @default([])
  preferredCuisines String[]  @default([])
}
```

**FoodItem Model**

```prisma
model FoodItem {
  // ... existing fields
  
  // Safety Tags
  allergenFlags        String[]  @default([])  // ["contains_peanuts", "contains_dairy"]
  dietaryCategory      String?                  // "vegan" | "vegetarian" | "veg_with_egg" | "non_veg"
  
  // Health & Nutrition Tags
  healthFlags          String[]  @default([])  // ["diabetic_caution", "heart_caution"]
  nutritionTags        String[]  @default([])  // ["high_sugar", "high_protein", "low_carb"]
  
  // Suitability Tags
  cuisineTags          String[]  @default([])  // ["indian", "mughlai"]
  mealSuitabilityTags  String[]  @default([])  // ["good_for_breakfast", "too_heavy_for_night"]
  processingLevel      String?                  // "raw" | "minimally_processed" | "ultra_processed"
  
  // Nutrition fields for auto-tagging
  sugarG      Float?
  proteinG    Float?
  carbsG      Float?
  fatsG       Float?
  sodiumMg    Float?
}
```

### 3.2 Tag Mappings Reference

**Allergen Mapping:**
```typescript
const ALLERGEN_MAPPING = {
  'peanuts': 'contains_peanuts',
  'tree_nuts': 'contains_tree_nuts',
  'dairy': 'contains_dairy',
  'eggs': 'contains_eggs',
  'wheat': 'contains_wheat',
  'soy': 'contains_soy',
  'fish': 'contains_fish',
  'shellfish': 'contains_shellfish',
  'sesame': 'contains_sesame',
  'mustard': 'contains_mustard',
  'celery': 'contains_celery',
  'sulphites': 'contains_sulphites',
};
```

**Diet Pattern Conflicts:**
```typescript
const DIET_CONFLICTS = {
  'vegan': ['non_veg', 'vegetarian', 'veg_with_egg'],
  'vegetarian': ['non_veg'],
  'vegetarian_with_egg': ['non_veg'],
  'pescatarian': ['non_veg'], // except fish
};
```

---

## 4. Backend Implementation

### 4.1 File Structure

```
backend/src/
├── services/
│   ├── validation.service.ts          [NEW]
│   └── foodTagging.service.ts         [EXISTS]
├── controllers/
│   └── validation.controller.ts       [NEW]
├── routes/
│   └── validation.routes.ts           [NEW]
├── types/
│   └── validation.types.ts            [NEW]
└── utils/
    └── validation-rules.ts            [NEW]
```

### 4.2 Core Types

**File:** `backend/src/types/validation.types.ts`

```typescript
export enum ValidationSeverity {
  RED = 'RED',
  YELLOW = 'YELLOW',
  GREEN = 'GREEN',
}

export enum ValidationMessageType {
  ALLERGY_ALERT = 'ALLERGY_ALERT',
  DIET_CONFLICT = 'DIET_CONFLICT',
  DAY_RESTRICTION = 'DAY_RESTRICTION',
  INTOLERANCE = 'INTOLERANCE',
  HEALTH_CAUTION = 'HEALTH_CAUTION',
  FOOD_DISLIKE = 'FOOD_DISLIKE',
  CATEGORY_AVOIDANCE = 'CATEGORY_AVOIDANCE',
  MEAL_SUITABILITY = 'MEAL_SUITABILITY',
  PREFERENCE_MATCH = 'PREFERENCE_MATCH',
}

export interface ValidationMessage {
  type: ValidationMessageType;
  severity: ValidationSeverity;
  title: string;
  message: string;
  details?: string;
  recommendation?: string;
}

export interface ValidationResult {
  foodId: string;
  severity: ValidationSeverity;
  blocked: boolean;
  allowed: boolean;
  messages: ValidationMessage[];
}

export interface ValidationContext {
  clientId: string;
  foodId: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  date?: Date;
}
```

### 4.3 Validation Service

**File:** `backend/src/services/validation.service.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import {
  ValidationResult,
  ValidationMessage,
  ValidationSeverity,
  ValidationMessageType,
  ValidationContext,
} from '../types/validation.types';
import {
  ALLERGEN_MAPPING,
  DIET_CONFLICTS,
  INTOLERANCE_MAPPING,
  MEDICAL_FLAG_MAPPING,
} from '../utils/validation-rules';

const prisma = new PrismaClient();

export class ValidationService {
  /**
   * Validate a single food against client profile
   */
  async validateFood(context: ValidationContext): Promise<ValidationResult> {
    const { clientId, foodId, mealType, date = new Date() } = context;

    // Fetch data
    const [client, food] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId } }),
      prisma.foodItem.findUnique({ where: { id: foodId } }),
    ]);

    if (!client || !food) {
      throw new Error('Client or Food not found');
    }

    const messages: ValidationMessage[] = [];
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // RULE 1: Allergy Check (RED - BLOCKING)
    this.checkAllergies(client, food, messages);

    // RULE 2: Diet Pattern Check (RED - BLOCKING)
    this.checkDietPattern(client, food, messages);

    // RULE 3: Egg Day Restriction (RED - BLOCKING)
    this.checkEggRestriction(client, food, dayOfWeek, messages);

    // RULE 4: Intolerance Check (YELLOW - WARNING)
    this.checkIntolerances(client, food, messages);

    // RULE 5: Medical Flags (YELLOW - WARNING)
    this.checkMedicalFlags(client, food, messages);

    // RULE 6: Dislikes (YELLOW - WARNING)
    this.checkDislikes(client, food, messages);

    // RULE 7: Category Avoidance (YELLOW - WARNING)
    this.checkCategoryAvoidance(client, food, messages);

    // RULE 8: Meal Suitability (YELLOW - INFO)
    if (mealType) {
      this.checkMealSuitability(food, mealType, messages);
    }

    // RULE 9: Preference Match (GREEN - POSITIVE)
    this.checkPreferences(client, food, messages);

    // Determine final severity and blocked status
    const severity = this.determineSeverity(messages);
    const blocked = messages.some(m => m.severity === ValidationSeverity.RED);

    return {
      foodId,
      severity,
      blocked,
      allowed: !blocked,
      messages,
    };
  }

  /**
   * Validate multiple foods (optimized bulk operation)
   */
  async validateFoodsBulk(
    clientId: string,
    foodIds: string[],
    mealType?: string,
    date?: Date
  ): Promise<ValidationResult[]> {
    const results = await Promise.all(
      foodIds.map(foodId =>
        this.validateFood({ clientId, foodId, mealType, date })
      )
    );
    return results;
  }

  // RULE IMPLEMENTATIONS

  private checkAllergies(client: any, food: any, messages: ValidationMessage[]): void {
    if (!client.allergies || client.allergies.length === 0) return;

    for (const allergen of client.allergies) {
      const allergenFlag = ALLERGEN_MAPPING[allergen];
      if (allergenFlag && food.allergenFlags.includes(allergenFlag)) {
        messages.push({
          type: ValidationMessageType.ALLERGY_ALERT,
          severity: ValidationSeverity.RED,
          title: '⛔ ALLERGY ALERT',
          message: `This food contains ${allergen}.`,
          details: `Client has a ${allergen} allergy.`,
          recommendation: 'This food cannot be added to the meal plan.',
        });
      }
    }
  }

  private checkDietPattern(client: any, food: any, messages: ValidationMessage[]): void {
    if (!client.dietPattern || !food.dietaryCategory) return;

    const conflicts = DIET_CONFLICTS[client.dietPattern] || [];
    if (conflicts.includes(food.dietaryCategory)) {
      messages.push({
        type: ValidationMessageType.DIET_CONFLICT,
        severity: ValidationSeverity.RED,
        title: '⛔ DIET CONFLICT',
        message: `This is a ${food.dietaryCategory} food.`,
        details: `Client follows a ${client.dietPattern} diet.`,
        recommendation: 'This food cannot be added.',
      });
    }
  }

  private checkEggRestriction(
    client: any,
    food: any,
    dayOfWeek: string,
    messages: ValidationMessage[]
  ): void {
    if (!client.eggAvoidDays || client.eggAvoidDays.length === 0) return;

    const isEggFood =
      food.dietaryCategory === 'veg_with_egg' ||
      food.name.toLowerCase().includes('egg') ||
      food.allergenFlags.includes('contains_eggs');

    if (isEggFood && client.eggAvoidDays.includes(dayOfWeek)) {
      messages.push({
        type: ValidationMessageType.DAY_RESTRICTION,
        severity: ValidationSeverity.RED,
        title: '⛔ DAY RESTRICTION',
        message: `Client avoids eggs on ${dayOfWeek}.`,
        details: `Today is ${dayOfWeek}.`,
        recommendation: 'Choose a non-egg alternative.',
      });
    }
  }

  private checkIntolerances(client: any, food: any, messages: ValidationMessage[]): void {
    if (!client.intolerances || client.intolerances.length === 0) return;

    for (const intolerance of client.intolerances) {
      const checkFlags = INTOLERANCE_MAPPING[intolerance] || [];
      const hasMatch = checkFlags.some(flag =>
        food.allergenFlags.includes(flag) || food.nutritionTags.includes(flag)
      );

      if (hasMatch) {
        messages.push({
          type: ValidationMessageType.INTOLERANCE,
          severity: ValidationSeverity.YELLOW,
          title: '⚠️ INTOLERANCE',
          message: `This food may contain ${intolerance}.`,
          details: `Client has ${intolerance} intolerance.`,
          recommendation: 'Consider alternatives or limit portion size.',
        });
      }
    }
  }

  private checkMedicalFlags(client: any, food: any, messages: ValidationMessage[]): void {
    const allConditions = [...(client.labDerivedTags || []), ...(client.medicalConditions || [])];

    for (const condition of allConditions) {
      const flags = MEDICAL_FLAG_MAPPING[condition] || [];
      const hasMatch = flags.some(flag => food.healthFlags.includes(flag));

      if (hasMatch) {
        messages.push({
          type: ValidationMessageType.HEALTH_CAUTION,
          severity: ValidationSeverity.YELLOW,
          title: '⚠️ HEALTH CAUTION',
          message: `This food may not be ideal for ${condition}.`,
          recommendation: 'Consider portion control or alternatives.',
        });
      }
    }
  }

  private checkDislikes(client: any, food: any, messages: ValidationMessage[]): void {
    if (!client.dislikes || client.dislikes.length === 0) return;

    const isDisliked = client.dislikes.some((dislike: string) =>
      food.name.toLowerCase().includes(dislike.toLowerCase())
    );

    if (isDisliked) {
      messages.push({
        type: ValidationMessageType.FOOD_DISLIKE,
        severity: ValidationSeverity.YELLOW,
        title: '⚠️ PREFERENCE',
        message: 'Client has indicated they dislike this food.',
        recommendation: 'Consider alternatives client prefers.',
      });
    }
  }

  private checkCategoryAvoidance(client: any, food: any, messages: ValidationMessage[]): void {
    if (!client.avoidCategories || client.avoidCategories.length === 0) return;

    const isAvoided = client.avoidCategories.some((cat: string) =>
      food.category?.toLowerCase().includes(cat.toLowerCase())
    );

    if (isAvoided) {
      messages.push({
        type: ValidationMessageType.CATEGORY_AVOIDANCE,
        severity: ValidationSeverity.YELLOW,
        title: '⚠️ AVOID CATEGORY',
        message: `Client prefers to avoid ${food.category} foods.`,
      });
    }
  }

  private checkMealSuitability(food: any, mealType: string, messages: ValidationMessage[]): void {
    if (!food.mealSuitabilityTags || food.mealSuitabilityTags.length === 0) return;

    // Example: too_heavy_for_night + dinner = conflict
    const conflicts = {
      dinner: ['too_heavy_for_night'],
      breakfast: ['too_heavy_for_breakfast'],
    };

    const conflictTags = conflicts[mealType] || [];
    const hasConflict = conflictTags.some(tag => food.mealSuitabilityTags.includes(tag));

    if (hasConflict) {
      messages.push({
        type: ValidationMessageType.MEAL_SUITABILITY,
        severity: ValidationSeverity.YELLOW,
        title: 'ℹ️ MEAL TIMING',
        message: `This food may not be ideal for ${mealType}.`,
      });
    }
  }

  private checkPreferences(client: any, food: any, messages: ValidationMessage[]): void {
    const isLiked = client.likedFoods?.includes(food.id);
    const cuisineMatch = client.preferredCuisines?.some((cuisine: string) =>
      food.cuisineTags?.includes(cuisine)
    );

    if (isLiked) {
      messages.push({
        type: ValidationMessageType.PREFERENCE_MATCH,
        severity: ValidationSeverity.GREEN,
        title: '✓ Client Favorite',
        message: 'Client likes this food.',
      });
    }

    if (cuisineMatch) {
      messages.push({
        type: ValidationMessageType.PREFERENCE_MATCH,
        severity: ValidationSeverity.GREEN,
        title: '✓ Preferred Cuisine',
        message: 'Matches client cuisine preference.',
      });
    }
  }

  private determineSeverity(messages: ValidationMessage[]): ValidationSeverity {
    if (messages.some(m => m.severity === ValidationSeverity.RED)) {
      return ValidationSeverity.RED;
    }
    if (messages.some(m => m.severity === ValidationSeverity.YELLOW)) {
      return ValidationSeverity.YELLOW;
    }
    return ValidationSeverity.GREEN;
  }
}

export const validationService = new ValidationService();
```

### 4.4 Validation Rules Utility

**File:** `backend/src/utils/validation-rules.ts`

```typescript
export const ALLERGEN_MAPPING: Record<string, string> = {
  peanuts: 'contains_peanuts',
  tree_nuts: 'contains_tree_nuts',
  dairy: 'contains_dairy',
  eggs: 'contains_eggs',
  wheat: 'contains_wheat',
  soy: 'contains_soy',
  fish: 'contains_fish',
  shellfish: 'contains_shellfish',
  sesame: 'contains_sesame',
  mustard: 'contains_mustard',
  celery: 'contains_celery',
  sulphites: 'contains_sulphites',
};

export const DIET_CONFLICTS: Record<string, string[]> = {
  vegan: ['non_veg', 'vegetarian', 'veg_with_egg'],
  vegetarian: ['non_veg'],
  vegetarian_with_egg: ['non_veg'],
  pescatarian: ['non_veg'],
};

export const INTOLERANCE_MAPPING: Record<string, string[]> = {
  lactose: ['contains_dairy'],
  gluten: ['contains_wheat', 'contains_gluten'],
  fructose: ['high_sugar'],
};

export const MEDICAL_FLAG_MAPPING: Record<string, string[]> = {
  diabetes: ['diabetic_caution'],
  pre_diabetes: ['diabetic_caution'],
  heart_disease: ['heart_caution'],
  high_cholesterol: ['heart_caution'],
  kidney_disease: ['kidney_caution'],
  hypertension: ['high_sodium'],
  PCOS: ['diabetic_caution'],
};
```

---

## 5. API Contracts

### 5.1 Validation Controller

**File:** `backend/src/controllers/validation.controller.ts`

```typescript
import { Request, Response } from 'express';
import { validationService } from '../services/validation.service';

export class ValidationController {
  /**
   * POST /api/validation/single
   * Validate a single food for a client
   */
  async validateSingleFood(req: Request, res: Response) {
    try {
      const { clientId, foodId, mealType, date } = req.body;

      if (!clientId || !foodId) {
        return res.status(400).json({ error: 'clientId and foodId are required' });
      }

      const result = await validationService.validateFood({
        clientId,
        foodId,
        mealType,
        date: date ? new Date(date) : new Date(),
      });

      return res.json(result);
    } catch (error) {
      console.error('Validation error:', error);
      return res.status(500).json({ error: 'Validation failed' });
    }
  }

  /**
   * POST /api/validation/bulk
   * Validate multiple foods at once
   */
  async validateBulkFoods(req: Request, res: Response) {
    try {
      const { clientId, foodIds, mealType, date } = req.body;

      if (!clientId || !foodIds || !Array.isArray(foodIds)) {
        return res.status(400).json({ error: 'clientId and foodIds array are required' });
      }

      const results = await validationService.validateFoodsBulk(
        clientId,
        foodIds,
        mealType,
        date ? new Date(date) : new Date()
      );

      return res.json({ results });
    } catch (error) {
      console.error('Bulk validation error:', error);
      return res.status(500).json({ error: 'Bulk validation failed' });
    }
  }
}

export const validationController = new ValidationController();
```

### 5.2 Routes

**File:** `backend/src/routes/validation.routes.ts`

```typescript
import { Router } from 'express';
import { validationController } from '../controllers/validation.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

// All validation routes require authentication
router.use(requireAuth);

router.post('/single', validationController.validateSingleFood);
router.post('/bulk', validationController.validateBulkFoods);

export default router;
```

**Register in main app:**

```typescript
// backend/src/app.ts or index.ts
import validationRoutes from './routes/validation.routes';
app.use('/api/validation', validationRoutes);
```

### 5.3 API Endpoint Documentation

#### POST `/api/validation/single`

**Request:**
```json
{
  "clientId": "client_123",
  "foodId": "food_456",
  "mealType": "breakfast",
  "date": "2026-02-04T00:00:00Z"
}
```

**Response (RED - Blocked):**
```json
{
  "foodId": "food_456",
  "severity": "RED",
  "blocked": true,
  "allowed": false,
  "messages": [
    {
      "type": "ALLERGY_ALERT",
      "severity": "RED",
      "title": "⛔ ALLERGY ALERT",
      "message": "This food contains peanuts.",
      "details": "Client has a peanuts allergy.",
      "recommendation": "This food cannot be added to the meal plan."
    }
  ]
}
```

**Response (YELLOW - Warning):**
```json
{
  "foodId": "food_789",
  "severity": "YELLOW",
  "blocked": false,
  "allowed": true,
  "messages": [
    {
      "type": "HEALTH_CAUTION",
      "severity": "YELLOW",
      "title": "⚠️ HEALTH CAUTION",
      "message": "This food may not be ideal for pre_diabetes.",
      "recommendation": "Consider portion control or alternatives."
    }
  ]
}
```

#### POST `/api/validation/bulk`

**Request:**
```json
{
  "clientId": "client_123",
  "foodIds": ["food_1", "food_2", "food_3"],
  "mealType": "lunch",
  "date": "2026-02-04T00:00:00Z"
}
```

**Response:**
```json
{
  "results": [
    {
      "foodId": "food_1",
      "severity": "GREEN",
      "blocked": false,
      "allowed": true,
      "messages": []
    },
    {
      "foodId": "food_2",
      "severity": "YELLOW",
      "blocked": false,
      "allowed": true,
      "messages": [...]
    },
    {
      "foodId": "food_3",
      "severity": "RED",
      "blocked": true,
      "allowed": false,
      "messages": [...]
    }
  ]
}
```

---

## 6. Frontend Implementation

### 6.1 File Structure

```
frontend/src/
├── components/
│   ├── dietitian/
│   │   ├── AddFoodModal.tsx              [MODIFY]
│   │   ├── FoodCard.tsx                  [MODIFY]
│   │   └── ValidationDisplay.tsx         [NEW]
│   └── common/
│       └── ValidationAlert.tsx           [NEW]
├── hooks/
│   └── useValidation.ts                  [NEW]
├── services/
│   └── validationService.ts              [NEW]
└── types/
    └── validation.types.ts               [NEW]
```

### 6.2 Frontend Types

**File:** `frontend/src/types/validation.types.ts`

```typescript
export type ValidationSeverity = 'RED' | 'YELLOW' | 'GREEN';

export interface ValidationMessage {
  type: string;
  severity: ValidationSeverity;
  title: string;
  message: string;
  details?: string;
  recommendation?: string;
}

export interface ValidationResult {
  foodId: string;
  severity: ValidationSeverity;
  blocked: boolean;
  allowed: boolean;
  messages: ValidationMessage[];
}
```

### 6.3 Validation Service (Frontend)

**File:** `frontend/src/services/validationService.ts`

```typescript
import axios from 'axios';
import { ValidationResult } from '../types/validation.types';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const validationService = {
  async validateFood(
    clientId: string,
    foodId: string,
    mealType?: string,
    date?: Date
  ): Promise<ValidationResult> {
    const response = await axios.post(`${API_BASE}/api/validation/single`, {
      clientId,
      foodId,
      mealType,
      date: date?.toISOString(),
    });
    return response.data;
  },

  async validateFoodsBulk(
    clientId: string,
    foodIds: string[],
    mealType?: string,
    date?: Date
  ): Promise<ValidationResult[]> {
    const response = await axios.post(`${API_BASE}/api/validation/bulk`, {
      clientId,
      foodIds,
      mealType,
      date: date?.toISOString(),
    });
    return response.data.results;
  },
};
```

### 6.4 Validation Hook

**File:** `frontend/src/hooks/useValidation.ts`

```typescript
import { useState, useEffect } from 'react';
import { validationService } from '../services/validationService';
import { ValidationResult } from '../types/validation.types';

export const useValidation = (
  clientId: string,
  foodIds: string[],
  mealType?: string,
  date?: Date
) => {
  const [validationResults, setValidationResults] = useState<Map<string, ValidationResult>>(
    new Map()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (foodIds.length === 0 || !clientId) return;

    const fetchValidations = async () => {
      setLoading(true);
      setError(null);

      try {
        const results = await validationService.validateFoodsBulk(
          clientId,
          foodIds,
          mealType,
          date
        );

        const resultsMap = new Map<string, ValidationResult>();
        results.forEach(result => {
          resultsMap.set(result.foodId, result);
        });

        setValidationResults(resultsMap);
      } catch (err) {
        setError('Failed to validate foods');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchValidations();
  }, [clientId, foodIds, mealType, date]);

  return { validationResults, loading, error };
};
```

### 6.5 Validation Alert Component

**File:** `frontend/src/components/common/ValidationAlert.tsx`

```tsx
import React from 'react';
import { ValidationMessage, ValidationSeverity } from '../../types/validation.types';

interface ValidationAlertProps {
  messages: ValidationMessage[];
  severity: ValidationSeverity;
}

const getSeverityStyles = (severity: ValidationSeverity) => {
  switch (severity) {
    case 'RED':
      return {
        container: 'bg-red-50 border-red-300',
        icon: '⛔',
        iconColor: 'text-red-600',
        titleColor: 'text-red-800',
        textColor: 'text-red-700',
      };
    case 'YELLOW':
      return {
        container: 'bg-yellow-50 border-yellow-300',
        icon: '⚠️',
        iconColor: 'text-yellow-600',
        titleColor: 'text-yellow-800',
        textColor: 'text-yellow-700',
      };
    case 'GREEN':
      return {
        container: 'bg-green-50 border-green-300',
        icon: '✓',
        iconColor: 'text-green-600',
        titleColor: 'text-green-800',
        textColor: 'text-green-700',
      };
  }
};

export const ValidationAlert: React.FC<ValidationAlertProps> = ({ messages, severity }) => {
  if (messages.length === 0) return null;

  const styles = getSeverityStyles(severity);

  return (
    <div className={`border rounded-lg p-4 ${styles.container}`}>
      {messages.map((msg, index) => (
        <div key={index} className="mb-3 last:mb-0">
          <div className="flex items-start gap-2">
            <span className={`text-xl ${styles.iconColor}`}>{styles.icon}</span>
            <div className="flex-1">
              <h4 className={`font-semibold ${styles.titleColor}`}>{msg.title}</h4>
              <p className={`text-sm ${styles.textColor} mt-1`}>{msg.message}</p>
              {msg.details && (
                <p className={`text-sm ${styles.textColor} mt-1`}>{msg.details}</p>
              )}
              {msg.recommendation && (
                <p className={`text-sm ${styles.textColor} mt-2 font-medium`}>
                  💡 {msg.recommendation}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
```

### 6.6 Food Card with Validation

**File:** `frontend/src/components/dietitian/FoodCard.tsx` (Modifications)

```tsx
import React from 'react';
import { ValidationResult } from '../../types/validation.types';
import { ValidationAlert } from '../common/ValidationAlert';

interface FoodCardProps {
  food: FoodItem;
  validationResult?: ValidationResult;
  onAdd: () => void;
}

export const FoodCard: React.FC<FoodCardProps> = ({ food, validationResult, onAdd }) => {
  const getBorderColor = () => {
    if (!validationResult) return 'border-gray-200';
    switch (validationResult.severity) {
      case 'RED':
        return 'border-red-500 border-2';
      case 'YELLOW':
        return 'border-yellow-500 border-2';
      case 'GREEN':
        return 'border-green-500';
      default:
        return 'border-gray-200';
    }
  };

  const getButtonState = () => {
    if (!validationResult) return { disabled: false, text: 'Add' };
    if (validationResult.blocked) return { disabled: true, text: 'Blocked' };
    if (validationResult.severity === 'YELLOW') return { disabled: false, text: 'Add Anyway' };
    return { disabled: false, text: 'Add' };
  };

  const buttonState = getButtonState();

  return (
    <div className={`rounded-lg border ${getBorderColor()} p-4 shadow-sm`}>
      {/* Food Image & Info */}
      <img src={food.imageUrl} alt={food.name} className="w-full h-32 object-cover rounded" />
      <h3 className="font-semibold mt-2">{food.name}</h3>
      <p className="text-sm text-gray-600">{food.category}</p>

      {/* Validation Alerts */}
      {validationResult && validationResult.messages.length > 0 && (
        <div className="mt-3">
          <ValidationAlert
            messages={validationResult.messages}
            severity={validationResult.severity}
          />
        </div>
      )}

      {/* Add Button */}
      <button
        onClick={onAdd}
        disabled={buttonState.disabled}
        className={`mt-4 w-full py-2 rounded ${
          buttonState.disabled
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : validationResult?.severity === 'YELLOW'
            ? 'bg-yellow-500 text-white hover:bg-yellow-600'
            : 'bg-green-500 text-white hover:bg-green-600'
        }`}
      >
        {buttonState.text}
      </button>
    </div>
  );
};
```

### 6.7 Add Food Modal with Validation

**File:** `frontend/src/components/dietitian/AddFoodModal.tsx` (Modifications)

```tsx
import React, { useState, useEffect } from 'react';
import { FoodCard } from './FoodCard';
import { useValidation } from '../../hooks/useValidation';

interface AddFoodModalProps {
  clientId: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  date: Date;
  onClose: () => void;
  onAddFood: (foodId: string) => void;
}

export const AddFoodModal: React.FC<AddFoodModalProps> = ({
  clientId,
  mealType,
  date,
  onClose,
  onAddFood,
}) => {
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const foodIds = searchResults.map(f => f.id);

  // Validate all visible foods
  const { validationResults, loading } = useValidation(clientId, foodIds, mealType, date);

  const handleAddFood = (foodId: string) => {
    const validation = validationResults.get(foodId);

    if (validation?.blocked) {
      // Should not reach here due to disabled button
      return;
    }

    if (validation?.severity === 'YELLOW') {
      // Show confirmation dialog
      const confirmed = window.confirm(
        'This food has warnings. Are you sure you want to add it?'
      );
      if (!confirmed) return;
    }

    onAddFood(foodId);
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>Add Food to {mealType}</h2>

        {/* Search input */}
        {/* ... search implementation ... */}

        {/* Food grid */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          {searchResults.map(food => (
            <FoodCard
              key={food.id}
              food={food}
              validationResult={validationResults.get(food.id)}
              onAdd={() => handleAddFood(food.id)}
            />
          ))}
        </div>

        <button onClick={onClose} className="mt-4">
          Close
        </button>
      </div>
    </div>
  );
};
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Backend Service Tests:**

**File:** `backend/src/services/__tests__/validation.service.test.ts`

```typescript
import { ValidationService } from '../validation.service';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client');

describe('ValidationService', () => {
  let service: ValidationService;
  let prisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    service = new ValidationService();
    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
  });

  describe('Allergy Validation', () => {
    it('should block food with matching allergen', async () => {
      const client = {
        id: 'client1',
        allergies: ['peanuts'],
      };

      const food = {
        id: 'food1',
        name: 'Peanut Butter',
        allergenFlags: ['contains_peanuts'],
      };

      prisma.client.findUnique = jest.fn().mockResolvedValue(client);
      prisma.foodItem.findUnique = jest.fn().mockResolvedValue(food);

      const result = await service.validateFood({
        clientId: 'client1',
        foodId: 'food1',
      });

      expect(result.severity).toBe('RED');
      expect(result.blocked).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].type).toBe('ALLERGY_ALERT');
    });

    it('should allow food without allergen match', async () => {
      const client = {
        id: 'client1',
        allergies: ['peanuts'],
      };

      const food = {
        id: 'food2',
        name: 'Rice',
        allergenFlags: [],
      };

      prisma.client.findUnique = jest.fn().mockResolvedValue(client);
      prisma.foodItem.findUnique = jest.fn().mockResolvedValue(food);

      const result = await service.validateFood({
        clientId: 'client1',
        foodId: 'food2',
      });

      expect(result.severity).toBe('GREEN');
      expect(result.blocked).toBe(false);
    });
  });

  describe('Diet Pattern Validation', () => {
    it('should block non-veg food for vegetarian client', async () => {
      const client = {
        id: 'client1',
        dietPattern: 'vegetarian',
      };

      const food = {
        id: 'food1',
        name: 'Chicken',
        dietaryCategory: 'non_veg',
      };

      prisma.client.findUnique = jest.fn().mockResolvedValue(client);
      prisma.foodItem.findUnique = jest.fn().mockResolvedValue(food);

      const result = await service.validateFood({
        clientId: 'client1',
        foodId: 'food1',
      });

      expect(result.severity).toBe('RED');
      expect(result.blocked).toBe(true);
      expect(result.messages[0].type).toBe('DIET_CONFLICT');
    });
  });

  // Add more test cases for each rule...
});
```

**Run backend tests:**
```bash
cd backend
npm test -- validation.service.test.ts
```

### 7.2 API Integration Tests

**File:** `backend/src/routes/__tests__/validation.routes.test.ts`

```typescript
import request from 'supertest';
import app from '../../app';

describe('Validation API', () => {
  it('POST /api/validation/single - should validate food successfully', async () => {
    const response = await request(app)
      .post('/api/validation/single')
      .send({
        clientId: 'test-client-1',
        foodId: 'test-food-1',
        mealType: 'breakfast',
      })
      .expect(200);

    expect(response.body).toHaveProperty('severity');
    expect(response.body).toHaveProperty('blocked');
    expect(response.body).toHaveProperty('allowed');
    expect(response.body).toHaveProperty('messages');
  });

  it('POST /api/validation/bulk - should validate multiple foods', async () => {
    const response = await request(app)
      .post('/api/validation/bulk')
      .send({
        clientId: 'test-client-1',
        foodIds: ['food-1', 'food-2', 'food-3'],
        mealType: 'lunch',
      })
      .expect(200);

    expect(response.body.results).toHaveLength(3);
  });

  it('should return 400 for missing clientId', async () => {
    await request(app)
      .post('/api/validation/single')
      .send({ foodId: 'food-1' })
      .expect(400);
  });
});
```

### 7.3 End-to-End Tests

**Using Playwright/Cypress:**

```typescript
// e2e/validation.spec.ts
describe('Food Validation Flow', () => {
  it('should show RED border for allergenic food', () => {
    cy.visit('/dietitian/clients/123/meal-plan');
    cy.get('[data-testid="add-food-btn"]').click();
    cy.get('[data-testid="search-input"]').type('Peanut Butter');
    cy.get('[data-testid="food-card"]').should('have.class', 'border-red-500');
    cy.contains('ALLERGY ALERT').should('be.visible');
    cy.get('[data-testid="add-food-to-meal"]').should('be.disabled');
  });

  it('should allow adding food with YELLOW warning after confirmation', () => {
    cy.visit('/dietitian/clients/123/meal-plan');
    cy.get('[data-testid="add-food-btn"]').click();
    cy.get('[data-testid="food-card-high-sugar"]').click();
    cy.contains('HEALTH CAUTION').should('be.visible');
    cy.get('[data-testid="add-anyway-btn"]').click();
    cy.on('window:confirm', () => true);
    cy.contains('Food added successfully').should('be.visible');
  });
});
```

### 7.4 Manual Testing Checklist

**Test Case 1: Allergy Blocking**
1. Navigate to Dietitian Dashboard
2. Select client with peanut allergy
3. Click "Add Food" for breakfast
4. Search for "Peanut Butter"
5. ✅ Verify RED border on food card
6. ✅ Verify "ALLERGY ALERT" message displayed
7. ✅ Verify "Add" button is disabled

**Test Case 2: Medical Warning**
1. Select client with diabetes
2. Add food modal for lunch
3. Search for "Gulab Jamun" (high sugar dessert)
4. ✅ Verify YELLOW border
5. ✅ Verify "HEALTH CAUTION" message
6. ✅ Verify "Add Anyway" button is enabled
7. Click "Add Anyway"
8. ✅ Verify confirmation dialog appears
9. Confirm
10. ✅ Verify food added to meal

**Test Case 3: Egg Day Restriction**
1. Select client who avoids eggs on Tuesday
2. On Tuesday, try adding "Egg Omelette"
3. ✅ Verify RED border and blocking
4. On Wednesday, try adding same food
5. ✅ Verify allowed (GREEN or YELLOW based on other factors)

---

## 8. Deployment Plan

### 8.1 Pre-Deployment Checklist

- [ ] All backend services implemented and tested
- [ ] API endpoints tested with Postman/Insomnia
- [ ] Frontend components tested in isolation
- [ ] E2E tests passing
- [ ] Database migrations applied (if any schema changes)
- [ ] Environment variables configured
- [ ] Performance testing completed (<200ms response time)
- [ ] Error handling tested
- [ ] Logging configured for validation events

### 8.2 Database Migration

No schema changes needed - all fields already exist. Verify with:

```bash
cd backend
npx prisma db pull
npx prisma generate
```

### 8.3 Backend Deployment Steps

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
cd backend
npm install

# 3. Build TypeScript
npm run build

# 4. Run tests
npm test

# 5. Restart server
pm2 restart backend
# OR
npm run prod
```

### 8.4 Frontend Deployment Steps

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
cd frontend
npm install

# 3. Build production bundle
npm run build

# 4. Deploy to hosting (Vercel/Netlify)
vercel deploy --prod
# OR
npm run deploy
```

### 8.5 Rollback Plan

If deployment fails:

```bash
# Rollback to previous version
git checkout <previous-commit-hash>
npm install
npm run build
pm2 restart all
```

### 8.6 Monitoring

**Key Metrics to Track:**

- Validation API response time (target: <200ms)
- Number of RED blocks per day
- Number of YELLOW warnings overridden
- Failed validations (errors)

**Logging:**

```typescript
// Add logging to validation service
logger.info('Food validation', {
  clientId,
  foodId,
  severity: result.severity,
  blocked: result.blocked,
  messageCount: result.messages.length,
});
```

---

## 9. Implementation Phases

### Phase 1: Backend Foundation (Week 1)

**Priority: P0 Critical**

- [x] Database schema (already done)
- [ ] Create `validation.types.ts`
- [ ] Create `validation-rules.ts`
- [ ] Implement `ValidationService`
- [ ] Unit tests for ValidationService
- [ ] Create API controller and routes
- [ ] Integration tests for API

**Deliverable:** Functional validation API

---

### Phase 2: Frontend Integration (Week 2)

**Priority: P0 Critical**

- [ ] Create frontend types
- [ ] Implement `validationService.ts` (API client)
- [ ] Create `useValidation` hook
- [ ] Build `ValidationAlert` component
- [ ] Modify `FoodCard` component
- [ ] Update `AddFoodModal` with validation

**Deliverable:** Functional validation UI in dietitian dashboard

---

### Phase 3: Testing & Refinement (Week 3)

**Priority: P1 Important**

- [ ] E2E tests with Playwright
- [ ] Manual testing with real client data
- [ ] Performance optimization
- [ ] UI/UX refinements based on feedback
- [ ] Error handling improvements
- [ ] Accessibility testing

**Deliverable:** Production-ready validation system

---

### Phase 4: Advanced Features (Week 4+)

**Priority: P2 Nice-to-have**

- [ ] Validation caching for better performance
- [ ] Batch validation on page load
- [ ] Smart food suggestions (alternatives)
- [ ] Admin dashboard for validation analytics
- [ ] AI-powered auto-tagging improvements

**Deliverable:** Enhanced validation system

---

## 10. Appendix

### A. Sample Test Data

**Client Profile:**

```json
{
  "id": "test-client-1",
  "name": "Gaurav Kumar",
  "allergies": ["peanuts", "shellfish"],
  "dietPattern": "vegetarian",
  "intolerances": ["lactose"],
  "eggAvoidDays": ["tuesday", "saturday"],
  "dislikes": ["bitter_gourd"],
  "avoidCategories": ["fried_foods"],
  "labDerivedTags": ["pre_diabetes"],
  "medicalConditions": ["PCOS"],
  "likedFoods": ["paneer_tikka"],
  "preferredCuisines": ["indian", "mughlai"]
}
```

**Food Items:**

```json
[
  {
    "id": "food-1",
    "name": "Peanut Butter",
    "allergenFlags": ["contains_peanuts"],
    "dietaryCategory": "vegan"
  },
  {
    "id": "food-2",
    "name": "Chicken Curry",
    "allergenFlags": [],
    "dietaryCategory": "non_veg"
  },
  {
    "id": "food-3",
    "name": "Gulab Jamun",
    "allergenFlags": ["contains_dairy"],
    "healthFlags": ["diabetic_caution"],
    "nutritionTags": ["high_sugar"]
  },
  {
    "id": "food-4",
    "name": "Paneer Tikka",
    "allergenFlags": ["contains_dairy"],
    "dietaryCategory": "vegetarian",
    "cuisineTags": ["indian", "mughlai"]
  }
]
```

### B. Performance Benchmarks

| Operation | Target | Acceptable | Critical |
|-----------|--------|------------|----------|
| Single validation | <100ms | <200ms | <500ms |
| Bulk validation (10 foods) | <500ms | <1s | <2s |
| Bulk validation (50 foods) | <2s | <5s | <10s |
| Frontend render with validation | <200ms | <500ms | <1s |

### C. Error Codes

| Code | Message | Resolution |
|------|---------|------------|
| VAL_001 | Client not found | Verify clientId exists |
| VAL_002 | Food not found | Verify foodId exists |
| VAL_003 | Validation failed | Check logs for details |
| VAL_004 | Invalid mealType | Use: breakfast, lunch, dinner, snack |
| VAL_005 | Invalid date format | Use ISO 8601 format |

### D. Configuration

**Environment Variables:**

```bash
# Backend
NODE_ENV=production
DATABASE_URL=postgresql://...
VALIDATION_CACHE_TTL=300  # 5 minutes
VALIDATION_TIMEOUT=5000   # 5 seconds

# Frontend
REACT_APP_API_URL=https://api.dietkaro.com
REACT_APP_ENABLE_VALIDATION_CACHE=true
```

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 1, 2026 | AI Assistant | Initial comprehensive tech spec |

---

## Next Steps

1. **Review this document** with the development team
2. **Set up project tracking** in Jira/Linear with tasks from Phase 1
3. **Assign developers** to backend and frontend tracks
4. **Schedule code reviews** for each phase
5. **Plan demo** for stakeholders after Phase 2

---

**Questions or Feedback?**  
Contact: [Your Team Lead/Project Manager]
