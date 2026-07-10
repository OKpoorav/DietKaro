import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { requireAuth } from '../middleware/auth.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validation.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';

/**
 * Free-text call notes for a client. Mounted at
 * /api/v1/clients/:clientId/call-notes. Any authenticated team member can
 * read/write — jotting a note mid-call must never be gated behind a role or a
 * consultation record.
 */
const router = Router({ mergeParams: true }); // expects :clientId from parent
router.use(requireAuth);

const contentSchema = z.object({
    content: z.string().trim().min(1, 'Note cannot be empty').max(5000),
});

const noteInclude = { creator: { select: { id: true, fullName: true } } } as const;

async function assertClient(req: AuthenticatedRequest) {
    if (!req.user) throw AppError.unauthorized();
    const client = await prisma.client.findFirst({
        where: { id: req.params.clientId, orgId: req.user.organizationId },
        select: { id: true },
    });
    if (!client) throw AppError.notFound('Client not found');
}

// GET /clients/:clientId/call-notes — newest first
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await assertClient(req);
    const notes = await prisma.callNote.findMany({
        where: { clientId: req.params.clientId, orgId: req.user!.organizationId },
        include: noteInclude,
        orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: notes });
}));

// POST /clients/:clientId/call-notes
router.post('/', writeOperationLimiter, validateBody(contentSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        await assertClient(req);
        const note = await prisma.callNote.create({
            data: {
                orgId: req.user!.organizationId,
                clientId: req.params.clientId,
                createdByUserId: req.user!.id,
                content: req.body.content.trim(),
            },
            include: noteInclude,
        });
        res.status(201).json({ success: true, data: note });
    }),
);

// PATCH /clients/:clientId/call-notes/:id
router.patch('/:id', writeOperationLimiter, validateBody(contentSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const existing = await prisma.callNote.findFirst({
            where: { id: req.params.id, orgId: req.user.organizationId },
            select: { id: true },
        });
        if (!existing) throw AppError.notFound('Note not found');

        const updated = await prisma.callNote.update({
            where: { id: req.params.id },
            data: { content: req.body.content.trim() },
            include: noteInclude,
        });
        res.json({ success: true, data: updated });
    }),
);

// DELETE /clients/:clientId/call-notes/:id — soft-delete via the prisma extension
router.delete('/:id', writeOperationLimiter,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const existing = await prisma.callNote.findFirst({
            where: { id: req.params.id, orgId: req.user.organizationId },
            select: { id: true },
        });
        if (!existing) throw AppError.notFound('Note not found');
        await prisma.callNote.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    }),
);

export default router;
