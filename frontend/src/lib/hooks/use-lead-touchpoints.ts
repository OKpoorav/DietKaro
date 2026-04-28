'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export type TouchpointKind =
    | 'field_change' | 'note_added' | 'proposal_shared' | 'payment_link_shared'
    | 'followup_scheduled' | 'followup_completed' | 'converted' | 'archived' | 'restored'
    | 'manual_call' | 'manual_whatsapp' | 'manual_visit' | 'manual_other';

export interface LeadTouchpoint {
    id: string;
    leadId: string;
    kind: TouchpointKind;
    payload?: Record<string, unknown> | null;
    actorUserId?: string | null;
    createdAt: string;
    actor?: { id: string; fullName: string; profilePhotoUrl?: string } | null;
}

export function useLeadTouchpoints(leadId: string, page = 1) {
    const api = useApiClient();
    return useQuery({
        queryKey: ['lead-touchpoints', leadId, page],
        queryFn: async () => {
            const { data } = await api.get(`/leads/${leadId}/touchpoints?page=${page}&pageSize=50`);
            return data as { items: LeadTouchpoint[]; total: number; page: number; pageSize: number };
        },
        enabled: !!leadId,
        staleTime: 30_000,
    });
}

export function useLogManualTouchpoint(leadId: string) {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (body: {
            kind: 'manual_call' | 'manual_whatsapp' | 'manual_visit' | 'manual_other';
            notes?: string;
            duration?: number;
            location?: string;
            createdAt?: string;
        }) => {
            const { data } = await api.post(`/leads/${leadId}/touchpoints`, body);
            return data.data as LeadTouchpoint;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-touchpoints', leadId] }),
    });
}
