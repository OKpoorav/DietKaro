import { Response } from 'express';

interface PaginationMeta {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
}

interface ApiSuccessOptions<T> {
    res: Response;
    data?: T;
    message?: string;
    meta?: PaginationMeta;
    statusCode?: number;
}

/**
 * Send a standardized success response.
 *
 * Shape: { success: true, data?: T, message?: string, meta?: PaginationMeta }
 */
export function sendSuccess<T>({
    res,
    data,
    message,
    meta,
    statusCode = 200,
}: ApiSuccessOptions<T>): void {
    const body: Record<string, any> = { success: true };

    if (data !== undefined) body.data = data;
    if (message) body.message = message;
    if (meta) body.meta = meta;

    res.status(statusCode).json(body);
}

/**
 * Send a standardized error response (for use in controllers,
 * not the global error handler which already follows its own format).
 */
export function sendError(
    res: Response,
    statusCode: number,
    code: string,
    message: string,
    details?: any
): void {
    res.status(statusCode).json({
        success: false,
        error: { code, message, ...(details && { details }) },
    });
}
