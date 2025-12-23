'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

// Types
export interface MealLog {
    id: string;
    mealId: string;
    scheduledDate: string;
    scheduledTime: string;
    status: 'pending' | 'eaten' | 'skipped' | 'substituted';
    mealPhotoUrl?: string;
    mealPhotoSmallUrl?: string;
    clientNotes?: string;
    dietitianFeedback?: string;
    loggedAt?: string;
    createdAt: string;
    client: {
        id: string;
        fullName: string;
    };
    meal?: {
        id: string;
        name: string;
        mealType: string;
    };
    reviewedByUser?: {
        id: string;
        fullName: string;
    };
}

interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    meta: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

interface MealLogsParams {
    page?: number;
    pageSize?: number;
    clientId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
}

interface ReviewMealLogInput {
    status: 'eaten' | 'skipped' | 'substituted';
    dietitianFeedback?: string;
}

// Hooks
export function useMealLogs(params: MealLogsParams = {}) {
    const api = useApiClient();
    const { page = 1, pageSize = 20, clientId, status, dateFrom, dateTo } = params;

    return useQuery({
        queryKey: ['meal-logs', page, pageSize, clientId, status, dateFrom, dateTo],
        queryFn: async () => {
            const { data } = await api.get<PaginatedResponse<MealLog>>('/meal-logs', {
                params: { page, pageSize, clientId, status, dateFrom, dateTo },
            });
            return data;
        },
    });
}

export function useMealLog(id: string) {
    const api = useApiClient();

    return useQuery({
        queryKey: ['meal-logs', id],
        queryFn: async () => {
            const { data } = await api.get(`/meal-logs/${id}`);
            return data.data as MealLog;
        },
        enabled: !!id,
    });
}

export function useReviewMealLog() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...reviewData }: ReviewMealLogInput & { id: string }) => {
            const { data } = await api.patch(`/meal-logs/${id}/review`, reviewData);
            return data.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
            queryClient.invalidateQueries({ queryKey: ['meal-logs', variables.id] });
        },
    });
}

export function useUpdateMealLog() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...updateData }: { id: string; status?: string; clientNotes?: string }) => {
            const { data } = await api.patch(`/meal-logs/${id}`, updateData);
            return data.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
            queryClient.invalidateQueries({ queryKey: ['meal-logs', variables.id] });
        },
    });
}
