import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mealLogsApi } from '../services/api';
import { MealLog } from '../types';

export function useMealLog(mealLogId: string) {
    // Don't fetch for pending meals - they don't exist in DB yet
    const isPending = mealLogId?.startsWith('pending-');

    return useQuery({
        queryKey: ['meal-log', mealLogId],
        queryFn: async () => {
            const { data } = await mealLogsApi.getMealLog(mealLogId);
            return data.data as MealLog;
        },
        enabled: !!mealLogId && !isPending, // Skip fetch for pending meals
        staleTime: 30 * 1000, // 30 seconds
    });
}

interface LogMealInput {
    mealLogId: string;
    status: 'eaten' | 'skipped' | 'substituted';
    notes?: string;
    photoUri?: string;
}

export function useLogMeal() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ mealLogId, status, notes }: LogMealInput) => {
            const { data } = await mealLogsApi.logMeal(mealLogId, {
                status,
                notes,
            });
            return data.data;
        },
        onSuccess: async (_, { mealLogId }) => {
            // Force immediate refetch of today's meals
            await queryClient.invalidateQueries({ queryKey: ['meals', 'today'] });
            await queryClient.refetchQueries({ queryKey: ['meals', 'today'] });

            // Also invalidate other related queries
            queryClient.invalidateQueries({ queryKey: ['meal-log', mealLogId] });
            queryClient.invalidateQueries({ queryKey: ['client', 'stats'] });
        },
    });
}
