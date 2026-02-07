import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mealLogsApi } from '../services/api';

export function useMealLog(mealLogId: string) {
    const isPending = mealLogId?.startsWith('pending-');

    return useQuery({
        queryKey: ['meal-log', mealLogId],
        queryFn: async () => {
            const { data } = await mealLogsApi.getMealLog(mealLogId);
            return data.data;
        },
        enabled: !!mealLogId && !isPending,
        staleTime: 30 * 1000,
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
            await queryClient.invalidateQueries({ queryKey: ['meals', 'today'] });
            await queryClient.refetchQueries({ queryKey: ['meals', 'today'] });
            queryClient.invalidateQueries({ queryKey: ['meal-log', mealLogId] });
            queryClient.invalidateQueries({ queryKey: ['client', 'stats'] });
        },
    });
}
