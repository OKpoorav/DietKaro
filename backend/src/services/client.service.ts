import crypto from 'crypto';
import prisma from '../utils/prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';
import { buildPaginationParams, buildPaginationMeta, buildDateFilter } from '../utils/queryFilters';
import { validationEngine } from './validationEngine.service';
import { labService } from './lab.service';
import type { MedicalSummary } from '../types/medical.types';
import type { CreateClientInput, UpdateClientInput, ClientListQuery, ClientProgressQuery } from '../schemas/client.schema';

const REFERRAL_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const REFERRAL_CODE_LENGTH = 6;
const MAX_REFERRAL_ATTEMPTS = 10;
const REFERRALS_PER_FREE_MONTH = 3;

function generateReferralCode(): string {
    let code = '';
    for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
        code += REFERRAL_CHARS.charAt(crypto.randomInt(REFERRAL_CHARS.length));
    }
    return code;
}

export class ClientService {
    async generateUniqueReferralCode(): Promise<string> {
        let attempts = 0;
        while (attempts < MAX_REFERRAL_ATTEMPTS) {
            const code = generateReferralCode();
            const existing = await prisma.client.findUnique({ where: { referralCode: code } });
            if (!existing) return code;
            attempts++;
        }
        return generateReferralCode() + Date.now().toString(36).slice(-2).toUpperCase();
    }

    async createClient(data: CreateClientInput, orgId: string, userId: string) {
        const existingClient = await prisma.client.findFirst({
            where: { orgId, email: data.email },
        });
        if (existingClient) {
            throw AppError.conflict('A client with this email already exists', 'CLIENT_EXISTS');
        }

        let referredByClientId: string | undefined;
        if (data.referralCode) {
            const referrer = await prisma.client.findUnique({
                where: { referralCode: data.referralCode.toUpperCase() },
                select: { id: true },
            });
            if (referrer) referredByClientId = referrer.id;
        }

        const client = await prisma.client.create({
            data: {
                orgId,
                primaryDietitianId: data.primaryDietitianId || userId,
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
                createdByUserId: userId,
                referralSource: data.referralSource,
                referralSourceName: data.referralSourceName,
                referralSourcePhone: data.referralSourcePhone,
                referredByClientId,
                referralCode: await this.generateUniqueReferralCode(),
            },
            include: {
                primaryDietitian: { select: { id: true, fullName: true } },
            },
        });

        if (referredByClientId) {
            await this.processReferralBenefit(referredByClientId);
        }

        logger.info('Client created', { clientId: client.id, orgId, referralSource: data.referralSource, referredBy: referredByClientId });
        return client;
    }

    async processReferralBenefit(referrerId: string) {
        await prisma.$transaction(async (tx) => {
            const benefit = await tx.referralBenefit.upsert({
                where: { clientId: referrerId },
                create: { clientId: referrerId, referralCount: 1, freeMonthsEarned: 0 },
                update: { referralCount: { increment: 1 } },
            });

            // benefit.referralCount is already the post-increment value from upsert
            const newFreeMonths = Math.floor(benefit.referralCount / REFERRALS_PER_FREE_MONTH);

            if (newFreeMonths > benefit.freeMonthsEarned) {
                await tx.referralBenefit.update({
                    where: { clientId: referrerId },
                    data: { freeMonthsEarned: newFreeMonths },
                });
            }
        });
    }

    async getClient(clientId: string, orgId: string) {
        const client = await prisma.client.findFirst({
            where: { id: clientId, orgId, isActive: true },
            include: {
                primaryDietitian: { select: { id: true, fullName: true } },
                medicalProfile: true,
            },
        });
        if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');
        return client;
    }

    async listClients(orgId: string, query: ClientListQuery, userRole: string, userId: string) {
        const { search, status, primaryDietitianId, sortBy = 'createdAt' } = query;
        const pagination = buildPaginationParams(query.page, query.pageSize);

        const where: Prisma.ClientWhereInput = { orgId, isActive: status !== 'inactive' };

        if (search) {
            where.OR = [
                { fullName: { contains: String(search), mode: 'insensitive' } },
                { email: { contains: String(search), mode: 'insensitive' } },
                { phone: { contains: String(search) } },
            ];
        }

        if (primaryDietitianId) where.primaryDietitianId = String(primaryDietitianId);
        if (userRole === 'dietitian') where.primaryDietitianId = userId;

        const [clients, total] = await prisma.$transaction([
            prisma.client.findMany({
                where,
                skip: pagination.skip,
                take: pagination.take,
                orderBy: { [String(sortBy)]: 'desc' },
                include: { primaryDietitian: { select: { id: true, fullName: true } } },
            }),
            prisma.client.count({ where }),
        ]);

        return { clients, meta: buildPaginationMeta(total, pagination) };
    }

