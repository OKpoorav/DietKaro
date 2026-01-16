import { Response } from 'express';
import prisma from '../utils/prisma';
import { ClientAuthRequest } from '../middleware/clientAuth.middleware';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import crypto from 'crypto';

/**
 * Generate a unique referral code for the client
 * Format: 6 alphanumeric characters, uppercase
 */
function generateReferralCode(): string {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}

/**
 * Get or generate referral code for the authenticated client
 */
export const getReferralCode = asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    let client = await prisma.client.findUnique({
        where: { id: req.client.id },
        select: { id: true, referralCode: true, fullName: true }
    });

    if (!client) throw AppError.notFound('Client not found');

    // Generate referral code if not exists
    if (!client.referralCode) {
        let code = generateReferralCode();
        let attempts = 0;

        // Ensure uniqueness
        while (attempts < 10) {
            const existing = await prisma.client.findUnique({
                where: { referralCode: code }
            });
            if (!existing) break;
            code = generateReferralCode();
            attempts++;
        }

        client = await prisma.client.update({
            where: { id: req.client.id },
            data: { referralCode: code },
            select: { id: true, referralCode: true, fullName: true }
        });

        logger.info('Referral code generated', { clientId: req.client.id, code });
    }

    // Generate share message
    const shareMessage = `Hey! I'm using DietKaro for my nutrition journey and it's been amazing! 🥗\n\nUse my referral code: ${client.referralCode}\n\nDownload the app and start your health journey today!`;

    res.status(200).json({
        success: true,
        data: {
            referralCode: client.referralCode,
            shareMessage,
            whatsappLink: `https://wa.me/?text=${encodeURIComponent(shareMessage)}`
        }
    });
});

/**
 * Get referral statistics and benefits for the authenticated client
 */
export const getReferralStats = asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    // Get count of clients referred by this client
    const referredClientsCount = await prisma.client.count({
        where: { referredByClientId: req.client.id, isActive: true }
    });

    // Get or create referral benefit record
    let benefit = await prisma.referralBenefit.findUnique({
        where: { clientId: req.client.id }
    });

    if (!benefit) {
        benefit = await prisma.referralBenefit.create({
            data: {
                clientId: req.client.id,
                referralCount: referredClientsCount,
                freeMonthsEarned: Math.floor(referredClientsCount / 3), // 3 referrals = 1 free month
                freeMonthsUsed: 0
            }
        });
    } else if (benefit.referralCount !== referredClientsCount) {
        // Update if count changed
        benefit = await prisma.referralBenefit.update({
            where: { clientId: req.client.id },
            data: {
                referralCount: referredClientsCount,
                freeMonthsEarned: Math.floor(referredClientsCount / 3)
            }
        });
    }

    // Get list of referred clients (limited info)
    const referredClients = await prisma.client.findMany({
        where: { referredByClientId: req.client.id, isActive: true },
        select: {
            id: true,
            fullName: true,
            createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    res.status(200).json({
        success: true,
        data: {
            referralCount: referredClientsCount,
            freeMonthsEarned: benefit.freeMonthsEarned,
            freeMonthsUsed: benefit.freeMonthsUsed,
            freeMonthsRemaining: benefit.freeMonthsEarned - benefit.freeMonthsUsed,
            referralsUntilNextReward: 3 - (referredClientsCount % 3),
            referredClients: referredClients.map(c => ({
                name: c.fullName,
                joinedAt: c.createdAt
            }))
        }
    });
});

/**
 * Validate a referral code (for client onboarding)
 */
export const validateReferralCode = asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    const { code } = req.params;

    if (!code || code.length !== 6) {
        throw AppError.badRequest('Invalid referral code format');
    }

    const referrer = await prisma.client.findUnique({
        where: { referralCode: code.toUpperCase() },
        select: { id: true, fullName: true }
    });

    if (!referrer) {
        res.status(200).json({
            success: true,
            data: { valid: false }
        });
        return;
    }

    res.status(200).json({
        success: true,
        data: {
            valid: true,
            referrerName: referrer.fullName
        }
    });
});
