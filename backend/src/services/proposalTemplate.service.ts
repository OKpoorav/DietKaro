import prisma from '../utils/prisma';

const DEFAULT_TEMPLATE = {
    headerCopy: null,
    logoUrl: null,
    footerNote: null,
    signatureLine: null,
    customFields: [],
};

export async function getTemplate(orgId: string) {
    const existing = await prisma.proposalTemplate.findUnique({ where: { orgId } });
    if (existing) return existing;
    return prisma.proposalTemplate.create({ data: { orgId, customFields: [] } });
}

export async function upsertTemplate(
    orgId: string,
    data: {
        headerCopy?: string | null;
        logoUrl?: string | null;
        footerNote?: string | null;
        signatureLine?: string | null;
        customFields?: Array<{ label: string; sortOrder: number }>;
    },
) {
    return prisma.proposalTemplate.upsert({
        where: { orgId },
        update: data,
        create: { orgId, ...DEFAULT_TEMPLATE, ...data },
    });
}
