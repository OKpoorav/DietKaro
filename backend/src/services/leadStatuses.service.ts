import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { AppError } from '../errors/AppError';

interface DefaultStatus { name: string; color: string; sortOrder: number; isSystemDefault?: boolean; isSystemConverted?: boolean }

const DEFAULT_STATUSES: DefaultStatus[] = [
    { name: 'New Lead',              color: '#6B7280', sortOrder: 0, isSystemDefault: true },
    { name: 'Contacted',             color: '#3B82F6', sortOrder: 1 },
    { name: 'Consultation Booked',   color: '#8B5CF6', sortOrder: 2 },
    { name: 'Interested',            color: '#10B981', sortOrder: 3 },
    { name: 'Not Interested',        color: '#EF4444', sortOrder: 4 },
    { name: 'Follow-up Required',    color: '#F59E0B', sortOrder: 5 },
    { name: 'Converted (Client)',     color: '#059669', sortOrder: 6, isSystemConverted: true },
    { name: 'Lost',                  color: '#9CA3AF', sortOrder: 7 },
];

export async function seedDefaultStatusesIfEmpty(orgId: string): Promise<void> {
    const existing = await prisma.leadStatus.count({ where: { orgId, deletedAt: null } });
    if (existing > 0) return;
    try {
        await prisma.leadStatus.createMany({
            data: DEFAULT_STATUSES.map((s) => ({
                orgId,
                name: s.name,
                color: s.color,
                sortOrder: s.sortOrder,
                isSystemDefault: s.isSystemDefault ?? false,
                isSystemConverted: s.isSystemConverted ?? false,
            })),
            skipDuplicates: true,
        });
        logger.info('Seeded default lead statuses', { orgId });
    } catch (err) {
        logger.warn('Failed to seed default lead statuses', { orgId, error: (err as Error).message });
    }
}

export async function listStatuses(orgId: string) {
    await seedDefaultStatusesIfEmpty(orgId);
    return prisma.leadStatus.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
    });
}

export async function findSystemStatus(orgId: string, kind: 'default' | 'converted') {
    await seedDefaultStatusesIfEmpty(orgId);
    const where = kind === 'default'
        ? { orgId, isSystemDefault: true, deletedAt: null }
        : { orgId, isSystemConverted: true, deletedAt: null };
    return prisma.leadStatus.findFirst({ where });
}

export async function createStatus(orgId: string, data: { name: string; color?: string; sortOrder?: number }) {
    return prisma.leadStatus.create({ data: { orgId, ...data } });
}

export async function updateStatus(id: string, orgId: string, data: { name?: string; color?: string; sortOrder?: number }) {
    const status = await prisma.leadStatus.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!status) throw AppError.notFound('Status not found');

    // System rows: only allow color + sortOrder changes, not name
    if ((status.isSystemDefault || status.isSystemConverted) && data.name && data.name !== status.name) {
        throw AppError.badRequest('System status names cannot be changed');
    }
    return prisma.leadStatus.update({ where: { id }, data });
}

export async function deleteStatus(id: string, orgId: string) {
    const status = await prisma.leadStatus.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!status) throw AppError.notFound('Status not found');
    if (status.isSystemDefault || status.isSystemConverted) {
        throw AppError.badRequest('System statuses cannot be deleted');
    }
    const inUse = await prisma.lead.count({ where: { statusId: id } });
    if (inUse > 0) {
        throw Object.assign(new Error('Status has leads — reassign leads first'), { statusCode: 409, code: 'STATUS_IN_USE' });
    }
    return prisma.leadStatus.update({ where: { id }, data: { deletedAt: new Date() } });
}
