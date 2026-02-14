import { Response, NextFunction } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';

/**
 * Middleware to require an active (non-cancelled, non-expired) subscription.
 * Must be used after requireAuth.
 */
export const requireActiveSubscription = async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
) => {
    if (!req.user) throw AppError.unauthorized();

    const org = await prisma.organization.findUnique({
        where: { id: req.user.organizationId },
        select: {
            subscriptionStatus: true,
            subscriptionExpiresAt: true,
        },
    });

    if (!org) throw AppError.notFound('Organization not found', 'ORG_NOT_FOUND');

    if (org.subscriptionStatus === 'cancelled') {
        throw AppError.forbidden(
            'Subscription cancelled. Please renew to continue.',
            'SUBSCRIPTION_CANCELLED'
        );
    }

    if (org.subscriptionStatus === 'paused') {
        throw AppError.forbidden(
            'Subscription paused. Please reactivate to continue.',
            'SUBSCRIPTION_PAUSED'
        );
    }

    if (org.subscriptionExpiresAt && org.subscriptionExpiresAt < new Date()) {
        throw AppError.forbidden(
            'Subscription expired. Please renew.',
            'SUBSCRIPTION_EXPIRED'
        );
    }

    next();
};

/**
 * Middleware to check that the organization has not exceeded its maxClients limit.
 * Apply this only on the client creation route.
 * Must be used after requireAuth.
 */
export const requireClientCapacity = async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
) => {
    if (!req.user) throw AppError.unauthorized();

    const org = await prisma.organization.findUnique({
        where: { id: req.user.organizationId },
        select: { maxClients: true },
    });

    if (!org) throw AppError.notFound('Organization not found', 'ORG_NOT_FOUND');

    const currentCount = await prisma.client.count({
        where: { orgId: req.user.organizationId, isActive: true },
    });

    if (currentCount >= org.maxClients) {
        throw AppError.forbidden(
            `Client limit reached (${org.maxClients}). Upgrade your plan to add more clients.`,
            'CLIENT_LIMIT_REACHED'
        );
    }

    next();
};
