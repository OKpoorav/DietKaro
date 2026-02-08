import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { onboardingApi } from '../services/api';

export function useOnboardingStatus() {
    return useQuery({
        queryKey: ['onboarding', 'status'],
        queryFn: async () => {
            const { data } = await onboardingApi.getStatus();
            return data.data;
        },
        staleTime: 30 * 1000,
    });
}

export function useSaveOnboardingStep() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ step, data }: { step: number; data: any }) => {
            const response = await onboardingApi.saveStep(step, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['onboarding', 'status'] });
        },
    });
}

export function useCompleteOnboarding() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const response = await onboardingApi.complete();
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['onboarding', 'status'] });
        },
    });
}
