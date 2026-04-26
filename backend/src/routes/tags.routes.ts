import { Router, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import prisma from '../utils/prisma';
import { ALLOWED_TAG_COLORS, seedDefaultTagsIfEmpty, TagColor } from '../services/tags.service';

const router = Router();

router.use(requireAuth);

function normaliseKeywords(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    return Array.from(
        new Set(
            input
                .filter((k): k is string => typeof k === 'string')
                .map((k) => k.trim().toLowerCase())
                .filter(Boolean),
        ),
    );
}

function isValidColor(color: unknown): color is TagColor {
    return typeof color === 'string' && (ALLOWED_TAG_COLORS as readonly string[]).includes(color);
}

// List org tags. Lazy-seeds 5 defaults on first read for orgs that have none.
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const orgId = req.user.organizationId;

    await seedDefaultTagsIfEmpty(orgId);

    const tags = await prisma.clientTag.findMany({
        where: { orgId, deletedAt: null },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    res.status(200).json({ success: true, data: tags });
}));

// Create — admin / owner only
router.post(
    '/',
    writeOperationLimiter,
    requireRole('admin', 'owner'),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const orgId = req.user.organizationId;
        const { name, color, keywords } = req.body ?? {};

        if (typeof name !== 'string' || !name.trim()) {
            throw AppError.badRequest('Tag name is required');
        }
        if (!isValidColor(color)) {
            throw AppError.badRequest(`color must be one of ${ALLOWED_TAG_COLORS.join(', ')}`);
        }

        const trimmedName = name.trim();
        const existing = await prisma.clientTag.findFirst({
            where: { orgId, name: trimmedName, deletedAt: null },
        });
        if (existing) throw AppError.badRequest('A tag with that name already exists');

        const tag = await prisma.clientTag.create({
            data: {
                orgId,
                name: trimmedName,
                color,
                keywords: normaliseKeywords(keywords),
                createdByUserId: req.user.id,
            },
        });
        res.status(201).json({ success: true, data: tag });
    }),
);

// Update — admin / owner only
router.patch(
    '/:id',
    writeOperationLimiter,
    requireRole('admin', 'owner'),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const orgId = req.user.organizationId;
        const tag = await prisma.clientTag.findFirst({
            where: { id: req.params.id, orgId, deletedAt: null },
        });
        if (!tag) throw AppError.notFound('Tag not found');

        const { name, color, keywords, active } = req.body ?? {};
        const data: { name?: string; color?: TagColor; keywords?: string[]; active?: boolean } = {};

        if (typeof name === 'string' && name.trim()) {
            const trimmed = name.trim();
            if (trimmed !== tag.name) {
                const dupe = await prisma.clientTag.findFirst({
                    where: { orgId, name: trimmed, deletedAt: null, NOT: { id: tag.id } },
                });
                if (dupe) throw AppError.badRequest('A tag with that name already exists');
                data.name = trimmed;
            }
        }
        if (color !== undefined) {
            if (!isValidColor(color)) {
                throw AppError.badRequest(`color must be one of ${ALLOWED_TAG_COLORS.join(', ')}`);
            }
            data.color = color;
        }
        if (keywords !== undefined) data.keywords = normaliseKeywords(keywords);
        if (typeof active === 'boolean') data.active = active;

        const updated = await prisma.clientTag.update({ where: { id: tag.id }, data });
        res.status(200).json({ success: true, data: updated });
    }),
);

// Soft delete — admin / owner only. Cascades to assignments via DB FK.
router.delete(
    '/:id',
    writeOperationLimiter,
    requireRole('admin', 'owner'),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const orgId = req.user.organizationId;
        const tag = await prisma.clientTag.findFirst({
            where: { id: req.params.id, orgId, deletedAt: null },
        });
        if (!tag) throw AppError.notFound('Tag not found');

        await prisma.$transaction([
            prisma.clientTagAssignment.deleteMany({ where: { tagId: tag.id } }),
            prisma.clientTag.update({
                where: { id: tag.id },
                data: { deletedAt: new Date(), active: false },
            }),
        ]);

        res.status(204).send();
    }),
);

export default router;
