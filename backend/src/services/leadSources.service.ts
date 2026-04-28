import prisma from '../utils/prisma';
import logger from '../utils/logger';

const DEFAULT_SOURCES = [
    'Instagram',
    'Facebook Ads',
    'Google Search',
    'Referral',
    'Walk-in',
    'Website Form',
    'Campaign',
];

export async function seedDefaultSourcesIfEmpty(orgId: string): Promise<void> {
    const existing = await prisma.leadSource.count({ where: { orgId, deletedAt: null } });
    if (existing > 0) return;
    try {
        await prisma.leadSource.createMany({
            data: DEFAULT_SOURCES.map((name) => ({ orgId, name, isSystem: true })),
            skipDuplicates: true,
        });
        logger.info('Seeded default lead sources', { orgId });
    } catch (err) {
        logger.warn('Failed to seed default lead sources', { orgId, error: (err as Error).message });
    }
}

export async function listSources(orgId: string) {
    await seedDefaultSourcesIfEmpty(orgId);
    return prisma.leadSource.findMany({
        where: { orgId, deletedAt: null },
        orderBy: { name: 'asc' },
    });
}

export async function createSource(orgId: string, name: string) {
    return prisma.leadSource.create({ data: { orgId, name } });
}

export async function updateSource(id: string, orgId: string, data: { name?: string; active?: boolean }) {
    return prisma.leadSource.update({ where: { id, orgId }, data });
}

export async function deleteSource(id: string, orgId: string) {
    const inUse = await prisma.lead.count({ where: { sourceId: id } });
    if (inUse > 0) throw Object.assign(new Error('Source is used by leads — reassign first'), { statusCode: 409, code: 'SOURCE_IN_USE' });
    return prisma.leadSource.update({ where: { id, orgId }, data: { deletedAt: new Date(), active: false } });
}
