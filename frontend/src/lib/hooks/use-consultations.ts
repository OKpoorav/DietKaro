'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export type ConsultationMode = 'online' | 'in_person';
export type ConsultationStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Consultation {
    id: string;
    orgId: string;
    clientId: string;
    createdByUserId: string;
    title?: string;
    scheduledAt: string;
    durationMin: number;
    mode: ConsultationMode;
    meetLink?: string | null;
    location?: string | null;
    notes?: string | null;
    status: ConsultationStatus;
    createdAt: string;
    updatedAt: string;
    createdBy?: { id: string; fullName: string };
}

export interface CreateConsultationInput {
    title?: string;
    scheduledAt: string;
    durationMin?: number;
    mode?: ConsultationMode;
    meetLink?: string;
    location?: string;
    notes?: string;
}

export function useConsultations(clientId: string, options?: { upcoming?: boolean }) {
    const api = useApiClient();
    return useQuery({
        queryKey: ['consultations', clientId, options],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (options?.upcoming) params.set('upcoming', 'true');
            const { data } = await api.get(`/clients/${clientId}/consultations?${params}`);
            return data.data as Consultation[];
        },
        enabled: !!clientId,
        staleTime: 30_000,
    });
}

export function useCreateConsultation(clientId: string) {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (body: CreateConsultationInput) => {
            const { data } = await api.post(`/clients/${clientId}/consultations`, body);
            return data.data as Consultation;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['consultations', clientId] }),
    });
}

export function useUpdateConsultation(clientId: string) {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...body }: Partial<CreateConsultationInput> & { id: string; status?: ConsultationStatus }) => {
            const { data } = await api.patch(`/clients/${clientId}/consultations/${id}`, body);
            return data.data as Consultation;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['consultations', clientId] }),
    });
}

export function useDeleteConsultation(clientId: string) {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => api.delete(`/clients/${clientId}/consultations/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['consultations', clientId] }),
    });
}
