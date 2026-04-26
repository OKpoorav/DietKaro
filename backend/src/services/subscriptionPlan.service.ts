import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';
import {
    CreateSubscriptionPlanInput,
    UpdateSubscriptionPlanInput,
    deriveDurationDays,
} from '../schemas/subscriptionPlan.schema';

export const subscriptionPlanService = {
    async list(orgId: string, includeInactive = false) {
        return prisma.subscriptionPlan.findMany({
            where: {
                orgId,
                deletedAt: null,
                ...(includeInactive ? {} : { active: true }),
            },
            orderBy: [{ active: 'desc' }, { costInr: 'asc' }],
        });
    },

    async create(orgId: string, userId: string, input: CreateSubscriptionPlanInput) {
        const durationDays = input.durationDays ?? deriveDurationDays(input.recurrenceUnit, input.intervalCount);

        const existing = await prisma.subscriptionPlan.findFirst({
            where: { orgId, name: input.name, deletedAt: null },
        });
        if (existing) throw AppError.conflict(`A plan named "${input.name}" already exists`);

        return prisma.subscriptionPlan.create({
            data: {
                orgId,
                name: input.name,
                recurrenceUnit: input.recurrenceUnit,
                intervalCount: input.intervalCount,
                durationDays,
                costInr: input.costInr,
                active: input.active,
                createdByUserId: userId,
            },
        });
    },

    async update(planId: string, orgId: string, input: UpdateSubscriptionPlanInput) {
        const plan = await prisma.subscriptionPlan.findFirst({
            where: { id: planId, orgId, deletedAt: null },
        });
        if (!plan) throw AppError.notFound('Plan not found');

        if (input.name && input.name !== plan.name) {
            const dupe = await prisma.subscriptionPlan.findFirst({
                where: { orgId, name: input.name, deletedAt: null, NOT: { id: planId } },
            });
            if (dupe) throw AppError.conflict(`A plan named "${input.name}" already exists`);
        }

        const nextUnit = input.recurrenceUnit ?? plan.recurrenceUnit;
        const nextCount = input.intervalCount ?? plan.intervalCount;
        const nextDuration =
            input.durationDays ?? (input.recurrenceUnit || input.intervalCount
                ? deriveDurationDays(nextUnit, nextCount)
                : plan.durationDays);

        return prisma.subscriptionPlan.update({
            where: { id: planId },
            data: {
                name: input.name ?? plan.name,
                recurrenceUnit: nextUnit,
                intervalCount: nextCount,
                durationDays: nextDuration,
                costInr: input.costInr ?? plan.costInr,
                active: input.active ?? plan.active,
            },
        });
    },

    async softDelete(planId: string, orgId: string) {
        const plan = await prisma.subscriptionPlan.findFirst({
            where: { id: planId, orgId, deletedAt: null },
        });
        if (!plan) throw AppError.notFound('Plan not found');

        // Block delete if any subscription still references this plan.
        const inUse = await prisma.clientSubscription.count({
            where: { planId },
        });
        if (inUse > 0) {
            throw AppError.conflict(
                `Plan is assigned to ${inUse} client(s). Reassign them or deactivate the plan instead.`,
                'PLAN_IN_USE',
            );
        }

        return prisma.subscriptionPlan.update({
            where: { id: planId },
            data: { deletedAt: new Date(), active: false },
        });
    },
};
