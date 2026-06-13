-- AlterTable
ALTER TABLE "public"."MealLog" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "DietPlan_orgId_isActive_status_idx" ON "public"."DietPlan"("orgId", "isActive", "status");

-- CreateIndex
CREATE INDEX "Meal_planId_deletedAt_idx" ON "public"."Meal"("planId", "deletedAt");
