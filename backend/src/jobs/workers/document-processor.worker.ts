import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../../config/env';
import { processReportDocument } from '../../services/document-summarizer.service';
import { DocumentProcessingJobData } from '../queue';
import logger from '../../utils/logger';

let worker: Worker | null = null;

export function startDocumentProcessorWorker(): Worker {
    // Worker needs its own dedicated connection (BullMQ requirement)
    const workerConnection = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });

    worker = new Worker<DocumentProcessingJobData>(
        'document-processing',
        async (job) => {
            logger.info('Document job started', { jobId: job.id, reportId: job.data.reportId });
            await processReportDocument(job.data.reportId);
        },
        {
            connection: workerConnection,
            concurrency: 3, // process up to 3 documents simultaneously
        },
    );

    worker.on('completed', (job) => {
        logger.info('Document job completed', { jobId: job.id, reportId: job.data.reportId });
    });

    worker.on('failed', (job, err) => {
        logger.error('Document processing job failed', {
            jobId: job?.id,
            reportId: job?.data?.reportId,
            error: err.message,
            attempts: job?.attemptsMade,
        });
    });

    logger.info('Document processor worker started (concurrency=3)');
    return worker;
}

export async function stopDocumentProcessorWorker(): Promise<void> {
    if (worker) {
        await worker.close();
        worker = null;
    }
}
