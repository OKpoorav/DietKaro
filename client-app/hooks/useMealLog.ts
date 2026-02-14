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
    chosenOptionGroup?: number;
}

export function useLogMeal() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ mealLogId, status, notes, photoUri, chosenOptionGroup }: LogMealInput) => {
            const { data } = await mealLogsApi.logMeal(mealLogId, {
                status,
                notes,
                chosenOptionGroup,
            });
            const result = data.data;

            // Upload photo if provided (fire-and-forget — meal log succeeds even if photo fails)
            if (photoUri) {
                try {
                    const actualId = result.id || mealLogId;
                    const formData = new FormData();
                    formData.append('photo', {
                        uri: photoUri,
                        name: 'meal-photo.jpg',
                        type: 'image/jpeg',
                    } as any);
                    await mealLogsApi.uploadPhoto(actualId, formData);
                } catch (err) {
                    console.warn('Photo upload failed, meal log was saved:', err);
                }
            }

            return result;
        },
        onSuccess: async (_, { mealLogId }) => {
            await queryClient.invalidateQueries({ queryKey: ['meals', 'today'] });
            await queryClient.refetchQueries({ queryKey: ['meals', 'today'] });
            queryClient.invalidateQueries({ queryKey: ['meal-log', mealLogId] });
            queryClient.invalidateQueries({ queryKey: ['client', 'stats'] });
        },
    });
}
