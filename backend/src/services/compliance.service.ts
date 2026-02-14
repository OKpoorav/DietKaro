/**
 * Compliance Service
 * 7-factor meal compliance scoring with daily/weekly/history adherence
 */

import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { COMPLIANCE_CONFIG } from '../config/compliance.config';

// ============ TYPES ============

export type ComplianceColor = 'GREEN' | 'YELLOW' | 'RED';

export interface ComplianceResult {
    score: number;
    color: ComplianceColor;
    issues: string[];
}

export interface MealBreakdown {
    mealLogId: string;
    mealName: string;
    mealType: string;
    score: number | null;
    color: ComplianceColor | null;
    status: string;
    issues: string[];
}

export interface DailyAdherence {
    date: string;
    score: number;
    color: ComplianceColor;
    mealsLogged: number;
    mealsPlanned: number;
    mealBreakdown: MealBreakdown[];
}

export interface WeeklyAdherence {
    weekStart: string;
    weekEnd: string;
    averageScore: number;
    color: ComplianceColor;
    dailyBreakdown: DailyAdherence[];
    trend: 'improving' | 'declining' | 'stable';
}

export interface ComplianceHistoryEntry {
    date: string;
    score: number;
    color: ComplianceColor;
}

export interface ComplianceHistory {
    data: ComplianceHistoryEntry[];
    averageScore: number;
    bestDay: ComplianceHistoryEntry | null;
    worstDay: ComplianceHistoryEntry | null;
}

// ============ HELPERS ============

function getColor(score: number): ComplianceColor {
    if (score >= COMPLIANCE_CONFIG.THRESHOLDS.GREEN_MIN) return 'GREEN';
    if (score >= COMPLIANCE_CONFIG.THRESHOLDS.YELLOW_MIN) return 'YELLOW';
    return 'RED';
}

/**
 * Parse a time string (HH:MM) and a date into a Date object
 */
function parseScheduledDateTime(date: Date, timeStr: string | null): Date | null {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    const d = new Date(date);
    d.setHours(hours, minutes, 0, 0);
    return d;
}

// ============ SERVICE ============

export class ComplianceService {

