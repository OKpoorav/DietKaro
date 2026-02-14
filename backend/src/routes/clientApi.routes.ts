// Framework
import { Router, Response } from 'express';

// Middleware
import { requireClientAuth, ClientAuthRequest } from '../middleware/clientAuth.middleware';
import { uploadSinglePhoto, validateFileContent, IMAGE_MIMES } from '../middleware/upload.middleware';
import { validateBody } from '../middleware/validation.middleware';

// Utilities
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import prisma from '../utils/prisma';
import cache, { clientCacheKey, invalidateClientCache } from '../utils/cache';

// Schemas
import { logMealSchema, createWeightLogSchema, updatePreferencesSchema } from '../schemas/clientApi.schema';

// Services
import { clientDashboardService } from '../services/clientDashboard.service';
import { mealLogService } from '../services/mealLog.service';
import { onboardingService } from '../services/onboarding.service';
import { complianceService } from '../services/compliance.service';
import { notificationService } from '../services/notification.service';

const router = Router();

// All routes require client auth
router.use(requireClientAuth);

// ============ MEALS ============

router.get('/meals/today', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = await clientDashboardService.getTodayMeals(req.client.id);
    res.status(200).json({ success: true, data });
}));

// GET /meals/:mealLogId — individual meal log detail (client-scoped)
router.get('/meals/:mealLogId', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = await clientDashboardService.getMealLog(req.client.id, req.params.mealLogId);
    res.status(200).json({ success: true, data });
}));

router.patch('/meals/:mealLogId/log', validateBody(logMealSchema), asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = await clientDashboardService.logMeal(
        req.client.id, req.client.orgId, req.params.mealLogId, req.body
    );
    invalidateClientCache(req.client.id);
    res.status(200).json({ success: true, data });
}));

router.post('/meals/:mealLogId/photo', uploadSinglePhoto, asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    if (!req.file) throw AppError.badRequest('No photo file provided', 'NO_FILE');

    await validateFileContent(req.file.buffer, IMAGE_MIMES);

    const mealLog = await prisma.mealLog.findFirst({
        where: { id: req.params.mealLogId, clientId: req.client.id },
    });
    if (!mealLog) throw AppError.notFound('Meal log not found', 'MEAL_LOG_NOT_FOUND');

    const data = await mealLogService.uploadMealPhoto(
        req.params.mealLogId, req.file.buffer, req.file.size, req.client.orgId
    );
    invalidateClientCache(req.client.id);
    res.status(200).json({ success: true, data });
}));

// ============ WEIGHT LOGS ============

router.get('/weight-logs', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const limit = parseInt(req.query.limit as string) || 30;
    const data = await clientDashboardService.getWeightLogs(req.client.id, limit);
    res.status(200).json({ success: true, data });
}));

router.post('/weight-logs', validateBody(createWeightLogSchema), asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = await clientDashboardService.createWeightLog(
        req.client.id, req.client.orgId, req.body
    );
    invalidateClientCache(req.client.id);
    res.status(200).json({ success: true, data });
}));

// ============ STATS & PROGRESS ============

router.get('/stats', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const key = clientCacheKey(req.client.id, 'stats');
    const cached = cache.get(key);
    if (cached) return res.status(200).json({ success: true, data: cached });
    const data = await clientDashboardService.getClientStats(req.client.id);
    cache.set(key, data);
    res.status(200).json({ success: true, data });
}));

router.get('/progress-summary', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const key = clientCacheKey(req.client.id, 'progress-summary');
    const cached = cache.get(key);
    if (cached) return res.status(200).json({ success: true, data: cached });
    const data = await clientDashboardService.getProgressSummary(req.client.id);
    cache.set(key, data);
    res.status(200).json({ success: true, data });
}));

// ============ ONBOARDING ============

router.get('/onboarding/status', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = await onboardingService.getOnboardingStatus(req.client.id);
    res.status(200).json({ success: true, data });
}));

router.get('/onboarding/presets', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = onboardingService.getPresets();
    res.status(200).json({ success: true, data });
}));

router.post('/onboarding/step/:step', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const step = parseInt(req.params.step);

    const handlers: Record<number, (clientId: string, data: any) => Promise<void>> = {
        1: (id, data) => onboardingService.saveStep1(id, data),
        2: (id, data) => onboardingService.saveStep2(id, data),
        3: (id, data) => onboardingService.saveStep3(id, data),
        4: (id, data) => onboardingService.saveStep4(id, data),
        5: (id, data) => onboardingService.saveStep5(id, data),
        6: (id, data) => onboardingService.saveStep6(id, data),
    };

    const handler = handlers[step];
    if (!handler) throw AppError.badRequest(`Invalid step: ${step}`, 'INVALID_STEP');

    await handler(req.client.id, req.body);
    res.status(200).json({ success: true, message: `Step ${step} saved successfully` });
}));

router.post('/onboarding/complete', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    await onboardingService.completeOnboarding(req.client.id);
    res.status(200).json({ success: true, message: 'Onboarding marked as complete' });
}));

// ============ PREFERENCES ============

router.get('/preferences', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = await prisma.clientPreferences.findUnique({
        where: { clientId: req.client.id },
    });
    res.status(200).json({ success: true, data });
}));

router.put('/preferences', validateBody(updatePreferencesSchema), asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const data = await clientDashboardService.updatePreferences(req.client.id, req.body);
    res.status(200).json({ success: true, data });
}));

// ============ ADHERENCE / COMPLIANCE ============

router.get('/adherence/daily', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    const dateStr = date.toISOString().split('T')[0];
    const key = clientCacheKey(req.client.id, `adherence-daily:${dateStr}`);
    const cached = cache.get(key);
    if (cached) return res.status(200).json({ success: true, data: cached });
    const data = await complianceService.calculateDailyAdherence(req.client.id, date);
    cache.set(key, data);
    res.status(200).json({ success: true, data });
}));

router.get('/adherence/weekly', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const weekStart = req.query.weekStart ? new Date(req.query.weekStart as string) : undefined;
    const weekKey = weekStart ? weekStart.toISOString().split('T')[0] : 'current';
    const key = clientCacheKey(req.client.id, `adherence-weekly:${weekKey}`);
    const cached = cache.get(key);
    if (cached) return res.status(200).json({ success: true, data: cached });
    const data = await complianceService.calculateWeeklyAdherence(req.client.id, weekStart);
    cache.set(key, data);
    res.status(200).json({ success: true, data });
}));

router.get('/adherence/history', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const key = clientCacheKey(req.client.id, `adherence-history:${days}`);
    const cached = cache.get(key);
    if (cached) return res.status(200).json({ success: true, data: cached });
    const data = await complianceService.getClientComplianceHistory(req.client.id, days);
    cache.set(key, data);
    res.status(200).json({ success: true, data });
}));

// ============ NOTIFICATIONS ============

router.post('/device-token', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const { token } = req.body;
    if (!token || typeof token !== 'string') throw AppError.badRequest('Push token is required', 'MISSING_TOKEN');
    await notificationService.registerDeviceToken(req.client.id, 'client', token);
    res.status(200).json({ success: true });
}));

router.get('/notifications', asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();
    const notifications = await prisma.notification.findMany({
        where: { recipientId: req.client.id, recipientType: 'client' },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });
    res.status(200).json({ success: true, data: notifications });
}));

export default router;
