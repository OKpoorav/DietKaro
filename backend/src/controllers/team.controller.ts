import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import { clerkClient, getAuth } from '@clerk/express';

export const listTeamMembers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const orgId = req.user.organizationId;

    const members = await prisma.user.findMany({
        where: { orgId, isActive: true },
        select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            role: true,
            specialization: true,
            profilePhotoUrl: true,
            createdAt: true,
        },
        orderBy: { fullName: 'asc' }
    });

    // Get client counts separately
    const clientCounts = await prisma.client.groupBy({
        by: ['primaryDietitianId'],
        where: { orgId, isActive: true },
        _count: true
    });

    const countMap = new Map(clientCounts.map(c => [c.primaryDietitianId, c._count]));

    res.status(200).json({
        success: true,
        data: members.map(m => ({
            id: m.id,
            name: m.fullName,
            email: m.email,
            phone: m.phone,
            role: m.role,
            specialization: m.specialization,
            profilePhotoUrl: m.profilePhotoUrl,
            clientCount: countMap.get(m.id) || 0,
            avatar: m.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        }))
    });
});

export const inviteMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { email, role } = req.body;

    if (!req.user) throw AppError.unauthorized();
    const orgId = req.user.organizationId;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({ where: { email } });
    if (existingUser) {
        throw AppError.conflict('User with this email already exists', 'USER_EXISTS');
    }

    // Generate token
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invitation = await prisma.invitation.create({
        data: {
            email,
            role,
            orgId,
            token,
            expiresAt,
            status: 'pending'
        }
    });

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/join?token=${token}`;

    console.log(`[Team] Invitation created for ${email}. Link: ${inviteLink}`);

    res.status(200).json({
        success: true,
        message: 'Invitation link generated',
        data: {
            inviteLink,
            invitation
        }
    });
});

export const validateInvite = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { token } = req.params;

    const invitation = await prisma.invitation.findUnique({
        where: { token },
        include: { organization: true }
    });

    if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
        throw AppError.badRequest('Invalid or expired invitation', 'INVALID_INVITE');
    }

    res.status(200).json({
        success: true,
        data: {
            email: invitation.email,
            orgName: invitation.organization.name,
            role: invitation.role
        }
    });
});

export const acceptInvite = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { token } = req.body;

    // Manual Auth Check since we removed requireAuth middleware
    // This allows us to handle users who exist in Clerk but not yet in our DB
    const auth = getAuth(req);
    if (!auth.userId) {
        throw AppError.unauthorized();
    }
    const clerkUserId = auth.userId;

    // 1. Validate Invitation
    const invitation = await prisma.invitation.findUnique({ where: { token } });

    if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
        throw AppError.badRequest('Invalid or expired invitation', 'INVALID_INVITE');
    }

    // 2. Check if DB User exists
    const dbUser = await prisma.user.findUnique({ where: { clerkUserId } });

    if (dbUser) {
        // User exists -> Update Org/Role
        // Optional: Check if email matches invitation.email
        await prisma.$transaction([
            prisma.user.update({
                where: { id: dbUser.id },
                data: {
                    orgId: invitation.orgId,
                    role: invitation.role,
                    isActive: true
                }
            }),
            prisma.invitation.update({
                where: { id: invitation.id },
                data: { status: 'accepted' }
            })
        ]);
    } else {
        // User DOES NOT exist -> Create new User
        // Fetch Clerk Name + Email 
        const clerkUser = await clerkClient.users.getUser(clerkUserId);
        const email = clerkUser.emailAddresses[0]?.emailAddress;

        if (!email) throw AppError.badRequest('Clerk user has no email', 'NO_EMAIL');
        // if (email !== invitation.email) throw AppError.forbidden('Invite email does not match logged in user');

        const fullName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Team Member';

        await prisma.$transaction([
            prisma.user.create({
                data: {
                    clerkUserId,
                    email,
                    fullName,
                    role: invitation.role,
                    orgId: invitation.orgId,
                    isActive: true
                }
            }),
            prisma.invitation.update({
                where: { id: invitation.id },
                data: { status: 'accepted' }
            })
        ]);
    }

    res.status(200).json({
        success: true,
        message: 'Joined organization successfully'
    });
});
