import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { mealLogsApi, clientStatsApi } from '../services/api';
import { getSocket } from '../services/socket';

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

export function useMealsByDateRange(startDate: string, endDate: string) {
    return useQuery({
        queryKey: ['meals', 'range', startDate, endDate],
        queryFn: async () => {
            const { data } = await mealLogsApi.getMealsByDateRange(startDate, endDate);
            return data.data;
        },
        enabled: !!startDate && !!endDate,
        staleTime: 15 * 1000,
        refetchOnWindowFocus: true,
    });
}

/** Listens for plan:published socket events and invalidates meals cache instantly */
export function usePlanSocket() {
    const queryClient = useQueryClient();

    useEffect(() => {
        let retryTimeout: ReturnType<typeof setTimeout>;
        let cleanup: (() => void) | undefined;

        const subscribe = () => {
            const socket = getSocket();
            if (!socket) {
                retryTimeout = setTimeout(subscribe, 500);
                return;
            }

            const handlePlanPublished = () => {
                queryClient.invalidateQueries({ queryKey: ['meals'] });
            };

            socket.on('plan:published', handlePlanPublished);
            cleanup = () => socket.off('plan:published', handlePlanPublished);
        };

        subscribe();

        return () => {
            clearTimeout(retryTimeout);
            cleanup?.();
        };
    }, [queryClient]);
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
