'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';
import type { SubscriptionPlan } from './use-subscription-plans';

export type SubscriptionStatus = 'active' | 'paused' | 'deactivated';
export type PaymentStatusValue = 'paid' | 'unpaid';

export interface ClientSubscription {
    id: string;
    clientId: string;
    planId: string;
    activeDate: string;
    renewalDate: string;
    status: SubscriptionStatus;
    paymentStatus: PaymentStatusValue;
    pausedUntil: string | null;
    pausedAt: string | null;
    deactivatedAt: string | null;
    lastPaidAt: string | null;
    createdAt: string;
    updatedAt: string;
    plan: SubscriptionPlan;
}

export type SubscriptionFilter =
    | 'all'
    | 'paid'
    | 'unpaid'
    | 'paused'
    | 'deactivated'
    | 'no-plan'
    | 'due-7'
    | 'due-30';

export interface SubscriptionListRow {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    primaryDietitian: { id: string; fullName: string } | null;
    subscription: {
        id: string;
        planId: string;
        planName: string;
        costInr: number | string;
        activeDate: string;
        renewalDate: string;
        status: SubscriptionStatus;
        paymentStatus: PaymentStatusValue;
        pausedUntil: string | null;
        lastPaidAt: string | null;
    } | null;
    latestPayment: {
        clientId: string;
        paidAt: string | null;
        amountInr: number | string;
        method: string;
    } | null;
}

interface SubscriptionListParams {
    filter?: SubscriptionFilter;
    search?: string;
    page?: number;
    pageSize?: number;
}

export function useSubscriptionList(params: SubscriptionListParams = {}) {
    const api = useApiClient();
    return useQuery({
        queryKey: ['subscriptions', params.filter ?? 'all', params.search ?? '', params.page ?? 1, params.pageSize ?? 20],
        queryFn: async () => {
            const { data } = await api.get('/subscriptions', { params });
            return data as { data: SubscriptionListRow[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
        },
        staleTime: 30 * 1000,
    });
}

export function useClientSubscription(clientId: string | null | undefined) {
    const api = useApiClient();
    return useQuery({
        queryKey: ['client-subscription', clientId],
        queryFn: async () => {
            const { data } = await api.get(`/clients/${clientId}/subscription`);
            return data.data as ClientSubscription | null;
        },
        enabled: !!clientId,
        staleTime: 30 * 1000,
    });
}

function makeMutation<TArgs>(api: ReturnType<typeof useApiClient>, queryClient: ReturnType<typeof useQueryClient>) {
    return (path: (args: TArgs) => string, body?: (args: TArgs) => unknown) => ({
        mutationFn: async (args: TArgs) => {
            const { data } = await api.post(path(args), body ? body(args) : {});
            return data.data as ClientSubscription;
        },
        onSuccess: (_data: ClientSubscription, args: TArgs) => {
            const clientId = (args as unknown as { clientId: string }).clientId;
            queryClient.invalidateQueries({ queryKey: ['client-subscription', clientId] });
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
            queryClient.invalidateQueries({ queryKey: ['client', clientId] });
        },
    });
}

export function useAssignPlan() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    const cfg = makeMutation<{ clientId: string; planId: string }>(api, queryClient)(
        ({ clientId }) => `/clients/${clientId}/subscription`,
        ({ planId }) => ({ planId }),
    );
    return useMutation(cfg);
}

export function usePauseSubscription() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    const cfg = makeMutation<{ clientId: string; until?: string }>(api, queryClient)(
        ({ clientId }) => `/clients/${clientId}/subscription/pause`,
        ({ until }) => (until ? { until } : {}),
    );
    return useMutation(cfg);
}

export function useResumeSubscription() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    const cfg = makeMutation<{ clientId: string }>(api, queryClient)(
        ({ clientId }) => `/clients/${clientId}/subscription/resume`,
    );
    return useMutation(cfg);
}

export function useDeactivateSubscription() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    const cfg = makeMutation<{ clientId: string }>(api, queryClient)(
        ({ clientId }) => `/clients/${clientId}/subscription/deactivate`,
    );
    return useMutation(cfg);
}

export function useMarkActive() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    const cfg = makeMutation<{ clientId: string; note?: string }>(api, queryClient)(
        ({ clientId }) => `/clients/${clientId}/subscription/mark-active`,
        ({ note }) => (note ? { note } : {}),
    );
    return useMutation(cfg);
}
