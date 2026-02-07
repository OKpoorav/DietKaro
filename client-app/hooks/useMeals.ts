import { useQuery } from '@tanstack/react-query';
import { mealLogsApi, clientStatsApi } from '../services/api';

export function useTodayMeals() {
    return useQuery({
        queryKey: ['meals', 'today'],
        queryFn: async () => {
            const { data } = await mealLogsApi.getTodayMeals();
            return data.data;
        },
        staleTime: 15 * 1000,
        refetchOnWindowFocus: true,
    });
}

export function useClientStats() {
    return useQuery({
        queryKey: ['client', 'stats'],
        queryFn: async () => {
            const { data } = await clientStatsApi.getStats();
            return data.data;
        },
        staleTime: 30 * 1000,
        refetchOnWindowFocus: true,
    });
}
