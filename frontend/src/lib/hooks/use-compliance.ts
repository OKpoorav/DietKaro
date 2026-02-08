'use client';

import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

// ============ TYPES ============

export type ComplianceColor = 'GREEN' | 'YELLOW' | 'RED';

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

// ============ HOOKS ============

export function useWeeklyAdherence(clientId: string | null, weekStart?: string) {
    const api = useApiClient();

    return useQuery({
        queryKey: ['compliance', 'weekly', clientId, weekStart],
        queryFn: async () => {
            const params = weekStart ? `?weekStart=${weekStart}` : '';
            const { data } = await api.get(`/clients/${clientId}/adherence/weekly${params}`);
            return data.data as WeeklyAdherence;
        },
        enabled: !!clientId,
        staleTime: 60 * 1000,
    });
}

export function useComplianceHistory(clientId: string | null, days: number = 30) {
    const api = useApiClient();

    return useQuery({
        queryKey: ['compliance', 'history', clientId, days],
        queryFn: async () => {
            const { data } = await api.get(`/clients/${clientId}/adherence/history?days=${days}`);
            return data.data as ComplianceHistory;
        },
        enabled: !!clientId,
        staleTime: 60 * 1000,
    });
}
