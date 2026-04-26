'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export type PaymentMethod =
    | 'razorpay_link'
    | 'razorpay_checkout'
    | 'manual_cash'
    | 'manual_upi'
    | 'manual_bank'
    | 'manual_other'
    | 'mark_active';

export type PaymentTxStatus = 'pending' | 'succeeded' | 'failed' | 'expired';

export interface Payment {
    id: string;
    clientId: string;
    clientSubscriptionId: string | null;
    amountInr: number | string;
    status: PaymentTxStatus;
    method: PaymentMethod;
    razorpayLinkId: string | null;
    razorpayPaymentId: string | null;
    paidAt: string | null;
    note: string | null;
    createdAt: string;
}

export interface PaymentLinkResult {
    paymentId: string;
    razorpayLinkId: string;
    shortUrl: string;
    whatsappUrl: string | null;
    emailSent: boolean;
}

export type ManualPaymentMethod = 'manual_cash' | 'manual_upi' | 'manual_bank' | 'manual_other';

interface ManualPaymentInput {
    clientId: string;
    amountInr: number;
    method: ManualPaymentMethod;
    note?: string;
}

interface PaymentLinkInput {
    clientId: string;
    amountInr?: number;
    message?: string;
    channels?: { whatsapp?: boolean; email?: boolean };
}

export function useClientPayments(clientId: string | null | undefined) {
    const api = useApiClient();
    return useQuery({
        queryKey: ['client-payments', clientId],
        queryFn: async () => {
            const { data } = await api.get(`/clients/${clientId}/payments`);
            return data.data as Payment[];
        },
        enabled: !!clientId,
        staleTime: 30 * 1000,
    });
}

export function useRecordManualPayment() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ clientId, ...body }: ManualPaymentInput) => {
            const { data } = await api.post(`/clients/${clientId}/payments/manual`, body);
            return data.data as Payment;
        },
        onSuccess: (_p, vars) => {
            queryClient.invalidateQueries({ queryKey: ['client-payments', vars.clientId] });
            queryClient.invalidateQueries({ queryKey: ['client-subscription', vars.clientId] });
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        },
    });
}

export function useCreatePaymentLink() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ clientId, ...body }: PaymentLinkInput) => {
            const { data } = await api.post(`/clients/${clientId}/payments/link`, body);
            return data.data as PaymentLinkResult;
        },
        onSuccess: (_p, vars) => {
            queryClient.invalidateQueries({ queryKey: ['client-payments', vars.clientId] });
        },
    });
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
    razorpay_link: 'Razorpay link',
    razorpay_checkout: 'Razorpay',
    manual_cash: 'Cash',
    manual_upi: 'UPI',
    manual_bank: 'Bank transfer',
    manual_other: 'Other',
    mark_active: 'Marked active',
};
