import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { CreateClientInput, UpdateClientInput } from '../schemas/client.schema';

export const createClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const data = req.body;

    const existingClient = await prisma.client.findFirst({
        where: { orgId: req.user.organizationId, email: data.email }
    });

    if (existingClient) {
        throw AppError.conflict('A client with this email already exists', 'CLIENT_EXISTS');
    }

    const client = await prisma.client.create({
        data: {
            orgId: req.user.organizationId,
            primaryDietitianId: data.primaryDietitianId || req.user.id,
            fullName: data.fullName,
            email: data.email,
            phone: data.phone,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            gender: data.gender,
            heightCm: data.heightCm,
            currentWeightKg: data.currentWeightKg,
            targetWeightKg: data.targetWeightKg,
            activityLevel: data.activityLevel,
            dietaryPreferences: data.dietaryPreferences || [],
            allergies: data.allergies || [],
            medicalConditions: data.medicalConditions || [],
            medications: data.medications || [],
            healthNotes: data.healthNotes,
            createdByUserId: req.user.id
        },
        include: {
            primaryDietitian: { select: { id: true, fullName: true } }
        }
    });

    logger.info('Client created', { clientId: client.id, orgId: req.user.organizationId });
    res.status(201).json({ success: true, data: client });
});

export const getClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const client = await prisma.client.findFirst({
        where: { id: req.params.id, orgId: req.user.organizationId, isActive: true },
        include: {
            primaryDietitian: { select: { id: true, fullName: true } },
            medicalProfile: true
        }
    });

    if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

    res.status(200).json({ success: true, data: client });
});

export const listClients = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { page = '1', pageSize = '20', search, status, primaryDietitianId, sortBy = 'createdAt' } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const where: any = {
        orgId: req.user.organizationId,
        isActive: status !== 'inactive'
    };

    if (search) {
        where.OR = [
            { fullName: { contains: String(search), mode: 'insensitive' } },
            { email: { contains: String(search), mode: 'insensitive' } },
            { phone: { contains: String(search) } }
        ];
    }

    if (primaryDietitianId) where.primaryDietitianId = String(primaryDietitianId);
    if (req.user.role === 'dietitian') where.primaryDietitianId = req.user.id;

    const [clients, total] = await prisma.$transaction([
        prisma.client.findMany({
            where, skip, take,
            orderBy: { [String(sortBy)]: 'desc' },
            include: { primaryDietitian: { select: { id: true, fullName: true } } }
        }),
        prisma.client.count({ where })
    ]);

    res.status(200).json({
        success: true,
        data: clients,
        meta: {
            page: Number(page),
            pageSize: Number(pageSize),
            total,
            totalPages: Math.ceil(total / Number(pageSize)),
            hasNextPage: Number(page) < Math.ceil(total / Number(pageSize)),
            hasPreviousPage: Number(page) > 1
        }
    });
});

export const updateClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { id } = req.params;
    const updateData: any = req.body;

    const existingClient = await prisma.client.findFirst({
        where: { id, orgId: req.user.organizationId }
    });

    if (!existingClient) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

    // Handle date conversion
    if (updateData.dateOfBirth) {
        updateData.dateOfBirth = new Date(updateData.dateOfBirth);
    }

    const client = await prisma.client.update({
        where: { id },
        data: updateData,
        include: { primaryDietitian: { select: { id: true, fullName: true } } }
    });

    logger.info('Client updated', { clientId: client.id });
    res.status(200).json({ success: true, data: client });
});

export const deleteClient = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const existingClient = await prisma.client.findFirst({
        where: { id: req.params.id, orgId: req.user.organizationId }
    });

    if (!existingClient) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

    await prisma.client.update({
        where: { id: req.params.id },
        data: { isActive: false, deletedAt: new Date() }
    });

    logger.info('Client deleted (soft)', { clientId: req.params.id });
    res.status(204).send();
});

export const getClientProgress = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { id } = req.params;
    const { dateFrom, dateTo } = req.query;

    const client = await prisma.client.findFirst({
        where: { id, orgId: req.user.organizationId }
    });

    if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

    const dateFilter: any = {};
    if (dateFrom) dateFilter.gte = new Date(String(dateFrom));
    if (dateTo) dateFilter.lte = new Date(String(dateTo));

    const weightLogs = await prisma.weightLog.findMany({
        where: { clientId: id, ...(Object.keys(dateFilter).length > 0 && { logDate: dateFilter }) },
        orderBy: { logDate: 'asc' }
    });

    let startWeight: number | null = null;
    let currentWeight: number | null = null;
    let totalWeightChange: number | null = null;
    let weeklyAvgChange: number | null = null;
    let targetWeight = client.targetWeightKg ? Number(client.targetWeightKg) : null;
    let progressToGoal: number | null = null;

    if (weightLogs.length > 0) {
        startWeight = Number(weightLogs[0].weightKg);
        currentWeight = Number(weightLogs[weightLogs.length - 1].weightKg);
        totalWeightChange = Math.round((currentWeight - startWeight) * 100) / 100;

        const firstDate = new Date(weightLogs[0].logDate);
        const lastDate = new Date(weightLogs[weightLogs.length - 1].logDate);
        const weeksDiff = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
        weeklyAvgChange = Math.round((totalWeightChange / weeksDiff) * 100) / 100;

        if (targetWeight && startWeight) {
            const totalToLose = startWeight - targetWeight;
            const lost = startWeight - currentWeight;
            progressToGoal = totalToLose > 0 ? Math.round((lost / totalToLose) * 100) : 0;
        }
    }

    const mealLogs = await prisma.mealLog.findMany({
        where: { clientId: id, ...(Object.keys(dateFilter).length > 0 && { scheduledDate: dateFilter }) }
    });

    const totalMeals = mealLogs.length;
    const eatenMeals = mealLogs.filter(m => m.status === 'eaten').length;
    const substitutedMeals = mealLogs.filter(m => m.status === 'substituted').length;
    const skippedMeals = mealLogs.filter(m => m.status === 'skipped').length;
    const pendingMeals = mealLogs.filter(m => m.status === 'pending').length;

    const adherencePercentage = totalMeals > 0 ? Math.round(((eatenMeals + substitutedMeals) / totalMeals) * 100) : 0;
    const completionPercentage = totalMeals > 0 ? Math.round(((totalMeals - pendingMeals) / totalMeals) * 100) : 0;

    const activePlansCount = await prisma.dietPlan.count({
        where: { clientId: id, status: 'active', isActive: true }
    });

    res.status(200).json({
        success: true,
        data: {
            client: { id: client.id, fullName: client.fullName },
            weightTrend: {
                startWeight, currentWeight, targetWeight, totalWeightChange,
                weeklyAverageChange: weeklyAvgChange, progressToGoalPercentage: progressToGoal,
                dataPoints: weightLogs.map(w => ({ date: w.logDate, weight: Number(w.weightKg) }))
            },
            mealAdherence: {
                totalMeals, eatenMeals, substitutedMeals, skippedMeals, pendingMeals,
                adherencePercentage, completionPercentage
            },
            activeDietPlans: activePlansCount,
            period: { from: dateFrom ? new Date(String(dateFrom)) : null, to: dateTo ? new Date(String(dateTo)) : null }
        }
    });
});
