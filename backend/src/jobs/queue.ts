import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';

export interface DocumentProcessingJobData {
    reportId: string;
}

// Shared Redis connection for BullMQ (reuses same Redis as Socket.io)
export const redisConnection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
});

export const documentQueue = new Queue<DocumentProcessingJobData>('document-processing', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
    },
});

export async function enqueueDocumentProcessing(reportId: string): Promise<void> {
    await documentQueue.add('process', { reportId }, { jobId: `report_${reportId}` });
}
