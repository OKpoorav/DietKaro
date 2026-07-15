'use client';

import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

// Types
export interface WeightLog {
    id: string;
    logDate: string;
    logTime?: string | null;
    weightKg: number;
    bmi: number | null;
    weightChange: number | null;
    notes?: string | null;
    progressPhotoUrl?: string | null;
    isOutlier: boolean;
}

interface WeightLogsResponse {
    success: boolean;
    data: WeightLog[];
    meta: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        totalStartWeight: number | null;
        totalEndWeight: number | null;
        totalWeightLoss: number | null;
        averageWeightLossPerWeek: number | null;
    };
}

interface WeightLogsParams {
    dateFrom?: string;
    dateTo?: string;
    pageSize?: number;
}

// Hooks
export function useWeightLogs(clientId: string, params: WeightLogsParams = {}) {
    const api = useApiClient();
    const { dateFrom, dateTo, pageSize = 200 } = params;

    return useQuery({
        queryKey: ['weight-logs', clientId, dateFrom, dateTo, pageSize],
        queryFn: async () => {
            const { data } = await api.get<WeightLogsResponse>(`/clients/${clientId}/weight-logs`, {
                params: { dateFrom, dateTo, pageSize },
            });
            return data;
        },
        enabled: !!clientId,
    });
}
