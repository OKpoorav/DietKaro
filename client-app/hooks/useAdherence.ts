import { useQuery } from '@tanstack/react-query';
import { adherenceApi } from '../services/api';

export function useDailyAdherence(date?: string) {
    return useQuery({
        queryKey: ['adherence', 'daily', date],
        queryFn: async () => {
            const { data } = await adherenceApi.getDaily(date);
            return data.data;
        },
        staleTime: 60 * 1000,
    });
}

export function useWeeklyAdherence(weekStart?: string) {
    return useQuery({
        queryKey: ['adherence', 'weekly', weekStart],
        queryFn: async () => {
            const { data } = await adherenceApi.getWeekly(weekStart);
            return data.data;
        },
        staleTime: 60 * 1000,
    });
}

export function useComplianceHistory(days: number = 30) {
    return useQuery({
        queryKey: ['adherence', 'history', days],
        queryFn: async () => {
            const { data } = await adherenceApi.getHistory(days);
            return data.data;
        },
        staleTime: 60 * 1000,
    });
}
