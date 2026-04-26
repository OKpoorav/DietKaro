import { Router, Response } from 'express';
import { Prisma, PaymentState, SubscriptionState } from '@prisma/client';
import { requireAuth } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import prisma from '../utils/prisma';
import { subscriptionService } from '../services/subscription.service';
import { buildPaginationParams, buildPaginationMeta } from '../utils/queryFilters';

const router = Router();
router.use(requireAuth);

type Filter = 'all' | 'paid' | 'unpaid' | 'paused' | 'deactivated' | 'no-plan' | 'due-7' | 'due-30';

/**
 * GET /api/v1/subscriptions
 *
 * Aggregate listing for the Subscriptions tab. Joins clients with their
 * subscription + plan; supports filters on status/payment/due-window. Always
 * runs the lazy paymentStatus flip first.
 *
 * Returns BOTH clients with and without subscriptions so the dashboard can
 * surface "no plan" rows (the most useful starting state).
 */
router.get(
    '/',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const orgId = req.user.organizationId;

        await subscriptionService.flipUnpaidIfDue(orgId);

        const filter = (String(req.query.filter ?? 'all') as Filter);
        const search = req.query.search ? String(req.query.search) : undefined;
        const pagination = buildPaginationParams(
            req.query.page as string | undefined,
            req.query.pageSize as string | undefined,
        );

        const where: Prisma.ClientWhereInput = { orgId, isActive: true };
        if (req.user.role === 'dietitian') {
            where.primaryDietitianId = req.user.id;
        }
        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
            ];
        }

        // Filter narrowing
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch (filter) {
            case 'paid':
                where.subscription = { is: { paymentStatus: PaymentState.paid } };
                break;
            case 'unpaid':
                where.subscription = { is: { paymentStatus: PaymentState.unpaid } };
                break;
            case 'paused':
                where.subscription = { is: { status: SubscriptionState.paused } };
                break;
            case 'deactivated':
                where.subscription = { is: { status: SubscriptionState.deactivated } };
                break;
            case 'no-plan':
                where.subscription = { is: null };
                break;
            case 'due-7': {
                const limit = new Date(today);
                limit.setDate(limit.getDate() + 7);
                where.subscription = {
                    is: {
                        status: SubscriptionState.active,
                        renewalDate: { gte: today, lte: limit },
                    },
                };
                break;
            }
            case 'due-30': {
                const limit = new Date(today);
                limit.setDate(limit.getDate() + 30);
                where.subscription = {
                    is: {
                        status: SubscriptionState.active,
                        renewalDate: { gte: today, lte: limit },
                    },
                };
                break;
            }
            default:
                break;
        }

        const [clients, total] = await prisma.$transaction([
            prisma.client.findMany({
                where,
                skip: pagination.skip,
                take: pagination.take,
                orderBy: [{ updatedAt: 'desc' }, { fullName: 'asc' }],
                include: {
                    primaryDietitian: { select: { id: true, fullName: true } },
                    subscription: { include: { plan: true } },
                },
            }),
            prisma.client.count({ where }),
        ]);

        // Latest payment per client (for "last paid X days ago" UX)
        const latestPayments = clients.length > 0
            ? await prisma.payment.findMany({
                where: { clientId: { in: clients.map((c) => c.id) }, status: 'succeeded' },
                orderBy: { paidAt: 'desc' },
                distinct: ['clientId'],
                select: { clientId: true, paidAt: true, amountInr: true, method: true },
            })
            : [];
        const latestByClient = new Map(latestPayments.map((p) => [p.clientId, p]));

        const rows = clients.map((c) => ({
            id: c.id,
            fullName: c.fullName,
            email: c.email,
            phone: c.phone,
            primaryDietitian: c.primaryDietitian,
            subscription: c.subscription
                ? {
                    id: c.subscription.id,
                    planId: c.subscription.planId,
                    planName: c.subscription.plan.name,
                    costInr: c.subscription.plan.costInr,
                    activeDate: c.subscription.activeDate,
                    renewalDate: c.subscription.renewalDate,
                    status: c.subscription.status,
                    paymentStatus: c.subscription.paymentStatus,
                    pausedUntil: c.subscription.pausedUntil,
                    lastPaidAt: c.subscription.lastPaidAt,
                }
                : null,
            latestPayment: latestByClient.get(c.id) ?? null,
        }));

        res.status(200).json({
            success: true,
            data: rows,
            meta: buildPaginationMeta(total, pagination),
        });
    }),
);

export default router;
