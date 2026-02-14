import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { dietPlanService } from '../services/dietPlan.service';
import type { DietPlanListQuery } from '../schemas/dietPlan.schema';

export const createDietPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const dietPlan = await dietPlanService.createPlan(req.body, req.user.organizationId, req.user.id);
    res.status(201).json({ success: true, data: dietPlan });
});

export const getDietPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const dietPlan = await dietPlanService.getPlan(req.params.id, req.user.organizationId);
    res.status(200).json({ success: true, data: dietPlan });
});

export const listDietPlans = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const { plans, meta } = await dietPlanService.listPlans(req.user.organizationId, req.query as unknown as DietPlanListQuery);
    res.status(200).json({ success: true, data: plans, meta });
});

export const updateDietPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const updated = await dietPlanService.updatePlan(req.params.id, req.body, req.user.organizationId);
    res.status(200).json({ success: true, data: updated });
});

export const publishDietPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const data = await dietPlanService.publishPlan(req.params.id, req.user.organizationId);
    res.status(200).json({ success: true, data });
});

export const assignTemplateToClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const newPlan = await dietPlanService.assignTemplateToClient(req.params.id, req.body, req.user.organizationId, req.user.id);
    res.status(201).json({ success: true, data: newPlan });
});
