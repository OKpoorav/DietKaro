'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

// Types
export interface FoodItem {
    id: string;
    name: string;
    brand?: string;
    category: string;
    subCategory?: string;
    servingSize: string;
    isGlobal: boolean;
    isVerified: boolean;
    isBaseIngredient: boolean;
    nutrition: {
        calories: number;
        proteinG: number | null;
        carbsG: number | null;
        fatsG: number | null;
        fiberG: number | null;
    };
    allergenFlags: string[];
    dietaryTags: string[];
    ingredients?: { id: string; name: string; allergenFlags: string[]; dietaryCategory: string | null }[];
    barcode?: string;
}

export interface BaseIngredient {
    id: string;
    name: string;
    allergenFlags: string[];
    dietaryCategory: string | null;
    category: string;
}

interface FoodItemsParams {
    page?: number;
    pageSize?: number;
    q?: string;
    category?: string;
}

// Hooks
export function useFoodItems(params: FoodItemsParams = {}) {
    const api = useApiClient();
    const { page = 1, pageSize = 50, q, category } = params;

    return useQuery({
        queryKey: ['food-items', page, pageSize, q, category],
        queryFn: async () => {
            const { data } = await api.get('/food-items', {
                params: { page, pageSize, q, category },
            });
            return data;
        },
    });
}

export function useFoodItem(id: string) {
    const api = useApiClient();

    return useQuery({
        queryKey: ['food-items', id],
        queryFn: async () => {
            const { data } = await api.get(`/food-items/${id}`);
            return data.data as FoodItem;
        },
        enabled: !!id,
    });
}

export function useBaseIngredients(search?: string) {
    const api = useApiClient();

    return useQuery({
        queryKey: ['base-ingredients', search],
        queryFn: async () => {
            const { data } = await api.get('/food-items/base-ingredients', {
                params: { q: search, pageSize: 50 },
            });
            return data.data as BaseIngredient[];
        },
    });
}

export interface CreateFoodItemInput {
    name: string;
    brand?: string;
    category: string;
    subCategory?: string;
    servingSizeG: number;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatsG: number;
    fiberG?: number;
    sugarG?: number;
    sodiumMg?: number;
    dietaryTags?: string[];
    allergenFlags?: string[];
    isBaseIngredient?: boolean;
    ingredientIds?: string[];
    nutrition?: never; // Ensure we don't accidentally use this
}

export function useCreateFoodItem() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (foodData: CreateFoodItemInput) => {
            const { data } = await api.post('/food-items', foodData);
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['food-items'] });
            queryClient.invalidateQueries({ queryKey: ['base-ingredients'] });
        }
    });
}

export type UpdateFoodItemInput = Partial<CreateFoodItemInput> & { id: string };

export function useUpdateFoodItem() {
    const api = useApiClient();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdateFoodItemInput) => {
            const { id, ...updateData } = data;
            const { data: response } = await api.patch(`/food-items/${id}`, updateData);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['food-items'] });
            queryClient.invalidateQueries({ queryKey: ['base-ingredients'] });
        }
    });
}
