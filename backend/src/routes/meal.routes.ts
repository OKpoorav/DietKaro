import { Router } from 'express';
import { addMealToPlan, updateMeal, deleteMeal } from '../controllers/meal.controller';
import { addFoodToMeal, updateMealFoodItem, removeFoodFromMeal } from '../controllers/foodItem.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

// Meal CRUD
router.post('/', addMealToPlan);
router.patch('/:id', updateMeal);
router.delete('/:id', deleteMeal);

// Meal Food Items
router.post('/:mealId/food-items', addFoodToMeal);
router.patch('/:mealId/food-items/:itemId', updateMealFoodItem);
router.delete('/:mealId/food-items/:itemId', removeFoodFromMeal);

export default router;
