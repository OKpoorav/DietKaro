'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export type LeadTemperature = 'hot' | 'warm' | 'cold';
export type ReferralType = 'existing_client' | 'doctor' | 'gym_trainer' | 'friend_family' | 'other';

export interface LeadStatus {
    id: string;
    name: string;
    color: string;
    isSystemDefault: boolean;
    isSystemConverted: boolean;
}

export interface LeadSource {
    id: string;
    name: string;
    active: boolean;
}

export interface LeadFollowup {
    id: string;
    leadId: string;
    dueAt: string;
    type: 'call' | 'whatsapp' | 'visit' | 'reminder';
    notes?: string;
    completedAt?: string | null;
}

export interface Lead {
    id: string;
    orgId: string;
    name: string;
    primaryMobile: string;
    altMobile?: string;
    email?: string;
    age?: number;
    gender?: 'male' | 'female' | 'other';
    city?: string;
    sourceId?: string;
    reference?: string;
    referralType?: ReferralType;
    ownerUserId?: string;
    statusId: string;
    temperature: LeadTemperature;
    notes?: string;
    convertedClientId?: string;
    archivedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    source?: LeadSource;
    status: LeadStatus;
    ownerUser?: { id: string; fullName: string; profilePhotoUrl?: string };
    followups?: LeadFollowup[];
}

export interface LeadListResult {
    items: Lead[];
    total: number;
    page: number;
    pageSize: number;
}

export interface LeadFilters {
    search?: string;
    statusIds?: string;
    sourceIds?: string;
    ownerUserId?: string;
    temperature?: LeadTemperature;
    referralType?: ReferralType;
    createdFrom?: string;
    createdTo?: string;
    dueToday?: boolean;
    overdue?: boolean;
    showArchived?: boolean;
    page?: number;
    pageSize?: number;
}

export function useLeads(filters: LeadFilters = {}) {
    const api = useApiClient();
    return useQuery({
        queryKey: ['leads', filters],
        queryFn: async () => {
            const params = new URLSearchParams();
            Object.entries(filters).forEach(([k, v]) => {
                if (v !== undefined && v !== '' && v !== false) params.set(k, String(v));
            });
            const { data } = await api.get(`/leads?${params}`);
            return data as LeadListResult & { success: boolean };
        },
        staleTime: 30_000,
    });
}

export function useLead(id: string) {
    const api = useApiClient();
    return useQuery({
        queryKey: ['lead', id],
        queryFn: async () => {
            const { data } = await api.get(`/leads/${id}`);
            return data.data as Lead & {
                tagAssignments?: Array<{ tagId: string; tag: { id: string; name: string; color: string } }>;
                convertedClient?: { id: string; fullName: string };
            };
        },
        enabled: !!id,
        staleTime: 30_000,
    });
}

export function useCreateLead() {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (body: Partial<Lead>) => {
            const { data } = await api.post('/leads', body);
            return data.data as Lead;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
    });
}

export function useUpdateLead(id: string) {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (body: Partial<Lead>) => {
            const { data } = await api.patch(`/leads/${id}`, body);
            return data.data as Lead;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['lead', id] });
            qc.invalidateQueries({ queryKey: ['leads'] });
        },
    });
}

export function useArchiveLead() {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => api.post(`/leads/${id}/archive`),
        onSuccess: (_data, id) => {
            qc.invalidateQueries({ queryKey: ['leads'] });
            qc.invalidateQueries({ queryKey: ['lead', id] });
        },
    });
}

export function useRestoreLead(id: string) {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async () => api.post(`/leads/${id}/restore`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['leads'] });
            qc.invalidateQueries({ queryKey: ['lead', id] });
        },
    });
}

export function useConvertLead(id: string) {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (body: {
            fullName: string; email: string; phone: string;
            gender?: string; dateOfBirth?: string; city?: string;
        }) => {
            const { data } = await api.post(`/leads/${id}/convert`, body);
            return data.data as { clientId: string; alreadyConverted: boolean };
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['leads'] });
            qc.invalidateQueries({ queryKey: ['lead', id] });
        },
    });
}

export function useRecordProposal(id: string) {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (body: { planId: string; pdfFilename: string }) => {
            const { data } = await api.post(`/leads/${id}/proposal`, body);
            return data;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-touchpoints', id] }),
    });
}

export function useLeadDashboardWidget() {
    const api = useApiClient();
    return useQuery({
        queryKey: ['lead-dashboard-widget'],
        queryFn: async () => {
            const { data } = await api.get('/leads/dashboard-widget');
            return data.data as {
                dueToday: Array<{ id: string; dueAt: string; type: string; lead: { id: string; name: string } }>;
                overdueCount: number;
            };
        },
        staleTime: 60_000,
    });
}
