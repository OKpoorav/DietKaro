import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../utils/prisma';
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

// In-memory OTP store (use Redis in production)
const otpStore = new Map<string, { otp: string; expiresAt: Date }>();

const generateOTP = (): string => {
    return crypto.randomInt(100000, 1000000).toString();
};

export const requestOTP = asyncHandler(async (req: Request, res: Response) => {
    const { phone, orgSlug } = req.body;

    if (!phone || phone.length < 10) {
        throw AppError.badRequest('Valid phone number required', 'INVALID_PHONE');
    }

    if (!orgSlug) {
        throw AppError.badRequest('Organization identifier required', 'MISSING_ORG');
    }

    // Resolve org
    const org = await prisma.organization.findFirst({
        where: { slug: orgSlug, isActive: true },
    });
    if (!org) {
        throw AppError.notFound('Organization not found', 'ORG_NOT_FOUND');
    }

    // Check if client exists in this org
    const client = await prisma.client.findFirst({
        where: { phone, orgId: org.id, isActive: true },
    });

    if (!client) {
        throw AppError.notFound('No account found with this phone number', 'CLIENT_NOT_FOUND');
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP (in production, send via SMS)
    otpStore.set(phone, { otp, expiresAt });

    logger.info('Client OTP generated', { phone: phone.slice(-4).padStart(phone.length, '*') });

    res.status(200).json({
        success: true,
        message: 'OTP sent successfully',
        // DEV ONLY: Remove in production
        dev_otp: process.env.NODE_ENV === 'development' ? otp : undefined,
    });
});

export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
    const { phone, otp, orgSlug } = req.body;

    if (!phone || !otp) {
        throw AppError.badRequest('Phone and OTP required', 'MISSING_FIELDS');
    }

    if (!orgSlug) {
        throw AppError.badRequest('Organization identifier required', 'MISSING_ORG');
    }

    const stored = otpStore.get(phone);

    if (!stored) {
        throw AppError.badRequest('OTP expired or not found', 'OTP_EXPIRED');
    }

    if (stored.expiresAt < new Date()) {
        otpStore.delete(phone);
        throw AppError.badRequest('OTP expired', 'OTP_EXPIRED');
    }

    // Timing-safe comparison to prevent timing attacks
    const isValid = stored.otp.length === otp.length &&
        crypto.timingSafeEqual(Buffer.from(stored.otp), Buffer.from(otp));

    if (!isValid) {
        throw AppError.badRequest('Invalid OTP', 'INVALID_OTP');
    }

    // OTP verified, delete from store
    otpStore.delete(phone);

    // Resolve org
    const org = await prisma.organization.findFirst({
        where: { slug: orgSlug, isActive: true },
    });
    if (!org) {
        throw AppError.notFound('Organization not found', 'ORG_NOT_FOUND');
    }

    // Get client scoped to org
    const client = await prisma.client.findFirst({
        where: { phone, orgId: org.id, isActive: true },
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
