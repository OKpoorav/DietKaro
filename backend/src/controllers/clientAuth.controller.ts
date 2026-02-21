import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../utils/prisma';
import redis from '../utils/redis';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import {
    signClientAccessToken,
    createRefreshToken,
    rotateRefreshToken,
    revokeAllClientTokens,
    ClientAuthRequest,
} from '../middleware/clientAuth.middleware';
import logger from '../utils/logger';

const OTP_TTL_SECONDS = 300; // 5 minutes
const OTP_KEY_PREFIX = 'otp:';

const generateOTP = (): string => {
    return crypto.randomInt(100000, 1000000).toString();
};

export const requestOTP = asyncHandler(async (req: Request, res: Response) => {
    const { phone } = req.body;

    if (!phone || phone.length < 10) {
        throw AppError.badRequest('Valid phone number required', 'INVALID_PHONE');
    }

    // Auto-resolve org from phone — a client belongs to exactly one org
    const clients = await prisma.client.findMany({
        where: { phone, isActive: true },
        take: 2, // Only need to know if there's more than 1
    });

    if (clients.length > 1) {
        throw AppError.badRequest(
            'Multiple accounts found. Please contact your dietitian for assistance.',
            'AMBIGUOUS_ACCOUNT',
        );
    }

    const client = clients[0] || null;

    if (!client) {
        throw AppError.notFound('No account found with this phone number', 'CLIENT_NOT_FOUND');
    }

    // Generate OTP
    const otp = generateOTP();

    // Store OTP + resolved orgId in Redis so verifyOTP uses the same org
    await redis.set(
        `${OTP_KEY_PREFIX}${phone}`,
        JSON.stringify({ otp, orgId: client.orgId }),
        'EX',
        OTP_TTL_SECONDS,
    );

    logger.info('Client OTP generated', { phone: phone.slice(-4).padStart(phone.length, '*') });

    res.status(200).json({
        success: true,
        message: 'OTP sent successfully',
        // DEV ONLY: Remove in production
        dev_otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    });
});

export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
        throw AppError.badRequest('Phone and OTP required', 'MISSING_FIELDS');
    }

    const storedRaw = await redis.get(`${OTP_KEY_PREFIX}${phone}`);

    if (!storedRaw) {
        throw AppError.badRequest('OTP expired or not found', 'OTP_EXPIRED');
    }

    const stored = JSON.parse(storedRaw) as { otp: string; orgId: string };

    // Timing-safe comparison to prevent timing attacks
    const isValid = stored.otp.length === otp.length &&
        crypto.timingSafeEqual(Buffer.from(stored.otp), Buffer.from(otp));

    if (!isValid) {
        throw AppError.badRequest('Invalid OTP', 'INVALID_OTP');
    }

    // OTP verified, delete from Redis
    await redis.del(`${OTP_KEY_PREFIX}${phone}`);

    // Get client using the orgId that was resolved at OTP-request time
    const client = await prisma.client.findFirst({
        where: { phone, orgId: stored.orgId, isActive: true },
        include: {
            primaryDietitian: {
                select: { fullName: true, email: true },
            },
        },
    });

    if (!client) {
        throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');
    }

    // Generate token pair
    const accessToken = signClientAccessToken(client.id);
    const refreshToken = await createRefreshToken(client.id);

    logger.info('Client login successful', { phone: phone.slice(-4).padStart(phone.length, '*') });

    res.status(200).json({
        success: true,
        data: {
            token: accessToken,
            accessToken,
            refreshToken,
            expiresIn: 900,
            client: {
                id: client.id,
                fullName: client.fullName,
                email: client.email,
                phone: client.phone,
                profilePhotoUrl: client.profilePhotoUrl,
                heightCm: client.heightCm,
                currentWeightKg: client.currentWeightKg,
                targetWeightKg: client.targetWeightKg,
                dietaryPreferences: client.dietaryPreferences,
                allergies: client.allergies,
                onboardingCompleted: client.onboardingCompleted,
                dietitian: client.primaryDietitian,
            },
        },
    });
});

export const getClientProfile = asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const client = await prisma.client.findUnique({
        where: { id: req.client.id },
        include: {
            primaryDietitian: {
                select: { fullName: true, email: true, phone: true },
            },
        },
    });

    if (!client) {
        throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');
    }

    res.status(200).json({
        success: true,
        data: {
            id: client.id,
            fullName: client.fullName,
            email: client.email,
            phone: client.phone,
            profilePhotoUrl: client.profilePhotoUrl,
            heightCm: client.heightCm,
            currentWeightKg: client.currentWeightKg,
            targetWeightKg: client.targetWeightKg,
            dietaryPreferences: client.dietaryPreferences,
            allergies: client.allergies,
            onboardingCompleted: client.onboardingCompleted,
            dietitian: client.primaryDietitian,
        },
    });
});

export const updateClientProfile = asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    const { profilePhotoUrl } = req.body;

    const updated = await prisma.client.update({
        where: { id: req.client.id },
        data: {
            ...(profilePhotoUrl && { profilePhotoUrl }),
        },
    });

    res.status(200).json({
        success: true,
        data: {
            id: updated.id,
            profilePhotoUrl: updated.profilePhotoUrl,
        },
    });
});

export const refreshClientToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        throw AppError.badRequest('Refresh token required', 'MISSING_REFRESH_TOKEN');
    }

    const result = await rotateRefreshToken(refreshToken);
    if (!result) {
        throw AppError.unauthorized('Invalid or expired refresh token');
    }

    res.status(200).json({
        success: true,
        data: {
            token: result.accessToken,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresIn: 900,
        },
    });
});

export const logoutClient = asyncHandler(async (req: ClientAuthRequest, res: Response) => {
    if (!req.client) throw AppError.unauthorized();

    await revokeAllClientTokens(req.client.id);

    res.status(200).json({
        success: true,
        message: 'Logged out successfully',
    });
});
