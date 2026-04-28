'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export interface LeadStatus {
    id: string;
    name: string;
    color: string;
    sortOrder: number;
    isSystemDefault: boolean;
    isSystemConverted: boolean;
    deletedAt?: string | null;
}

export function useLeadStatuses() {
    const api = useApiClient();
    return useQuery({
        queryKey: ['lead-statuses'],
        queryFn: async () => {
            const { data } = await api.get('/lead-statuses');
            return data.data as LeadStatus[];
        },
        staleTime: 60_000,
    });
}

export function useCreateLeadStatus() {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (body: { name: string; color?: string; sortOrder?: number }) => {
            const { data } = await api.post('/lead-statuses', body);
            return data.data as LeadStatus;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-statuses'] }),
    });
}

export function useUpdateLeadStatus() {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...body }: { id: string; name?: string; color?: string; sortOrder?: number }) => {
            const { data } = await api.patch(`/lead-statuses/${id}`, body);
            return data.data as LeadStatus;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-statuses'] }),
    });
}

export function useDeleteLeadStatus() {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => api.delete(`/lead-statuses/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-statuses'] }),
    });
}
