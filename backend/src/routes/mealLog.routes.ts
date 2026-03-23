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
import { requireActiveSubscription } from '../middleware/subscription.middleware';
import { uploadSinglePhoto } from '../middleware/upload.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { createMealLogSchema, updateMealLogSchema, reviewMealLogSchema } from '../schemas/mealLog.schema';

const router = Router();

router.use(requireAuth);
router.use(requireActiveSubscription);

router.post('/', validateBody(createMealLogSchema), createMealLog);
router.get('/', listMealLogs);
router.get('/:id', getMealLog);
router.patch('/:id', validateBody(updateMealLogSchema), updateMealLog);
router.patch('/:id/review', validateBody(reviewMealLogSchema), reviewMealLog);
router.post('/:id/photo', uploadSinglePhoto, uploadMealPhoto);

export default router;