    /**
     * Calculate 7-factor compliance score for a meal log
     */
    async calculateMealCompliance(mealLogId: string): Promise<ComplianceResult> {
        const mealLog = await prisma.mealLog.findUnique({
            where: { id: mealLogId },
            include: {
                meal: {
                    include: {
                        foodItems: {
                            include: { foodItem: true },
                        },
                    },
                },
            },
        });

        if (!mealLog) {
            logger.warn('Compliance: MealLog not found', { mealLogId });
            return { score: 0, color: 'RED', issues: ['Meal log not found'] };
        }

        const { WEIGHTS, BONUS, PENALTIES } = COMPLIANCE_CONFIG;
        const issues: string[] = [];
        let score = 0;

        // Factor 7: Skipped → score is 0
        if (mealLog.status === 'skipped') {
            await this.persistScore(mealLogId, PENALTIES.SKIPPED_SCORE, ['Meal was skipped']);
            return { score: 0, color: 'RED', issues: ['Meal was skipped'] };
        }

        // Factor 1: On-time (+20)
        if (mealLog.loggedAt && mealLog.scheduledTime) {
            const scheduled = parseScheduledDateTime(mealLog.scheduledDate, mealLog.scheduledTime);
            if (scheduled) {
                const diffMinutes = Math.abs(mealLog.loggedAt.getTime() - scheduled.getTime()) / 60000;
                if (diffMinutes <= COMPLIANCE_CONFIG.ON_TIME_WINDOW_MINUTES) {
                    score += WEIGHTS.ON_TIME;
                } else {
                    issues.push(`Meal logged ${Math.round(diffMinutes)} min from scheduled time`);
                }
            } else {
                // No valid scheduled time — give benefit of the doubt
                score += WEIGHTS.ON_TIME;
            }
        } else if (mealLog.loggedAt) {
            // No scheduled time set — give the points
            score += WEIGHTS.ON_TIME;
        } else {
            issues.push('Meal not logged yet');
        }

        // Factor 2: Photo uploaded (+15)
        if (mealLog.mealPhotoUrl) {
            score += WEIGHTS.PHOTO;
        } else {
            issues.push('No photo uploaded');
        }

        // Factor 3: Correct foods (+30)
        // For now, if status is 'eaten' (not substituted), assume correct foods
        if (mealLog.status === 'eaten') {
            score += WEIGHTS.CORRECT_FOODS;
        } else if (mealLog.status === 'substituted') {
            // Partial credit for substitution — they ate something
            score += Math.round(WEIGHTS.CORRECT_FOODS * 0.5);
            issues.push('Substituted foods from planned meal');
        } else {
            issues.push('Foods not confirmed');
        }

        // Factor 4: Portion accuracy (+20)
        // Compare substituteCaloriesEst (if provided) vs planned calories
        // Filter by chosen option group for meals with alternatives
        const chosenGroup = mealLog.chosenOptionGroup ?? 0;
        const plannedFoodItems = mealLog.meal.foodItems.filter(fi => fi.optionGroup === chosenGroup);
        let plannedCalories = 0;
        plannedFoodItems.forEach(fi => {
            const ratio = Number(fi.quantityG) / 100;
            plannedCalories += fi.foodItem.calories * ratio;
        });

        if (mealLog.substituteCaloriesEst && plannedCalories > 0) {
            const deviation = Math.abs(mealLog.substituteCaloriesEst - plannedCalories) / plannedCalories;
            if (deviation <= COMPLIANCE_CONFIG.PORTION_TOLERANCE_PCT) {
                score += WEIGHTS.PORTION_ACCURACY;
            } else {
                // Proportional: lose points based on deviation
                const portionScore = Math.max(0, WEIGHTS.PORTION_ACCURACY * (1 - deviation));
                score += Math.round(portionScore);
                issues.push(`Calorie deviation: ${Math.round(deviation * 100)}%`);
            }
        } else if (mealLog.status === 'eaten') {
            // No substitute info and ate the meal — assume portion was correct
            score += WEIGHTS.PORTION_ACCURACY;
        }

        // Factor 5: Dietitian review — bonus, not a deduction
        // Client-controllable factors already sum to 100. Review adds extra, clamped at 100.
        if (mealLog.dietitianFeedback) {
            score += BONUS.DIETITIAN_APPROVED;
        }

        // Factor 6: Substitution penalty (-10)
        if (mealLog.status === 'substituted') {
            score += PENALTIES.SUBSTITUTION;
            issues.push('Substitution penalty applied');
        }

        score = Math.max(0, Math.min(100, score));
        const color = getColor(score);

        await this.persistScore(mealLogId, score, issues);

        logger.info('Compliance calculated', { mealLogId, score, color, issues });
        return { score, color, issues };
    }

