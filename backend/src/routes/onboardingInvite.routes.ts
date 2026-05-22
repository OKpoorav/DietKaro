import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import { AuthenticatedRequest } from '../types/auth.types';
import * as inviteService from '../services/onboardingInvite.service';
import { env } from '../config/env';
import { upload, validateFileContent, IMAGE_MIMES } from '../middleware/upload.middleware';
import { StorageService } from '../services/storage.service';

const router = Router();

// ── Authenticated: dietitian generates/resends invite ─────────────────────

router.post('/clients/:clientId/onboarding/invite',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const token = await inviteService.generateInvite(req.params.clientId, req.user.organizationId);
        const link = `${env.FRONTEND_URL}/onboarding?token=${token}`;
        res.status(201).json({ success: true, data: { link, expiresInDays: 3 } });
    }),
);

router.get('/clients/:clientId/onboarding/invite/status',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const status = await inviteService.getInviteStatus(req.params.clientId, req.user.organizationId);
        res.json({ success: true, data: status });
    }),
);

// Resend = same as generate (generateInvite already invalidates old tokens)
router.post('/clients/:clientId/onboarding/invite/resend',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const token = await inviteService.generateInvite(req.params.clientId, req.user.organizationId);
        const link = `${env.FRONTEND_URL}/onboarding?token=${token}`;
        res.status(201).json({ success: true, data: { link, expiresInDays: 3 } });
    }),
);

// ── Public: client fills form (no auth) ──────────────────────────────────

const BEFORE_PHOTO_TYPES = ['front', 'side', 'back'] as const;
type BeforePhotoType = typeof BEFORE_PHOTO_TYPES[number];

const submitSchema = z.object({
    heightCm: z.number().min(50).max(300).optional(),
    currentWeightKg: z.number().min(10).max(500).optional(),
    targetWeightKg: z.number().min(10).max(500).optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum(['male', 'female', 'other']).optional(),
    activityLevel: z.enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active']).optional(),
    dietPattern: z.string().max(100).optional(),
    eggAllowed: z.boolean().optional(),
    allergies: z.array(z.string().max(100)).max(20).optional(),
    intolerances: z.array(z.string().max(100)).max(20).optional(),
    dislikes: z.array(z.string().max(100)).max(50).optional(),
    likedFoods: z.array(z.string().max(100)).max(50).optional(),
    preferredCuisines: z.array(z.string().max(100)).max(20).optional(),
    goal: z.string().max(500).optional(),
    goalDeadline: z.string().optional(),
    beforePhotoFrontUrl: z.string().url().optional(),
    beforePhotoSideUrl: z.string().url().optional(),
    beforePhotoBackUrl: z.string().url().optional(),
});

router.get('/onboarding-invite/:token', asyncHandler(async (req: Request, res: Response) => {
    const invite = await inviteService.validateToken(req.params.token);
    res.json({ success: true, data: { client: invite.client } });
}));

router.post('/onboarding-invite/:token/upload-photo',
    upload.single('photo'),
    asyncHandler(async (req: Request, res: Response) => {
        const photoType = req.query.type as string;
        if (!BEFORE_PHOTO_TYPES.includes(photoType as BeforePhotoType)) {
            throw new AppError('type must be front, side, or back', 400, 'INVALID_PHOTO_TYPE');
        }
        if (!req.file) throw new AppError('No photo uploaded', 400, 'NO_FILE');
        await validateFileContent(req.file.buffer, IMAGE_MIMES);

        const invite = await inviteService.validateToken(req.params.token);
        const { url } = await StorageService.uploadBeforePhoto(
            req.file.buffer, invite.orgId, invite.clientId, photoType,
        );
        res.json({ success: true, data: { url } });
    }),
);

router.post('/onboarding-invite/:token/submit',
    validateBody(submitSchema),
    asyncHandler(async (req: Request, res: Response) => {
        await inviteService.submitInvite(req.params.token, req.body);
        res.json({ success: true, message: 'Onboarding completed successfully' });
    }),
);

// Public catalog search scoped by onboarding token (read-only)
router.get('/onboarding-invite/:token/base-ingredients', asyncHandler(async (req: Request, res: Response) => {
    await inviteService.validateToken(req.params.token);
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const ingredients = await (await import('../utils/prisma')).default.foodItem.findMany({
        where: {
            isBaseIngredient: true,
            ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 20,
    });
    res.json({ success: true, data: ingredients });
}));

router.get('/onboarding-invite/:token/food-items', asyncHandler(async (req: Request, res: Response) => {
    await inviteService.validateToken(req.params.token);
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const items = await (await import('../utils/prisma')).default.foodItem.findMany({
        where: q ? { name: { contains: q, mode: 'insensitive' as const } } : {},
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 20,
    });
    res.json({ success: true, data: items });
}));

export default router;
