'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export interface ProposalTemplate {
    id: string;
    orgId: string;
    headerCopy?: string | null;
    logoUrl?: string | null;
    footerNote?: string | null;
    signatureLine?: string | null;
    customFields: Array<{ label: string; sortOrder: number }>;
    updatedAt: string;
}

export function useProposalTemplate() {
    const api = useApiClient();
    return useQuery({
        queryKey: ['proposal-template'],
        queryFn: async () => {
            const { data } = await api.get('/proposal-template');
            return data.data as ProposalTemplate;
        },
        staleTime: 60_000,
    });
}

export function useUpdateProposalTemplate() {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (body: Partial<Omit<ProposalTemplate, 'id' | 'orgId' | 'updatedAt'>>) => {
            const { data } = await api.put('/proposal-template', body);
            return data.data as ProposalTemplate;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['proposal-template'] }),
    });
}
