import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../../config/env';
import { EmailPdfJobData } from '../queue';
import prisma from '../../utils/prisma';
import { generateDietPlanPDF } from '../../utils/pdfGenerator';
import { sendEmail, generateDietPlanEmailHtml } from '../../utils/emailService';
import { escapeHtml } from '../../utils/htmlEscape';
import logger from '../../utils/logger';

let worker: Worker | null = null;

export function startEmailPdfWorker(): Worker {
    // Worker needs its own dedicated connection (BullMQ requirement)
    const workerConnection = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });

    worker = new Worker<EmailPdfJobData>(
        'email-pdf',
        async (job) => {
            const { planId, orgId, recipientEmail, customMessage, userId } = job.data;

            logger.info('Email PDF job started', { jobId: job.id, planId, recipientEmail });

            // 1. Fetch the diet plan from DB
            const plan = await prisma.dietPlan.findFirst({
                where: { id: planId, orgId, isActive: true },
                include: {
                    client: {
                        select: {
                            fullName: true,
                            email: true,
                            currentWeightKg: true,
                            targetWeightKg: true,
                        },
                    },
                    creator: {
                        select: { fullName: true },
                    },
                    meals: {
                        orderBy: [{ dayOfWeek: 'asc' }, { sequenceNumber: 'asc' }],
                        include: {
                            foodItems: {
                                orderBy: [{ optionGroup: 'asc' }, { sortOrder: 'asc' }],
                                include: { foodItem: true },
                            },
                        },
                    },
                },
            });

            if (!plan) {
                throw new Error(`Diet plan ${planId} not found or inactive`);
            }

            // 2. Generate PDF as buffer
            const doc = generateDietPlanPDF(plan);
            const chunks: Buffer[] = [];

            await new Promise<void>((resolve, reject) => {
                doc.on('data', (chunk: Buffer) => chunks.push(chunk));
                doc.on('end', () => resolve());
                doc.on('error', reject);
                doc.end();
            });

            const pdfBuffer = Buffer.concat(chunks);

            // 3. Generate email HTML
            const html = generateDietPlanEmailHtml(
                plan.name,
                plan.client?.fullName || 'Client',
                plan.creator?.fullName || 'Your Dietitian'
            );

            // 4. Send email with PDF attachment
            const sent = await sendEmail({
                to: recipientEmail,
                subject: `Your Diet Plan: ${plan.name}`,
                html: customMessage
                    ? `<p>${escapeHtml(customMessage)}</p>${html}`
                    : html,
                attachments: [
                    {
                        filename: `${plan.name.replace(/[^a-z0-9]/gi, '-')}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf',
                    },
                ],
            });

            if (!sent) {
                throw new Error(`Failed to send email to ${recipientEmail} for plan ${planId}`);
            }

            // 5. Log success
            logger.info('Diet plan emailed successfully', {
                planId,
                to: recipientEmail,
                userId,
            });
        },
        {
            connection: workerConnection,
            concurrency: 2, // email isn't super urgent
        },
    );

    worker.on('completed', (job) => {
        logger.info('Email PDF job completed', {
            jobId: job.id,
            planId: job.data.planId,
            recipientEmail: job.data.recipientEmail,
        });
    });

    worker.on('failed', (job, err) => {
        logger.error('Email PDF job failed', {
            jobId: job?.id,
            planId: job?.data?.planId,
            recipientEmail: job?.data?.recipientEmail,
            error: err.message,
            attempts: job?.attemptsMade,
        });
    });

    logger.info('Email PDF worker started (concurrency=2)');
    return worker;
}

export async function stopEmailPdfWorker(): Promise<void> {
    if (worker) {
        await worker.close();
        worker = null;
    }
}
