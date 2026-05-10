import { Router, Response } from 'express';
import { z } from 'zod';
import { ConsultationMode, ConsultationStatus } from '@prisma/client';
import prisma from '../utils/prisma';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validation.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';

const router = Router({ mergeParams: true }); // expects :clientId from parent
router.use(requireAuth, requireRole('owner', 'admin'));

const createSchema = z.object({
    title: z.string().max(200).optional(),
    scheduledAt: z.string().datetime(),
    durationMin: z.number().int().min(5).max(480).default(30),
    mode: z.nativeEnum(ConsultationMode).default('online'),
    meetLink: z.string().url().optional().or(z.literal('')),
    location: z.string().max(300).optional(),
    notes: z.string().max(2000).optional(),
});

const updateSchema = createSchema.partial().extend({
    status: z.nativeEnum(ConsultationStatus).optional(),
});

// GET /clients/:clientId/consultations
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { status, upcoming } = req.query as Record<string, string>;
    const client = await prisma.client.findFirst({ where: { id: req.params.clientId, orgId: req.user.organizationId } });
    if (!client) throw AppError.notFound('Client not found');

    const where: any = { clientId: req.params.clientId, orgId: req.user.organizationId };
    if (status) where.status = status;
    if (upcoming === 'true') {
        where.scheduledAt = { gte: new Date() };
        where.status = 'scheduled';
    }

    const consultations = await prisma.consultation.findMany({
        where,
        include: { createdBy: { select: { id: true, fullName: true } } },
        orderBy: { scheduledAt: 'asc' },
    });
    res.json({ success: true, data: consultations });
}));

// POST /clients/:clientId/consultations
router.post('/', writeOperationLimiter, validateBody(createSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const client = await prisma.client.findFirst({ where: { id: req.params.clientId, orgId: req.user.organizationId } });
        if (!client) throw AppError.notFound('Client not found');

        const consultation = await prisma.consultation.create({
            data: {
                orgId: req.user.organizationId,
                clientId: req.params.clientId,
                createdByUserId: req.user.id,
                title: req.body.title,
                scheduledAt: new Date(req.body.scheduledAt),
                durationMin: req.body.durationMin ?? 30,
                mode: req.body.mode ?? 'online',
                meetLink: req.body.meetLink || null,
                location: req.body.location || null,
                notes: req.body.notes || null,
            },
            include: { createdBy: { select: { id: true, fullName: true } } },
        });
        res.status(201).json({ success: true, data: consultation });
    }),
);

// PATCH /clients/:clientId/consultations/:id
router.patch('/:id', writeOperationLimiter, validateBody(updateSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const existing = await prisma.consultation.findFirst({ where: { id: req.params.id, orgId: req.user.organizationId } });
        if (!existing) throw AppError.notFound('Consultation not found');

        const updated = await prisma.consultation.update({
            where: { id: req.params.id },
            data: {
                ...(req.body.title !== undefined && { title: req.body.title }),
                ...(req.body.scheduledAt && { scheduledAt: new Date(req.body.scheduledAt) }),
                ...(req.body.durationMin !== undefined && { durationMin: req.body.durationMin }),
                ...(req.body.mode && { mode: req.body.mode }),
                ...(req.body.meetLink !== undefined && { meetLink: req.body.meetLink || null }),
                ...(req.body.location !== undefined && { location: req.body.location || null }),
                ...(req.body.notes !== undefined && { notes: req.body.notes || null }),
                ...(req.body.status && { status: req.body.status }),
            },
            include: { createdBy: { select: { id: true, fullName: true } } },
        });
        res.json({ success: true, data: updated });
    }),
);

// DELETE /clients/:clientId/consultations/:id
router.delete('/:id', writeOperationLimiter,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const existing = await prisma.consultation.findFirst({ where: { id: req.params.id, orgId: req.user.organizationId } });
        if (!existing) throw AppError.notFound('Consultation not found');
        await prisma.consultation.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    }),
);

export default router;
