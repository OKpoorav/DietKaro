import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.types';
import { AppError } from '../errors/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { notificationService } from '../services/notification.service';
import prisma from '../utils/prisma';

export const registerToken = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    const { token } = req.body;
    if (!token || typeof token !== 'string' || token.length < 10) {
        throw AppError.badRequest('Valid push token is required', 'TOKEN_REQUIRED');
    }

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

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const [notifications, total] = await prisma.$transaction([
        prisma.notification.findMany({
            where: { recipientId: req.user.id, orgId: req.user.organizationId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: pageSize,
        }),
        prisma.notification.count({ where: { recipientId: req.user.id, orgId: req.user.organizationId } })
    ]);

    res.status(200).json({
        success: true,
        data: notifications,
        meta: { page, pageSize, total }
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

export const markAllRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw AppError.unauthorized();

    await prisma.notification.updateMany({
        where: {
            recipientId: req.user.id,
            recipientType: 'user',
            isRead: false,
        },
        data: {
            isRead: true,
            readAt: new Date(),
        },
    });

    res.json({ success: true });
});
