import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import prisma from '../utils/prisma';
import { enqueueDocumentProcessing, enqueueUnifiedSummary } from '../jobs/queue';
import { getCachedUnifiedSummary } from '../services/document-summarizer.service';
import { signDownloadToken } from '../routes/media.routes';

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

    // Check cache — if not present, enqueue background generation
    const cachedSummaryText = await getCachedUnifiedSummary(clientId);

    const [unifiedSummaryRecord, reports] = await Promise.all([
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
                uploaderRole: true,
                uploadedByUserId: true,
                uploadedBy: { select: { fullName: true } },
                summary: { select: { summaryText: true, generatedAt: true, extractedData: true } },
            },
            orderBy: { uploadedAt: 'desc' },
        }),
    ]);

    // If no cached summary, enqueue a background job to generate it
    if (!cachedSummaryText) {
        await enqueueUnifiedSummary(clientId, orgId);
    }

    // Build media-proxy URLs instead of presigned S3 URLs to avoid
    // exposing the internal Docker hostname (minio:9000) to clients.
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const documents = reports.map((r) => {
        const key = r.s3Key || (r.fileUrl?.includes('.amazonaws.com/') ? r.fileUrl.split('.amazonaws.com/')[1] : r.fileUrl);
        const token = key ? signDownloadToken(key, orgId) : '';
        const viewUrl = key ? `${baseUrl}/media/${key}?token=${token}` : r.fileUrl;
        const { s3Key, fileUrl, uploadedBy, ...rest } = r;
        return { ...rest, uploadedByName: uploadedBy?.fullName ?? null, viewUrl };
    });

    res.status(200).json({
        success: true,
        data: {
            clientId,
            unifiedSummary: unifiedSummaryRecord ?? null,
            status: cachedSummaryText ? 'ready' : 'generating',
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

    // Delete cached summary and enqueue background rebuild
    await prisma.clientDocumentSummary.deleteMany({ where: { clientId } });
    await enqueueUnifiedSummary(clientId, orgId);

    res.status(202).json({
        success: true,
        message: 'Summary regeneration queued',
    });
});
