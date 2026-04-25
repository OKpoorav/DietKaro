'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

// ============ TYPES ============

export interface LabAlert {
    name: string;
    value: number;
    unit: string;
    status: 'critical' | 'warning' | 'normal' | 'optimal';
    normalRange: string;
    derivedTag?: string;
}

export interface MedicalSummary {
    allergies: string[];
    intolerances: string[];
    dietPattern: string | null;
    eggAllowed: boolean;
    eggAvoidDays: string[];
    medicalConditions: string[];
    dislikes: string[];
    likedFoods: string[];
    avoidCategories: string[];

    diagnoses: string[];
    medications: string[];
    supplements: string[];
    surgeries: string[];
    familyHistory: string | null;
    healthNotes: string | null;

    labAlerts: LabAlert[];
    labDate: string | null;
    labDerivedTags: string[];

    criticalCount: number;
    warningCount: number;
    lastUpdated: string;
}

export interface LabValuesData {
    labValues: Record<string, number> | null;
    labDate: string | null;
    alerts: LabAlert[];
    derivedTags: string[];
}

// ============ HOOKS ============

export function useMedicalSummary(clientId: string) {
    const api = useApiClient();

    return useQuery({
        queryKey: ['medical-summary', clientId],
        queryFn: async () => {
            const { data } = await api.get(`/clients/${clientId}/medical-summary`);
            return data.data as MedicalSummary;
        },
        enabled: !!clientId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useLabValues(clientId: string) {
    const api = useApiClient();

    return useQuery({
        queryKey: ['lab-values', clientId],
        queryFn: async () => {
            const { data } = await api.get(`/clients/${clientId}/lab-values`);
            return data.data as LabValuesData;
        },
        enabled: !!clientId,
    });
}

// ============ CLIENT REPORTS ============

export interface ClientReport {
    id: string;
    fileName: string;
    fileType: string;
    reportType: string | null;
    notes: string | null;
    uploadedAt: string;
    viewUrl: string;
}

export function useClientReports(clientId: string) {
    const api = useApiClient();

    return useQuery({
        queryKey: ['client-reports', clientId],
        queryFn: async () => {
            const { data } = await api.get(`/clients/${clientId}/reports`);
            return data.data as ClientReport[];
        },
        enabled: !!clientId,
        staleTime: 5 * 60 * 1000,
    });
}

// ============ DOCUMENT AI SUMMARY ============

export type ReportProcessingStatus = 'pending' | 'extracting' | 'summarizing' | 'done' | 'failed' | 'skipped';

export interface MedicalExtractedData {
    diagnoses: string[];
    conditions: string[];
    medications: Array<{ name: string; dose: string | null; frequency: string | null }>;
    allergies: string[];
    intolerances: string[];
    dietary_restrictions: string[];
    lab_values: Record<string, string> | null;
    dietary_flags: string[];
    dietary_recommendations: string[];
    document_type_detected: string;
    summary: string;
}

export type ReportUploaderRole = 'client' | 'dietitian' | 'admin';

export interface ReportDocumentItem {
    id: string;
    fileName: string;
    fileType: string;
    reportType: string | null;
    processingStatus: ReportProcessingStatus;
    processingError: string | null;
    uploadedAt: string;
    viewUrl: string | null;
    uploaderRole?: ReportUploaderRole;
    uploadedByUserId?: string | null;
    uploadedByName?: string | null;
    summary: {
        summaryText: string | null;
        generatedAt: string;
        extractedData: MedicalExtractedData | null;
    } | null;
}

export interface ClientDocumentSummaryData {
    clientId: string;
    unifiedSummary: {
        id: string;
        summaryText: string;
        docCount: number;
        modelVersion: string | null;
        generatedAt: string;
        updatedAt: string;
    } | null;
    documents: ReportDocumentItem[];
}

export function useClientDocumentSummary(clientId: string) {
    const api = useApiClient();

    return useQuery({
        queryKey: ['client-document-summary', clientId],
        queryFn: async () => {
            const { data } = await api.get(`/clients/${clientId}/document-summary`);
            return data.data as ClientDocumentSummaryData;
        },
        enabled: !!clientId,
        staleTime: 2 * 60 * 1000,
        refetchInterval: (query) => {
            // Poll every 5s while any doc is still processing
            const docs = query.state.data?.documents ?? [];
            const processing = docs.some(
                (d) => d.processingStatus === 'pending' || d.processingStatus === 'extracting' || d.processingStatus === 'summarizing'
            );
            return processing ? 5000 : false;
        },
    });
}

export function useRegenerateDocumentSummary(clientId: string) {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const { data } = await api.post(`/clients/${clientId}/document-summary/regenerate`);
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client-document-summary', clientId] });
        },
    });
}

export function useRetriggerSummarize(clientId: string) {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (reportId: string) => {
            await api.post(`/reports/${reportId}/summarize`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client-document-summary', clientId] });
        },
    });
}

export function useSaveLabValues(clientId: string) {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: { labValues: Record<string, number>; labDate: string }) => {
            const { data } = await api.put(`/clients/${clientId}/lab-values`, input);
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['lab-values', clientId] });
            queryClient.invalidateQueries({ queryKey: ['medical-summary', clientId] });
            queryClient.invalidateQueries({ queryKey: ['clients', clientId] });
        },
    });
}
