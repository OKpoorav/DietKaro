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

export function useDashboardStats(dietitianId?: string | null) {
    const api = useApiClient();

    return useQuery({
        queryKey: ['dashboard', 'stats', dietitianId || 'all'],
        queryFn: async () => {
            const params = dietitianId ? `?dietitianId=${dietitianId}` : '';
            const { data } = await api.get(`/dashboard/stats${params}`);
            return data.data as DashboardStats;
        },
        staleTime: 30 * 1000,
    });
}

export function useDietitianAnalytics() {
    const api = useApiClient();
    return useQuery({
        queryKey: ['dashboard', 'dietitian-analytics'],
        queryFn: async () => {
            const { data } = await api.get('/dashboard/dietitian-analytics');
            return data.data.dietitians as Array<{
                id: string;
                fullName: string;
                email: string;
                profilePhotoUrl: string | null;
                clientCount: number;
                activePlanCount: number;
                pendingReviewCount: number;
                adherencePercent: number;
            }>;
        },
    });
}
