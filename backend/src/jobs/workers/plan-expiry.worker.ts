import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import prisma from '../../utils/prisma';
import { notificationService } from '../../services/notification.service';
import { env } from '../../config/env';
import logger from '../../utils/logger';

let worker: Worker | null = null;

export function startPlanExpiryWorker(): Worker {
    const connection = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });

    worker = new Worker('plan-expiry', async (job) => {
        logger.info('Running plan expiry check');

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
        const tomorrowEnd = new Date(tomorrowStart);
        tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

        // Find active plans whose endDate is tomorrow
        const expiringPlans = await prisma.dietPlan.findMany({
            where: {
                status: 'active',
                isActive: true,
                endDate: { gte: tomorrowStart, lt: tomorrowEnd },
            },
            include: {
                client: { select: { id: true, fullName: true, orgId: true, primaryDietitianId: true } },
                creator: { select: { id: true } },
            },
        });

        let sent = 0;
        for (const plan of expiringPlans) {
            const dietitianId = plan.client?.primaryDietitianId || plan.creator?.id;
            if (!dietitianId || !plan.client) continue;

            try {
                await notificationService.sendNotification(
                    dietitianId,
                    'user',
                    plan.client.orgId,
                    'Diet plan expiring tomorrow',
                    `${plan.client.fullName}'s plan "${plan.name}" ends tomorrow. Consider creating a new plan.`,
                    { entityType: 'diet_plan', entityId: plan.id, deepLink: `/dashboard/diet-plans/${plan.id}` },
                    'plan_expiry'
                );
                sent++;
            } catch (err) {
                logger.warn('Failed to send plan expiry notification', {
                    planId: plan.id,
                    error: (err as Error).message,
                });
            }
        }

        logger.info('Plan expiry check complete', { found: expiringPlans.length, sent });
    }, { connection, concurrency: 1 });

    worker.on('failed', (job, err) => {
        logger.error('Plan expiry job failed', { jobId: job?.id, error: err.message });
    });

    logger.info('Plan expiry worker started');
    return worker;
}

export async function stopPlanExpiryWorker(): Promise<void> {
    if (worker) {
        await worker.close();
        worker = null;
    }
}
