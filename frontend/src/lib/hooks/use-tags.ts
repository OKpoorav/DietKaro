'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../api/use-api-client';

export const TAG_COLORS = ['green', 'blue', 'amber', 'rose', 'violet', 'slate', 'teal', 'orange'] as const;
export type TagColor = (typeof TAG_COLORS)[number];

export interface ClientTag {
    id: string;
    orgId: string;
    name: string;
    color: TagColor;
    keywords: string[];
    active: boolean;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}

interface CreateTagInput {
    name: string;
    color: TagColor;
    keywords?: string[];
}

interface UpdateTagInput {
    name?: string;
    color?: TagColor;
    keywords?: string[];
    active?: boolean;
}

export function useTags() {
    const api = useApiClient();
    return useQuery({
        queryKey: ['tags'],
        queryFn: async () => {
            const { data } = await api.get('/tags');
            return data.data as ClientTag[];
        },
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateTag() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreateTagInput) => {
            const { data } = await api.post('/tags', input);
            return data.data as ClientTag;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
    });
}

export function useUpdateTag() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...input }: UpdateTagInput & { id: string }) => {
            const { data } = await api.patch(`/tags/${id}`, input);
            return data.data as ClientTag;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
    });
}

export function useDeleteTag() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/tags/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tags'] });
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            queryClient.invalidateQueries({ queryKey: ['client'] });
        },
    });
}

export function useSetClientTags() {
    const api = useApiClient();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ clientId, tagIds }: { clientId: string; tagIds: string[] }) => {
            const { data } = await api.put(`/clients/${clientId}/tags`, { tagIds });
            return {
                clientId,
                tags: (data.data?.tags ?? []) as ClientTag[],
            };
        },
        onSuccess: ({ clientId }) => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            queryClient.invalidateQueries({ queryKey: ['client', clientId] });
        },
    });
}

/**
 * Suggest tag IDs based on free-text inputs (goal + medical conditions).
 * Match: any keyword (lowercased) is a substring of the joined text (lowercased).
 * Tag name itself also acts as an implicit keyword.
 */
export function suggestTagIds(
    tags: ClientTag[],
    inputs: { goal?: string | null; medicalConditions?: string[] | null },
): string[] {
    const text = [
        inputs.goal ?? '',
        ...(inputs.medicalConditions ?? []),
    ].join(' ').toLowerCase();
    if (!text.trim()) return [];

    const suggested: string[] = [];
    for (const tag of tags) {
        if (!tag.active) continue;
        const candidates = [tag.name.toLowerCase(), ...tag.keywords.map((k) => k.toLowerCase())];
        if (candidates.some((c) => c && text.includes(c))) {
            suggested.push(tag.id);
        }
    }
    return suggested;
}
