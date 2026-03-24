import { Response } from 'express';
import prisma from '../utils/prisma';
import { Prisma } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';

export const getDashboardStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const orgId = req.user.organizationId;
    const userId = req.user.id;
    const role = req.user.role;

    // Admin/Owner can pass ?dietitianId= to view a specific dietitian's stats
    const queryDietitianId = req.query.dietitianId as string | undefined;
    const isAdminOrOwner = role === 'admin' || role === 'owner';

    // Determine scope: specific dietitian (either self or admin viewing someone)
    let scopeDietitianId: string | null = null;
    if (role === 'dietitian') {
        scopeDietitianId = userId; // always scoped to self
    } else if (isAdminOrOwner && queryDietitianId) {
        scopeDietitianId = queryDietitianId; // admin viewing specific dietitian
    }
    // else: admin/owner with no filter → org-wide (scopeDietitianId = null)

    const clientWhere: Prisma.ClientWhereInput = {
        orgId,
        isActive: true,
        ...(scopeDietitianId && { primaryDietitianId: scopeDietitianId }),
    };

    const mealLogWhere: Prisma.MealLogWhereInput = {
        orgId,
        ...(scopeDietitianId && { client: { primaryDietitianId: scopeDietitianId } }),
    };

    // Get counts
    const [
        totalClients,
        pendingReviews,
        activeDietPlans,
        recentClients,
        pendingMealLogs
    ] = await Promise.all([
        // Total active clients (scoped)
        prisma.client.count({ where: clientWhere }),

        // Pending meal log reviews (scoped)
        prisma.mealLog.count({
            where: {
                ...mealLogWhere,
                status: { in: ['eaten', 'skipped', 'substituted'] },
                reviewedByUserId: null,
            }
        }),

        // Active (published) diet plans (scoped)
        prisma.dietPlan.count({
            where: {
                orgId,
                status: 'active',
                ...(scopeDietitianId && { client: { primaryDietitianId: scopeDietitianId } }),
            }
        }),

        // Recent clients (last 5, scoped)
        prisma.client.findMany({
            where: clientWhere,
            orderBy: { updatedAt: 'desc' },
            take: 5,
            select: {
                id: true,
                fullName: true,
                updatedAt: true,
                createdAt: true
            }
        }),

        // Pending meal logs with client info (scoped)
        prisma.mealLog.findMany({
            where: {
                ...mealLogWhere,
                status: { in: ['eaten', 'skipped', 'substituted'] },
                reviewedByUserId: null,
            },
            orderBy: { scheduledDate: 'desc' },
            take: 5,
            include: {
                client: { select: { id: true, fullName: true } },
                meal: { select: { id: true, name: true, mealType: true } }
            }
        })
    ]);

    // Calculate average adherence (simplified - from last 30 days, scoped)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const mealLogStats = await prisma.mealLog.groupBy({
        by: ['status'],
        where: {
            ...mealLogWhere,
            scheduledDate: { gte: thirtyDaysAgo }
        },
        _count: true
    });

    const totalMeals = mealLogStats.reduce((acc, s) => acc + s._count, 0);
    const eatenMeals = mealLogStats.find(s => s.status === 'eaten')?._count || 0;
    const adherencePercent = totalMeals > 0 ? Math.round((eatenMeals / totalMeals) * 100) : 0;

    // Weekly adherence breakdown (scoped)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date();
    weekEnd.setHours(23, 59, 59, 999);

    const weeklyMealLogs = await prisma.mealLog.findMany({
        where: { ...mealLogWhere, scheduledDate: { gte: weekStart, lte: weekEnd } },
        select: { scheduledDate: true, status: true },
    });

    const weeklyData: { day: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStr = date.toISOString().split('T')[0];

        const dayLogs = weeklyMealLogs.filter(m => m.scheduledDate.toISOString().split('T')[0] === dayStr);
        const dayTotal = dayLogs.length;
        const dayEaten = dayLogs.filter(m => m.status === 'eaten').length;
        const dayPercent = dayTotal > 0 ? Math.round((dayEaten / dayTotal) * 100) : 0;

        weeklyData.push({ day: days[date.getDay()], value: dayPercent });
    }

    res.status(200).json({
        success: true,
        data: {
            stats: {
                totalClients,
                pendingReviews,
                activeDietPlans,
                adherencePercent
            },
            weeklyAdherence: weeklyData,
            recentClients: recentClients.map(c => ({
                id: c.id,
                name: c.fullName,
                avatar: c.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
                status: 'active',
                lastActivity: c.updatedAt || c.createdAt
            })),
            pendingReviews: pendingMealLogs.map(m => ({
                id: m.id,
                client: m.client.fullName,
                meal: m.meal?.mealType || 'Meal',
                time: m.scheduledTime
            }))
        }
    });
});

