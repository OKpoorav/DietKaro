import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { invoiceService } from '../services/invoice.service';

export const createInvoice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const invoice = await invoiceService.createInvoice(req.body, req.user.organizationId, req.user.id);
    res.status(201).json({ success: true, data: invoice });
});

export const getInvoice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const invoice = await invoiceService.getInvoice(req.params.id, req.user.organizationId);
    res.status(200).json({ success: true, data: invoice });
});

export const listInvoices = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { invoices, meta } = await invoiceService.listInvoices(
        req.user.organizationId,
        req.query as { clientId?: string; status?: string; page?: string; pageSize?: string }
    );
    res.status(200).json({ success: true, data: invoices, meta });
});

export const updateInvoice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const invoice = await invoiceService.updateInvoice(req.params.id, req.body, req.user.organizationId);
    res.status(200).json({ success: true, data: invoice });
});

export const markInvoicePaid = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const invoice = await invoiceService.markAsPaid(req.params.id, req.user.organizationId);
    res.status(200).json({ success: true, data: invoice });
});

export const deleteInvoice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await invoiceService.deleteInvoice(req.params.id, req.user.organizationId);
    res.status(204).send();
});
