import { Socket } from 'socket.io';
import { verifyToken } from '@clerk/backend';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import logger from '../utils/logger';

const CLIENT_JWT_SECRET = process.env.CLIENT_JWT_SECRET!;

/**
 * Socket.io authentication middleware.
 *
 * Clients connect with:
 *   io(url, { auth: { type: 'user', token: '<clerk-jwt>' } })
 *   io(url, { auth: { type: 'client', token: '<client-jwt>' } })
 */
export async function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
    try {
        const { type, token } = socket.handshake.auth;

        if (!token || !type) {
            return next(new Error('Authentication required'));
        }

        if (type === 'client') {
            const decoded = jwt.verify(token, CLIENT_JWT_SECRET) as { clientId: string; type?: string };
            if (decoded.type && decoded.type !== 'access') {
                return next(new Error('Invalid token type'));
            }

            const client = await prisma.client.findUnique({
                where: { id: decoded.clientId },
                select: { id: true, orgId: true, fullName: true, isActive: true },
            });

            if (!client || !client.isActive) {
                return next(new Error('Invalid or inactive client'));
            }

            socket.data.userType = 'client';
            socket.data.userId = client.id;
            socket.data.orgId = client.orgId;
            socket.data.fullName = client.fullName;

        } else if (type === 'user') {
            const payload = await verifyToken(token, {
                secretKey: process.env.CLERK_SECRET_KEY!,
            });

            if (!payload.sub) {
                return next(new Error('Invalid Clerk token'));
            }

            const dbUser = await prisma.user.findUnique({
                where: { clerkUserId: payload.sub },
                select: { id: true, orgId: true, fullName: true, isActive: true, role: true },
            });

            if (!dbUser || !dbUser.isActive) {
                return next(new Error('User not found or inactive'));
            }

            socket.data.userType = 'user';
            socket.data.userId = dbUser.id;
            socket.data.orgId = dbUser.orgId;
            socket.data.fullName = dbUser.fullName;

        } else {
            return next(new Error('Invalid auth type'));
        }

        // Join personal room for direct targeting
        socket.join(`${socket.data.userType}:${socket.data.userId}`);

        next();
    } catch (error) {
        logger.error('Socket auth failed', { error: error instanceof Error ? error.message : error });
        next(new Error('Authentication failed'));
    }
}
