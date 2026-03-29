'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';
import type { FoodRestriction } from './use-validation';

// Types
export interface Client {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth?: string;
    gender?: 'male' | 'female' | 'other';
    currentWeightKg?: number;
    targetWeightKg?: number;
    heightCm?: number;
    isActive: boolean;
    status?: 'active' | 'at-risk' | 'completed';
    createdAt: string;
    updatedAt: string;
    lastActivityAt?: string;
    primaryDietitian?: {
        id: string;
        fullName: string;
    };
    medicalProfile?: {
        allergies: string[];
        conditions: string[];
        medications: string[];
    };
    // Validation-related fields
    allergies?: string[];
    intolerances?: string[];
    dietPattern?: string;
    medicalConditions?: string[];
    foodRestrictions?: FoodRestriction[];
    dislikes?: string[];
    likedFoods?: string[];
    preferredCuisines?: string[];
    preferences?: {
        breakfastTime?: string | null;
        lunchTime?: string | null;
        dinnerTime?: string | null;
        snackTime?: string | null;
    } | null;
    // Nutrition targets
    targetCalories?: number | null;
    targetProteinG?: number | null;
    targetCarbsG?: number | null;
    targetFatsG?: number | null;
    // Latest body measurements
    latestMeasurement?: {
        logDate: string;
        chestCm: number | null;
        waistCm: number | null;
        hipsCm: number | null;
        thighsCm: number | null;
        armsCm: number | null;
        bodyFatPercentage: number | null;
    } | null;
}

export interface ClientProgress {
    weight: {
        startWeight: number | null;
        currentWeight: number | null;
        targetWeight: number | null;
        totalChange: number | null;
        last30DaysChange: number | null;
        weeklyAvgChange: number | null;
        progressToGoal: number | null;
    };
    meals: {
        total: number;
        eaten: number;
        substituted: number;
        skipped: number;
        pending: number;
        adherencePercentage: number;
        completionPercentage: number;
    };
    activeDietPlans: number;
}

interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    meta: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasNextPage?: boolean;
        hasPreviousPage?: boolean;
    };
}

interface ClientsParams {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
}

// Hooks
export function useClients(params: ClientsParams = {}) {
    const api = useApiClient();
    const { page = 1, pageSize = 20, search, status } = params;

    return useQuery({
        queryKey: ['clients', page, pageSize, search, status],
        queryFn: async () => {
            const { data } = await api.get<PaginatedResponse<Client>>('/clients', {
                params: { page, pageSize, search, status },
            });
            return data;
        },
        staleTime: 30 * 1000,
    });
}

export function useClient(id: string) {
    const api = useApiClient();

    return useQuery({
        queryKey: ['clients', id],
        queryFn: async () => {
            const { data } = await api.get(`/clients/${id}`);
            return data.data as Client;
        },
        enabled: !!id,
        staleTime: 60 * 1000,
    });
}

export function useClientProgress(clientId: string, params?: { dateFrom?: string; dateTo?: string }) {
    const api = useApiClient();

    return useQuery({
        queryKey: ['clients', clientId, 'progress', params],
        queryFn: async () => {
            const { data } = await api.get(`/clients/${clientId}/progress`, { params });
            const raw = data.data;
            // Map backend field names to frontend interface
            const progress: ClientProgress = {
                weight: {
                    startWeight: raw.weightTrend?.startWeight ?? null,
                    currentWeight: raw.weightTrend?.currentWeight ?? null,
                    targetWeight: raw.weightTrend?.targetWeight ?? null,
                    totalChange: raw.weightTrend?.totalWeightChange ?? null,
                    last30DaysChange: raw.weightTrend?.last30DaysChange ?? null,
                    weeklyAvgChange: raw.weightTrend?.weeklyAverageChange ?? null,
                    progressToGoal: raw.weightTrend?.progressToGoalPercentage ?? null,
                },
                meals: {
                    total: raw.mealAdherence?.totalMeals ?? 0,
                    eaten: raw.mealAdherence?.eatenMeals ?? 0,
                    substituted: raw.mealAdherence?.substitutedMeals ?? 0,
                    skipped: raw.mealAdherence?.skippedMeals ?? 0,
                    pending: raw.mealAdherence?.pendingMeals ?? 0,
                    adherencePercentage: raw.mealAdherence?.adherencePercentage ?? 0,
                    completionPercentage: raw.mealAdherence?.completionPercentage ?? 0,
                },
                activeDietPlans: raw.activeDietPlans ?? 0,
            };
            return progress;
        },
        enabled: !!clientId,
        staleTime: 60 * 1000,
    });
}

export function useCreateClient() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (clientData: Partial<Client>) => {
            const { data } = await api.post('/clients', clientData);
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
        },
    });
}

export function useDeleteClient() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (clientId: string) => {
            await api.delete(`/clients/${clientId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
        },
    });
}

export function useUpdateClient() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...clientData }: Partial<Client> & { id: string }) => {
            const { data } = await api.patch(`/clients/${id}`, clientData);
            return data.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['clients', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['clients'], exact: false, refetchType: 'active' });
        },
    });
}

