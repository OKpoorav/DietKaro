'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export interface OnboardingInvite {
    token: string;
    expiresAt: string;
    usedAt: string | null;
    isExpired: boolean;
    isUsed: boolean;
}

export interface OnboardingInviteStatus {
    hasActive: boolean;
    invite: OnboardingInvite | null;
}

export interface GenerateInviteResult {
    link: string;
    expiresInDays: number;
}

export function useOnboardingInviteStatus(clientId: string) {
    const api = useApiClient();
    return useQuery({
        queryKey: ['onboarding-invite-status', clientId],
        queryFn: async () => {
            const { data } = await api.get(`/clients/${clientId}/onboarding/invite/status`);
            return data.data as OnboardingInviteStatus;
        },
        enabled: !!clientId,
        staleTime: 30 * 1000,
    });
}

export function useGenerateInvite() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ clientId }: { clientId: string }) => {
            const { data } = await api.post(`/clients/${clientId}/onboarding/invite`);
            return data.data as GenerateInviteResult;
        },
        onSuccess: (_data, { clientId }) => {
            queryClient.invalidateQueries({ queryKey: ['onboarding-invite-status', clientId] });
        },
    });
}
