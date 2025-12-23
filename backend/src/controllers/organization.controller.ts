import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { CreateOrganizationInput } from '../schemas/organization.schema';

export const createOrganization = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data: CreateOrganizationInput = req.body;

    const existingOrg = await prisma.organization.findUnique({
        where: { name: data.name }
    });

    if (existingOrg) {
        throw AppError.conflict('Organization name already taken', 'ORG_EXISTS');
    }

    const organization = await prisma.organization.create({
        data: {
            name: data.name,
            description: data.description,
            email: data.email,
            phone: data.phone,
            address: data.address,
            city: data.city,
            country: data.country || 'IN',
            timezone: data.timezone || 'Asia/Kolkata'
        }
    });

    logger.info('Organization created', { orgId: organization.id, name: organization.name });

    res.status(201).json({
        success: true,
        data: organization
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
