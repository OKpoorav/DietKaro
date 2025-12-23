import { Router } from 'express';
import { createClient, getClient, listClients, updateClient, deleteClient, getClientProgress } from '../controllers/client.controller';
import { createWeightLog, listWeightLogs } from '../controllers/weightLog.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';

const router = Router();

// All client routes require authentication
router.use(requireAuth);

router.post('/', createClient);
router.get('/', listClients);
router.get('/:id', getClient);
router.patch('/:id', updateClient);
router.delete('/:id', requireRole('admin', 'owner'), deleteClient);

// Client progress analytics
router.get('/:id/progress', getClientProgress);

// Client weight logs
router.post('/:clientId/weight-logs', createWeightLog);
router.get('/:clientId/weight-logs', listWeightLogs);

export default router;
