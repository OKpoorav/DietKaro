'use client';

import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export interface Organization {
    id: string;
    name: string;
    slug: string;
    currentClientCount: number;
    currentUserCount: number;
}

export function useOrganization() {
    const api = useApiClient();
    return useQuery({
        queryKey: ['organization'],
        queryFn: async () => {
            const { data } = await api.get('/organizations');
            return data.data as Organization;
        },
        staleTime: 5 * 60 * 1000,
    });
}
