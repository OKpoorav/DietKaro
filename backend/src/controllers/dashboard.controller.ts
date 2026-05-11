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

    // 2. Batch queries — all aggregations are pushed to the DB (no unbounded findMany).
    //
    // Prisma's groupBy cannot group by a relation field (e.g. client.primaryDietitianId),
    // so we use $queryRaw with explicit GROUP BY. Each query is O(matching rows) at the
    // DB level and returns only one row per dietitian — safe at any org size.
    //
    // Soft-deleted records are excluded via deletedAt IS NULL (the Prisma extension
    // handles this automatically for ORM calls but not for $queryRaw).

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Client counts per dietitian (ORM groupBy is fine here — no relation field needed)
    const clientCounts = await prisma.client.groupBy({
        by: ['primaryDietitianId'],
        where: { orgId, isActive: true, primaryDietitianId: { in: dietitianIds } },
        _count: true,
    });
    const clientCountMap = new Map(clientCounts.map(c => [c.primaryDietitianId, c._count]));

    type CountRow = { dietitianId: string; count: bigint };
    type AdherenceRow = { dietitianId: string; status: string; count: bigint };

    const [activePlanRows, pendingReviewRows, adherenceRows] = await Promise.all([
        // Active plan counts — single GROUP BY query, O(active plans)
        prisma.$queryRaw<CountRow[]>`
            SELECT c."primaryDietitianId" AS "dietitianId", COUNT(*)::bigint AS count
            FROM "DietPlan" dp
            JOIN "Client" c ON dp."clientId" = c."id"
            WHERE dp."orgId" = ${orgId}
              AND dp."status" = 'active'
              AND dp."deletedAt" IS NULL
              AND c."primaryDietitianId" = ANY(${dietitianIds}::uuid[])
            GROUP BY c."primaryDietitianId"
        `,

        // Pending review counts — single GROUP BY query, O(unreviewed logs)
        prisma.$queryRaw<CountRow[]>`
            SELECT c."primaryDietitianId" AS "dietitianId", COUNT(*)::bigint AS count
            FROM "MealLog" ml
            JOIN "Client" c ON ml."clientId" = c."id"
            WHERE ml."orgId" = ${orgId}
              AND ml."status" IN ('eaten', 'skipped', 'substituted')
              AND ml."reviewedByUserId" IS NULL
              AND ml."deletedAt" IS NULL
              AND c."primaryDietitianId" = ANY(${dietitianIds}::uuid[])
            GROUP BY c."primaryDietitianId"
        `,

        // Adherence breakdown — single GROUP BY returning (dietitianId, status, count)
        prisma.$queryRaw<AdherenceRow[]>`
            SELECT c."primaryDietitianId" AS "dietitianId", ml."status", COUNT(*)::bigint AS count
            FROM "MealLog" ml
            JOIN "Client" c ON ml."clientId" = c."id"
            WHERE ml."orgId" = ${orgId}
              AND ml."scheduledDate" >= ${thirtyDaysAgo}
              AND ml."deletedAt" IS NULL
              AND c."primaryDietitianId" = ANY(${dietitianIds}::uuid[])
            GROUP BY c."primaryDietitianId", ml."status"
        `,
    ]);

    const activePlanCountMap = new Map<string, number>(
        activePlanRows.map(r => [r.dietitianId, Number(r.count)])
    );
    const pendingReviewCountMap = new Map<string, number>(
        pendingReviewRows.map(r => [r.dietitianId, Number(r.count)])
    );

    const adherenceMap = new Map<string, { total: number; eaten: number }>();
    for (const row of adherenceRows) {
        const entry = adherenceMap.get(row.dietitianId) ?? { total: 0, eaten: 0 };
        const n = Number(row.count);
        entry.total += n;
        if (row.status === 'eaten') entry.eaten += n;
        adherenceMap.set(row.dietitianId, entry);
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
