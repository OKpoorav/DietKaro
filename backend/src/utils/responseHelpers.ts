/**
 * Standardized response helpers
 */

import { PaginationMeta } from './queryFilters';

export function successResponse<T>(data: T) {
    return { success: true as const, data };
}

export function paginatedResponse<T>(data: T[], meta: PaginationMeta) {
    return { success: true as const, data, meta };
}
