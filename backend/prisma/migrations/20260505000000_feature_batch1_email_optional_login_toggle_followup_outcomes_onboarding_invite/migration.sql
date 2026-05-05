-- AlterEnum: safely replace FollowupType, migrating deprecated values first
-- Step 1: Cast the column to text so we can update freely
ALTER TABLE "public"."LeadFollowup" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;

-- Step 2: Migrate deprecated follow-up types to 'todo'
UPDATE "public"."LeadFollowup" SET "type" = 'todo' WHERE "type" IN ('whatsapp', 'reminder');

-- Step 3: Drop the old enum and create the new one
DROP TYPE "public"."FollowupType";
CREATE TYPE "public"."FollowupType" AS ENUM ('call', 'visit', 'todo');

-- Step 4: Cast the column back to the new enum type
ALTER TABLE "public"."LeadFollowup" ALTER COLUMN "type" TYPE "public"."FollowupType" USING "type"::"public"."FollowupType";

-- AlterTable: Client new fields
ALTER TABLE "public"."Client" ADD COLUMN     "altPhone" TEXT,
ADD COLUMN     "altPhoneRelation" TEXT,
ADD COLUMN     "loginEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "remarks" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable: LeadFollowup new fields
ALTER TABLE "public"."LeadFollowup" ADD COLUMN     "callbackAt" TIMESTAMP(3),
ADD COLUMN     "lostReason" TEXT,
ADD COLUMN     "outcome" TEXT;

-- CreateTable
CREATE TABLE "public"."OnboardingInvite" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingInvite_token_key" ON "public"."OnboardingInvite"("token");

-- CreateIndex
CREATE INDEX "OnboardingInvite_clientId_idx" ON "public"."OnboardingInvite"("clientId");

-- CreateIndex
CREATE INDEX "OnboardingInvite_token_idx" ON "public"."OnboardingInvite"("token");

-- AddForeignKey
ALTER TABLE "public"."OnboardingInvite" ADD CONSTRAINT "OnboardingInvite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
