import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE, {
        message: `pageSize cannot exceed ${MAX_PAGE_SIZE}`,
    }).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
