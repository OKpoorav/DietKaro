'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

// Mirror of backend `NotesExtraction` — kept loose (Record / null) so backend
// changes do not break the UI; the verify modal renders whatever it gets.
export interface ExtractedLabReport {
    date: string | null;
    values: Record<string, number>;
}

export interface ExtractedBodyMeasurement {
    date: string | null;
    chestCm: number | null;
    waistCm: number | null;
    hipsCm: number | null;
    thighsCm: number | null;
    armsCm: number | null;
    stomachCm: number | null;
    bellyAboveNavelCm: number | null;
    bellyBelowNavelCm: number | null;
    calfCm: number | null;
}

export interface ExtractedLifestyle {
    sleep: string | null;
    water: string | null;
    bowel: string | null;
    periods: string | null;
    hormonal: string | null;
    headaches: string | null;
    breakfast: string | null;
    lunch: string | null;
    dinner: string | null;
    other: string | null;
}

export interface NotesExtraction {
    age: number | null;
    heightCm: number | null;
    currentWeightKg: number | null;
    referredBy: string | null;
    location: string | null;
    bloodReports: ExtractedLabReport[];
    bodyMeasurements: ExtractedBodyMeasurement[];
    medicalIssues: string[];
    familyHistory: string[];
    allergies: string[];
    intolerances: string[];
    dislikes: string[];
    likedFoods: string[];
    lifestyle: ExtractedLifestyle;
    otherNotes: string[];
}

export function useExtractNotes(clientId: string) {
    const api = useApiClient();
    return useMutation({
        mutationFn: async (notes: string): Promise<NotesExtraction> => {
            const { data } = await api.post(`/clients/${clientId}/notes/extract`, { notes });
            return data.data as NotesExtraction;
        },
    });
}

export function useApplyExtractedNotes(clientId: string) {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input: { extracted: NotesExtraction; notes: string }) => {
            const { data } = await api.post(`/clients/${clientId}/notes/extract/apply`, input);
            return data.data as {
                measurementsApplied: { date: string; id: string }[];
                labReportApplied: { derivedTags: string[]; alertCount: number } | null;
                clientReportId: string;
                clientReportName: string;
                clientFieldsUpdated: string[];
            };
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['clients'] });
            qc.invalidateQueries({ queryKey: ['clients', clientId] });
            qc.invalidateQueries({ queryKey: ['medical-summary', clientId] });
            qc.invalidateQueries({ queryKey: ['lab-values', clientId] });
            qc.invalidateQueries({ queryKey: ['client-reports', clientId] });
            qc.invalidateQueries({ queryKey: ['client-document-summary', clientId] });
            qc.invalidateQueries({ queryKey: ['document-summary', clientId] });
        },
    });
}
