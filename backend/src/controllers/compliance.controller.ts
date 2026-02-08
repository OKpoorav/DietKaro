import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { complianceService } from '../services/compliance.service';

export const getDailyAdherence = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.params;
    const date = req.query.date ? new Date(req.query.date as string) : new Date();

    const data = await complianceService.calculateDailyAdherence(clientId, date);
    res.status(200).json({ success: true, data });
});

export const getWeeklyAdherence = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.params;
    const weekStart = req.query.weekStart ? new Date(req.query.weekStart as string) : undefined;

    const data = await complianceService.calculateWeeklyAdherence(clientId, weekStart);
    res.status(200).json({ success: true, data });
});

export const getComplianceHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.params;
    const days = req.query.days ? parseInt(req.query.days as string) : 30;

    const data = await complianceService.getClientComplianceHistory(clientId, days);
    res.status(200).json({ success: true, data });
});
