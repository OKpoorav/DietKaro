-- CreateEnum
CREATE TYPE "public"."ConsultationMode" AS ENUM ('online', 'in_person');

-- CreateEnum
CREATE TYPE "public"."ConsultationStatus" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "public"."Consultation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "mode" "public"."ConsultationMode" NOT NULL DEFAULT 'online',
    "meetLink" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "status" "public"."ConsultationStatus" NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Consultation_orgId_scheduledAt_idx" ON "public"."Consultation"("orgId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Consultation_clientId_idx" ON "public"."Consultation"("clientId");

-- AddForeignKey
ALTER TABLE "public"."Consultation" ADD CONSTRAINT "Consultation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Consultation" ADD CONSTRAINT "Consultation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Consultation" ADD CONSTRAINT "Consultation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
