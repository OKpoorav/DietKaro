import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { notificationService } from '../services/notification.service';
import prisma from '../utils/prisma';

export const registerToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Can be called by Client (via some auth?) or User
    // Assuming req.user is populated. If it's a client app, we might need client auth middleware
    // For now, assuming this is for Users (Dietitians). Clients need separate auth flow or use same middleware if unified.

    // Check if it's a client or user. The `AuthenticatedRequest` typically implies User/Dietitian.
    // If we have client auth, we need to handle that.

    if (!req.user) throw AppError.unauthorized();

    const { token } = req.body;
    if (!token) throw AppError.badRequest('Token required', 'TOKEN_REQUIRED');

    // For now, this endpoint assumes it's the logged-in User
    await notificationService.registerDeviceToken(req.user.id, 'user', token, req.user.organizationId);

    res.status(200).json({ success: true, message: 'Token registered' });
});

// Endpoint for Clients to register (if we expose it publicly or via client-auth)
export const registerClientToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Identify client from param or auth.
    // Ensure safety.
    const { clientId } = req.params;
    const { token } = req.body;

    // Check permissions (User allowed to update Client?)
    // Realistically, the CLIENT App calls this. But currently we use Clerk for Users.
    // If Client App uses Clerk, they have a User ID.
    // I'll skip this implementation detail and assume 'registerToken' is enough for now or I handle client mapping.

    res.status(501).json({ message: 'Not implemented for Clients yet' });
});


export const listNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { page = '1', pageSize = '20' } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);

    const [notifications, total] = await prisma.$transaction([
        prisma.notification.findMany({
            where: { recipientId: req.user.id, orgId: req.user.organizationId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: Number(pageSize)
        }),
        prisma.notification.count({ where: { recipientId: req.user.id, orgId: req.user.organizationId } })
    ]);

    res.status(200).json({
        success: true,
        data: notifications,
        meta: { page: Number(page), pageSize: Number(pageSize), total }
    });
});

export const markRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { id } = req.params;

    await prisma.notification.updateMany({
        where: { id, recipientId: req.user.id, orgId: req.user.organizationId },
        data: { isRead: true, readAt: new Date() }
    });

    res.status(200).json({ success: true });
});
