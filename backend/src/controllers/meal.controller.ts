import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { mealService } from '../services/meal.service';

export const addMealToPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const meal = await mealService.addMealToPlan(req.body, req.user.organizationId);
    res.status(201).json({ success: true, data: meal });
});

export const updateMeal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const updated = await mealService.updateMeal(req.params.id, req.body, req.user.organizationId);
    res.status(200).json({ success: true, data: updated });
});

export const deleteMeal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    await mealService.deleteMeal(req.params.id, req.user.organizationId);
    res.status(204).send();
});
