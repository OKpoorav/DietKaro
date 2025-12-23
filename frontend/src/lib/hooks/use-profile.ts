'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export interface UserProfile {
    id: string;
    email: string;
    fullName: string;
    phone?: string;
    profilePhotoUrl?: string;
    specialization?: string;
    bio?: string;
    role: string;
    organizationId: string;
    isActive: boolean;
    mfaEnabled: boolean;
    lastLoginAt?: string;
    createdAt: string;
    updatedAt: string;
}

export function useProfile() {
    const api = useApiClient();

    return useQuery({
        queryKey: ['auth', 'me'],
        queryFn: async () => {
            const { data } = await api.get('/auth/me');
            return data.data as UserProfile;
        },
    });
}

export function useUpdateProfile() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (profileData: Partial<UserProfile>) => {
            const { data } = await api.patch('/auth/me', profileData);
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
        },
    });
}
