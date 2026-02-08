'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

// Types
export interface Meal {
    id: string;
    name: string;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    scheduledTime: string;
    foodItems: MealFoodItem[];
}

export interface MealFoodItem {
    id: string;
    foodItem: {
        id: string;
        name: string;
        caloriesPer100g: number;
        proteinPer100g: number;
        carbsPer100g: number;
        fatsPer100g: number;
    };
    quantityG: number;
}

export interface DietPlan {
    id: string;
    clientId?: string; // Optional for templates
    name?: string; // Backend returns name
    title?: string; // Keep for backwards compatibility
    description?: string;
    startDate: string;
    endDate?: string;
    status?: string;
    isPublished?: boolean;
    isTemplate?: boolean;
    templateCategory?: string;
    publishedAt?: string;
    targetCalories?: number;
    targetProteinG?: number;
    targetCarbsG?: number;
    targetFatsG?: number;
    createdAt: string;
    updatedAt: string;
    client?: {
        id: string;
        fullName: string;
    };
    meals?: Meal[];
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

interface DietPlansParams {
    page?: number;
    pageSize?: number;
    clientId?: string;
    isPublished?: boolean;
    isTemplate?: boolean;
}

export interface CreateDietPlanInput {
    clientId?: string; // Optional for templates
    title: string; // 'name' in backend schema mapped to 'title'
    description?: string;
    startDate: string;
    endDate?: string;
    targetCalories?: number;
    targetProteinG?: number;
    targetCarbsG?: number;
    targetFatsG?: number;
    notesForClient?: string;
    internalNotes?: string;
    meals?: {
        dayIndex?: number;
        mealDate?: string;
        mealType: string;
        timeOfDay?: string;
        title: string;
        description?: string;
        instructions?: string;
        foodItems?: {
            foodId: string;
            quantity: number;
            notes?: string;
        }[];
    }[];
    options?: {
        saveAsTemplate?: boolean;
        templateCategory?: string;
    };
}

// Hooks
export function useDietPlans(params: DietPlansParams = {}) {
    const api = useApiClient();
    const { page = 1, pageSize = 20, clientId, isPublished, isTemplate } = params;

    return useQuery({
        queryKey: ['diet-plans', page, pageSize, clientId, isPublished, isTemplate],
        queryFn: async () => {
            const { data } = await api.get<PaginatedResponse<DietPlan>>('/diet-plans', {
                params: { page, pageSize, clientId, isTemplate },
            });
            return data;
        },
    });
}

export function useDietPlan(id: string) {
    const api = useApiClient();

    return useQuery({
        queryKey: ['diet-plans', id],
        queryFn: async () => {
            const { data } = await api.get(`/diet-plans/${id}`);
            return data.data as DietPlan;
        },
        enabled: !!id,
    });
}

export function useCreateDietPlan() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (planData: CreateDietPlanInput) => {
            // Map 'title' to 'name' as expected by backend
            const { title, ...rest } = planData;
            const payload = { ...rest, name: title };
            const { data } = await api.post('/diet-plans', payload);
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diet-plans'] });
        },
    });
}

export function useUpdateDietPlan() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...planData }: Partial<DietPlan> & { id: string }) => {
            const { data } = await api.patch(`/diet-plans/${id}`, planData);
            return data.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['diet-plans'] });
            queryClient.invalidateQueries({ queryKey: ['diet-plans', variables.id] });
        },
    });
}

export function usePublishDietPlan() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const { data } = await api.post(`/diet-plans/${id}/publish`);
            return data.data;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ['diet-plans'] });
            queryClient.invalidateQueries({ queryKey: ['diet-plans', id] });
        },
    });
}

interface AssignTemplateInput {
    templateId: string;
    clientId: string;
    startDate: string;
    name?: string;
}

export function useAssignTemplate() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ templateId, clientId, startDate, name }: AssignTemplateInput) => {
            const { data } = await api.post(`/diet-plans/${templateId}/assign`, {
                clientId,
                startDate,
                name,
            });
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['diet-plans'] });
        },
    });
}
