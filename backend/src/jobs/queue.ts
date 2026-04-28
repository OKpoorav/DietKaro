import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';
import logger from '../utils/logger';

export interface DocumentProcessingJobData {
    reportId: string;
}

export interface EmailPdfJobData {
    planId: string;
    orgId: string;
    recipientEmail: string;
    customMessage?: string;
    userId: string;
}

// Shared Redis connection for BullMQ (reuses same Redis as Socket.io)
export const redisConnection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
});

// ── Dead Letter Queue ────────────────────────────────────────────────
// Failed jobs that exhaust retries are moved here for auditing/replay
export const deadLetterQueue = new Queue('dead-letter', {
    connection: redisConnection,
    defaultJobOptions: {
        removeOnComplete: { age: 7 * 24 * 3600 }, // keep 7 days
        removeOnFail: false, // never auto-remove from DLQ
    },
});

/** Move a failed job to the dead letter queue for later inspection */
export async function moveToDeadLetter(
    sourceQueue: string,
    jobId: string,
    jobData: unknown,
    failedReason: string
) {
    await deadLetterQueue.add('failed-job', {
        sourceQueue,
        originalJobId: jobId,
        data: jobData,
        failedReason,
        failedAt: new Date().toISOString(),
    });
    logger.error('Job moved to dead letter queue', { sourceQueue, jobId, failedReason });
}

export const documentQueue = new Queue<DocumentProcessingJobData>('document-processing', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 200 }, // keep failed for inspection
    },
});

export const emailPdfQueue = new Queue<EmailPdfJobData>('email-pdf', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 200 },
    },
});

export async function enqueueDocumentProcessing(reportId: string): Promise<void> {
    await documentQueue.add('process', { reportId }, { jobId: `report_${reportId}` });
}

export async function enqueueEmailPdf(data: EmailPdfJobData): Promise<void> {
    // Deterministic jobId prevents duplicate sends for the same plan+recipient
    await emailPdfQueue.add('send-email-pdf', data, {
        jobId: `email-pdf_${data.planId}_${data.recipientEmail}`,
    });
}

// ── Unified Summary Queue ──────────────────────────────────────────

export interface UnifiedSummaryJobData {
    clientId: string;
    orgId: string;
}

export const unifiedSummaryQueue = new Queue<UnifiedSummaryJobData>('unified-summary', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 200 },
    },
});

export async function enqueueUnifiedSummary(clientId: string, orgId: string): Promise<void> {
    await unifiedSummaryQueue.add('build-summary', { clientId, orgId }, { jobId: `summary_${clientId}` });
}

// ── Scheduled Notification Queues ────────────────────────────────────

// Meal reminder — runs every 15 minutes
export const mealReminderQueue = new Queue('meal-reminder', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 50 },
    },
});

// Plan expiry check — runs daily at 9 AM
export const planExpiryQueue = new Queue('plan-expiry', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 10 },
    },
});

// Compliance alert — runs daily at 10 AM
export const complianceAlertQueue = new Queue('compliance-alert', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 10 },
    },
});

// Lead followup reminder — runs every 5 minutes
export const leadFollowupReminderQueue = new Queue('lead-followup-reminder', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 50 },
    },
});

// ── All queues list (for graceful shutdown draining) ─────────────────
export const ALL_QUEUES = [
    documentQueue,
    emailPdfQueue,
    unifiedSummaryQueue,
    mealReminderQueue,
    planExpiryQueue,
    complianceAlertQueue,
    leadFollowupReminderQueue,
];

/** Call once on server start to register repeatable job schedules */
export async function setupScheduledJobs() {
    // Meal reminders every 15 minutes
    await mealReminderQueue.upsertJobScheduler('meal-reminder-scheduler',
        { every: 15 * 60 * 1000 },
        { name: 'check-meals' }
    );

    // Plan expiry daily at 9 AM
    await planExpiryQueue.upsertJobScheduler('plan-expiry-scheduler',
        { pattern: '0 9 * * *' },
        { name: 'check-expiry' }
    );

    // Compliance alert daily at 10 AM
    await complianceAlertQueue.upsertJobScheduler('compliance-alert-scheduler',
        { pattern: '0 10 * * *' },
        { name: 'check-compliance' }
    );

    // Lead followup reminder every 5 minutes
    await leadFollowupReminderQueue.upsertJobScheduler('lead-followup-reminder-scheduler',
        { every: 5 * 60 * 1000 },
        { name: 'check-lead-followups' }
    );
}
