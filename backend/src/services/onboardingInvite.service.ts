import crypto from 'crypto';
import prisma from '../utils/prisma';
import { AppError } from '../errors/AppError';

const INVITE_EXPIRY_DAYS = 3;

export async function generateInvite(clientId: string, orgId: string): Promise<string> {
    // Verify client belongs to this org
    const client = await prisma.client.findFirst({
        where: { id: clientId, orgId, isActive: true },
        select: { id: true },
    });
    if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

    // Invalidate any existing unused invites for this client
    await prisma.onboardingInvite.updateMany({
        where: { clientId, usedAt: null },
        data: { expiresAt: new Date() }, // expire immediately
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    await prisma.onboardingInvite.create({
        data: { clientId, orgId, token, expiresAt },
    });

    return token;
}

export async function getInviteStatus(clientId: string, orgId: string) {
    const client = await prisma.client.findFirst({
        where: { id: clientId, orgId, isActive: true },
        select: { id: true },
    });
    if (!client) throw AppError.notFound('Client not found', 'CLIENT_NOT_FOUND');

    const invite = await prisma.onboardingInvite.findFirst({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
        select: { token: true, expiresAt: true, usedAt: true, createdAt: true },
    });

    if (!invite) return { hasActive: false, invite: null };

    const now = new Date();
    const isExpired = invite.expiresAt < now;
    const isUsed = !!invite.usedAt;
    const hasActive = !isExpired && !isUsed;

    return { hasActive, invite: { ...invite, isExpired, isUsed } };
}

export async function validateToken(token: string) {
    const invite = await prisma.onboardingInvite.findUnique({
        where: { token },
        include: {
            client: {
                select: {
                    id: true, fullName: true, email: true, phone: true,
                    dateOfBirth: true, gender: true, heightCm: true,
                    currentWeightKg: true, targetWeightKg: true, activityLevel: true,
                    dietPattern: true, eggAllowed: true, allergies: true,
                    intolerances: true, dislikes: true, likedFoods: true,
                    preferredCuisines: true, onboardingCompleted: true,
                    goal: true, goalDeadline: true,
                },
            },
        },
    });

    if (!invite) throw AppError.notFound('Invalid or expired invite link', 'INVITE_NOT_FOUND');
    if (invite.usedAt) throw AppError.badRequest('This onboarding link has already been used', 'INVITE_USED');
    if (invite.expiresAt < new Date()) throw AppError.badRequest('This onboarding link has expired. Please ask your dietitian to resend it.', 'INVITE_EXPIRED');

    return invite;
}

export async function submitInvite(
    token: string,
    data: {
        heightCm?: number;
        currentWeightKg?: number;
        targetWeightKg?: number;
        dateOfBirth?: string;
        gender?: string;
        activityLevel?: string;
        dietPattern?: string;
        eggAllowed?: boolean;
        allergies?: string[];
        intolerances?: string[];
        dislikes?: string[];
        likedFoods?: string[];
        preferredCuisines?: string[];
        goal?: string;
        goalDeadline?: string;
        beforePhotoFrontUrl?: string;
        beforePhotoSideUrl?: string;
        beforePhotoBackUrl?: string;
    },
) {
    const invite = await validateToken(token);
    const clientId = invite.clientId;

    await prisma.$transaction(async (tx) => {
        // Consume the token FIRST, atomically — two concurrent submits both pass
        // validateToken (read usedAt=null), so the conditional write is the arbiter.
        const consumed = await tx.onboardingInvite.updateMany({
            where: { token, usedAt: null },
            data: { usedAt: new Date() },
        });
        if (consumed.count === 0) {
            throw AppError.badRequest('This onboarding link has already been used', 'INVITE_USED');
        }

        await tx.client.update({
            where: { id: clientId },
            data: {
                ...(data.heightCm !== undefined && { heightCm: data.heightCm }),
                ...(data.currentWeightKg !== undefined && { currentWeightKg: data.currentWeightKg }),
                ...(data.targetWeightKg !== undefined && { targetWeightKg: data.targetWeightKg }),
                ...(data.dateOfBirth !== undefined && { dateOfBirth: new Date(data.dateOfBirth) }),
                ...(data.gender !== undefined && { gender: data.gender as any }),
                ...(data.activityLevel !== undefined && { activityLevel: data.activityLevel as any }),
                ...(data.dietPattern !== undefined && { dietPattern: data.dietPattern }),
                ...(data.eggAllowed !== undefined && { eggAllowed: data.eggAllowed }),
                ...(data.allergies !== undefined && { allergies: data.allergies }),
                ...(data.intolerances !== undefined && { intolerances: data.intolerances }),
                ...(data.dislikes !== undefined && { dislikes: data.dislikes }),
                ...(data.likedFoods !== undefined && { likedFoods: data.likedFoods }),
                ...(data.preferredCuisines !== undefined && { preferredCuisines: data.preferredCuisines }),
                ...(data.goal !== undefined && { goal: data.goal }),
                ...(data.goalDeadline !== undefined && { goalDeadline: new Date(data.goalDeadline) }),
                ...(data.beforePhotoFrontUrl !== undefined && { beforePhotoFrontUrl: data.beforePhotoFrontUrl }),
                ...(data.beforePhotoSideUrl !== undefined && { beforePhotoSideUrl: data.beforePhotoSideUrl }),
                ...(data.beforePhotoBackUrl !== undefined && { beforePhotoBackUrl: data.beforePhotoBackUrl }),
                onboardingCompleted: true,
            },
        });
    });

    return { success: true };
}
