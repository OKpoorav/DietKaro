-- CreateEnum
CREATE TYPE "public"."ReferralType" AS ENUM ('existing_client', 'doctor', 'gym_trainer', 'friend_family', 'other');

-- CreateEnum
CREATE TYPE "public"."LeadTemperature" AS ENUM ('hot', 'warm', 'cold');

-- CreateEnum
CREATE TYPE "public"."FollowupType" AS ENUM ('call', 'whatsapp', 'visit', 'reminder');

-- CreateEnum
CREATE TYPE "public"."TouchpointKind" AS ENUM ('field_change', 'note_added', 'proposal_shared', 'payment_link_shared', 'followup_scheduled', 'followup_completed', 'converted', 'archived', 'restored', 'manual_call', 'manual_whatsapp', 'manual_visit', 'manual_other');

-- AlterTable
ALTER TABLE "public"."Organization" ALTER COLUMN "slug" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "leadId" TEXT;

-- CreateTable
CREATE TABLE "public"."Lead" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryMobile" TEXT NOT NULL,
    "altMobile" TEXT,
    "email" TEXT,
    "age" INTEGER,
    "gender" "public"."Gender",
    "city" TEXT,
    "sourceId" TEXT,
    "reference" TEXT,
    "referralType" "public"."ReferralType",
    "ownerUserId" TEXT,
    "statusId" TEXT NOT NULL,
    "temperature" "public"."LeadTemperature" NOT NULL DEFAULT 'warm',
    "notes" TEXT,
    "convertedClientId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadSource" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LeadSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadStatus" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystemConverted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LeadStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadFollowup" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "type" "public"."FollowupType" NOT NULL,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadFollowup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadTouchpoint" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "kind" "public"."TouchpointKind" NOT NULL,
    "payload" JSONB,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadTouchpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadTagAssignment" (
    "leadId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadTagAssignment_pkey" PRIMARY KEY ("leadId","tagId")
);

-- CreateTable
CREATE TABLE "public"."ProposalTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "headerCopy" TEXT,
    "logoUrl" TEXT,
    "footerNote" TEXT,
    "signatureLine" TEXT,
    "customFields" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_convertedClientId_key" ON "public"."Lead"("convertedClientId");

-- CreateIndex
CREATE INDEX "Lead_orgId_archivedAt_idx" ON "public"."Lead"("orgId", "archivedAt");

-- CreateIndex
CREATE INDEX "Lead_orgId_statusId_idx" ON "public"."Lead"("orgId", "statusId");

-- CreateIndex
CREATE INDEX "Lead_ownerUserId_idx" ON "public"."Lead"("ownerUserId");

-- CreateIndex
CREATE INDEX "Lead_orgId_createdAt_idx" ON "public"."Lead"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadSource_orgId_deletedAt_idx" ON "public"."LeadSource"("orgId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSource_orgId_name_key" ON "public"."LeadSource"("orgId", "name");

-- CreateIndex
CREATE INDEX "LeadStatus_orgId_sortOrder_idx" ON "public"."LeadStatus"("orgId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LeadStatus_orgId_name_key" ON "public"."LeadStatus"("orgId", "name");

-- CreateIndex
CREATE INDEX "LeadFollowup_dueAt_completedAt_notifiedAt_idx" ON "public"."LeadFollowup"("dueAt", "completedAt", "notifiedAt");

-- CreateIndex
CREATE INDEX "LeadFollowup_leadId_idx" ON "public"."LeadFollowup"("leadId");

-- CreateIndex
CREATE INDEX "LeadTouchpoint_leadId_createdAt_idx" ON "public"."LeadTouchpoint"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalTemplate_orgId_key" ON "public"."ProposalTemplate"("orgId");

-- CreateIndex
CREATE INDEX "Payment_leadId_idx" ON "public"."Payment"("leadId");

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "public"."LeadSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."LeadStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_convertedClientId_fkey" FOREIGN KEY ("convertedClientId") REFERENCES "public"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadSource" ADD CONSTRAINT "LeadSource_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadStatus" ADD CONSTRAINT "LeadStatus_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadFollowup" ADD CONSTRAINT "LeadFollowup_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadFollowup" ADD CONSTRAINT "LeadFollowup_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadTouchpoint" ADD CONSTRAINT "LeadTouchpoint_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadTouchpoint" ADD CONSTRAINT "LeadTouchpoint_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadTagAssignment" ADD CONSTRAINT "LeadTagAssignment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadTagAssignment" ADD CONSTRAINT "LeadTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."ClientTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProposalTemplate" ADD CONSTRAINT "ProposalTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
