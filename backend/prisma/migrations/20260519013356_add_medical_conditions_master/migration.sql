-- CreateTable
CREATE TABLE "MedicalConditionMaster" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MedicalConditionMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MedicalConditionMaster_orgId_name_key" ON "MedicalConditionMaster"("orgId", "name");

-- CreateIndex
CREATE INDEX "MedicalConditionMaster_orgId_deletedAt_idx" ON "MedicalConditionMaster"("orgId", "deletedAt");

-- AddForeignKey
ALTER TABLE "MedicalConditionMaster" ADD CONSTRAINT "MedicalConditionMaster_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
