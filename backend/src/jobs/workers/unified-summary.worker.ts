import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../../config/env';
import { buildAndCacheUnifiedSummary } from '../../services/document-summarizer.service';
import { UnifiedSummaryJobData, moveToDeadLetter } from '../queue';
import logger from '../../utils/logger';

let worker: Worker | null = null;

export function startUnifiedSummaryWorker(): Worker {
    // Worker needs its own dedicated connection (BullMQ requirement)
    const workerConnection = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });
    // Unhandled ioredis 'error' events crash the whole process.
    workerConnection.on('error', (err) => logger.error('Unified summary worker Redis error', { error: err.message }));

    worker = new Worker<UnifiedSummaryJobData>(
        'unified-summary',
        async (job) => {
            logger.info('Unified summary job started', { jobId: job.id, clientId: job.data.clientId });
            await buildAndCacheUnifiedSummary(job.data.clientId, job.data.orgId);
        },
        {
            connection: workerConnection,
            concurrency: 2, // expensive GPT-4o calls — keep concurrency low
        },
    );

    worker.on('completed', (job) => {
        logger.info('Unified summary job completed', { jobId: job.id, clientId: job.data.clientId });
    });

    worker.on('failed', (job, err) => {
        logger.error('Unified summary job failed', {
            jobId: job?.id,
            clientId: job?.data?.clientId,
            error: err.message,
            attempts: job?.attemptsMade,
        });
        // Retries exhausted — park in the dead-letter queue for inspection/replay
        if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
            moveToDeadLetter('unified-summary', String(job.id), job.data, err.message)
                .catch((dlqErr) => logger.error('Failed to move job to DLQ', { error: (dlqErr as Error).message }));
        }
    });

    logger.info('Unified summary worker started (concurrency=2)');
    return worker;
}

export async function stopUnifiedSummaryWorker(): Promise<void> {
    if (worker) {
        await worker.close();
        worker = null;
    }
}
