/**
 * Shared query filter and pagination utilities
 * Eliminates duplication across controllers
 */

export interface PaginationParams {
    skip: number;
    take: number;
    page: number;
    pageSize: number;
}

export interface PaginationMeta {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

/**
 * Parse page/pageSize from query params
 */
export function buildPaginationParams(page?: string | any, pageSize?: string | any): PaginationParams {
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.min(100, Math.max(1, Number(pageSize) || 20));
    return {
        page: p,
        pageSize: ps,
        skip: (p - 1) * ps,
        take: ps,
    };
}

/**
 * Build pagination meta for response
 */
export function buildPaginationMeta(total: number, params: PaginationParams): PaginationMeta {
    const totalPages = Math.ceil(total / params.pageSize);
    return {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages,
        hasNextPage: params.page < totalPages,
        hasPreviousPage: params.page > 1,
    };
}

/**
 * Build date range filter for Prisma
 */
export function buildDateFilter(dateFrom?: string | any, dateTo?: string | any): Record<string, Date> | undefined {
    if (!dateFrom && !dateTo) return undefined;

    const filter: Record<string, Date> = {};
    if (dateFrom) filter.gte = new Date(String(dateFrom));
    if (dateTo) filter.lte = new Date(String(dateTo));
    return filter;
}

/**
 * Build search filter for Prisma (OR across multiple fields)
 */
export function buildSearchFilter(search: string | undefined, fields: string[]): any[] | undefined {
    if (!search) return undefined;
    return fields.map((field) => ({
        [field]: { contains: String(search), mode: 'insensitive' },
    }));
}