    /**
     * Calculate daily adherence for a client on a given date
     */
    async calculateDailyAdherence(clientId: string, date: Date): Promise<DailyAdherence> {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        // Get all meal logs for this day
        const logs = await prisma.mealLog.findMany({
            where: {
                clientId,
                scheduledDate: { gte: start, lte: end },
            },
            include: {
                meal: { select: { name: true, mealType: true } },
            },
            orderBy: { scheduledTime: 'asc' },
        });

        // Count planned meals from active diet plan
        const activePlan = await prisma.dietPlan.findFirst({
            where: {
                clientId,
                status: 'active',
                isActive: true,
            },
            include: {
                meals: { select: { id: true } },
            },
        });

        const mealsPlanned = activePlan?.meals.length || logs.length;

        // Derive score from status when complianceScore hasn't been calculated yet
        const deriveScoreFromStatus = (status: string): number => {
            if (status === 'eaten') return 85;
            if (status === 'substituted') return 50;
            if (status === 'skipped') return 0;
            return 0; // pending
        };

        const mealBreakdown: MealBreakdown[] = logs.map(log => {
            const score = log.complianceScore ?? (log.status !== 'pending' ? deriveScoreFromStatus(log.status) : null);
            return {
                mealLogId: log.id,
                mealName: log.meal.name,
                mealType: log.meal.mealType,
                score,
                color: score !== null ? (log.complianceColor as ComplianceColor) || getColor(score) : null,
                status: log.status,
                issues: log.complianceIssues || [],
            };
        });

        const scoredMeals = mealBreakdown.filter(m => m.score !== null);
        const totalScore = scoredMeals.reduce((sum, m) => sum + (m.score || 0), 0);
        const avgScore = scoredMeals.length > 0 ? Math.round(totalScore / scoredMeals.length) : 0;

        return {
            date: start.toISOString().split('T')[0],
            score: avgScore,
            color: getColor(avgScore),
            mealsLogged: logs.filter(l => l.status !== 'pending').length,
            mealsPlanned,
            mealBreakdown,
        };
    }

    /**
     * Calculate weekly adherence for a client
     * Optimized: 3 queries (week logs + active plan + prev week) instead of 15
     */
    async calculateWeeklyAdherence(clientId: string, weekStartDate?: Date): Promise<WeeklyAdherence> {
        const weekStart = weekStartDate ? new Date(weekStartDate) : this.getWeekStart(new Date());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        // Single query: all meal logs for the entire week
        const allLogs = await prisma.mealLog.findMany({
            where: {
                clientId,
                scheduledDate: { gte: weekStart, lte: weekEnd },
            },
            include: {
                meal: { select: { name: true, mealType: true } },
            },
            orderBy: { scheduledTime: 'asc' },
        });

        // Single query: active diet plan (same for all 7 days)
        const activePlan = await prisma.dietPlan.findFirst({
            where: {
                clientId,
                status: 'active',
                isActive: true,
            },
            include: {
                meals: { select: { id: true } },
            },
        });

        const mealsPlanned = activePlan?.meals.length || 0;

        // Partition logs by date in memory
        const logsByDate = new Map<string, typeof allLogs>();
        allLogs.forEach(log => {
            const dateKey = log.scheduledDate.toISOString().split('T')[0];
            if (!logsByDate.has(dateKey)) logsByDate.set(dateKey, []);
            logsByDate.get(dateKey)!.push(log);
        });

        // Build daily breakdown without additional queries
        const dailyBreakdown: DailyAdherence[] = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(weekStart);
            day.setDate(day.getDate() + i);
            const dateKey = day.toISOString().split('T')[0];
            const dayLogs = logsByDate.get(dateKey) || [];
            const daily = this.buildDailyAdherenceFromLogs(dateKey, dayLogs, mealsPlanned || dayLogs.length);
            dailyBreakdown.push(daily);
        }

        const daysWithScores = dailyBreakdown.filter(d => d.mealsLogged > 0);
        const avgScore = daysWithScores.length > 0
            ? Math.round(daysWithScores.reduce((sum, d) => sum + d.score, 0) / daysWithScores.length)
            : 0;

        // Single query: previous week trend
        const prevWeekStart = new Date(weekStart);
        prevWeekStart.setDate(prevWeekStart.getDate() - 7);
        const prevWeekEnd = new Date(prevWeekStart);
        prevWeekEnd.setDate(prevWeekEnd.getDate() + 6);

        const prevLogs = await prisma.mealLog.findMany({
            where: {
                clientId,
                scheduledDate: { gte: prevWeekStart, lte: prevWeekEnd },
                complianceScore: { not: null },
            },
            select: { complianceScore: true },
        });

        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        if (prevLogs.length > 0 && daysWithScores.length > 0) {
            const prevAvg = Math.round(prevLogs.reduce((s, l) => s + (l.complianceScore || 0), 0) / prevLogs.length);
            const diff = avgScore - prevAvg;
            if (diff > COMPLIANCE_CONFIG.TREND_THRESHOLD) trend = 'improving';
            else if (diff < -COMPLIANCE_CONFIG.TREND_THRESHOLD) trend = 'declining';
        }