export const getDietitianAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const orgId = req.user.organizationId;

    // 1. Fetch all active dietitians in the org
    const dietitians = await prisma.user.findMany({
        where: { orgId, role: 'dietitian', isActive: true },
        select: {
            id: true,
            fullName: true,
            email: true,
            profilePhotoUrl: true,
        },
        orderBy: { fullName: 'asc' },
    });

    const dietitianIds = dietitians.map(d => d.id);

    if (dietitianIds.length === 0) {
        res.status(200).json({ success: true, data: { dietitians: [] } });
        return;
    }

    // 2. Batch queries to avoid N+1

    // Client counts per dietitian
    const clientCounts = await prisma.client.groupBy({
        by: ['primaryDietitianId'],
        where: { orgId, isActive: true, primaryDietitianId: { in: dietitianIds } },
        _count: true,
    });
    const clientCountMap = new Map(clientCounts.map(c => [c.primaryDietitianId, c._count]));

    // Active plan counts per dietitian (grouped by client's assigned dietitian)
    const activePlanRows = await prisma.dietPlan.findMany({
        where: {
            orgId,
            status: 'active',
            client: { primaryDietitianId: { in: dietitianIds } },
        },
        select: {
            client: { select: { primaryDietitianId: true } },
        },
    });
    const activePlanCountMap = new Map<string, number>();
    for (const row of activePlanRows) {
        const did = row.client?.primaryDietitianId;
        if (did) activePlanCountMap.set(did, (activePlanCountMap.get(did) || 0) + 1);
    }

    // Pending review counts per dietitian (meal logs not yet reviewed, for their clients)
    const pendingReviewRows = await prisma.mealLog.findMany({
        where: {
            orgId,
            status: { in: ['eaten', 'skipped', 'substituted'] },
            reviewedByUserId: null,
            client: { primaryDietitianId: { in: dietitianIds } },
        },
        select: {
            client: { select: { primaryDietitianId: true } },
        },
    });
    const pendingReviewCountMap = new Map<string, number>();
    for (const row of pendingReviewRows) {
        const did = row.client?.primaryDietitianId;
        if (did) pendingReviewCountMap.set(did, (pendingReviewCountMap.get(did) || 0) + 1);
    }

    // Adherence percent (last 30 days) per dietitian
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const adherenceLogs = await prisma.mealLog.findMany({
        where: {
            orgId,
            scheduledDate: { gte: thirtyDaysAgo },
            client: { primaryDietitianId: { in: dietitianIds } },
        },
        select: {
            status: true,
            client: { select: { primaryDietitianId: true } },
        },
    });

    const adherenceMap = new Map<string, { total: number; eaten: number }>();
    for (const log of adherenceLogs) {
        const did = log.client.primaryDietitianId;
        if (!did) continue;
        const entry = adherenceMap.get(did) || { total: 0, eaten: 0 };
        entry.total++;
        if (log.status === 'eaten') entry.eaten++;
        adherenceMap.set(did, entry);
    }

    // 3. Assemble response
    const result = dietitians.map(d => {
        const adh = adherenceMap.get(d.id);
        const adherencePercent = adh && adh.total > 0
            ? Math.round((adh.eaten / adh.total) * 100)
            : 0;

        return {
            id: d.id,
            fullName: d.fullName,
            email: d.email,
            profilePhotoUrl: d.profilePhotoUrl,
            clientCount: clientCountMap.get(d.id) || 0,
            activePlanCount: activePlanCountMap.get(d.id) || 0,
            pendingReviewCount: pendingReviewCountMap.get(d.id) || 0,
            adherencePercent,
        };
    });

    res.status(200).json({
        success: true,
        data: { dietitians: result },
    });
});
