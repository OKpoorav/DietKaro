import { Router, Response } from 'express';
import { z } from 'zod';
import { Gender, LeadTemperature, ReferralType, TouchpointKind } from '@prisma/client';
import prisma from '../utils/prisma';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { writeOperationLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validation.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import * as leadsSvc from '../services/leads.service';
import * as followupsSvc from '../services/leadFollowups.service';
import * as touchpointsSvc from '../services/leadTouchpoints.service';

const router = Router();
router.use(requireAuth, requireRole('owner', 'admin'));

// ── Zod schemas ────────────────────────────────────────────────────────────
const createLeadSchema = z.object({
    name: z.string().min(1).max(200),
    primaryMobile: z.string().min(5).max(20),
    altMobile: z.string().max(20).optional(),
    email: z.string().email().optional().or(z.literal('')),
    age: z.number().int().min(1).max(130).optional(),
    gender: z.nativeEnum(Gender).optional(),
    city: z.string().max(100).optional(),
    sourceId: z.string().uuid().optional(),
    reference: z.string().max(200).optional(),
    referralType: z.nativeEnum(ReferralType).optional(),
    ownerUserId: z.string().uuid().optional(),
    statusId: z.string().uuid().optional(),
    temperature: z.nativeEnum(LeadTemperature).optional(),
    notes: z.string().max(5000).optional(),
});

const followupSchema = z.object({
    dueAt: z.string().datetime(),
    type: z.enum(['call', 'visit', 'todo']),
    notes: z.string().max(1000).optional(),
    outcome: z.enum(['outgoing', 'incoming', 'answered', 'unanswered', 'callback_requested', 'meeting_scheduled', 'confirmed', 'lost']).optional(),
    lostReason: z.string().max(500).optional(),
    callbackAt: z.string().datetime().optional(),
});

const completeFollowupSchema = z.object({
    outcome: z.enum(['outgoing', 'incoming', 'answered', 'unanswered', 'callback_requested', 'meeting_scheduled', 'confirmed', 'lost']).optional(),
    lostReason: z.string().max(500).optional(),
    callbackAt: z.string().datetime().optional(),
    notes: z.string().max(1000).optional(),
});

const manualTouchpointSchema = z.object({
    kind: z.enum(['manual_call', 'manual_whatsapp', 'manual_visit', 'manual_other']),
    notes: z.string().max(1000).optional(),
    duration: z.number().int().min(0).optional(),
    location: z.string().max(200).optional(),
    createdAt: z.string().datetime().optional(),
});

const convertSchema = z.object({
    fullName: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().min(5).max(20),
    altPhone: z.string().optional(),
    gender: z.nativeEnum(Gender).optional(),
    dateOfBirth: z.string().datetime().optional(),
    city: z.string().optional(),
});

// ── Lead CRUD ──────────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { search, statusIds, sourceIds, ownerUserId, temperature, referralType,
        createdFrom, createdTo, dueToday, overdue, showArchived, page = '1', pageSize = '25' } = req.query as Record<string, string>;

    const filters: leadsSvc.LeadFilters = {
        search: search || undefined,
        statusIds: statusIds ? statusIds.split(',').filter(Boolean) : undefined,
        sourceIds: sourceIds ? sourceIds.split(',').filter(Boolean) : undefined,
        ownerUserId: ownerUserId || undefined,
        temperature: temperature as LeadTemperature | undefined,
        referralType: referralType as ReferralType | undefined,
        createdFrom: createdFrom ? new Date(createdFrom) : undefined,
        createdTo: createdTo ? new Date(createdTo) : undefined,
        dueToday: dueToday === 'true',
        overdue: overdue === 'true',
        showArchived: showArchived === 'true',
    };

    const result = await leadsSvc.listLeads(req.user.organizationId, filters, parseInt(page), parseInt(pageSize));
    res.json({ success: true, ...result });
}));

router.post('/', writeOperationLimiter, validateBody(createLeadSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const lead = await leadsSvc.createLead(req.user.organizationId, req.body, req.user.id);
        res.status(201).json({ success: true, data: lead });
    }),
);

router.get('/dashboard-widget', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await leadsSvc.getDashboardWidget(req.user.organizationId);
    res.json({ success: true, data });
}));

router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const lead = await leadsSvc.getLead(req.params.id, req.user.organizationId);
    res.json({ success: true, data: lead });
}));

