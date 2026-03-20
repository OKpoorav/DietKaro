import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getClientDocumentSummary, regenerateClientDocumentSummary } from '../controllers/document-summary.controller';

const router = Router({ mergeParams: true });
router.use(requireAuth);

// GET  /api/v1/clients/:clientId/document-summary            — get unified summary
// POST /api/v1/clients/:clientId/document-summary/regenerate — force rebuild
router.get('/', getClientDocumentSummary);
router.post('/regenerate', regenerateClientDocumentSummary);

export default router;
