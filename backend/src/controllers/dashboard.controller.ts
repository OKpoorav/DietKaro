import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';

export const getDashboardStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const orgId = req.user.organizationId;

    // Get counts
    const [
        totalClients,
        pendingReviews,
        activeDietPlans,
        recentClients,
        pendingMealLogs
    ] = await Promise.all([
        // Total active clients
        prisma.client.count({
            where: { orgId, isActive: true }
        }),
        // Pending meal log reviews (client acted, dietitian hasn't reviewed)
        prisma.mealLog.count({
            where: { orgId, status: { in: ['eaten', 'skipped', 'substituted'] }, reviewedByUserId: null }
        }),
        // Active (published) diet plans
        prisma.dietPlan.count({
            where: { orgId, status: 'active' }
        }),
        // Recent clients (last 5)
        prisma.client.findMany({
            where: { orgId, isActive: true },
            orderBy: { updatedAt: 'desc' },
            take: 5,
            select: {
                id: true,
                fullName: true,
                updatedAt: true,
                createdAt: true
            }
        }),
        // Pending meal logs with client info (client acted, dietitian hasn't reviewed)
        prisma.mealLog.findMany({
            where: { orgId, status: { in: ['eaten', 'skipped', 'substituted'] }, reviewedByUserId: null },
            orderBy: { scheduledDate: 'desc' },
            take: 5,
            include: {
                client: { select: { id: true, fullName: true } },
                meal: { select: { id: true, name: true, mealType: true } }
            }
        })
    ]);

    // Calculate average adherence (simplified - from last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const mealLogStats = await prisma.mealLog.groupBy({
        by: ['status'],
        where: {
            orgId,
            scheduledDate: { gte: thirtyDaysAgo }
        },
        _count: true
    });

    const totalMeals = mealLogStats.reduce((acc, s) => acc + s._count, 0);
    const eatenMeals = mealLogStats.find(s => s.status === 'eaten')?._count || 0;
    const adherencePercent = totalMeals > 0 ? Math.round((eatenMeals / totalMeals) * 100) : 0;

    // Weekly adherence breakdown — single query instead of 7
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date();
    weekEnd.setHours(23, 59, 59, 999);

    const weeklyMealLogs = await prisma.mealLog.findMany({
        where: { orgId, scheduledDate: { gte: weekStart, lte: weekEnd } },
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