router.patch('/:id', writeOperationLimiter, validateBody(createLeadSchema.partial()),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const lead = await leadsSvc.updateLead(req.params.id, req.user.organizationId, req.body, req.user.id);
        res.json({ success: true, data: lead });
    }),
);

router.post('/:id/archive', writeOperationLimiter,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const result = await leadsSvc.archiveLead(req.params.id, req.user.organizationId, req.user.id);
        res.json({ success: true, data: result });
    }),
);

router.post('/:id/restore', writeOperationLimiter,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const result = await leadsSvc.restoreLead(req.params.id, req.user.organizationId, req.user.id);
        res.json({ success: true, data: result });
    }),
);

router.post('/:id/convert', writeOperationLimiter, validateBody(convertSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const result = await leadsSvc.convertLead(req.params.id, req.user.organizationId, req.user.id, req.body);
        res.status(201).json({ success: true, data: result });
    }),
);

router.post('/:id/proposal', writeOperationLimiter,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const { planId, pdfFilename } = req.body ?? {};
        if (!planId || !pdfFilename) throw AppError.badRequest('planId and pdfFilename are required');
        const result = await leadsSvc.recordProposalShared(req.params.id, req.user.organizationId, req.user.id, { planId, pdfFilename });
        res.json({ success: true, data: result });
    }),
);

// ── Follow-ups ─────────────────────────────────────────────────────────────
router.get('/:id/followups', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await followupsSvc.listFollowups(req.params.id, req.user.organizationId);
    res.json({ success: true, data });
}));

router.post('/:id/followups', writeOperationLimiter, validateBody(followupSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const followup = await followupsSvc.createFollowup(
            req.params.id, req.user.organizationId, req.user.id,
            {
                ...req.body,
                dueAt: new Date(req.body.dueAt),
                callbackAt: req.body.callbackAt ? new Date(req.body.callbackAt) : undefined,
            },
        );
        res.status(201).json({ success: true, data: followup });
    }),
);

router.patch('/:id/followups/:fId', writeOperationLimiter, validateBody(followupSchema.partial()),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const data = { ...req.body };
        if (data.dueAt) data.dueAt = new Date(data.dueAt);
        if (data.callbackAt) data.callbackAt = new Date(data.callbackAt);
        const followup = await followupsSvc.updateFollowup(req.params.fId, req.params.id, req.user.organizationId, data);
        res.json({ success: true, data: followup });
    }),
);

router.post('/:id/followups/:fId/complete', writeOperationLimiter, validateBody(completeFollowupSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const outcomeData = {
            ...req.body,
            callbackAt: req.body.callbackAt ? new Date(req.body.callbackAt) : undefined,
        };
        const followup = await followupsSvc.completeFollowup(req.params.fId, req.params.id, req.user.organizationId, req.user.id, outcomeData);
        res.json({ success: true, data: followup });
    }),
);

// ── Lead Notes (append-only) ───────────────────────────────────────────────
const noteSchema = z.object({
    text: z.string().min(1).max(5000),
});

router.post('/:id/notes', writeOperationLimiter, validateBody(noteSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        // Create append-only touchpoint for history
        const touchpoint = await touchpointsSvc.logTouchpoint(
            req.params.id, 'note_added' as TouchpointKind, req.user.id,
            { text: req.body.text },
        );
        // Also update lead's notes field (latest note = visible in detail view)
        await prisma.lead.updateMany({
            where: { id: req.params.id, orgId: req.user.organizationId },
            data: { notes: req.body.text },
        });
        res.status(201).json({ success: true, data: touchpoint });
    }),
);

// ── Touchpoints ────────────────────────────────────────────────────────────
router.get('/:id/touchpoints', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { page = '1', pageSize = '50' } = req.query as Record<string, string>;
    const result = await touchpointsSvc.listTouchpoints(req.params.id, req.user.organizationId, parseInt(page), parseInt(pageSize));
    if (!result) throw AppError.notFound('Lead not found');
    res.json({ success: true, ...result });
}));

router.post('/:id/touchpoints', writeOperationLimiter, validateBody(manualTouchpointSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const { kind, notes, duration, location, createdAt } = req.body;
        const touchpoint = await touchpointsSvc.logManual(req.params.id, kind as TouchpointKind, req.user.id, {
            notes, duration, location,
            createdAt: createdAt ? new Date(createdAt) : undefined,
        });
        res.status(201).json({ success: true, data: touchpoint });
    }),
);

export default router;
