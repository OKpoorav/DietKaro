import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

/**
 * Get referral statistics for the organization (admin dashboard)
 */
export const getOrgReferralStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    // Get total clients with referral codes
    const clientsWithCodes = await prisma.client.count({
        where: {
            orgId: req.user.organizationId,
            referralCode: { not: null },
            isActive: true
        }
    });

    // Get total referred clients
    const referredClients = await prisma.client.count({
        where: {
            orgId: req.user.organizationId,
            referredByClientId: { not: null },
            isActive: true
        }
    });

    // Get referral source breakdown
    const referralSourceBreakdown = await prisma.client.groupBy({
        by: ['referralSource'],
        where: {
            orgId: req.user.organizationId,
            referralSource: { not: null },
            isActive: true
        },
        _count: { id: true }
    });

    // Get total free months earned/used
    const benefitsAggr = await prisma.referralBenefit.aggregate({
        where: {
            client: { orgId: req.user.organizationId }
        },
        _sum: {
            freeMonthsEarned: true,
            freeMonthsUsed: true,
            referralCount: true
        }
    });

    // Top referrers
    const topReferrers = await prisma.client.findMany({
        where: {
            orgId: req.user.organizationId,
            isActive: true,
            referredClients: { some: {} }
        },
        select: {
            id: true,
            fullName: true,
            referralCode: true,
            _count: { select: { referredClients: true } }
        },
        orderBy: {
            referredClients: { _count: 'desc' }
        },
        take: 10
    });

    res.status(200).json({
        success: true,
        data: {
            overview: {
                clientsWithCodes,
                referredClients,
                totalReferrals: benefitsAggr._sum.referralCount || 0,
                freeMonthsEarned: benefitsAggr._sum.freeMonthsEarned || 0,
                freeMonthsUsed: benefitsAggr._sum.freeMonthsUsed || 0,
                freeMonthsPending: (benefitsAggr._sum.freeMonthsEarned || 0) - (benefitsAggr._sum.freeMonthsUsed || 0)
            },
            referralSourceBreakdown: referralSourceBreakdown.map(item => ({
                source: item.referralSource,
                count: item._count.id
            })),
            topReferrers: topReferrers.map(client => ({
                id: client.id,
                name: client.fullName,
                code: client.referralCode,
                referralCount: client._count.referredClients
            }))
        }
    });
});

/**
 * Get list of clients referred by a specific client
 */
export const getClientReferrals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.params;
    const { page = '1', pageSize = '20' } = req.query;

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
        where: { id: clientId, orgId: req.user.organizationId }
    });

    if (!client) throw AppError.notFound('Client not found');

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const [referrals, total] = await prisma.$transaction([
        prisma.client.findMany({
            where: {
                referredByClientId: clientId,
                orgId: req.user.organizationId,
                isActive: true
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take
        }),
        prisma.client.count({
            where: {
                referredByClientId: clientId,
                orgId: req.user.organizationId,
                isActive: true
            }
        })
    ]);

    // Get referral benefit info
    const benefit = await prisma.referralBenefit.findUnique({
        where: { clientId }
    });

    res.status(200).json({
        success: true,
        data: {
            referrer: {
                id: client.id,
                name: client.fullName,
                referralCode: client.referralCode
            },
            benefit: benefit ? {
                referralCount: benefit.referralCount,
                freeMonthsEarned: benefit.freeMonthsEarned,
                freeMonthsUsed: benefit.freeMonthsUsed,
                freeMonthsRemaining: benefit.freeMonthsEarned - benefit.freeMonthsUsed
            } : null,
            referrals
        },
        meta: {
            page: Number(page),
            pageSize: Number(pageSize),
            total,
            totalPages: Math.ceil(total / Number(pageSize))
        }
    });
});

/**
 * Get all clients with referral tracking info
 */
export const listClientsWithReferrals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { page = '1', pageSize = '20', source, hasReferrals } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const where: any = {
        orgId: req.user.organizationId,
        isActive: true
    };

    if (source) {
        where.referralSource = String(source);
    }

    if (hasReferrals === 'true') {
        where.referredClients = { some: {} };
    }

    const [clients, total] = await prisma.$transaction([
        prisma.client.findMany({
            where,
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                referralSource: true,
                referralSourceName: true,
                referralCode: true,
                createdAt: true,
                referredByClient: {
                    select: { id: true, fullName: true }
                },
                _count: { select: { referredClients: true } },
                referralBenefit: {
                    select: {
                        referralCount: true,
                        freeMonthsEarned: true,
                        freeMonthsUsed: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take
        }),
        prisma.client.count({ where })
    ]);

    res.status(200).json({
        success: true,
        data: clients.map(client => ({
            id: client.id,
            fullName: client.fullName,
            email: client.email,
            phone: client.phone,
            referralSource: client.referralSource,
            referralSourceName: client.referralSourceName,
            referralCode: client.referralCode,
            referredBy: client.referredByClient,
            referralCount: client._count.referredClients,
            benefit: client.referralBenefit,
            createdAt: client.createdAt
        })),
        meta: {
            page: Number(page),
            pageSize: Number(pageSize),
            total,
            totalPages: Math.ceil(total / Number(pageSize))
        }
    });
});

/**
 * Apply/redeem free month benefit for a client
 */
export const redeemFreeBenefit = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { clientId } = req.params;

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
        where: { id: clientId, orgId: req.user.organizationId }
    });

    if (!client) throw AppError.notFound('Client not found');

    const benefit = await prisma.referralBenefit.findUnique({
        where: { clientId }
    });

    if (!benefit) {
        throw AppError.badRequest('Client has no referral benefits');
    }

    const available = benefit.freeMonthsEarned - benefit.freeMonthsUsed;
    if (available <= 0) {
        throw AppError.badRequest('No free months available to redeem');
    }

    // Increment used count
    const updated = await prisma.referralBenefit.update({
        where: { clientId },
        data: {
            freeMonthsUsed: { increment: 1 }
        }
    });

    logger.info('Free month redeemed', {
        clientId,
        byUserId: req.user.id,
        remaining: updated.freeMonthsEarned - updated.freeMonthsUsed
    });

    res.status(200).json({
        success: true,
        data: {
            redeemed: true,
            freeMonthsEarned: updated.freeMonthsEarned,
            freeMonthsUsed: updated.freeMonthsUsed,
            freeMonthsRemaining: updated.freeMonthsEarned - updated.freeMonthsUsed
        }
    });
});
