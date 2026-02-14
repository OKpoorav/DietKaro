import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mealLogsApi } from '../services/api';
import { compressImageForUpload } from '../utils/imageUtils';

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

interface LogMealResult {
    mealLog: any;
    photoUploadFailed: boolean;
    photoError?: Error;
}

export function useLogMeal() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            mealLogId,
            status,
            notes,
            photoUri,
            chosenOptionGroup,
        }: LogMealInput): Promise<LogMealResult> => {
            const { data } = await mealLogsApi.logMeal(mealLogId, {
                status,
                notes,
                chosenOptionGroup,
            });
            const result = data.data;
            let photoUploadFailed = false;
            let photoError: Error | undefined;

            if (photoUri) {
                try {
                    const actualId = result.id || mealLogId;
                    const compressedUri = await compressImageForUpload(photoUri);
                    const formData = new FormData();
                    formData.append('photo', {
                        uri: compressedUri,
                        name: 'meal-photo.jpg',
                        type: 'image/jpeg',
                    });
                    await mealLogsApi.uploadPhoto(actualId, formData);
                } catch (err) {
                    photoUploadFailed = true;
                    photoError = err instanceof Error ? err : new Error(String(err));
                    console.warn('Photo upload failed, meal log was saved:', err);
                }
            }

            return { mealLog: result, photoUploadFailed, photoError };
        },
        onSuccess: async (result) => {
            const actualId = result.mealLog.id;

            // invalidateQueries marks stale AND triggers refetch for mounted queries.
            // No need for a separate refetchQueries call.
            await queryClient.invalidateQueries({ queryKey: ['meals', 'today'] });

            // Use the ACTUAL server-returned ID, not the input mealLogId
            queryClient.invalidateQueries({ queryKey: ['meal-log', actualId] });
            queryClient.invalidateQueries({ queryKey: ['client', 'stats'] });
        },
    });
}

// Separate hook for retrying a failed photo upload
export function useRetryPhotoUpload() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            mealLogId,
            photoUri,
        }: {
            mealLogId: string;
            photoUri: string;
        }) => {
            const formData = new FormData();
            formData.append('photo', {
                uri: photoUri,
                name: 'meal-photo.jpg',
                type: 'image/jpeg',
            });
            const { data } = await mealLogsApi.uploadPhoto(mealLogId, formData);
            return data.data;
        },
        onSuccess: (_, { mealLogId }) => {
            queryClient.invalidateQueries({ queryKey: ['meals', 'today'] });
            queryClient.invalidateQueries({ queryKey: ['meal-log', mealLogId] });
        },
    });
}
