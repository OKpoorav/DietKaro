import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import prisma from '../../utils/prisma';
import { notificationService } from '../../services/notification.service';
import { env } from '../../config/env';
import logger from '../../utils/logger';

let worker: Worker | null = null;

export function startComplianceAlertWorker(): Worker {
    const connection = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });

    worker = new Worker('compliance-alert', async (job) => {
        logger.info('Running compliance alert check');

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        const yesterdayEnd = new Date(yesterdayStart);
        yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);

        // Get all meal logs from yesterday for active plans
        const mealLogs = await prisma.mealLog.findMany({
            where: {
                scheduledDate: { gte: yesterdayStart, lt: yesterdayEnd },
                meal: { dietPlan: { status: 'active' } },
            },
            select: {
                clientId: true,
                status: true,
                client: { select: { fullName: true, orgId: true, primaryDietitianId: true } },
            },
        });

        // Group by client
        const clientMeals = new Map<string, { total: number; missed: number; client: typeof mealLogs[0]['client'] }>();
        for (const log of mealLogs) {
            const existing = clientMeals.get(log.clientId) || { total: 0, missed: 0, client: log.client };
            existing.total++;
            if (log.status === 'pending') existing.missed++;
            clientMeals.set(log.clientId, existing);
        }

        let sent = 0;
        for (const [clientId, data] of clientMeals) {
            if (data.total === 0 || !data.client?.primaryDietitianId) continue;

            const missRate = data.missed / data.total;
            if (missRate > 0.5) {
                try {
                    await notificationService.sendNotification(
                        data.client.primaryDietitianId,
                        'user',
                        data.client.orgId,
                        'Low adherence alert',
                        `${data.client.fullName} missed ${data.missed} of ${data.total} meals yesterday`,
                        { entityType: 'client', entityId: clientId, deepLink: `/dashboard/clients/${clientId}` },
                        'compliance_alert'
                    );
                    sent++;
                } catch (err) {
                    logger.warn('Failed to send compliance alert', {
                        clientId,
                        error: (err as Error).message,
                    });
                }
            }
        }

        logger.info('Compliance alert check complete', { clientsChecked: clientMeals.size, alertsSent: sent });
    }, { connection, concurrency: 1 });

    worker.on('failed', (job, err) => {
        logger.error('Compliance alert job failed', { jobId: job?.id, error: err.message });
    });

    logger.info('Compliance alert worker started');
    return worker;
}

export async function stopComplianceAlertWorker(): Promise<void> {
    if (worker) {
        await worker.close();
        worker = null;
    }
}
