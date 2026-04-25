'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

interface UploadArgs {
    file: File;
    reportType?: string;
    notes?: string;
}

export const ACCEPTED_REPORT_MIMES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
];

export const MAX_REPORT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateReportFile(file: File): string | null {
    if (!ACCEPTED_REPORT_MIMES.includes(file.type)) {
        return 'Only PDF, JPG, PNG, or WebP files are accepted';
    }
    if (file.size > MAX_REPORT_SIZE_BYTES) {
        return 'File exceeds 10 MB';
    }
    return null;
}

export function useUploadClientReport(clientId: string) {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ file, reportType, notes }: UploadArgs) => {
            const form = new FormData();
            form.append('file', file);
            if (reportType) form.append('reportType', reportType);
            if (notes) form.append('notes', notes);

            const { data } = await api.post(
                `/clients/${clientId}/reports`,
                form,
                { headers: { 'Content-Type': 'multipart/form-data' } },
            );
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client-document-summary', clientId] });
            queryClient.invalidateQueries({ queryKey: ['client-reports', clientId] });
        },
    });
}

export function useDeleteClientReport(clientId: string) {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (reportId: string) => {
            await api.delete(`/clients/${clientId}/reports/${reportId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['client-document-summary', clientId] });
            queryClient.invalidateQueries({ queryKey: ['client-reports', clientId] });
        },
    });
}
