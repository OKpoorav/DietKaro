import { Response, NextFunction } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';

/**
 * Middleware to require authentication.
 * Uses Clerk's getAuth() to verify the session token.
 */
export const requireAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        // Get auth info from Clerk
        const auth = getAuth(req);

        if (!auth.userId) {
            return res.status(401).json({
                   success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                }
            });
        }

        // Find user in our database by clerkUserId
        const dbUser = await prisma.user.findUnique({
            where: { clerkUserId: auth.userId },
            include: { organization: true }
        });

        if (!dbUser) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'USER_NOT_REGISTERED',
                    message: 'User not registered in the system. Please complete registration first.'
                }
            });
        }

        if (!dbUser.isActive) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'USER_INACTIVE',
                    message: 'User account is inactive'
                }
            });
        }

        // Attach user info to request
        req.user = {
            id: dbUser.id,
            clerkUserId: dbUser.clerkUserId!,
            organizationId: dbUser.orgId,
            role: dbUser.role,
            email: dbUser.email,
            fullName: dbUser.fullName
        };
        req.dbUser = dbUser;

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({
            success: false,
            error: {
                code: 'AUTH_ERROR',
                message: 'Authentication failed'
            }
        });
    }
};

/**
 * Role-based authorization middleware.
 * Must be used after requireAuth.
 */
export const requireRole = (...allowedRoles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required'
                }
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'You do not have permission to perform this action'
                }
            });
        }

        next();
    };
};
