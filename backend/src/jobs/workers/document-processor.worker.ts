import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../../config/env';
import { processReportDocument } from '../../services/document-summarizer.service';
import { DocumentProcessingJobData, moveToDeadLetter } from '../queue';
import logger from '../../utils/logger';

let worker: Worker | null = null;

export function startDocumentProcessorWorker(): Worker {
    // Worker needs its own dedicated connection (BullMQ requirement)
    const workerConnection = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });
    // Unhandled ioredis 'error' events crash the whole process.
    workerConnection.on('error', (err) => logger.error('Document processor worker Redis error', { error: err.message }));

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
        // Retries exhausted — park in the dead-letter queue for inspection/replay
        if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
            moveToDeadLetter('document-processing', String(job.id), job.data, err.message)
                .catch((dlqErr) => logger.error('Failed to move job to DLQ', { error: (dlqErr as Error).message }));
        }
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