    async updateClient(clientId: string, rawData: UpdateClientInput, orgId: string) {
        const existing = await prisma.client.findFirst({ where: { id: clientId, orgId } });
        if (!existing) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

        const ALLOWED_FIELDS = [
            'fullName', 'email', 'phone', 'dateOfBirth', 'gender',
            'heightCm', 'currentWeightKg', 'targetWeightKg',
            'activityLevel', 'dietaryPreferences', 'allergies',
            'medicalConditions', 'medications', 'healthNotes',
            'targetCalories', 'targetProteinG', 'targetCarbsG', 'targetFatsG',
            'intolerances', 'dietPattern', 'eggAllowed', 'eggAvoidDays',
            'dislikes', 'avoidCategories', 'likedFoods', 'preferredCuisines',
            'foodRestrictions',
        ] as const;

        const updateData: Record<string, unknown> = {};
        for (const field of ALLOWED_FIELDS) {
            if (rawData[field] !== undefined) {
                updateData[field] = rawData[field];
            }
        }

        if (updateData.dateOfBirth) {
            updateData.dateOfBirth = new Date(updateData.dateOfBirth as string);
        }

        const client = await prisma.client.update({
            where: { id: clientId },
            data: updateData,
            include: { primaryDietitian: { select: { id: true, fullName: true } } },
        });

        validationEngine.invalidateClientCache(clientId);
        logger.info('Client updated', { clientId: client.id });
        return client;
    }

    async deleteClient(clientId: string, orgId: string) {
        const existing = await prisma.client.findFirst({ where: { id: clientId, orgId } });
        if (!existing) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

        await prisma.client.update({
            where: { id: clientId },
            data: { isActive: false, deletedAt: new Date() },
        });

        logger.info('Client deleted (soft)', { clientId });
    }

