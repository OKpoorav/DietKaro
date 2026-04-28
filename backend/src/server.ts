// Must be set before any I/O modules are loaded
process.env.UV_THREADPOOL_SIZE = '16';

import 'dotenv/config'; // Prevents hoisting issues
import { env } from './config/env'; // Validates env vars — crashes early if invalid
import http from 'http';
import app from './app';
import { initializeSocket, getIO } from './socket';
import { startDocumentProcessorWorker, stopDocumentProcessorWorker } from './jobs/workers/document-processor.worker';
import { startEmailPdfWorker, stopEmailPdfWorker } from './jobs/workers/email-pdf.worker';
import { startUnifiedSummaryWorker, stopUnifiedSummaryWorker } from './jobs/workers/unified-summary.worker';
import { startMealReminderWorker, stopMealReminderWorker } from './jobs/workers/meal-reminder.worker';
import { startPlanExpiryWorker, stopPlanExpiryWorker } from './jobs/workers/plan-expiry.worker';
import { startComplianceAlertWorker, stopComplianceAlertWorker } from './jobs/workers/compliance-alert.worker';
import { startLeadFollowupReminderWorker, stopLeadFollowupReminderWorker } from './jobs/workers/lead-followup-reminder.worker';
import { setupScheduledJobs, ALL_QUEUES } from './jobs/queue';
import logger from './utils/logger';
import prisma from './utils/prisma';
import redis from './utils/redis';

const server = http.createServer(app);
initializeSocket(server);

// Start BullMQ workers for background processing
startDocumentProcessorWorker();
startEmailPdfWorker();
startUnifiedSummaryWorker();
startMealReminderWorker();
startPlanExpiryWorker();
startComplianceAlertWorker();
startLeadFollowupReminderWorker();

// Register repeatable job schedules (meal reminders, plan expiry, compliance alerts)
setupScheduledJobs().catch((err) => {
    logger.error('Failed to setup scheduled jobs', { error: (err as Error).message });
});

server.listen(env.PORT, () => {
    logger.info(`Server is running on port ${env.PORT}`);
});

// ── Graceful shutdown ────────────────────────────────────────────────
async function gracefulShutdown(signal: string) {
    logger.info(`Received ${signal}, starting graceful shutdown…`);

    // Hard timeout — force exit if cleanup hangs (increased to 15s for queue draining)
    const forceTimer = setTimeout(() => {
        logger.error('Graceful shutdown timed out after 15s, forcing exit');
        process.exit(1);
    }, 15_000);
    forceTimer.unref();

    try {
        // 1. Stop accepting new HTTP connections
        logger.info('Closing HTTP server…');
        await new Promise<void>((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
        });

        // 2. Close Socket.io
        logger.info('Closing Socket.io…');
        try {
            const io = getIO();
            await io.close();
        } catch {
            // Socket.io may not have been initialized
        }

        // 3. Stop BullMQ workers (let in-flight jobs finish)
        logger.info('Stopping BullMQ workers…');
        await Promise.all([
            stopDocumentProcessorWorker(),
            stopEmailPdfWorker(),
            stopUnifiedSummaryWorker(),
            stopMealReminderWorker(),
            stopPlanExpiryWorker(),
            stopComplianceAlertWorker(),
            stopLeadFollowupReminderWorker(),
        ]);

        // 4. Close BullMQ queues (flush pending commands)
        logger.info('Closing BullMQ queues…');
        await Promise.all(ALL_QUEUES.map(q => q.close()));

        // 5. Disconnect Prisma
        logger.info('Disconnecting Prisma…');
        await prisma.$disconnect();

        // 6. Close Redis
        logger.info('Closing Redis connection…');
        await redis.quit();

        logger.info('Graceful shutdown complete');
        process.exit(0);
    } catch (err) {
        logger.error('Error during graceful shutdown', { error: err });
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

