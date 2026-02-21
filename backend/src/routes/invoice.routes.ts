import { Router } from 'express';
import { createInvoice, getInvoice, listInvoices, updateInvoice, markInvoicePaid, deleteInvoice } from '../controllers/invoice.controller';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { requireActiveSubscription } from '../middleware/subscription.middleware';

const router = Router();

router.use(requireAuth);
router.use(requireActiveSubscription);
router.use(requireRole('admin', 'owner'));

router.post('/', createInvoice);
router.get('/', listInvoices);
router.get('/:id', getInvoice);
router.patch('/:id', updateInvoice);
router.post('/:id/mark-paid', markInvoicePaid);
router.delete('/:id', deleteInvoice);

export default router;
