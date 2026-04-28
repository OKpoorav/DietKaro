'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export interface LeadSource {
    id: string;
    name: string;
    active: boolean;
    isSystem: boolean;
    deletedAt?: string | null;
}

export function useLeadSources() {
    const api = useApiClient();
    return useQuery({
        queryKey: ['lead-sources'],
        queryFn: async () => {
            const { data } = await api.get('/lead-sources');
            return data.data as LeadSource[];
        },
        staleTime: 60_000,
    });
}

export function useCreateLeadSource() {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (name: string) => {
            const { data } = await api.post('/lead-sources', { name });
            return data.data as LeadSource;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-sources'] }),
    });
}

export function useUpdateLeadSource() {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...body }: { id: string; name?: string; active?: boolean }) => {
            const { data } = await api.patch(`/lead-sources/${id}`, body);
            return data.data as LeadSource;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-sources'] }),
    });
}

export function useDeleteLeadSource() {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => api.delete(`/lead-sources/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-sources'] }),
    });
}
