import { Router } from 'express';
import {
    createMealLog,
    listMealLogs,
    getMealLog,
    updateMealLog,
    reviewMealLog,
    uploadMealPhoto
} from '../controllers/mealLog.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { uploadSinglePhoto } from '../middleware/upload.middleware';

const router = Router();

router.use(requireAuth);

router.post('/', createMealLog);
router.get('/', listMealLogs);
router.get('/:id', getMealLog);
router.patch('/:id', updateMealLog);
router.patch('/:id/review', reviewMealLog);
router.post('/:id/photo', uploadSinglePhoto, uploadMealPhoto);

export default router;
