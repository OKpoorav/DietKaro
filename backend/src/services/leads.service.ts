import { Gender, LeadTemperature, ReferralType, TouchpointKind } from '@prisma/client';
import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';
import { logTouchpoint } from './leadTouchpoints.service';
import { findSystemStatus, seedDefaultStatusesIfEmpty } from './leadStatuses.service';
import { seedDefaultSourcesIfEmpty } from './leadSources.service';

export interface LeadFilters {
    search?: string;
    statusIds?: string[];
    sourceIds?: string[];
    ownerUserId?: string;
    temperature?: LeadTemperature;
    referralType?: ReferralType;
    createdFrom?: Date;
    createdTo?: Date;
    dueToday?: boolean;
    overdue?: boolean;
    showArchived?: boolean;
}

const LEAD_SELECT = {
    id: true, orgId: true, name: true, primaryMobile: true, altMobile: true,
    email: true, age: true, gender: true, city: true, reference: true,
    referralType: true, temperature: true, notes: true, convertedClientId: true,
    archivedAt: true, createdAt: true, updatedAt: true, sourceId: true,
    ownerUserId: true, statusId: true,
    source: { select: { id: true, name: true } },
    status: { select: { id: true, name: true, color: true, isSystemDefault: true, isSystemConverted: true } },
    ownerUser: { select: { id: true, fullName: true, profilePhotoUrl: true } },
    followups: {
        where: { completedAt: null },
        orderBy: { dueAt: 'asc' as const },
        take: 1,
        select: { id: true, dueAt: true, type: true, notes: true },
    },
} as const;

