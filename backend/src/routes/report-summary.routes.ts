import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getReportSummary, triggerReportSummarize } from '../controllers/document-summary.controller';

const router = Router({ mergeParams: true });
router.use(requireAuth);

// GET  /api/v1/reports/:reportId/summary    — get per-doc summary + extracted JSON
// POST /api/v1/reports/:reportId/summarize  — re-trigger processing
router.get('/:reportId/summary', getReportSummary);
router.post('/:reportId/summarize', triggerReportSummarize);

export default router;
