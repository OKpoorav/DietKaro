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
