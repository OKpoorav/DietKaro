import crypto from 'crypto';
import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types/auth.types';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../errors/AppError';
import { clerkClient, getAuth } from '@clerk/express';
import logger from '../utils/logger';
import { emailService } from '../services/email.service';

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

    // Validate invite role — prevent escalation
    const ALLOWED_INVITE_ROLES = ['dietitian', 'admin'];
    if (!role || !ALLOWED_INVITE_ROLES.includes(role)) {
        throw AppError.badRequest('Invalid role. Allowed: dietitian, admin', 'INVALID_ROLE');
    }
    // Only owners can invite admins
    if (role === 'admin' && req.user.role !== 'owner') {
        throw AppError.forbidden('Only owners can invite admin users');
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({ where: { email } });
    if (existingUser) {
        throw AppError.conflict('User with this email already exists', 'USER_EXISTS');
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('base64url');
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

    logger.info('Invitation created', { email, inviteLink });

    // Send invite email — fire and forget
    Promise.all([
        prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
        prisma.user.findUnique({ where: { id: req.user.id }, select: { fullName: true } }),
    ]).then(([org, inviter]) => {
        emailService.sendTeamInvite(email, inviteLink, role, org?.name || 'HealthPractix', inviter?.fullName || 'Your team');
    }).catch((err) => {
        logger.warn('Failed to send team invite email', { email, error: (err as Error).message });
    });

    res.status(200).json({
        success: true,
        message: 'Invitation link generated',
        data: {
            inviteLink,
            invitation: {
                id: invitation.id,
                email: invitation.email,
                status: invitation.status,
                token: invitation.token,
            }
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

    // 2. Verify the logged-in user's email matches the invitation
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const clerkEmail = clerkUser.emailAddresses[0]?.emailAddress;

    if (!clerkEmail) throw AppError.badRequest('Your account has no email address', 'NO_EMAIL');

    if (clerkEmail.toLowerCase() !== invitation.email.toLowerCase()) {
        throw AppError.forbidden(
            `This invitation was sent to ${invitation.email}. Please sign in with that email address to accept it.`,
            'EMAIL_MISMATCH'
        );
    }

    // 3. Check if DB User exists
    const dbUser = await prisma.user.findUnique({ where: { clerkUserId } });

    if (dbUser) {
        // User exists → update org/role
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
        // User does not exist → create new user
        const fullName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Team Member';

        await prisma.$transaction([
            prisma.user.create({
                data: {
                    clerkUserId,
                    email: clerkEmail,
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

export const removeMember = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const orgId = req.user.organizationId;
    const callerRole = req.user.role;
    const callerId = req.user.id;
    const { memberId } = req.params;

    // Find the target member
    const member = await prisma.user.findFirst({
        where: { id: memberId, orgId, isActive: true },
        select: { id: true, role: true, fullName: true },
    });

    if (!member) {
        throw AppError.notFound('Team member not found');
    }

    // Cannot remove yourself
    if (member.id === callerId) {
        throw AppError.forbidden('You cannot remove yourself');
    }

    // Admin can only remove dietitians — not other admins or the owner
    if (callerRole === 'admin' && member.role !== 'dietitian') {
        throw AppError.forbidden('Admins can only remove dietitians');
    }

    // Soft-delete the member and unassign their clients in one transaction
    await prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: memberId },
            data: { isActive: false },
        });
        await tx.$executeRaw`UPDATE "Client" SET "primaryDietitianId" = NULL WHERE "primaryDietitianId" = ${memberId} AND "orgId" = ${orgId}`;
    });

    logger.info('Team member removed', { memberId, removedBy: callerId, memberRole: member.role });

    res.status(200).json({
        success: true,
        message: `${member.fullName} has been removed from the team`,
    });
});