    async getClientProgress(clientId: string, orgId: string, query: ClientProgressQuery) {
        const client = await prisma.client.findFirst({ where: { id: clientId, orgId } });
        if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

        const dateFilter = buildDateFilter(query.dateFrom, query.dateTo);

        const weightLogs = await prisma.weightLog.findMany({
            where: { clientId, ...(dateFilter && { logDate: dateFilter }) },
            orderBy: { logDate: 'asc' },
        });

        let startWeight: number | null = null;
        let currentWeight: number | null = null;
        let totalWeightChange: number | null = null;
        let last30DaysChange: number | null = null;
        let weeklyAvgChange: number | null = null;
        const targetWeight = client.targetWeightKg ? Number(client.targetWeightKg) : null;
        let progressToGoal: number | null = null;

        if (weightLogs.length > 0) {
            startWeight = Number(weightLogs[0].weightKg);
            currentWeight = Number(weightLogs[weightLogs.length - 1].weightKg);
            totalWeightChange = Math.round((currentWeight - startWeight) * 100) / 100;

            const firstDate = new Date(weightLogs[0].logDate);
            const lastDate = new Date(weightLogs[weightLogs.length - 1].logDate);
            const weeksDiff = Math.max(1, Math.round((lastDate.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000)));
            weeklyAvgChange = Math.round((totalWeightChange / weeksDiff) * 100) / 100;

            // Last 30 days change — separate from all-time totalWeightChange
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const recentLogs = weightLogs.filter(w => new Date(w.logDate) >= thirtyDaysAgo);
            if (recentLogs.length >= 2) {
                const recentStart = Number(recentLogs[0].weightKg);
                const recentEnd = Number(recentLogs[recentLogs.length - 1].weightKg);
                last30DaysChange = Math.round((recentEnd - recentStart) * 100) / 100;
            } else if (recentLogs.length === 1) {
                last30DaysChange = 0;
            }

            // Progress to goal — handles both weight loss AND weight gain
            if (targetWeight && startWeight && currentWeight) {
                const totalToChange = Math.abs(startWeight - targetWeight);
                if (totalToChange > 0) {
                    // Check if moving in the right direction
                    const isLossGoal = targetWeight < startWeight;
                    const moved = isLossGoal
                        ? startWeight - currentWeight   // positive = good for loss
                        : currentWeight - startWeight;  // positive = good for gain
                    progressToGoal = moved > 0
                        ? Math.min(100, Math.round((moved / totalToChange) * 100))
                        : 0;
                } else {
                    progressToGoal = 100; // Already at target
                }
            }
        }

        const mealLogs = await prisma.mealLog.findMany({
            where: { clientId, ...(dateFilter && { scheduledDate: dateFilter }) },
        });

        const totalMeals = mealLogs.length;
        const eatenMeals = mealLogs.filter((m) => m.status === 'eaten').length;
        const substitutedMeals = mealLogs.filter((m) => m.status === 'substituted').length;
        const skippedMeals = mealLogs.filter((m) => m.status === 'skipped').length;
        const pendingMeals = mealLogs.filter((m) => m.status === 'pending').length;
        const adherencePercentage = totalMeals > 0 ? Math.round(((eatenMeals + substitutedMeals) / totalMeals) * 100) : 0;
        const completionPercentage = totalMeals > 0 ? Math.round(((totalMeals - pendingMeals) / totalMeals) * 100) : 0;

        const activePlansCount = await prisma.dietPlan.count({
            where: { clientId, status: 'active', isActive: true },
        });

        return {
            client: { id: client.id, fullName: client.fullName },
            weightTrend: {
                startWeight, currentWeight, targetWeight, totalWeightChange, last30DaysChange,
                weeklyAverageChange: weeklyAvgChange, progressToGoalPercentage: progressToGoal,
                dataPoints: weightLogs.map((w) => ({ date: w.logDate, weight: Number(w.weightKg) })),
            },
            mealAdherence: {
                totalMeals, eatenMeals, substitutedMeals, skippedMeals, pendingMeals,
                adherencePercentage, completionPercentage,
            },
            activeDietPlans: activePlansCount,
            period: {
                from: query.dateFrom ? new Date(String(query.dateFrom)) : null,
                to: query.dateTo ? new Date(String(query.dateTo)) : null,
            },
        };
    }

    async getMedicalSummary(clientId: string, orgId: string): Promise<MedicalSummary> {
        const client = await prisma.client.findFirst({
            where: { id: clientId, orgId, isActive: true },
            select: {
                allergies: true,
                intolerances: true,
                dietPattern: true,
                eggAllowed: true,
                eggAvoidDays: true,
                medicalConditions: true,
                medications: true,
                dislikes: true,
                likedFoods: true,
                avoidCategories: true,
                labDerivedTags: true,
                medicalProfile: true,
            },
        });

        if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

        // Compute lab alerts from stored lab values
        const labValues = (client.medicalProfile?.labValues as Record<string, number>) || {};
        const hasLabValues = Object.keys(labValues).length > 0;
        const { alerts: labAlerts } = hasLabValues
            ? labService.deriveRiskFlags(labValues)
            : { alerts: [] };

        const criticalCount = labAlerts.filter(a => a.status === 'critical').length;
        const warningCount = labAlerts.filter(a => a.status === 'warning').length;

        return {
            allergies: client.allergies,
            intolerances: client.intolerances,
            dietPattern: client.dietPattern || null,
            eggAllowed: client.eggAllowed,
            eggAvoidDays: client.eggAvoidDays,
            medicalConditions: client.medicalConditions,
            dislikes: client.dislikes,
            likedFoods: client.likedFoods,
            avoidCategories: client.avoidCategories,

            diagnoses: client.medicalProfile?.diagnoses || [],
            medications: client.medicalProfile?.medications || client.medications || [],
            supplements: client.medicalProfile?.supplements || [],
            surgeries: client.medicalProfile?.surgeries || [],
            familyHistory: client.medicalProfile?.familyHistory || null,
            healthNotes: client.medicalProfile?.healthNotes || null,

            labAlerts,
            labDate: client.medicalProfile?.labDate?.toISOString() || null,
            labDerivedTags: client.medicalProfile?.labDerivedTags || client.labDerivedTags || [],

            criticalCount,
            warningCount,
            lastUpdated: client.medicalProfile?.updatedAt?.toISOString() || '',
        };
    }
}

export const clientService = new ClientService();
