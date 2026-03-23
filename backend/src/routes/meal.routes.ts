import { Router } from 'express';
import { addMealToPlan, updateMeal, deleteMeal } from '../controllers/meal.controller';
import { addFoodToMeal, updateMealFoodItem, removeFoodFromMeal } from '../controllers/foodItem.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { addMealSchema, updateMealSchema } from '../schemas/meal.schema';
import { addFoodToMealSchema, updateMealFoodItemSchema } from '../schemas/foodItem.schema';

const router = Router();

router.use(requireAuth);

// Meal CRUD
router.post('/', validateBody(addMealSchema), addMealToPlan);
router.patch('/:id', validateBody(updateMealSchema), updateMeal);
router.delete('/:id', deleteMeal);

// Meal Food Items
router.post('/:mealId/food-items', validateBody(addFoodToMealSchema), addFoodToMeal);
router.patch('/:mealId/food-items/:itemId', validateBody(updateMealFoodItemSchema), updateMealFoodItem);
router.delete('/:mealId/food-items/:itemId', removeFoodFromMeal);

export default router;
