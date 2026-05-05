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
    data: { dueAt: Date; type: string; notes?: string; outcome?: string; lostReason?: string; callbackAt?: Date },
) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId } });
    if (!lead) throw AppError.notFound('Lead not found');

    const followup = await prisma.leadFollowup.create({
        data: {
            leadId,
            createdByUserId: actorUserId,
            dueAt: data.dueAt,
            type: data.type as any,
            notes: data.notes,
            outcome: data.outcome,
            lostReason: data.lostReason,
            callbackAt: data.callbackAt,
        },
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
    data: { dueAt?: Date; type?: string; notes?: string; outcome?: string; lostReason?: string; callbackAt?: Date },
) {
    const followup = await prisma.leadFollowup.findFirst({
        where: { id, leadId, lead: { orgId } },
    });
    if (!followup) throw AppError.notFound('Follow-up not found');
    return prisma.leadFollowup.update({ where: { id }, data: data as any });
}

export async function completeFollowup(
    id: string,
    leadId: string,
    orgId: string,
    actorUserId: string,
    outcomeData?: { outcome?: string; lostReason?: string; callbackAt?: Date; notes?: string },
) {
    const followup = await prisma.leadFollowup.findFirst({
        where: { id, leadId, lead: { orgId } },
    });
    if (!followup) throw AppError.notFound('Follow-up not found');
    if (followup.completedAt) throw AppError.badRequest('Follow-up already completed');

    const updated = await prisma.leadFollowup.update({
        where: { id },
        data: {
            completedAt: new Date(),
            ...(outcomeData?.outcome && { outcome: outcomeData.outcome }),
            ...(outcomeData?.lostReason && { lostReason: outcomeData.lostReason }),
            ...(outcomeData?.callbackAt && { callbackAt: outcomeData.callbackAt }),
            ...(outcomeData?.notes && { notes: outcomeData.notes }),
        } as any,
    });

    await logTouchpoint(leadId, 'followup_completed', actorUserId, {
        followupId: id,
        type: followup.type,
        outcome: outcomeData?.outcome,
    });

    return updated;
}
