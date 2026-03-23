-- Database CHECK constraints for data integrity
-- Run manually or via prisma migrate

-- Weight must be positive
ALTER TABLE "WeightLog" ADD CONSTRAINT "WeightLog_weightKg_positive" CHECK ("weightKg" > 0);

-- Food item nutritional values must be non-negative
ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_calories_non_negative" CHECK ("calories" >= 0);
ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_protein_non_negative" CHECK ("proteinG" >= 0);
ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_carbs_non_negative" CHECK ("carbsG" >= 0);
ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_fats_non_negative" CHECK ("fatsG" >= 0);

-- Invoice total must be non-negative
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_total_non_negative" CHECK ("total" >= 0);

-- Client measurements must be positive (when not null)
ALTER TABLE "Client" ADD CONSTRAINT "Client_heightCm_positive" CHECK ("heightCm" IS NULL OR "heightCm" > 0);
ALTER TABLE "Client" ADD CONSTRAINT "Client_currentWeightKg_positive" CHECK ("currentWeightKg" IS NULL OR "currentWeightKg" > 0);
ALTER TABLE "Client" ADD CONSTRAINT "Client_targetWeightKg_positive" CHECK ("targetWeightKg" IS NULL OR "targetWeightKg" > 0);
