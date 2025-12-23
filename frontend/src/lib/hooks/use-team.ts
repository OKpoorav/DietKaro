'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export interface TeamMember {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    specialization?: string;
    profilePhotoUrl?: string;
    clientCount: number;
    avatar: string;
}

export interface InviteMemberInput {
    email: string;
    role: string;
}

export function useTeam() {
    const api = useApiClient();

    return useQuery({
        queryKey: ['team'],
        queryFn: async () => {
            const { data } = await api.get('/team');
            return data.data as TeamMember[];
        },
    });
}

export function useInviteMember() {
    const api = useApiClient();

    return useMutation({
        mutationFn: async (data: InviteMemberInput) => {
            const res = await api.post('/team/invite', data);
            return res.data.data;
        }
    });
}

export function useValidateInvite(token: string) {
    const api = useApiClient();

    return useQuery({
        queryKey: ['invitation', token],
        queryFn: async () => {
            const { data } = await api.get(`/team/invitation/${token}`);
            return data.data as { email: string; orgName: string; role: string };
        },
        enabled: !!token,
        retry: false
    });
}

export function useAcceptInvite() {
    const api = useApiClient();

    return useMutation({
        mutationFn: async (token: string) => {
            const res = await api.post('/team/join', { token });
            return res.data;
        }
    });
}
