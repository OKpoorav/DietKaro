'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export interface CallNote {
    id: string;
    orgId: string;
    clientId: string;
    createdByUserId?: string | null;
    content: string;
    createdAt: string;
    updatedAt: string;
    creator?: { id: string; fullName: string } | null;
}

export function useCallNotes(clientId: string) {
    const api = useApiClient();
    return useQuery({
        queryKey: ['call-notes', clientId],
        queryFn: async () => {
            const { data } = await api.get(`/clients/${clientId}/call-notes`);
            return data.data as CallNote[];
        },
        enabled: !!clientId,
        staleTime: 15_000,
    });
}

export function useCreateCallNote(clientId: string) {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (content: string) => {
            const { data } = await api.post(`/clients/${clientId}/call-notes`, { content });
            return data.data as CallNote;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['call-notes', clientId] }),
    });
}

export function useUpdateCallNote(clientId: string) {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, content }: { id: string; content: string }) => {
            const { data } = await api.patch(`/clients/${clientId}/call-notes/${id}`, { content });
            return data.data as CallNote;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['call-notes', clientId] }),
    });
}

export function useDeleteCallNote(clientId: string) {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => api.delete(`/clients/${clientId}/call-notes/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['call-notes', clientId] }),
    });
}
