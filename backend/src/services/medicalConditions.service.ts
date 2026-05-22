import prisma from '../utils/prisma';
import logger from '../utils/logger';

const DEFAULT_CONDITIONS = [
    'Diabetes Type 1',
    'Diabetes Type 2',
    'Hypertension',
    'Thyroid',
    'PCOD/PCOS',
    'Heart Disease',
    'Kidney Disease',
    'Liver Disease',
    'Anemia',
    'Osteoporosis',
    'IBS',
    'Celiac Disease',
    'Asthma',
    'Arthritis',
    'High Cholesterol',
];

export async function seedDefaultConditionsIfEmpty(orgId: string): Promise<void> {
    const existing = await prisma.medicalConditionMaster.count({ where: { orgId, deletedAt: null } });
    if (existing > 0) return;
    try {
        await prisma.medicalConditionMaster.createMany({
            data: DEFAULT_CONDITIONS.map((name) => ({ orgId, name, isSystem: true })),
            skipDuplicates: true,
        });
        logger.info('Seeded default medical conditions', { orgId });
    } catch (err) {
        logger.warn('Failed to seed default medical conditions', { orgId, error: (err as Error).message });
    }
}

export async function listConditions(orgId: string, search?: string) {
    await seedDefaultConditionsIfEmpty(orgId);
    return prisma.medicalConditionMaster.findMany({
        where: {
            orgId,
            deletedAt: null,
            ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
        },
        orderBy: { name: 'asc' },
    });
}

export async function createCondition(orgId: string, name: string) {
    return prisma.medicalConditionMaster.create({ data: { orgId, name } });
}

export async function updateCondition(id: string, orgId: string, data: { name?: string; active?: boolean }) {
    return prisma.medicalConditionMaster.update({ where: { id, orgId }, data });
}

export async function deleteCondition(id: string, orgId: string) {
    return prisma.medicalConditionMaster.update({ where: { id, orgId }, data: { deletedAt: new Date(), active: false } });
}
