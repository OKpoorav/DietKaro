import { Router } from 'express';
import {
    createFoodItem,
    listFoodItems,
    getFoodItem,
    updateFoodItem,
    deleteFoodItem
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

export default router;
