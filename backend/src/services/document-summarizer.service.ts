import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { downloadFromStorage } from './storage.service';
import { extractContent, isSupportedMimeType } from './extraction/registry';
import { extractMedicalInfo } from './ai/document-extract';
import { buildUnifiedClientSummary, DocSummaryInput } from './ai/unified-summary';

function keyFromUrl(fileUrl: string): string {
    // Legacy AWS URLs: extract key after amazonaws.com/
    const parts = fileUrl.split('.amazonaws.com/');
    if (parts.length === 2) return parts[1];
    throw new Error(`Cannot extract S3 key from URL: ${fileUrl}`);
}

/**
 * Core orchestrator: downloads the file from S3, extracts text/structured data,
 * runs Level-1 AI extraction and stores results in ReportSummary.
 * Called by the BullMQ worker for every confirmed upload.
 */
export async function processReportDocument(reportId: string): Promise<void> {
    const report = await prisma.clientReport.findUnique({ where: { id: reportId } });
    if (!report) throw new Error(`Report not found: ${reportId}`);

    // Idempotency: skip if already fully processed
    if (report.processingStatus === 'done') {
        logger.info('Report already processed, skipping', { reportId });
        return;
    }

    // Determine effective MIME type
    const mimeType = report.mimeType ?? (report.fileType === 'pdf' ? 'application/pdf' : null);

    // Skip unsupported types (images) without failing
    if (!mimeType || !isSupportedMimeType(mimeType)) {
        await prisma.clientReport.update({
            where: { id: reportId },
            data: { processingStatus: 'skipped' },
        });
        logger.info('Report skipped (unsupported type)', { reportId, mimeType });
        return;
    }

    await prisma.clientReport.update({ where: { id: reportId }, data: { processingStatus: 'extracting' } });

    try {
        // Step 1: Download from S3
        const s3Key = report.s3Key ?? keyFromUrl(report.fileUrl);
        const buffer = await downloadFromStorage(s3Key);

        // Step 2: Extract content
        const extracted = await extractContent(buffer, mimeType);
        const rawText = extracted.type === 'text'
            ? extracted.content
            : JSON.stringify(extracted.content);

        // Persist raw text immediately so re-runs don't need to re-download
        await prisma.reportSummary.upsert({
            where: { reportId },
            create: { reportId, rawText },
            update: { rawText },
        });

        // Step 3: Level-1 AI extraction (Gemini Flash)
        // Check if AI extraction was already done (e.g. partial retry after crash)
        const existingSummary = await prisma.reportSummary.findUnique({ where: { reportId } });
        if (existingSummary?.summaryText) {
            await prisma.clientReport.update({ where: { id: reportId }, data: { processingStatus: 'done' } });
            logger.info('Report summary already exists, skipping AI extraction', { reportId });
            return;
        }

        await prisma.clientReport.update({ where: { id: reportId }, data: { processingStatus: 'summarizing' } });

        const medicalInfo = await extractMedicalInfo(extracted, report.reportType ?? 'other');

        // Step 4: Store structured result
        await prisma.reportSummary.update({
            where: { reportId },
            data: {
                summaryText: medicalInfo.summary,
                extractedData: medicalInfo as object,
                modelVersion: 'gemini-2.0-flash',
                promptVersion: 1,
                generatedAt: new Date(),
            },
        });

        await prisma.clientReport.update({ where: { id: reportId }, data: { processingStatus: 'done' } });

        // Step 5: Invalidate any cached unified summary — will be rebuilt on next request
        await prisma.clientDocumentSummary.deleteMany({ where: { clientId: report.clientId } });

        logger.info('Report processed successfully', { reportId, clientId: report.clientId });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        await prisma.clientReport.update({
            where: { id: reportId },
            data: { processingStatus: 'failed', processingError: msg },
        });
        logger.error('Report processing failed', { reportId, error: msg });
        throw error; // Re-throw so BullMQ marks the job as failed and schedules retry
    }
}

/**
 * Returns the cached unified summary for a client, or builds and caches one on the fly.
 * Level-2 uses the default model (GPT-4o / GPT-5).
 */
export async function getOrBuildUnifiedSummary(clientId: string): Promise<string | null> {
    const existing = await prisma.clientDocumentSummary.findUnique({ where: { clientId } });
    // Only use cache if it has actual content — stale null records from failed builds are skipped
    if (existing?.summaryText) return existing.summaryText;

    const summaries = await prisma.reportSummary.findMany({
        where: { report: { clientId, processingStatus: 'done' } },
        include: { report: { select: { reportType: true } } },
    });

    const inputs: DocSummaryInput[] = summaries
        .filter(s => s.summaryText)
        .map(s => ({
            reportType: s.report.reportType ?? 'other',
            summary: s.summaryText!,
            flags: ((s.extractedData as Record<string, unknown>)?.dietary_flags as string[]) ?? [],
        }));

    if (inputs.length === 0) return null;

    const summaryText = await buildUnifiedClientSummary(inputs);

    await prisma.clientDocumentSummary.upsert({
        where: { clientId },
        create: { clientId, summaryText, docCount: inputs.length, modelVersion: 'gpt-4o' },
        update: { summaryText, docCount: inputs.length, modelVersion: 'gpt-4o', updatedAt: new Date() },
    });

    return summaryText;
}
