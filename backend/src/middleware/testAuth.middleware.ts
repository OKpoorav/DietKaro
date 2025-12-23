import { Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';

/**
 * TEST-ONLY middleware that bypasses Clerk auth for development testing.
 * Use X-Test-User-Id header to simulate an authenticated user.
 * 
 * DO NOT USE IN PRODUCTION!
 */
export const testAuthBypass = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const testUserId = req.headers['x-test-user-id'] as string;

        if (!testUserId) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'X-Test-User-Id header required for testing'
                }
            });
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: testUserId },
            include: { organization: true }
        });

        if (!dbUser) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'Test user not found'
                }
            });
        }

        req.user = {
            id: dbUser.id,
            clerkUserId: dbUser.clerkUserId || 'test-clerk-id',
            organizationId: dbUser.orgId,
            role: dbUser.role,
            email: dbUser.email,
            fullName: dbUser.fullName
        };
        req.dbUser = dbUser;

        next();
    } catch (error) {
        console.error('Test auth error:', error);
        return res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Test auth failed' }
        });
    }
};
