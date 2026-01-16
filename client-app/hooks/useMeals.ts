import { useQuery } from '@tanstack/react-query';
import { mealLogsApi, clientStatsApi } from '../services/api';
import { MealLog, ClientStats } from '../types';

export function useTodayMeals() {
    return useQuery({
        queryKey: ['meals', 'today'],
        queryFn: async () => {
            const { data } = await mealLogsApi.getTodayMeals();
            return data.data as MealLog[];
        },
        staleTime: 15 * 1000, // 15 seconds - reduced for faster updates
        refetchOnWindowFocus: true,
    });
}

export function useClientStats() {
    return useQuery({
        queryKey: ['client', 'stats'],
        queryFn: async () => {
            const { data } = await clientStatsApi.getStats();
            return data.data as ClientStats;
        },
        staleTime: 30 * 1000, // 30 seconds - reduced for faster updates
        refetchOnWindowFocus: true,
    });
}
