import { TouchpointKind } from '@prisma/client';
import prisma from '../utils/prisma';

export async function logTouchpoint(
    leadId: string,
    kind: TouchpointKind,
    actorUserId: string | null,
    payload?: Record<string, unknown>,
) {
    return prisma.leadTouchpoint.create({
        data: { leadId, kind, actorUserId, payload: payload ?? undefined },
        include: { actor: { select: { id: true, fullName: true, profilePhotoUrl: true } } },
    });
}

export async function logManual(
    leadId: string,
    kind: TouchpointKind,
    actorUserId: string,
    payload: { notes?: string; duration?: number; location?: string; createdAt?: Date },
) {
    return prisma.leadTouchpoint.create({
        data: {
            leadId,
            kind,
            actorUserId,
            payload,
            ...(payload.createdAt ? { createdAt: payload.createdAt } : {}),
        },
        include: { actor: { select: { id: true, fullName: true, profilePhotoUrl: true } } },
    });
}

export async function listTouchpoints(leadId: string, orgId: string, page: number, pageSize: number) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId } });
    if (!lead) return null;

    const [items, total] = await Promise.all([
        prisma.leadTouchpoint.findMany({
            where: { leadId },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: { actor: { select: { id: true, fullName: true, profilePhotoUrl: true } } },
        }),
        prisma.leadTouchpoint.count({ where: { leadId } }),
    ]);

    return { items, total, page, pageSize };
}
