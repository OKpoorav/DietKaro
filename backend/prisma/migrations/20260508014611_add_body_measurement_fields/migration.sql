-- AlterTable
ALTER TABLE "public"."BodyMeasurement" ADD COLUMN     "bellyAboveNavelCm" DECIMAL(5,2),
ADD COLUMN     "bellyBelowNavelCm" DECIMAL(5,2),
ADD COLUMN     "calfCm" DECIMAL(5,2),
ADD COLUMN     "stomachCm" DECIMAL(5,2);

-- CreateIndex
CREATE INDEX "Lead_orgId_primaryMobile_idx" ON "public"."Lead"("orgId", "primaryMobile");
