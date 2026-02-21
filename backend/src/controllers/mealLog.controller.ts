import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { mealLogService } from '../services/mealLog.service';
import { validateFileContent, IMAGE_MIMES } from '../middleware/upload.middleware';
import type { MealLogListQuery } from '../schemas/mealLog.schema';

export const createMealLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const mealLog = await mealLogService.createMealLog(req.body, req.user.organizationId);
    res.status(201).json({ success: true, data: mealLog });
});

export const listMealLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { data, meta } = await mealLogService.listMealLogs(req.user.organizationId, req.query as unknown as MealLogListQuery, req.user.role, req.user.id);
    res.status(200).json({ success: true, data, meta });
});

export const getMealLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await mealLogService.getMealLog(req.params.id, req.user.organizationId);
    res.status(200).json({ success: true, data });
});

export const updateMealLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await mealLogService.updateMealLog(req.params.id, req.body, req.user.organizationId);
    res.status(200).json({ success: true, data });
});

export const reviewMealLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await mealLogService.reviewMealLog(req.params.id, req.body, req.user.organizationId, req.user.id, req.user.role);
    res.status(200).json({ success: true, data });
});

export const uploadMealPhoto = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    if (!req.file) throw AppError.badRequest('No photo file provided', 'NO_FILE');
    await validateFileContent(req.file.buffer, IMAGE_MIMES);
    const data = await mealLogService.uploadMealPhoto(req.params.id, req.file.buffer, req.file.size, req.user.organizationId);
    res.status(200).json({ success: true, data });
});
