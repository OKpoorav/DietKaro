import { Router, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import prisma from '../utils/prisma';

const router = Router();
router.use(requireAuth);

// GET /api/v1/calendar/events?start=ISO&end=ISO
// Returns only events belonging to the current user (per-person filtering)
router.get('/events', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { organizationId: orgId, id: userId } = req.user!;
    const { start, end } = req.query;

    const startDate = start ? new Date(String(start)) : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
    const endDate = end ? new Date(String(end)) : (() => { const d = new Date(); d.setDate(d.getDate() + 30); d.setHours(23, 59, 59, 999); return d; })();

    const [consultations, followups] = await Promise.all([
        prisma.consultation.findMany({
            where: {
                orgId,
                createdByUserId: userId,
                scheduledAt: { gte: startDate, lte: endDate },
            },
            include: {
                client: { select: { id: true, fullName: true, phone: true } },
            },
            orderBy: { scheduledAt: 'asc' },
            take: 500,
        }),
        prisma.leadFollowup.findMany({
            where: {
                completedAt: null,
                dueAt: { gte: startDate, lte: endDate },
                lead: { orgId, archivedAt: null },
                OR: [
                    { createdByUserId: userId },
                    { lead: { ownerUserId: userId } },
                ],
            },
            include: {
                lead: {
                    select: {
                        id: true, name: true, primaryMobile: true,
                        status: { select: { name: true, color: true } },
                    },
                },
            },
            orderBy: { dueAt: 'asc' },
            take: 500,
        }),
    ]);

    res.json({ success: true, data: { consultations, followups } });
}));

// PATCH /api/v1/calendar/consultations/:id — update status / reschedule
router.patch('/consultations/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { organizationId: orgId, id: userId } = req.user!;
    const { id } = req.params;
    const { status, scheduledAt, durationMin, meetLink, location, notes, title } = req.body;

    const existing = await prisma.consultation.findFirst({ where: { id, orgId, createdByUserId: userId } });
    if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Consultation not found' } });

    const updated = await prisma.consultation.update({
        where: { id },
        data: {
            ...(status !== undefined && { status }),
            ...(scheduledAt !== undefined && { scheduledAt: new Date(scheduledAt) }),
            ...(durationMin !== undefined && { durationMin }),
            ...(meetLink !== undefined && { meetLink }),
            ...(location !== undefined && { location }),
            ...(notes !== undefined && { notes }),
            ...(title !== undefined && { title }),
        },
        include: { client: { select: { id: true, fullName: true, phone: true } } },
    });

    res.json({ success: true, data: updated });
}));

// PATCH /api/v1/calendar/followups/:id — mark complete / update
router.patch('/followups/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { organizationId: orgId, id: userId } = req.user!;
    const { id } = req.params;
    const { completedAt, outcome, notes } = req.body;

    const existing = await prisma.leadFollowup.findFirst({
        where: {
            id,
            lead: { orgId },
            OR: [{ createdByUserId: userId }, { lead: { ownerUserId: userId } }],
        },
    });
    if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Follow-up not found' } });

    const updated = await prisma.leadFollowup.update({
        where: { id },
        data: {
            ...(completedAt !== undefined && { completedAt: completedAt ? new Date(completedAt) : null }),
            ...(outcome !== undefined && { outcome }),
            ...(notes !== undefined && { notes }),
        },
        include: {
            lead: { select: { id: true, name: true, primaryMobile: true, status: { select: { name: true, color: true } } } },
        },
    });

    res.json({ success: true, data: updated });
}));

export default router;
