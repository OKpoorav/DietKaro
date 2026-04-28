'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export type FollowupType = 'call' | 'whatsapp' | 'visit' | 'reminder';

export interface LeadFollowup {
    id: string;
    leadId: string;
    dueAt: string;
    type: FollowupType;
    notes?: string | null;
    completedAt?: string | null;
    createdBy?: { id: string; fullName: string } | null;
}

export function useLeadFollowups(leadId: string) {
    const api = useApiClient();
    return useQuery({
        queryKey: ['lead-followups', leadId],
        queryFn: async () => {
            const { data } = await api.get(`/leads/${leadId}/followups`);
            return data.data as LeadFollowup[];
        },
        enabled: !!leadId,
        staleTime: 30_000,
    });
}

export function useCreateFollowup(leadId: string) {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (body: { dueAt: string; type: FollowupType; notes?: string }) => {
            const { data } = await api.post(`/leads/${leadId}/followups`, body);
            return data.data as LeadFollowup;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['lead-followups', leadId] });
            qc.invalidateQueries({ queryKey: ['lead', leadId] });
            qc.invalidateQueries({ queryKey: ['leads'] });
        },
    });
}

export function useUpdateFollowup(leadId: string) {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...body }: { id: string; dueAt?: string; type?: FollowupType; notes?: string }) => {
            const { data } = await api.patch(`/leads/${leadId}/followups/${id}`, body);
            return data.data as LeadFollowup;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-followups', leadId] }),
    });
}

export function useCompleteFollowup(leadId: string) {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (followupId: string) => {
            const { data } = await api.post(`/leads/${leadId}/followups/${followupId}/complete`);
            return data.data as LeadFollowup;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['lead-followups', leadId] });
            qc.invalidateQueries({ queryKey: ['lead-touchpoints', leadId] });
            qc.invalidateQueries({ queryKey: ['leads'] });
        },
    });
}
