import { FollowupType } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';
import { logTouchpoint } from './leadTouchpoints.service';

export async function listFollowups(leadId: string, orgId: string) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId } });
    if (!lead) throw AppError.notFound('Lead not found');

    return prisma.leadFollowup.findMany({
        where: { leadId },
        orderBy: { dueAt: 'asc' },
        include: { createdBy: { select: { id: true, fullName: true } } },
    });
}

export async function createFollowup(
    leadId: string,
    orgId: string,
    actorUserId: string,
    data: { dueAt: Date; type: FollowupType; notes?: string },
) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId } });
    if (!lead) throw AppError.notFound('Lead not found');

    const followup = await prisma.leadFollowup.create({
        data: { leadId, ...data, createdByUserId: actorUserId },
    });

    await logTouchpoint(leadId, 'followup_scheduled', actorUserId, {
        followupId: followup.id,
        type: data.type,
        dueAt: data.dueAt.toISOString(),
    });

    return followup;
}

export async function updateFollowup(
    id: string,
    leadId: string,
    orgId: string,
    data: { dueAt?: Date; type?: FollowupType; notes?: string },
) {
    const followup = await prisma.leadFollowup.findFirst({
        where: { id, leadId, lead: { orgId } },
    });
    if (!followup) throw AppError.notFound('Follow-up not found');
    return prisma.leadFollowup.update({ where: { id }, data });
}

export async function completeFollowup(id: string, leadId: string, orgId: string, actorUserId: string) {
    const followup = await prisma.leadFollowup.findFirst({
        where: { id, leadId, lead: { orgId } },
    });
    if (!followup) throw AppError.notFound('Follow-up not found');
    if (followup.completedAt) throw AppError.badRequest('Follow-up already completed');

    const updated = await prisma.leadFollowup.update({
        where: { id },
        data: { completedAt: new Date() },
    });

    await logTouchpoint(leadId, 'followup_completed', actorUserId, {
        followupId: id,
        type: followup.type,
    });

    return updated;
}
