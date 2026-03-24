import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { CreateOrganizationInput } from '../schemas/organization.schema';
import { getAuth } from '@clerk/express';
import { clerkClient } from '@clerk/express';

export const createOrganization = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data: CreateOrganizationInput = req.body;

    // Use Clerk auth directly — the user may not have a DB record yet
    const auth = getAuth(req);
    if (!auth.userId) throw AppError.unauthorized();

    const clerkUserId = auth.userId;

    // Check if this Clerk user already has a DB user
    const existingUser = await prisma.user.findUnique({ where: { clerkUserId } });
    if (existingUser) {
        throw AppError.conflict('You are already linked to an organization', 'USER_ALREADY_REGISTERED');
    }

    const existingOrg = await prisma.organization.findUnique({
        where: { name: data.name }
    });
    if (existingOrg) {
        throw AppError.conflict('Organization name already taken', 'ORG_EXISTS');
    }

    // Get Clerk user info
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) throw AppError.badRequest('Your account has no email address', 'NO_EMAIL');
    const fullName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Owner';

    // Create org + owner user atomically
    const result = await prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
            data: {
                name: data.name,
                description: data.description,
                email: data.email || email,
                phone: data.phone,
                address: data.address,
                city: data.city,
                country: data.country || 'IN',
                timezone: data.timezone || 'Asia/Kolkata',
            }
        });

        const user = await tx.user.create({
            data: {
                clerkUserId,
                email,
                fullName,
                role: 'owner',
                orgId: organization.id,
                isActive: true,
            }
        });

        return { organization, user };
    });

    logger.info('Organization created with owner', {
        orgId: result.organization.id,
        name: result.organization.name,
        ownerId: result.user.id,
    });

    res.status(201).json({
        success: true,
        data: result.organization
    });
});

export const getOrganization = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
        throw AppError.unauthorized();
    }

    const organization = await prisma.organization.findUnique({
        where: { id: req.user.organizationId },
        include: {
            _count: {
                select: { clients: true, users: true }
            }
        }
    });

    if (!organization) {
        throw AppError.notFound('Organization not found', 'ORG_NOT_FOUND');
    }

    res.status(200).json({
        success: true,
        data: {
            ...organization,
            currentClientCount: organization._count.clients,
            currentUserCount: organization._count.users
        }
    });
});
