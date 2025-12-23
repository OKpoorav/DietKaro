'use client';

import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export interface DashboardStats {
    stats: {
        totalClients: number;
        pendingReviews: number;
        activeDietPlans: number;
        adherencePercent: number;
    };
    weeklyAdherence: { day: string; value: number }[];
    recentClients: {
        id: string;
        name: string;
        avatar: string;
        status: string;
        lastActivity: string;
    }[];
    pendingReviews: {
        id: string;
        client: string;
        meal: string;
        time: string;
    }[];
}

export function useDashboardStats() {
    const api = useApiClient();

    return useQuery({
        queryKey: ['dashboard', 'stats'],
        queryFn: async () => {
            const { data } = await api.get('/dashboard/stats');
            return data.data as DashboardStats;
        },
        staleTime: 30 * 1000, // Refresh every 30 seconds
    });
}
