import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
    namespace Express {
        interface Request {
            requestId: string;
        }
    }
}

/**
 * Assigns a unique request ID to every incoming request.
 * Uses the X-Request-ID header if provided (for distributed tracing),
 * otherwise generates a new UUID.
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
};
