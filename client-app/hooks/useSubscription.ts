import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

export interface SubscriptionPlan {
    id: string;
    name: string;
    recurrenceUnit: string;
    intervalCount: number;
    durationDays: number;
    costInr: number | string;
}

export interface SubscriptionState {
    id: string;
    status: 'active' | 'paused' | 'deactivated';
    paymentStatus: 'paid' | 'unpaid';
    activeDate: string;
    renewalDate: string;
    pausedUntil: string | null;
    lastPaidAt: string | null;
    daysUntilRenewal: number;
    inGrace: boolean;
    graceDaysRemaining: number;
    plan: SubscriptionPlan;
}

interface UseSubscriptionResult {
    subscription: SubscriptionState | null;
    loading: boolean;
    refresh: () => Promise<void>;
}

/**
 * Fetches the client's own subscription state. Polls quietly in the
 * background after a Pay Now flow returns by calling `refresh()`.
 */
export function useSubscription(): UseSubscriptionResult {
    const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const res = await api.get('/client/subscription');
            setSubscription(res.data.data ?? null);
        } catch {
            // Network/auth errors handled by interceptors elsewhere; keep last good state.
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { subscription, loading, refresh };
}
