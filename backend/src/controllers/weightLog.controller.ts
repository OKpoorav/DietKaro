import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { weightLogService } from '../services/weightLog.service';

export const createWeightLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await weightLogService.createWeightLog(req.body, req.params.clientId, req.user.organizationId);
    res.status(201).json({ success: true, data });
});

export const listWeightLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const result = await weightLogService.listWeightLogs(req.params.clientId, req.user.organizationId, req.query);
    res.status(200).json({ success: true, ...result });
});

export const listAllWeightLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response, next) => {
    if (!req.user) throw AppError.unauthorized();
    const { clientId } = req.query;
    if (!clientId) throw AppError.badRequest('clientId query parameter is required', 'MISSING_CLIENT_ID');
    req.params.clientId = String(clientId);
    await listWeightLogs(req, res, next);
});

export const createWeightLogGeneral = asyncHandler(async (req: AuthenticatedRequest, res: Response, next) => {
    const { clientId } = req.body;
    if (!clientId) throw AppError.badRequest('clientId is required', 'MISSING_CLIENT_ID');
    req.params.clientId = clientId;
    await createWeightLog(req, res, next);
});

export const uploadProgressPhoto = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    if (!req.file) throw AppError.badRequest('No photo file provided', 'NO_FILE');
    const data = await weightLogService.uploadProgressPhoto(req.params.id, req.file.buffer, req.file.size, req.user.organizationId);
    res.status(200).json({ success: true, data });
});
