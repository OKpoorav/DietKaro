import { Router } from 'express';
import { listReports, getUploadUrl, createReport, deleteReport, uploadReportDirect } from '../controllers/reports.controller';
import { requireClientAuth } from '../middleware/clientAuth.middleware';
import { uploadSingleReport } from '../middleware/upload.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';

const router = Router();

// All routes require client authentication
router.use(requireClientAuth);

// List client's reports
router.get('/', listReports);

// Direct multipart upload (mobile — avoids presigned URL / internal hostname issue)
router.post('/upload', writeOperationLimiter, uploadSingleReport, uploadReportDirect);

// Get presigned upload URL (web only)
router.post('/upload-url', getUploadUrl);

// Create/confirm report after upload
router.post('/', createReport);

// Delete a report
router.delete('/:id', deleteReport);

export default router;
