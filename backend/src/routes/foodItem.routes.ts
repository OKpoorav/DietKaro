import { Router } from 'express';
import {
    createFoodItem,
    listFoodItems,
    getFoodItem,
    updateFoodItem,
    deleteFoodItem,
    updateFoodTags,
    autoTagFood,
    bulkAutoTagFoods
} from '../controllers/foodItem.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

// Food Items CRUD
router.post('/', createFoodItem);
router.get('/', listFoodItems);
router.get('/:id', getFoodItem);
router.patch('/:id', updateFoodItem);
router.delete('/:id', deleteFoodItem);

// Tagging endpoints
router.patch('/:id/tags', updateFoodTags);
router.post('/:id/auto-tag', autoTagFood);
router.post('/bulk-auto-tag', bulkAutoTagFoods);

export default router;

