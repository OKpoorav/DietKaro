import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import { signClientToken, ClientAuthRequest } from '../middleware/clientAuth.middleware';
import logger from '../utils/logger';

// In-memory OTP store (use Redis in production)
const otpStore = new Map<string, { otp: string; expiresAt: Date }>();

const generateOTP = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const requestOTP = asyncHandler(async (req: Request, res: Response) => {
    const { phone } = req.body;

    if (!phone || phone.length < 10) {
        throw AppError.badRequest('Valid phone number required', 'INVALID_PHONE');
    }

    // Check if client exists
    const client = await prisma.client.findFirst({
        where: { phone, isActive: true },
    });

    if (!client) {
        throw AppError.notFound('No account found with this phone number', 'CLIENT_NOT_FOUND');
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP (in production, send via SMS)
    otpStore.set(phone, { otp, expiresAt });

    logger.info(`[Client OTP] Generated for ${phone}: ${otp}`); // Remove in production

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

    const stored = otpStore.get(phone);

    if (!stored) {
        throw AppError.badRequest('OTP expired or not found', 'OTP_EXPIRED');
    }

    if (stored.expiresAt < new Date()) {
        otpStore.delete(phone);
        throw AppError.badRequest('OTP expired', 'OTP_EXPIRED');
    }

    if (stored.otp !== otp) {
        throw AppError.badRequest('Invalid OTP', 'INVALID_OTP');
    }

    // OTP verified, delete from store
    otpStore.delete(phone);

    // Get client
    const client = await prisma.client.findFirst({
        where: { phone, isActive: true },
        include: {
            primaryDietitian: {
                select: { fullName: true, email: true },
            },
        },
    });

    if (!client) {
        throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');
    }

    // Generate JWT
    const token = signClientToken(client.id);

    logger.info(`[Client Auth] Login successful for ${phone}`);

    res.status(200).json({
        success: true,
        data: {
            token,
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
