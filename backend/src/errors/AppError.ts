/**
 * Custom application error class for operational errors
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;
    public readonly details?: unknown;

    constructor(
        message: string,
        statusCode: number = 500,
        code: string = 'INTERNAL_ERROR',
        isOperational: boolean = true,
        details?: unknown
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = isOperational;
        this.details = details;

        Object.setPrototypeOf(this, AppError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }

    // Common error factories
    static badRequest(message: string, code: string = 'BAD_REQUEST', details?: unknown) {
        return new AppError(message, 400, code, true, details);
    }

    static unauthorized(message: string = 'Authentication required', code: string = 'UNAUTHORIZED') {
        return new AppError(message, 401, code);
    }

    static forbidden(message: string = 'Access denied', code: string = 'FORBIDDEN') {
        return new AppError(message, 403, code);
    }

    static notFound(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
        return new AppError(message, 404, code);
    }

    static conflict(message: string, code: string = 'CONFLICT') {
        return new AppError(message, 409, code);
    }

    static internal(message: string = 'Internal server error', code: string = 'INTERNAL_ERROR') {
        return new AppError(message, 500, code, false);
    }

    static validation(message: string, details?: unknown) {
        return new AppError(message, 400, 'VALIDATION_ERROR', true, details);
    }
}
