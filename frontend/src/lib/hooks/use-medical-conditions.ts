'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export interface MedicalCondition {
    id: string;
    name: string;
    active: boolean;
    isSystem: boolean;
    deletedAt?: string | null;
}

export function useMedicalConditions(search?: string) {
    const api = useApiClient();
    return useQuery({
        queryKey: ['medical-conditions', search ?? ''],
        queryFn: async () => {
            const { data } = await api.get('/medical-conditions', { params: search ? { q: search } : undefined });
            return data.data as MedicalCondition[];
        },
        staleTime: 60_000,
    });
}

export function useCreateMedicalCondition() {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (name: string) => {
            const { data } = await api.post('/medical-conditions', { name });
            return data.data as MedicalCondition;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['medical-conditions'] }),
    });
}

export function useUpdateMedicalCondition() {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...body }: { id: string; name?: string; active?: boolean }) => {
            const { data } = await api.patch(`/medical-conditions/${id}`, body);
            return data.data as MedicalCondition;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['medical-conditions'] }),
    });
}

export function useDeleteMedicalCondition() {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => api.delete(`/medical-conditions/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['medical-conditions'] }),
    });
}
