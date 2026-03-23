import { Router } from 'express';
import {
    createFoodItem,
    listFoodItems,
    listBaseIngredients,
    getFoodItem,
    updateFoodItem,
    deleteFoodItem,
    updateFoodTags,
    autoTagFood,
    bulkAutoTagFoods
} from '../controllers/foodItem.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { createFoodItemSchema, updateFoodItemSchema } from '../schemas/foodItem.schema';

const router = Router();

router.use(requireAuth);

// Food Items CRUD
router.post('/', validateBody(createFoodItemSchema), createFoodItem);
router.get('/', listFoodItems);
router.get('/base-ingredients', listBaseIngredients);
router.get('/:id', getFoodItem);
router.patch('/:id', validateBody(updateFoodItemSchema), updateFoodItem);
router.delete('/:id', deleteFoodItem);

// Tagging endpoints
router.patch('/:id/tags', updateFoodTags);
router.post('/:id/auto-tag', autoTagFood);
router.post('/bulk-auto-tag', bulkAutoTagFoods);

export default router;

