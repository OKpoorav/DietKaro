-- CreateEnum
CREATE TYPE "public"."SubscriptionTier" AS ENUM ('free', 'pro', 'clinic', 'enterprise');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('active', 'paused', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('owner', 'admin', 'dietitian');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "public"."ActivityLevel" AS ENUM ('sedentary', 'lightly_active', 'moderately_active', 'very_active');

-- CreateEnum
CREATE TYPE "public"."DietPlanStatus" AS ENUM ('draft', 'active', 'completed', 'paused');

-- CreateEnum
CREATE TYPE "public"."DietPlanVisibility" AS ENUM ('private', 'org_shared', 'public');

-- CreateEnum
CREATE TYPE "public"."MealType" AS ENUM ('breakfast', 'lunch', 'snack', 'dinner');

-- CreateEnum
CREATE TYPE "public"."MealLogStatus" AS ENUM ('pending', 'eaten', 'skipped', 'substituted');

-- CreateEnum
CREATE TYPE "public"."NoteType" AS ENUM ('SOAP', 'DAP', 'other');

-- CreateEnum
CREATE TYPE "public"."RecipientType" AS ENUM ('user', 'client');

-- CreateEnum
CREATE TYPE "public"."DeliveryStatus" AS ENUM ('pending', 'delivered', 'failed');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('unpaid', 'sent', 'paid', 'cancelled');

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "subscriptionTier" "public"."SubscriptionTier" NOT NULL DEFAULT 'free',
    "subscriptionStatus" "public"."SubscriptionStatus" NOT NULL DEFAULT 'active',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "maxClients" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "role" "public"."UserRole" NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "profilePhotoUrl" TEXT,
    "licenseNumber" TEXT,
    "specialization" TEXT,
    "bio" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "primaryDietitianId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "gender" "public"."Gender",
    "profilePhotoUrl" TEXT,
    "heightCm" DECIMAL(5,2),
    "currentWeightKg" DECIMAL(5,2),
    "targetWeightKg" DECIMAL(5,2),
    "activityLevel" "public"."ActivityLevel",
    "dietaryPreferences" TEXT[],
    "allergies" TEXT[],
    "medicalConditions" TEXT[],
    "medications" TEXT[],
    "healthNotes" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MedicalProfile" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "diagnoses" TEXT[],
    "allergies" TEXT[],
    "intolerances" TEXT[],
    "medications" TEXT[],
    "supplements" TEXT[],
    "surgeries" TEXT[],
    "familyHistory" TEXT,
    "healthNotes" TEXT,
    "dietaryRestrictions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "MedicalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DietPlan" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "targetCalories" INTEGER,
    "targetProteinG" DECIMAL(5,1),
    "targetCarbsG" DECIMAL(5,1),
    "targetFatsG" DECIMAL(5,1),
    "targetFiberG" DECIMAL(5,1),
    "notesForClient" TEXT,
    "internalNotes" TEXT,
    "status" "public"."DietPlanStatus" NOT NULL DEFAULT 'draft',
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "templateCategory" TEXT,
    "visibility" "public"."DietPlanVisibility" NOT NULL DEFAULT 'private',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DietPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Meal" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "mealDate" DATE,
    "sequenceNumber" INTEGER,
    "mealType" "public"."MealType" NOT NULL,
    "timeOfDay" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "servingSizeNotes" TEXT,
    "totalCalories" INTEGER,
    "totalProteinG" DECIMAL(5,1),
    "totalCarbsG" DECIMAL(5,1),
    "totalFatsG" DECIMAL(5,1),
    "totalFiberG" DECIMAL(5,1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FoodItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "servingSizeG" DECIMAL(6,2) NOT NULL DEFAULT 100,
    "calories" INTEGER NOT NULL,
    "proteinG" DECIMAL(5,1),
    "carbsG" DECIMAL(5,1),
    "fatsG" DECIMAL(5,1),
    "fiberG" DECIMAL(5,1),
    "sodiumMg" DECIMAL(7,2),
    "sugarG" DECIMAL(5,1),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "barcode" TEXT,
    "allergenFlags" TEXT[],
    "dietaryTags" TEXT[],
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MealFoodItem" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "quantityG" DECIMAL(6,2) NOT NULL,
    "calories" INTEGER,
    "proteinG" DECIMAL(5,1),
    "carbsG" DECIMAL(5,1),
    "fatsG" DECIMAL(5,1),
    "fiberG" DECIMAL(5,1),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealFoodItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MealLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "scheduledTime" TEXT,
    "status" "public"."MealLogStatus" NOT NULL DEFAULT 'pending',
    "mealPhotoUrl" TEXT,
    "mealPhotoSmallUrl" TEXT,
    "photoUploadedAt" TIMESTAMP(3),
    "aiFoodRecognition" JSONB,
    "clientNotes" TEXT,
    "dietitianFeedback" TEXT,
    "dietitianFeedbackAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "substituteDescription" TEXT,
    "substituteCaloriesEst" INTEGER,
    "loggedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WeightLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "weightKg" DECIMAL(5,2) NOT NULL,
    "logDate" DATE NOT NULL,
    "logTime" TEXT,
    "notes" TEXT,
    "progressPhotoUrl" TEXT,
    "bmi" DECIMAL(4,2),
    "weightChangeFromPrevious" DECIMAL(5,2),
    "isOutlier" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeightLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BodyMeasurement" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "logDate" DATE NOT NULL,
    "chestCm" DECIMAL(5,2),
    "waistCm" DECIMAL(5,2),
    "hipsCm" DECIMAL(5,2),
    "thighsCm" DECIMAL(5,2),
    "armsCm" DECIMAL(5,2),
    "bodyFatPercentage" DECIMAL(4,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SessionNote" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "noteType" "public"."NoteType" NOT NULL,
    "title" TEXT NOT NULL,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientType" "public"."RecipientType" NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "icon" TEXT,
    "deepLink" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "sentViaChannels" TEXT[] DEFAULT ARRAY['push']::TEXT[],
    "deliveryStatus" "public"."DeliveryStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT NOW() + INTERVAL '30 days',

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ActivityLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "userType" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "changeDesc" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'unpaid',
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "public"."Organization"("name");

-- CreateIndex
CREATE INDEX "Organization_subscriptionStatus_idx" ON "public"."Organization"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "Organization_isActive_idx" ON "public"."Organization"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "public"."User"("clerkUserId");

-- CreateIndex
CREATE INDEX "User_orgId_idx" ON "public"."User"("orgId");

-- CreateIndex
CREATE INDEX "User_clerkUserId_idx" ON "public"."User"("clerkUserId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "User_orgId_email_key" ON "public"."User"("orgId", "email");

-- CreateIndex
CREATE INDEX "Client_orgId_idx" ON "public"."Client"("orgId");

-- CreateIndex
CREATE INDEX "Client_primaryDietitianId_idx" ON "public"."Client"("primaryDietitianId");

-- CreateIndex
CREATE INDEX "Client_isActive_idx" ON "public"."Client"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Client_orgId_email_key" ON "public"."Client"("orgId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalProfile_clientId_key" ON "public"."MedicalProfile"("clientId");

-- CreateIndex
CREATE INDEX "MedicalProfile_clientId_idx" ON "public"."MedicalProfile"("clientId");

-- CreateIndex
CREATE INDEX "DietPlan_orgId_idx" ON "public"."DietPlan"("orgId");

-- CreateIndex
CREATE INDEX "DietPlan_clientId_idx" ON "public"."DietPlan"("clientId");

-- CreateIndex
CREATE INDEX "DietPlan_status_idx" ON "public"."DietPlan"("status");

-- CreateIndex
CREATE INDEX "DietPlan_isTemplate_idx" ON "public"."DietPlan"("isTemplate");

-- CreateIndex
CREATE INDEX "Meal_planId_idx" ON "public"."Meal"("planId");

-- CreateIndex
CREATE INDEX "Meal_mealDate_idx" ON "public"."Meal"("mealDate");

-- CreateIndex
CREATE INDEX "FoodItem_orgId_idx" ON "public"."FoodItem"("orgId");

-- CreateIndex
CREATE INDEX "FoodItem_category_idx" ON "public"."FoodItem"("category");

-- CreateIndex
CREATE INDEX "MealFoodItem_mealId_idx" ON "public"."MealFoodItem"("mealId");

-- CreateIndex
CREATE INDEX "MealFoodItem_foodId_idx" ON "public"."MealFoodItem"("foodId");

-- CreateIndex
CREATE INDEX "MealLog_orgId_idx" ON "public"."MealLog"("orgId");

-- CreateIndex
CREATE INDEX "MealLog_clientId_idx" ON "public"."MealLog"("clientId");

-- CreateIndex
CREATE INDEX "MealLog_scheduledDate_idx" ON "public"."MealLog"("scheduledDate");

-- CreateIndex
CREATE INDEX "MealLog_status_idx" ON "public"."MealLog"("status");

-- CreateIndex
CREATE INDEX "WeightLog_orgId_idx" ON "public"."WeightLog"("orgId");

-- CreateIndex
CREATE INDEX "WeightLog_clientId_idx" ON "public"."WeightLog"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "WeightLog_clientId_logDate_key" ON "public"."WeightLog"("clientId", "logDate");

-- CreateIndex
CREATE INDEX "BodyMeasurement_orgId_idx" ON "public"."BodyMeasurement"("orgId");

-- CreateIndex
CREATE INDEX "BodyMeasurement_clientId_idx" ON "public"."BodyMeasurement"("clientId");

-- CreateIndex
CREATE INDEX "SessionNote_orgId_idx" ON "public"."SessionNote"("orgId");

-- CreateIndex
CREATE INDEX "SessionNote_clientId_idx" ON "public"."SessionNote"("clientId");

-- CreateIndex
CREATE INDEX "Notification_recipientId_recipientType_idx" ON "public"."Notification"("recipientId", "recipientType");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "public"."Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_orgId_idx" ON "public"."Notification"("orgId");

-- CreateIndex
CREATE INDEX "ActivityLog_orgId_idx" ON "public"."ActivityLog"("orgId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "public"."ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_action_idx" ON "public"."ActivityLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "public"."Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_orgId_idx" ON "public"."Invoice"("orgId");

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "public"."Invoice"("clientId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "public"."Invoice"("status");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_primaryDietitianId_fkey" FOREIGN KEY ("primaryDietitianId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MedicalProfile" ADD CONSTRAINT "MedicalProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DietPlan" ADD CONSTRAINT "DietPlan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DietPlan" ADD CONSTRAINT "DietPlan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DietPlan" ADD CONSTRAINT "DietPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Meal" ADD CONSTRAINT "Meal_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."DietPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FoodItem" ADD CONSTRAINT "FoodItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FoodItem" ADD CONSTRAINT "FoodItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MealFoodItem" ADD CONSTRAINT "MealFoodItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "public"."Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MealFoodItem" ADD CONSTRAINT "MealFoodItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "public"."FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MealLog" ADD CONSTRAINT "MealLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MealLog" ADD CONSTRAINT "MealLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MealLog" ADD CONSTRAINT "MealLog_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "public"."Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MealLog" ADD CONSTRAINT "MealLog_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeightLog" ADD CONSTRAINT "WeightLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeightLog" ADD CONSTRAINT "WeightLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BodyMeasurement" ADD CONSTRAINT "BodyMeasurement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BodyMeasurement" ADD CONSTRAINT "BodyMeasurement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionNote" ADD CONSTRAINT "SessionNote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionNote" ADD CONSTRAINT "SessionNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionNote" ADD CONSTRAINT "SessionNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActivityLog" ADD CONSTRAINT "ActivityLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
