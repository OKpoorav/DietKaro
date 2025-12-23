import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../errors/AppError';
import logger from '../utils/logger';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * Global error handler middleware
 * Catches all errors and formats consistent responses
 */
export const errorHandler: ErrorRequestHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Log the error
    logger.error('Error caught by global handler', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        body: req.body
    });

    // Handle Zod validation errors
    if (err instanceof ZodError) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Validation failed',
                details: err.issues.map((e: any) => ({
                    field: e.path.join('.'),
                    message: e.message
                }))
            }
        });
    }

    // Handle Prisma errors
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            return res.status(409).json({
                success: false,
                error: {
                    code: 'CONFLICT',
                    message: 'A record with this value already exists'
                }
            });
        }
        if (err.code === 'P2025') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Record not found'
                }
            });
        }
    }

    // Handle AppError (operational errors)
    if (err instanceof AppError) {
        const errorResponse: any = {
            code: err.code,
            message: err.message
        };
        if (err.details) {
            errorResponse.details = err.details;
        }
        return res.status(err.statusCode).json({
            success: false,
            error: errorResponse
        });
    }

    // Handle unknown errors (programming errors)
    const statusCode = 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;

    return res.status(statusCode).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message,
            ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {})
        }
    });
};

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`
        }
    });
};
