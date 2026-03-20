import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import prisma from '../utils/prisma';
import { enqueueDocumentProcessing } from '../jobs/queue';
import { getOrBuildUnifiedSummary } from '../services/document-summarizer.service';
import { getPresignedUrl } from '../services/storage.service';

// ─────────────────────────────────────────────
// GET /api/v1/reports/:reportId/summary
// Returns the per-document Level-1 summary and extracted JSON
// ─────────────────────────────────────────────
export const getReportSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { reportId } = req.params;
    const orgId = req.user!.organizationId;

    const report = await prisma.clientReport.findFirst({
        where: { id: reportId, orgId },
        include: { summary: true },
    });

    if (!report) throw AppError.notFound('Report not found');

    res.status(200).json({
        success: true,
        data: {
            reportId: report.id,
            fileName: report.fileName,
            reportType: report.reportType,
            processingStatus: report.processingStatus,
            processingError: report.processingError ?? null,
            summary: report.summary
                ? {
                    summaryText: report.summary.summaryText,
                    extractedData: report.summary.extractedData,
                    modelVersion: report.summary.modelVersion,
                    generatedAt: report.summary.generatedAt,
                }
                : null,
        },
    });
});

// ─────────────────────────────────────────────
// POST /api/v1/reports/:reportId/summarize
// Re-triggers processing (resets status and re-queues)
// ─────────────────────────────────────────────
export const triggerReportSummarize = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { reportId } = req.params;
    const orgId = req.user!.organizationId;

    const report = await prisma.clientReport.findFirst({ where: { id: reportId, orgId } });
    if (!report) throw AppError.notFound('Report not found');

    await prisma.clientReport.update({
        where: { id: reportId },
        data: { processingStatus: 'pending', processingError: null },
    });

    await enqueueDocumentProcessing(reportId);

    res.status(202).json({ success: true, message: 'Summarization queued' });
});

// ─────────────────────────────────────────────
// GET /api/v1/clients/:clientId/document-summary
// Returns Level-2 unified summary + per-doc status list
// ─────────────────────────────────────────────
export const getClientDocumentSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { clientId } = req.params;
    const orgId = req.user!.organizationId;

    const client = await prisma.client.findFirst({ where: { id: clientId, orgId } });
    if (!client) throw AppError.notFound('Client not found');

    // Build unified summary if not cached, then fetch the full record
    await getOrBuildUnifiedSummary(clientId);

    const [unifiedSummary, reports] = await Promise.all([
        prisma.clientDocumentSummary.findUnique({
            where: { clientId },
            select: { id: true, summaryText: true, docCount: true, modelVersion: true, generatedAt: true, updatedAt: true },
        }),
        prisma.clientReport.findMany({
            where: { clientId, orgId },
            select: {
                id: true,
                fileName: true,
                fileType: true,
                reportType: true,
                processingStatus: true,
                processingError: true,
                uploadedAt: true,
                s3Key: true,
                fileUrl: true,
                summary: { select: { summaryText: true, generatedAt: true, extractedData: true } },
            },
            orderBy: { uploadedAt: 'desc' },
        }),
    ]);

    // Generate presigned view URLs per document
    const documents = await Promise.all(
        reports.map(async (r) => {
            const key = r.s3Key || (r.fileUrl?.includes('.amazonaws.com/') ? r.fileUrl.split('.amazonaws.com/')[1] : r.fileUrl);
            const viewUrl = key ? await getPresignedUrl(key, 3600).catch(() => r.fileUrl) : r.fileUrl;
            const { s3Key, fileUrl, ...rest } = r;
            return { ...rest, viewUrl };
        })
    );

    res.status(200).json({
        success: true,
        data: {
            clientId,
            unifiedSummary,
            documents,
        },
    });
});

// ─────────────────────────────────────────────
// POST /api/v1/clients/:clientId/document-summary/regenerate
// Force-rebuilds the unified summary from scratch
// ─────────────────────────────────────────────
export const regenerateClientDocumentSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { clientId } = req.params;
    const orgId = req.user!.organizationId;

    const client = await prisma.client.findFirst({ where: { id: clientId, orgId } });
    if (!client) throw AppError.notFound('Client not found');

    // Delete cached summary so getOrBuildUnifiedSummary rebuilds it
    await prisma.clientDocumentSummary.deleteMany({ where: { clientId } });

    const unifiedSummary = await getOrBuildUnifiedSummary(clientId);

    res.status(200).json({
        success: true,
        data: { clientId, unifiedSummary },
    });
});
