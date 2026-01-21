/**
 * Compliance Service
 * Calculates adherence scores and flags issues for meal logs
 */

import prisma from '../utils/prisma';
import logger from '../utils/logger';

export interface ComplianceResult {
    score: number;
    color: 'GREEN' | 'YELLOW' | 'RED';
    issues: string[];
}

export class ComplianceService {

    /**
     * Calculate compliance for a meal log
     */
    async calculateCompliance(
        mealLogId: string,
        calories: number,
        plannedCalories: number,
        onTime: boolean,
        forbiddenItems: string[] = []
    ): Promise<ComplianceResult> {
        const issues: string[] = [];
        let score = 100;

        // 1. Calorie check (+/- 15% is generous, +/- 10% is strict)
        const variance = Math.abs(calories - plannedCalories) / plannedCalories;

        if (variance > 0.2) {
            issues.push('Calorie deviation > 20%');
            score -= 20;
        } else if (variance > 0.1) {
            issues.push('Calorie deviation > 10%');
            score -= 10;
        }

        // 2. Timing check
        if (!onTime) {
            issues.push('Meal skippped or late'); // Simplified
            score -= 10;
        }

        // 3. Forbidden items (major penalty)
        if (forbiddenItems.length > 0) {
            issues.push(`Forbidden items: ${forbiddenItems.join(', ')}`);
            score -= 30 * forbiddenItems.length;
        }

        score = Math.max(0, score);

        // Determine color
        let color: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
        if (score < 60) color = 'RED';
        else if (score < 85) color = 'YELLOW';

        // Update record
        await prisma.mealLog.update({
            where: { id: mealLogId },
            data: {
                complianceScore: score,
                complianceColor: color,
                complianceIssues: issues
            }
        });

        logger.info('Compliance calculated', { mealLogId, score, color });

        return { score, color, issues };
    }

    /**
     * Calculate Daily Adherence Score for a Client
     * Average of all meal scores for the day
     */
    async calculateDailyAdherence(clientId: string, date: Date): Promise<number> {
        // Start/End of day
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        const logs = await prisma.mealLog.findMany({
            where: {
                clientId,
                scheduledDate: {
                    gte: start,
                    lte: end
                },
                status: { not: 'skipped' }
            },
            select: { complianceScore: true }
        });

        if (logs.length === 0) return 0;

        const totalScore = logs.reduce((sum, log) => sum + (log.complianceScore || 0), 0);
        const average = Math.round(totalScore / logs.length);

        return average;
    }
}

export const complianceService = new ComplianceService();
