/**
 * Validation Controller
 * Handles diet validation API endpoints
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { validationEngine } from '../services/validationEngine.service';
import logger from '../utils/logger';

/**
 * POST /api/v1/diet-validation/check
 * Validate a single food item against client restrictions
 */
export const checkValidation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId, foodId, context } = req.body;

    if (!clientId || !foodId) {
        throw AppError.badRequest('clientId and foodId are required');
    }

    if (!context?.currentDay || !context?.mealType) {
        throw AppError.badRequest('context.currentDay and context.mealType are required');
    }

    const startTime = Date.now();

    const result = await validationEngine.validate(clientId, foodId, context);

    logger.debug('Validation check completed', {
        clientId,
        foodId,
        severity: result.severity,
        processingTimeMs: Date.now() - startTime
    });

    res.status(200).json({
        success: true,
        data: result
    });
});

/**
 * POST /api/v1/diet-validation/batch
 * Validate multiple food items against client restrictions
 */
export const checkBatchValidation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId, foodIds, context } = req.body;

    if (!clientId || !foodIds || !Array.isArray(foodIds)) {
        throw AppError.badRequest('clientId and foodIds array are required');
    }

    if (!context?.currentDay || !context?.mealType) {
        throw AppError.badRequest('context.currentDay and context.mealType are required');
    }

    if (foodIds.length > 50) {
        throw AppError.badRequest('Maximum 50 foods per batch');
    }

    const result = await validationEngine.validateBatch(clientId, foodIds, context);

    logger.debug('Batch validation completed', {
        clientId,
        foodCount: foodIds.length,
        processingTimeMs: result.processingTimeMs
    });

    res.status(200).json({
        success: true,
        data: result
    });
});

/**
 * POST /api/v1/diet-validation/invalidate-cache
 * Invalidate client cache (call when client tags are updated)
 */
export const invalidateCache = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.body;

    if (clientId) {
        validationEngine.invalidateClientCache(clientId);
        logger.info('Client validation cache invalidated', { clientId });
    } else {
        validationEngine.clearCache();
        logger.info('Entire validation cache cleared');
    }

    res.status(200).json({
        success: true,
        message: clientId ? `Cache invalidated for client ${clientId}` : 'Entire cache cleared'
    });
});
