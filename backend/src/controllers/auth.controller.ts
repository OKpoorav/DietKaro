import { Request, Response } from 'express';
import { clerkClient, getAuth } from '@clerk/express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

export const register = asyncHandler(async (req: Request, res: Response) => {
    const auth = getAuth(req);
    const clerkUserId = req.body.clerkUserId || auth.userId;

    if (!clerkUserId) {
        throw AppError.badRequest('Clerk user ID is required', 'MISSING_CLERK_USER');
    }

    const { email, fullName, role, orgId, phone, licenseNumber, specialization } = req.body;

    if (!email || !fullName || !role || !orgId) {
        throw AppError.badRequest('email, fullName, role, and orgId are required', 'MISSING_FIELDS');
    }

    try {
        await clerkClient.users.getUser(clerkUserId);
    } catch {
        throw AppError.badRequest('Invalid Clerk user ID', 'INVALID_CLERK_USER');
    }

    const existingUser = await prisma.user.findUnique({ where: { clerkUserId } });
    if (existingUser) {
        throw AppError.conflict('User already registered', 'USER_EXISTS');
    }

    const organization = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!organization) {
        throw AppError.notFound('Organization not found', 'ORG_NOT_FOUND');
    }

    const user = await prisma.user.create({
        data: { clerkUserId, email, fullName, role, orgId, phone, licenseNumber, specialization, lastLoginAt: new Date() }
    });

    logger.info('User registered', { userId: user.id, clerkUserId, orgId });

    res.status(201).json({
        success: true,
        data: { id: user.id, organizationId: user.orgId, role: user.role, email: user.email, fullName: user.fullName, phone: user.phone, profilePhotoUrl: user.profilePhotoUrl, specialization: user.specialization }
    });
});

export const syncUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    await prisma.user.update({ where: { id: req.user.id }, data: { lastLoginAt: new Date() } });

    res.status(200).json({ success: true, data: { synced: true } });
});

export const getMe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || !req.dbUser) throw AppError.unauthorized();

    const user = req.dbUser;

    res.status(200).json({
        success: true,
        data: {
            id: user.id, organizationId: user.orgId, role: user.role, email: user.email,
            fullName: user.fullName, phone: user.phone, profilePhotoUrl: user.profilePhotoUrl,
            licenseNumber: user.licenseNumber, specialization: user.specialization, bio: user.bio,
            isActive: user.isActive, mfaEnabled: user.mfaEnabled, lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt, updatedAt: user.updatedAt
        }
    });
});

export const updateMe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { fullName, phone, specialization, bio } = req.body;

    const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: {
            ...(fullName && { fullName }),
            ...(phone && { phone }),
            ...(specialization && { specialization }),
            ...(bio && { bio })
        }
    });

    logger.info('User profile updated', { userId: updatedUser.id });

    res.status(200).json({
        success: true,
        data: { id: updatedUser.id, fullName: updatedUser.fullName, phone: updatedUser.phone, specialization: updatedUser.specialization, bio: updatedUser.bio, updatedAt: updatedUser.updatedAt }
    });
});
