import { Router } from 'express';
import {
    createWeightLogGeneral,
    listAllWeightLogs,
    uploadProgressPhoto
} from '../controllers/weightLog.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { uploadSinglePhoto } from '../middleware/upload.middleware';

const router = Router();

router.use(requireAuth);

router.post('/', createWeightLogGeneral);
router.get('/', listAllWeightLogs);
router.post('/:id/photo', uploadSinglePhoto, uploadProgressPhoto);

export default router;
