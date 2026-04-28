import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import prisma from '../../utils/prisma';
import { emailService } from '../../services/email.service';
import { env } from '../../config/env';
import logger from '../../utils/logger';

let worker: Worker | null = null;

export function startLeadFollowupReminderWorker(): Worker {
    const connection = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });

    worker = new Worker('lead-followup-reminder', async () => {
        logger.info('Running lead followup reminder check');

        const now = new Date();

        // SELECT ... FOR UPDATE SKIP LOCKED: use raw query for idempotency
        const overdue = await prisma.$queryRaw<Array<{
            id: string; leadId: string; type: string; dueAt: Date; notes: string | null;
            ownerUserId: string | null; ownerEmail: string | null; ownerName: string | null;
            leadName: string; orgId: string;
        }>>`
            SELECT f.id, f."leadId", f.type::text, f."dueAt", f.notes,
                   l."ownerUserId", u.email AS "ownerEmail", u."fullName" AS "ownerName",
                   l.name AS "leadName", l."orgId"
            FROM "LeadFollowup" f
            JOIN "Lead" l ON l.id = f."leadId"
            LEFT JOIN "User" u ON u.id = l."ownerUserId"
            WHERE f."completedAt" IS NULL
              AND f."notifiedAt" IS NULL
              AND f."dueAt" <= ${now}
            LIMIT 200
            FOR UPDATE OF f SKIP LOCKED
        `;

        if (overdue.length === 0) return;

        const ids = overdue.map((r) => r.id);
        await prisma.leadFollowup.updateMany({ where: { id: { in: ids } }, data: { notifiedAt: now } });

        let notifSent = 0;
        let emailSent = 0;

        for (const row of overdue) {
            if (!row.ownerUserId) continue;

            const deepLink = `/dashboard/leads/${row.leadId}?tab=todos`;
            const dueLabel = row.dueAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, hour: 'numeric', minute: '2-digit', day: '2-digit', month: 'short' });

            // In-app notification
            try {
                await prisma.notification.create({
                    data: {
                        recipientId: row.ownerUserId,
                        recipientType: 'user',
                        orgId: row.orgId,
                        type: 'lead_followup',
                        category: 'lead_followup',
                        title: `Follow-up due: ${row.leadName}`,
                        message: `${row.type} follow-up due at ${dueLabel}`,
                        deepLink,
                        relatedEntityType: 'lead',
                        relatedEntityId: row.leadId,
                        sentViaChannels: ['in_app', 'email'],
                    },
                });
                notifSent++;
            } catch (err) {
                logger.warn('Failed to create lead followup notification', { followupId: row.id, error: (err as Error).message });
            }

            // Email reminder
            if (row.ownerEmail) {
                try {
                    await emailService.sendLeadFollowupReminder({
                        to: row.ownerEmail,
                        ownerName: row.ownerName ?? 'Team',
                        leadName: row.leadName,
                        followupType: row.type,
                        dueAt: dueLabel,
                        deepLink: `${env.FRONTEND_URL ?? 'https://app.healthpractix.com'}${deepLink}`,
                    });
                    emailSent++;
                } catch (err) {
                    logger.warn('Failed to send lead followup email', { followupId: row.id, error: (err as Error).message });
                }
            }
        }

        logger.info('Lead followup reminder check complete', { processed: overdue.length, notifSent, emailSent });
    }, { connection, concurrency: 1 });

    worker.on('failed', (job, err) => {
        logger.error('Lead followup reminder job failed', { jobId: job?.id, error: err.message });
    });

    logger.info('Lead followup reminder worker started');
    return worker;
}

export async function stopLeadFollowupReminderWorker(): Promise<void> {
    if (worker) {
        await worker.close();
        worker = null;
    }
}
