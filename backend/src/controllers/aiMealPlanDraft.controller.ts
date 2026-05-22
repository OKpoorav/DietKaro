import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import prisma from '../utils/prisma';
import { aiMealPlanDraftService } from '../services/aiMealPlanDraft.service';
import type { AiMealPlanDraftRequest } from '../schemas/aiMealPlan.schema';

export const generateAiMealPlanDraft = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) throw AppError.unauthorized();
        const { clientId, prompt } = req.body as AiMealPlanDraftRequest;
        const orgId = req.user.organizationId;

        // Authorization: client must belong to the dietitian's org.
        const client = await prisma.client.findFirst({
            where: { id: clientId, orgId },
            select: { id: true },
        });
        if (!client) throw AppError.notFound('Client not found');

        const result = await aiMealPlanDraftService.generateDraft({
            prompt,
            clientId,
            orgId,
            userId: req.user.id,
        });

        res.status(200).json({ success: true, data: result });
    },
);
