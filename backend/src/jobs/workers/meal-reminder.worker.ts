import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import prisma from '../../utils/prisma';
import { notificationService } from '../../services/notification.service';
import { env } from '../../config/env';
import { moveToDeadLetter } from '../queue';
import logger from '../../utils/logger';

let worker: Worker | null = null;

export function startMealReminderWorker(): Worker {
    const connection = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });
    // Unhandled ioredis 'error' events crash the whole process.
    connection.on('error', (err) => logger.error('Meal reminder worker Redis error', { error: err.message }));

    worker = new Worker('meal-reminder', async (job) => {
        logger.info('Running meal reminder check');

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Find today's pending meal logs whose scheduled meal is coming up.
        // reminderSentAt null = not yet notified — makes job retries idempotent.
        const pendingMealLogs = await prisma.mealLog.findMany({
            where: {
                scheduledDate: today,
                status: 'pending',
                reminderSentAt: null,
                meal: {
                    dietPlan: { status: 'active', isActive: true },
                },
            },
            include: {
                meal: { select: { mealType: true, timeOfDay: true } },
                client: { select: { id: true, fullName: true, orgId: true, pushTokens: true } },
            },
        });

        let sent = 0;
        let failures = 0;
        for (const mealLog of pendingMealLogs) {
            // Parse timeOfDay (format: "HH:MM") and check if within the next 15 min
            const timeStr = mealLog.scheduledTime || mealLog.meal?.timeOfDay;
            if (!timeStr) continue;

            const [hours, minutes] = timeStr.split(':').map(Number);
            if (isNaN(hours) || isNaN(minutes)) continue;

            const mealTime = new Date(today);
            mealTime.setHours(hours, minutes, 0, 0);

            const diffMs = mealTime.getTime() - now.getTime();
            // Send reminder if meal is 0-15 minutes from now
            if (diffMs >= 0 && diffMs <= 15 * 60 * 1000) {
                if (!mealLog.client?.pushTokens?.length) continue;

                try {
                    await notificationService.sendNotification(
                        mealLog.clientId,
                        'client',
                        mealLog.orgId,
                        `Time for your ${mealLog.meal?.mealType || 'meal'}!`,
                        `Don't forget to log your ${mealLog.meal?.mealType || 'meal'}`,
                        { entityType: 'meal_log', entityId: mealLog.id, deepLink: `/meals/${mealLog.id}` },
                        'meal_reminder'
                    );
                    await prisma.mealLog.update({
                        where: { id: mealLog.id },
                        data: { reminderSentAt: now },
                    });
                    sent++;
                } catch (err) {
                    failures++;
                    logger.warn('Failed to send meal reminder', {
                        mealLogId: mealLog.id,
                        error: (err as Error).message,
                    });
                }
            }
        }

        logger.info('Meal reminder check complete', { checked: pendingMealLogs.length, sent, failures });

        // Total failure (e.g. notification service down) — surface it so BullMQ
        // retries. Safe: reminderSentAt gates already-sent logs, so no duplicates.
        if (failures > 0 && sent === 0) {
            throw new Error(`All ${failures} meal reminder sends failed`);
        }
    }, { connection, concurrency: 1 });

    worker.on('failed', (job, err) => {
        logger.error('Meal reminder job failed', { jobId: job?.id, error: err.message });
        // Retries exhausted — park in the dead-letter queue for inspection/replay
        if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
            moveToDeadLetter('meal-reminder', String(job.id), job.data, err.message)
                .catch((dlqErr) => logger.error('Failed to move job to DLQ', { error: (dlqErr as Error).message }));
        }
    });

    logger.info('Meal reminder worker started');
    return worker;
}

export async function stopMealReminderWorker(): Promise<void> {
    if (worker) {
        await worker.close();
        worker = null;
    }
}