export async function listLeads(orgId: string, filters: LeadFilters, page: number, pageSize: number) {
    await Promise.all([seedDefaultSourcesIfEmpty(orgId), seedDefaultStatusesIfEmpty(orgId)]);

    const now = new Date();
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

    const where: Record<string, unknown> = {
        orgId,
        archivedAt: filters.showArchived ? undefined : null,
    };

    if (filters.search) {
        where.OR = [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { primaryMobile: { contains: filters.search } },
            { email: { contains: filters.search, mode: 'insensitive' } },
        ];
    }
    if (filters.statusIds?.length) where.statusId = { in: filters.statusIds };
    if (filters.sourceIds?.length) where.sourceId = { in: filters.sourceIds };
    if (filters.ownerUserId) where.ownerUserId = filters.ownerUserId;
    if (filters.temperature) where.temperature = filters.temperature;
    if (filters.referralType) where.referralType = filters.referralType;
    if (filters.createdFrom || filters.createdTo) {
        where.createdAt = {
            ...(filters.createdFrom ? { gte: filters.createdFrom } : {}),
            ...(filters.createdTo ? { lte: filters.createdTo } : {}),
        };
    }
    if (filters.dueToday) {
        where.followups = { some: { completedAt: null, dueAt: { gte: todayStart, lte: todayEnd } } };
    }
    if (filters.overdue) {
        where.followups = { some: { completedAt: null, dueAt: { lt: now } } };
    }

    const [items, total] = await Promise.all([
        prisma.lead.findMany({
            where,
            select: LEAD_SELECT,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.lead.count({ where }),
    ]);

    return { items, total, page, pageSize };
}

export async function getLead(id: string, orgId: string) {
    const lead = await prisma.lead.findFirst({
        where: { id, orgId },
        include: {
            source: true,
            status: true,
            ownerUser: { select: { id: true, fullName: true, profilePhotoUrl: true } },
            followups: {
                orderBy: { dueAt: 'asc' },
                include: { createdBy: { select: { id: true, fullName: true } } },
            },
            tagAssignments: { include: { tag: true } },
            convertedClient: { select: { id: true, fullName: true } },
        },
    });
    if (!lead) throw AppError.notFound('Lead not found');
    return lead;
}

export interface CreateLeadInput {
    name: string;
    primaryMobile: string;
    altMobile?: string;
    email?: string;
    age?: number;
    gender?: Gender;
    city?: string;
    sourceId?: string;
    reference?: string;
    referralType?: ReferralType;
    ownerUserId?: string;
    statusId?: string;
    temperature?: LeadTemperature;
    notes?: string;
}

export async function createLead(orgId: string, data: CreateLeadInput, actorUserId: string) {
    await seedDefaultStatusesIfEmpty(orgId);

    let statusId = data.statusId;
    if (!statusId) {
        const defaultStatus = await findSystemStatus(orgId, 'default');
        if (!defaultStatus) throw AppError.internal('No default lead status found');
        statusId = defaultStatus.id;
    }

    return prisma.lead.create({
        data: { orgId, ...data, statusId },
        include: {
            source: true,
            status: true,
            ownerUser: { select: { id: true, fullName: true } },
        },
    });
}

type PipelineField = 'statusId' | 'sourceId' | 'ownerUserId' | 'temperature';
const TRACKED_FIELDS: PipelineField[] = ['statusId', 'sourceId', 'ownerUserId', 'temperature'];

export async function updateLead(
    id: string,
    orgId: string,
    patch: Partial<CreateLeadInput> & { notes?: string },
    actorUserId: string,
) {
    const existing = await prisma.lead.findFirst({ where: { id, orgId } });
    if (!existing) throw AppError.notFound('Lead not found');

    const updated = await prisma.lead.update({
        where: { id },
        data: patch,
        include: {
            source: true,
            status: true,
            ownerUser: { select: { id: true, fullName: true } },
        },
    });

    // Auto-log field_change touchpoint for tracked pipeline fields
    for (const field of TRACKED_FIELDS) {
        const patchValue = (patch as Record<string, unknown>)[field];
        if (patchValue !== undefined && patchValue !== (existing as Record<string, unknown>)[field]) {
            await logTouchpoint(id, 'field_change', actorUserId, {
                field,
                from: (existing as Record<string, unknown>)[field],
                to: patchValue,
            });
        }
    }

    // Owner re-assignment: in-app notification to new owner
    if (patch.ownerUserId && patch.ownerUserId !== existing.ownerUserId) {
        await prisma.notification.create({
            data: {
                recipientId: patch.ownerUserId,
                recipientType: 'user',
                orgId,
                type: 'lead_assigned',
                category: 'lead_assigned',
                title: 'Lead assigned to you',
                message: `You have been assigned lead: ${existing.name}`,
                deepLink: `/dashboard/leads/${id}`,
                relatedEntityType: 'lead',
                relatedEntityId: id,
                sentViaChannels: ['in_app'],
            },
        });
    }

    return updated;
}

export async function archiveLead(id: string, orgId: string, actorUserId: string) {
    const lead = await prisma.lead.findFirst({ where: { id, orgId } });
    if (!lead) throw AppError.notFound('Lead not found');
    if (lead.archivedAt) throw AppError.badRequest('Lead is already archived');

    await prisma.lead.update({ where: { id }, data: { archivedAt: new Date() } });
    await logTouchpoint(id, 'archived', actorUserId);
    return { success: true };
}

export async function restoreLead(id: string, orgId: string, actorUserId: string) {
    const lead = await prisma.lead.findFirst({ where: { id, orgId } });
    if (!lead) throw AppError.notFound('Lead not found');
    if (!lead.archivedAt) throw AppError.badRequest('Lead is not archived');

    await prisma.lead.update({ where: { id }, data: { archivedAt: null } });
    await logTouchpoint(id, 'restored', actorUserId);
    return { success: true };
}

export async function convertLead(
    id: string,
    orgId: string,
    actorUserId: string,
    clientPayload: {
        fullName: string;
        email: string;
        phone: string;
        altPhone?: string;
        gender?: Gender;
        dateOfBirth?: Date;
        city?: string;
    },
) {
    const lead = await prisma.lead.findFirst({ where: { id, orgId } });
    if (!lead) throw AppError.notFound('Lead not found');

    // Idempotent: already converted
    if (lead.convertedClientId) return { clientId: lead.convertedClientId, alreadyConverted: true };

    const convertedStatus = await findSystemStatus(orgId, 'converted');
    if (!convertedStatus) throw AppError.internal('No converted status found');

    const result = await prisma.$transaction(async (tx) => {
        const client = await tx.client.create({
            data: {
                orgId,
                fullName: clientPayload.fullName,
                email: clientPayload.email,
                phone: clientPayload.phone,
                gender: clientPayload.gender,
                dateOfBirth: clientPayload.dateOfBirth,
                createdByUserId: actorUserId,
            },
        });

        await tx.lead.update({
            where: { id },
            data: {
                convertedClientId: client.id,
                statusId: convertedStatus.id,
                archivedAt: new Date(),
            },
        });

        await tx.leadTouchpoint.create({
            data: {
                leadId: id,
                kind: TouchpointKind.converted,
                actorUserId,
                payload: { clientId: client.id },
            },
        });

        return client;
    });

    return { clientId: result.id, alreadyConverted: false };
}

export async function recordProposalShared(
    id: string,
    orgId: string,
    actorUserId: string,
    payload: { planId: string; pdfFilename: string },
) {
    const lead = await prisma.lead.findFirst({ where: { id, orgId } });
    if (!lead) throw AppError.notFound('Lead not found');
    await logTouchpoint(id, 'proposal_shared', actorUserId, payload);
    return { success: true };
}

export async function getDashboardWidget(orgId: string) {
    const now = new Date();
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

    const [dueToday, overdue] = await Promise.all([
        prisma.leadFollowup.findMany({
            where: {
                completedAt: null,
                dueAt: { gte: todayStart, lte: todayEnd },
                lead: { orgId, archivedAt: null },
            },
            take: 5,
            orderBy: { dueAt: 'asc' },
            include: {
                lead: { select: { id: true, name: true } },
            },
        }),
        prisma.leadFollowup.count({
            where: {
                completedAt: null,
                dueAt: { lt: todayStart },
                lead: { orgId, archivedAt: null },
            },
        }),
    ]);

    return { dueToday, overdueCount: overdue };
}
