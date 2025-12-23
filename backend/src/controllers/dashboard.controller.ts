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
        // Pending meal log reviews
        prisma.mealLog.count({
            where: { orgId, status: 'pending' }
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
        // Pending meal logs with client info
        prisma.mealLog.findMany({
            where: { orgId, status: 'pending' },
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

    // Weekly adherence breakdown
    const weeklyData: { day: string; value: number }[] = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date.setHours(0, 0, 0, 0));
        const dayEnd = new Date(date.setHours(23, 59, 59, 999));

        const dayMealLogs = await prisma.mealLog.groupBy({
            by: ['status'],
            where: {
                orgId,
                scheduledDate: { gte: dayStart, lte: dayEnd }
            },
            _count: true
        });

        const dayTotal = dayMealLogs.reduce((acc, s) => acc + s._count, 0);
        const dayEaten = dayMealLogs.find(s => s.status === 'eaten')?._count || 0;
        const dayPercent = dayTotal > 0 ? Math.round((dayEaten / dayTotal) * 100) : 0;

        weeklyData.push({
            day: days[dayStart.getDay()],
            value: dayPercent
        });
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