        return {
            weekStart: weekStart.toISOString().split('T')[0],
            weekEnd: weekEnd.toISOString().split('T')[0],
            averageScore: avgScore,
            color: getColor(avgScore),
            dailyBreakdown,
            trend,
        };
    }

    /**
     * Get compliance history for charting
     */
    async getClientComplianceHistory(clientId: string, days: number = 30): Promise<ComplianceHistory> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        // Use groupBy to aggregate in the database instead of fetching all rows
        const grouped = await prisma.mealLog.groupBy({
            by: ['scheduledDate'],
            where: {
                clientId,
                scheduledDate: { gte: startDate },
                complianceScore: { not: null },
            },
            _avg: { complianceScore: true },
            orderBy: { scheduledDate: 'asc' },
        });

        const data: ComplianceHistoryEntry[] = grouped.map(row => {
            const avg = Math.round(row._avg.complianceScore || 0);
            return {
                date: row.scheduledDate.toISOString().split('T')[0],
                score: avg,
                color: getColor(avg),
            };
        });

        const totalAvg = data.length > 0
            ? Math.round(data.reduce((s, d) => s + d.score, 0) / data.length)
            : 0;

        const bestDay = data.length > 0
            ? data.reduce((best, d) => d.score > best.score ? d : best, data[0])
            : null;

        const worstDay = data.length > 0
            ? data.reduce((worst, d) => d.score < worst.score ? d : worst, data[0])
            : null;

        return { data, averageScore: totalAvg, bestDay, worstDay };
    }

    // ============ PRIVATE HELPERS ============

    /**
     * Pure function: build a DailyAdherence from pre-fetched logs. No database calls.
     */
    private buildDailyAdherenceFromLogs(
        dateKey: string,
        logs: Array<{
            id: string;
            status: string;
            complianceScore: number | null;
            complianceColor: string | null;
            complianceIssues: string[];
            meal: { name: string; mealType: string };
        }>,
        mealsPlanned: number,
    ): DailyAdherence {
        const deriveScoreFromStatus = (status: string): number => {
            if (status === 'eaten') return 85;
            if (status === 'substituted') return 50;
            if (status === 'skipped') return 0;
            return 0;
        };

        const mealBreakdown: MealBreakdown[] = logs.map(log => {
            const score = log.complianceScore ?? (log.status !== 'pending' ? deriveScoreFromStatus(log.status) : null);
            return {
                mealLogId: log.id,
                mealName: log.meal.name,
                mealType: log.meal.mealType,
                score,
                color: score !== null ? (log.complianceColor as ComplianceColor) || getColor(score) : null,
                status: log.status,
                issues: log.complianceIssues || [],
            };
        });

        const scoredMeals = mealBreakdown.filter(m => m.score !== null);
        const totalScore = scoredMeals.reduce((sum, m) => sum + (m.score || 0), 0);
        const avgScore = scoredMeals.length > 0 ? Math.round(totalScore / scoredMeals.length) : 0;

        return {
            date: dateKey,
            score: avgScore,
            color: getColor(avgScore),
            mealsLogged: logs.filter(l => l.status !== 'pending').length,
            mealsPlanned,
            mealBreakdown,
        };
    }

    private async persistScore(mealLogId: string, score: number, issues: string[]): Promise<void> {
        const color = getColor(score);
        await prisma.mealLog.update({
            where: { id: mealLogId },
            data: {
                complianceScore: score,
                complianceColor: color,
                complianceIssues: issues,
            },
        });
    }

    private getWeekStart(date: Date): Date {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        d.setDate(diff);
        return d;
    }
}

export const complianceService = new ComplianceService();
