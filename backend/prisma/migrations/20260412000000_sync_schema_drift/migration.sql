-- Migration: Sync schema drift
-- Covers all differences between init migration + hide_calories migration and current schema.prisma

-- ============================================================================
-- 1. NEW ENUMS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE "public"."InvitationStatus" AS ENUM ('pending', 'accepted', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."MessageStatus" AS ENUM ('sent', 'delivered', 'read');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."ReportProcessingStatus" AS ENUM ('pending', 'extracting', 'summarizing', 'done', 'failed', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."ReferralSource" AS ENUM ('doctor', 'dietitian', 'client_referral', 'social_media', 'website', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. NEW COLUMNS ON EXISTING TABLES
-- ============================================================================

-- ------------------------------------
-- Organization: add slug
-- ------------------------------------
ALTER TABLE "public"."Organization" ADD COLUMN "slug" TEXT;

-- Backfill slug with id (uuid) so existing rows satisfy NOT NULL + UNIQUE
UPDATE "public"."Organization" SET "slug" = "id" WHERE "slug" IS NULL;

ALTER TABLE "public"."Organization" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "public"."Organization" ALTER COLUMN "slug" SET DEFAULT gen_random_uuid()::text;

CREATE UNIQUE INDEX "Organization_slug_key" ON "public"."Organization"("slug");

-- ------------------------------------
-- User: add pushTokens
-- ------------------------------------
ALTER TABLE "public"."User" ADD COLUMN "pushTokens" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ------------------------------------
-- Client: add all new columns
-- ------------------------------------
ALTER TABLE "public"."Client" ADD COLUMN "goal" TEXT;
ALTER TABLE "public"."Client" ADD COLUMN "goalDeadline" DATE;
ALTER TABLE "public"."Client" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "public"."Client" ADD COLUMN "referralSource" "public"."ReferralSource";
ALTER TABLE "public"."Client" ADD COLUMN "referralSourceName" TEXT;
ALTER TABLE "public"."Client" ADD COLUMN "referralSourcePhone" TEXT;
ALTER TABLE "public"."Client" ADD COLUMN "referredByClientId" TEXT;
ALTER TABLE "public"."Client" ADD COLUMN "avoidCategories" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."Client" ADD COLUMN "dietPattern" TEXT;
ALTER TABLE "public"."Client" ADD COLUMN "dislikes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."Client" ADD COLUMN "eggAllowed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "public"."Client" ADD COLUMN "eggAvoidDays" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."Client" ADD COLUMN "intolerances" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."Client" ADD COLUMN "labDerivedTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."Client" ADD COLUMN "likedFoods" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."Client" ADD COLUMN "preferredCuisines" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."Client" ADD COLUMN "foodRestrictions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "public"."Client" ADD COLUMN "pushTokens" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."Client" ADD COLUMN "targetCalories" INTEGER;
ALTER TABLE "public"."Client" ADD COLUMN "targetCarbsG" DECIMAL(5,1);
ALTER TABLE "public"."Client" ADD COLUMN "targetFatsG" DECIMAL(5,1);
ALTER TABLE "public"."Client" ADD COLUMN "targetProteinG" DECIMAL(5,1);

-- Client: make primaryDietitianId nullable (was NOT NULL)
ALTER TABLE "public"."Client" ALTER COLUMN "primaryDietitianId" DROP NOT NULL;

-- Client: new indexes
CREATE UNIQUE INDEX "Client_orgId_referralCode_key" ON "public"."Client"("orgId", "referralCode");
CREATE INDEX "Client_referralCode_idx" ON "public"."Client"("referralCode");
CREATE INDEX "Client_referredByClientId_idx" ON "public"."Client"("referredByClientId");
CREATE INDEX "Client_orgId_isActive_createdAt_idx" ON "public"."Client"("orgId", "isActive", "createdAt");
CREATE INDEX "Client_dietPattern_idx" ON "public"."Client"("dietPattern");
CREATE INDEX "Client_phone_idx" ON "public"."Client"("phone");

-- Client: change FK on primaryDietitianId from RESTRICT to SET NULL
ALTER TABLE "public"."Client" DROP CONSTRAINT "Client_primaryDietitianId_fkey";
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_primaryDietitianId_fkey"
    FOREIGN KEY ("primaryDietitianId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Client: add FK for referredByClientId (self-relation)
ALTER TABLE "public"."Client" ADD CONSTRAINT "Client_referredByClientId_fkey"
    FOREIGN KEY ("referredByClientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------
-- MedicalProfile: add new columns
-- ------------------------------------
ALTER TABLE "public"."MedicalProfile" ADD COLUMN "labDate" TIMESTAMP(3);
ALTER TABLE "public"."MedicalProfile" ADD COLUMN "labDerivedTags" TEXT[];
ALTER TABLE "public"."MedicalProfile" ADD COLUMN "labValues" JSONB;

-- ------------------------------------
-- DietPlan: make clientId and createdByUserId nullable
-- (hideCaloriesFromClient already handled in migration 2)
-- ------------------------------------
ALTER TABLE "public"."DietPlan" ALTER COLUMN "clientId" DROP NOT NULL;
ALTER TABLE "public"."DietPlan" ALTER COLUMN "createdByUserId" DROP NOT NULL;

-- DietPlan: new indexes
CREATE INDEX "DietPlan_orgId_status_createdAt_idx" ON "public"."DietPlan"("orgId", "status", "createdAt");
CREATE INDEX "DietPlan_clientId_status_idx" ON "public"."DietPlan"("clientId", "status");

-- DietPlan: change FK on clientId from CASCADE to CASCADE (no change on delete action,
-- but the column is now nullable so Prisma re-generates the constraint)
-- Actually the FK action stays CASCADE, but we need to allow NULL values through.
-- The ALTER COLUMN DROP NOT NULL above handles that.

-- DietPlan: change FK on createdByUserId from RESTRICT to SET NULL
ALTER TABLE "public"."DietPlan" DROP CONSTRAINT "DietPlan_createdByUserId_fkey";
ALTER TABLE "public"."DietPlan" ADD CONSTRAINT "DietPlan_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------
-- Meal: add new columns
-- ------------------------------------
ALTER TABLE "public"."Meal" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "public"."Meal" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Meal: new index
CREATE INDEX "Meal_createdByUserId_idx" ON "public"."Meal"("createdByUserId");

-- ------------------------------------
-- FoodItem: add new columns
-- ------------------------------------
ALTER TABLE "public"."FoodItem" ADD COLUMN "cuisineTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."FoodItem" ADD COLUMN "dietaryCategory" TEXT;
ALTER TABLE "public"."FoodItem" ADD COLUMN "healthFlags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."FoodItem" ADD COLUMN "mealSuitabilityTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."FoodItem" ADD COLUMN "nutritionTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."FoodItem" ADD COLUMN "processingLevel" TEXT;
ALTER TABLE "public"."FoodItem" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "public"."FoodItem" ADD COLUMN "updatedByUserId" TEXT;
ALTER TABLE "public"."FoodItem" ADD COLUMN "isBaseIngredient" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."FoodItem" ADD COLUMN "servingUnit" TEXT NOT NULL DEFAULT 'g';

-- FoodItem: new indexes
CREATE INDEX "FoodItem_orgId_category_idx" ON "public"."FoodItem"("orgId", "category");
CREATE INDEX "FoodItem_isBaseIngredient_idx" ON "public"."FoodItem"("isBaseIngredient");

-- ------------------------------------
-- MealFoodItem: add new columns
-- ------------------------------------
ALTER TABLE "public"."MealFoodItem" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "public"."MealFoodItem" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "public"."MealFoodItem" ADD COLUMN "optionGroup" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "public"."MealFoodItem" ADD COLUMN "optionLabel" TEXT;

-- MealFoodItem: new indexes
CREATE INDEX "MealFoodItem_mealId_optionGroup_idx" ON "public"."MealFoodItem"("mealId", "optionGroup");
CREATE INDEX "MealFoodItem_createdByUserId_idx" ON "public"."MealFoodItem"("createdByUserId");

-- ------------------------------------
-- MealLog: add new columns
-- ------------------------------------
ALTER TABLE "public"."MealLog" ADD COLUMN "complianceColor" TEXT;
ALTER TABLE "public"."MealLog" ADD COLUMN "complianceIssues" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "public"."MealLog" ADD COLUMN "complianceScore" INTEGER;
ALTER TABLE "public"."MealLog" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "public"."MealLog" ADD COLUMN "chosenOptionGroup" INTEGER;

-- MealLog: new unique constraint
CREATE UNIQUE INDEX "MealLog_clientId_mealId_scheduledDate_key" ON "public"."MealLog"("clientId", "mealId", "scheduledDate");

-- MealLog: new indexes
CREATE INDEX "MealLog_orgId_status_scheduledDate_idx" ON "public"."MealLog"("orgId", "status", "scheduledDate");
CREATE INDEX "MealLog_clientId_scheduledDate_idx" ON "public"."MealLog"("clientId", "scheduledDate");

-- ------------------------------------
-- WeightLog: add new columns
-- ------------------------------------
ALTER TABLE "public"."WeightLog" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "public"."WeightLog" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- WeightLog: new index
CREATE INDEX "WeightLog_clientId_logDate_idx" ON "public"."WeightLog"("clientId", "logDate");

-- ------------------------------------
-- BodyMeasurement: add new columns
-- ------------------------------------
ALTER TABLE "public"."BodyMeasurement" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "public"."BodyMeasurement" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- BodyMeasurement: new unique constraint
CREATE UNIQUE INDEX "BodyMeasurement_clientId_logDate_key" ON "public"."BodyMeasurement"("clientId", "logDate");

-- ------------------------------------
-- SessionNote: make createdByUserId nullable
-- ------------------------------------
ALTER TABLE "public"."SessionNote" ALTER COLUMN "createdByUserId" DROP NOT NULL;

-- SessionNote: change FK from RESTRICT to SET NULL
ALTER TABLE "public"."SessionNote" DROP CONSTRAINT "SessionNote_createdByUserId_fkey";
ALTER TABLE "public"."SessionNote" ADD CONSTRAINT "SessionNote_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------
-- Invoice: make createdByUserId nullable, add deletedAt
-- ------------------------------------
ALTER TABLE "public"."Invoice" ALTER COLUMN "createdByUserId" DROP NOT NULL;
ALTER TABLE "public"."Invoice" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Invoice: change FK from RESTRICT to SET NULL
ALTER TABLE "public"."Invoice" DROP CONSTRAINT "Invoice_createdByUserId_fkey";
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------
-- Notification: new indexes
-- ------------------------------------
CREATE INDEX "Notification_recipientId_recipientType_isRead_createdAt_idx"
    ON "public"."Notification"("recipientId", "recipientType", "isRead", "createdAt");
CREATE INDEX "Notification_expiresAt_idx" ON "public"."Notification"("expiresAt");

-- ============================================================================
-- 3. NEW TABLES
-- ============================================================================

-- ------------------------------------
-- ClientRefreshToken
-- ------------------------------------
CREATE TABLE IF NOT EXISTS "public"."ClientRefreshToken" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientRefreshToken_tokenHash_key" ON "public"."ClientRefreshToken"("tokenHash");
CREATE INDEX "ClientRefreshToken_clientId_idx" ON "public"."ClientRefreshToken"("clientId");
CREATE INDEX "ClientRefreshToken_familyId_idx" ON "public"."ClientRefreshToken"("familyId");

ALTER TABLE "public"."ClientRefreshToken" ADD CONSTRAINT "ClientRefreshToken_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------
-- FoodItemIngredient
-- ------------------------------------
CREATE TABLE IF NOT EXISTS "public"."FoodItemIngredient" (
    "id" TEXT NOT NULL,
    "foodItemId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodItemIngredient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodItemIngredient_foodItemId_ingredientId_key"
    ON "public"."FoodItemIngredient"("foodItemId", "ingredientId");
CREATE INDEX "FoodItemIngredient_foodItemId_idx" ON "public"."FoodItemIngredient"("foodItemId");
CREATE INDEX "FoodItemIngredient_ingredientId_idx" ON "public"."FoodItemIngredient"("ingredientId");

ALTER TABLE "public"."FoodItemIngredient" ADD CONSTRAINT "FoodItemIngredient_foodItemId_fkey"
    FOREIGN KEY ("foodItemId") REFERENCES "public"."FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."FoodItemIngredient" ADD CONSTRAINT "FoodItemIngredient_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "public"."FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------
-- Invitation
-- ------------------------------------
CREATE TABLE IF NOT EXISTS "public"."Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "token" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."InvitationStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invitation_token_key" ON "public"."Invitation"("token");
CREATE INDEX "Invitation_orgId_idx" ON "public"."Invitation"("orgId");
CREATE INDEX "Invitation_token_idx" ON "public"."Invitation"("token");
CREATE INDEX "Invitation_email_idx" ON "public"."Invitation"("email");

ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------
-- ReferralBenefit
-- ------------------------------------
CREATE TABLE IF NOT EXISTS "public"."ReferralBenefit" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "referralCount" INTEGER NOT NULL DEFAULT 0,
    "freeMonthsEarned" INTEGER NOT NULL DEFAULT 0,
    "freeMonthsUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralBenefit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralBenefit_clientId_key" ON "public"."ReferralBenefit"("clientId");
CREATE INDEX "ReferralBenefit_clientId_idx" ON "public"."ReferralBenefit"("clientId");

ALTER TABLE "public"."ReferralBenefit" ADD CONSTRAINT "ReferralBenefit_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------
-- ClientReport
-- ------------------------------------
CREATE TABLE IF NOT EXISTS "public"."ClientReport" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "reportType" TEXT,
    "notes" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mimeType" TEXT,
    "processingError" TEXT,
    "processingStatus" "public"."ReportProcessingStatus" NOT NULL DEFAULT 'pending',
    "s3Key" TEXT,

    CONSTRAINT "ClientReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientReport_clientId_idx" ON "public"."ClientReport"("clientId");
CREATE INDEX "ClientReport_orgId_idx" ON "public"."ClientReport"("orgId");
CREATE INDEX "ClientReport_clientId_processingStatus_idx" ON "public"."ClientReport"("clientId", "processingStatus");

ALTER TABLE "public"."ClientReport" ADD CONSTRAINT "ClientReport_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ClientReport" ADD CONSTRAINT "ClientReport_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------
-- ReportSummary
-- ------------------------------------
CREATE TABLE IF NOT EXISTS "public"."ReportSummary" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "rawText" TEXT,
    "summaryText" TEXT,
    "extractedData" JSONB,
    "modelVersion" TEXT,
    "promptVersion" INTEGER NOT NULL DEFAULT 1,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportSummary_reportId_key" ON "public"."ReportSummary"("reportId");
CREATE INDEX "ReportSummary_reportId_idx" ON "public"."ReportSummary"("reportId");

ALTER TABLE "public"."ReportSummary" ADD CONSTRAINT "ReportSummary_reportId_fkey"
    FOREIGN KEY ("reportId") REFERENCES "public"."ClientReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------
-- ClientDocumentSummary
-- ------------------------------------
CREATE TABLE IF NOT EXISTS "public"."ClientDocumentSummary" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "summaryText" TEXT NOT NULL,
    "docCount" INTEGER NOT NULL DEFAULT 0,
    "modelVersion" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientDocumentSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientDocumentSummary_clientId_key" ON "public"."ClientDocumentSummary"("clientId");
CREATE INDEX "ClientDocumentSummary_clientId_idx" ON "public"."ClientDocumentSummary"("clientId");

ALTER TABLE "public"."ClientDocumentSummary" ADD CONSTRAINT "ClientDocumentSummary_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------
-- ClientPreferences
-- ------------------------------------
CREATE TABLE IF NOT EXISTS "public"."ClientPreferences" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "breakfastTime" TEXT,
    "lunchTime" TEXT,
    "dinnerTime" TEXT,
    "snackTime" TEXT,
    "canCook" BOOLEAN NOT NULL DEFAULT true,
    "kitchenAvailable" BOOLEAN NOT NULL DEFAULT true,
    "hasDietaryCook" BOOLEAN NOT NULL DEFAULT false,
    "weekdayActivity" TEXT,
    "weekendActivity" TEXT,
    "sportOrHobby" TEXT,
    "generalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPreferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientPreferences_clientId_key" ON "public"."ClientPreferences"("clientId");
CREATE INDEX "ClientPreferences_clientId_idx" ON "public"."ClientPreferences"("clientId");

ALTER TABLE "public"."ClientPreferences" ADD CONSTRAINT "ClientPreferences_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------
-- Conversation
-- ------------------------------------
CREATE TABLE IF NOT EXISTS "public"."Conversation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "lastMessageText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Conversation_orgId_userId_clientId_key"
    ON "public"."Conversation"("orgId", "userId", "clientId");
CREATE INDEX "Conversation_userId_lastMessageAt_idx"
    ON "public"."Conversation"("userId", "lastMessageAt" DESC);
CREATE INDEX "Conversation_clientId_lastMessageAt_idx"
    ON "public"."Conversation"("clientId", "lastMessageAt" DESC);

ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------
-- Message
-- ------------------------------------
CREATE TABLE IF NOT EXISTS "public"."Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderType" "public"."RecipientType" NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "public"."MessageStatus" NOT NULL DEFAULT 'sent',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Message_conversationId_createdAt_idx"
    ON "public"."Message"("conversationId", "createdAt" DESC);
CREATE INDEX "Message_conversationId_status_idx"
    ON "public"."Message"("conversationId", "status");
CREATE INDEX "Message_conversationId_senderType_status_idx"
    ON "public"."Message"("conversationId", "senderType", "status");

ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
