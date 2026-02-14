import prisma from '../utils/prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';
import { buildPaginationParams, buildPaginationMeta } from '../utils/queryFilters';

export class InvoiceService {
    async createInvoice(
        data: {
            clientId: string;
            issueDate: string;
            dueDate: string;
            subtotal: number;
            tax?: number;
            notes?: string;
        },
        orgId: string,
        userId: string
    ) {
        const client = await prisma.client.findFirst({ where: { id: data.clientId, orgId } });
        if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

        // Generate invoice number: INV-YYYYMM-XXXX
        const count = await prisma.invoice.count({ where: { orgId } });
        const now = new Date();
        const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

        const tax = data.tax ?? 0;
        const total = data.subtotal + tax;

        const invoice = await prisma.invoice.create({
            data: {
                orgId,
                clientId: data.clientId,
                createdByUserId: userId,
                invoiceNumber,
                issueDate: new Date(data.issueDate),
                dueDate: new Date(data.dueDate),
                subtotal: data.subtotal,
                tax,
                total,
                notes: data.notes,
                status: 'unpaid',
            },
            include: {
                client: { select: { id: true, fullName: true, email: true } },
                creator: { select: { id: true, fullName: true } },
            },
        });

        logger.info('Invoice created', { invoiceId: invoice.id, invoiceNumber });
        return invoice;
    }

    async getInvoice(invoiceId: string, orgId: string) {
        const invoice = await prisma.invoice.findFirst({
            where: { id: invoiceId, orgId },
            include: {
                client: { select: { id: true, fullName: true, email: true, phone: true } },
                creator: { select: { id: true, fullName: true } },
            },
        });

        if (!invoice) throw AppError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');
        return invoice;
    }

    async listInvoices(orgId: string, query: { clientId?: string; status?: string; page?: string; pageSize?: string }) {
        const pagination = buildPaginationParams(query.page, query.pageSize);

        const where: Prisma.InvoiceWhereInput = { orgId };
        if (query.clientId) where.clientId = query.clientId;
        if (query.status) where.status = query.status as Prisma.EnumInvoiceStatusFilter;

        const [invoices, total] = await prisma.$transaction([
            prisma.invoice.findMany({
                where,
                skip: pagination.skip,
                take: pagination.take,
                orderBy: { createdAt: 'desc' },
                include: {
                    client: { select: { id: true, fullName: true, email: true } },
                    creator: { select: { id: true, fullName: true } },
                },
            }),
            prisma.invoice.count({ where }),
        ]);

        return {
            invoices,
            meta: buildPaginationMeta(total, pagination),
        };
    }

    async updateInvoice(invoiceId: string, data: { notes?: string; dueDate?: string; status?: string }, orgId: string) {
        const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, orgId } });
        if (!invoice) throw AppError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');

        const updateData: Record<string, unknown> = {};
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
        if (data.status !== undefined) updateData.status = data.status;

        // Track when invoice is sent
        if (data.status === 'sent' && !invoice.sentAt) {
            updateData.sentAt = new Date();
        }

        const updated = await prisma.invoice.update({
            where: { id: invoiceId },
            data: updateData,
            include: {
                client: { select: { id: true, fullName: true, email: true } },
                creator: { select: { id: true, fullName: true } },
            },
        });

        logger.info('Invoice updated', { invoiceId, status: updated.status });
        return updated;
    }

    async markAsPaid(invoiceId: string, orgId: string) {
        const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, orgId } });
        if (!invoice) throw AppError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');

        const updated = await prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: 'paid' },
        });

        logger.info('Invoice marked as paid', { invoiceId });
        return updated;
    }

    async deleteInvoice(invoiceId: string, orgId: string) {
        const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, orgId } });
        if (!invoice) throw AppError.notFound('Invoice not found', 'INVOICE_NOT_FOUND');

        if (invoice.status === 'paid') {
            throw AppError.badRequest('Cannot delete a paid invoice', 'INVOICE_PAID');
        }

        await prisma.invoice.delete({ where: { id: invoiceId } });
        logger.info('Invoice deleted', { invoiceId });
    }
}

export const invoiceService = new InvoiceService();
