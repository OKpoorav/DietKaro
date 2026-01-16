import { Router } from 'express';
import { listReports, getUploadUrl, createReport, deleteReport } from '../controllers/reports.controller';
import { requireClientAuth } from '../middleware/clientAuth.middleware';

const router = Router();

// All routes require client authentication
router.use(requireClientAuth);

// List client's reports
router.get('/', listReports);

// Get presigned upload URL
router.post('/upload-url', getUploadUrl);

// Create/confirm report after upload
router.post('/', createReport);

// Delete a report
router.delete('/:id', deleteReport);

export default router;
