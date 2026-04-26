import prisma from '../utils/prisma';
import logger from '../utils/logger';

/**
 * Default tag seed — applied lazily on first list call per org.
 * Keep keywords lowercased; matching engine lowercases inputs too.
 */
const DEFAULT_TAGS: { name: string; color: string; keywords: string[] }[] = [
    { name: 'Weight Loss', color: 'green',  keywords: ['weight loss', 'lose weight', 'fat loss', 'cut', 'slim'] },
    { name: 'PCOS',        color: 'rose',   keywords: ['pcos', 'polycystic'] },
    { name: 'Diabetes',    color: 'amber',  keywords: ['diabetes', 'diabetic', 'type 1', 'type 2', 't2dm'] },
    { name: 'Muscle Gain', color: 'blue',   keywords: ['muscle gain', 'bulk', 'gain muscle', 'lean mass'] },
    { name: 'Thyroid',     color: 'violet', keywords: ['thyroid', 'hypothyroid', 'hyperthyroid', 'hashimoto'] },
];

export const ALLOWED_TAG_COLORS = ['green', 'blue', 'amber', 'rose', 'violet', 'slate', 'teal', 'orange'] as const;
export type TagColor = (typeof ALLOWED_TAG_COLORS)[number];

/**
 * Insert the 5 defaults if the org has zero tags. Idempotent — uses ON CONFLICT
 * via the unique (orgId, name) index, but we also short-circuit on existing count
 * to avoid unnecessary writes.
 */
export async function seedDefaultTagsIfEmpty(orgId: string): Promise<void> {
    const existing = await prisma.clientTag.count({ where: { orgId, deletedAt: null } });
    if (existing > 0) return;

    try {
        await prisma.clientTag.createMany({
            data: DEFAULT_TAGS.map((t) => ({
                orgId,
                name: t.name,
                color: t.color,
                keywords: t.keywords,
            })),
            skipDuplicates: true,
        });
        logger.info('Seeded default client tags', { orgId, count: DEFAULT_TAGS.length });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'unknown';
        logger.warn('Failed to seed default tags', { orgId, error: message });
    }
}
