'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year';

export interface SubscriptionPlan {
    id: string;
    orgId: string;
    name: string;
    recurrenceUnit: RecurrenceUnit;
    intervalCount: number;
    durationDays: number;
    costInr: number | string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}

export interface CreatePlanInput {
    name: string;
    recurrenceUnit: RecurrenceUnit;
    intervalCount: number;
    durationDays?: number;
    costInr: number;
    active?: boolean;
}

export interface UpdatePlanInput extends Partial<CreatePlanInput> {
    id: string;
}

export function useSubscriptionPlans(includeInactive = false) {
    const api = useApiClient();
    return useQuery({
        queryKey: ['subscription-plans', includeInactive],
        queryFn: async () => {
            const { data } = await api.get('/plans', {
                params: includeInactive ? { includeInactive: 'true' } : {},
            });
            return data.data as SubscriptionPlan[];
        },
        staleTime: 60 * 1000,
    });
}

export function useCreatePlan() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreatePlanInput) => {
            const { data } = await api.post('/plans', input);
            return data.data as SubscriptionPlan;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
        },
    });
}

export function useUpdatePlan() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...input }: UpdatePlanInput) => {
            const { data } = await api.patch(`/plans/${id}`, input);
            return data.data as SubscriptionPlan;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        },
    });
}

export function useDeletePlan() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/plans/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
        },
    });
}

const RECURRENCE_DAYS: Record<RecurrenceUnit, number> = { day: 1, week: 7, month: 30, year: 365 };
export function deriveDurationDays(unit: RecurrenceUnit, count: number): number {
    return RECURRENCE_DAYS[unit] * count;
}

export function formatRecurrence(unit: RecurrenceUnit, count: number): string {
    if (count === 1) return `Every ${unit}`;
    return `Every ${count} ${unit}s`;
}
