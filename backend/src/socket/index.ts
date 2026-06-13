import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import logger from '../utils/logger';
import prisma from '../utils/prisma';
import { socketAuthMiddleware } from './auth.middleware';
import { registerChatHandlers } from './chat.handlers';

// Auth is verified only at handshake; long-lived sockets must be re-checked so
// a deactivated dietitian/client doesn't keep receiving real-time data.
const SOCKET_REVERIFY_INTERVAL_MS = 10 * 60 * 1000;

let io: SocketServer;

export function initializeSocket(httpServer: HttpServer): SocketServer {
    const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

    // Socket.io adapter needs its own dedicated pub/sub connections
    const pubClient = new Redis(REDIS_URL);
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => logger.error('Socket.io Redis pub error', { error: err.message }));
    subClient.on('error', (err) => logger.error('Socket.io Redis sub error', { error: err.message }));

    // Validate pub/sub connections before proceeding. In production a missing
    // adapter silently breaks cross-instance broadcasts (chat/notifications
    // only reach users on the same replica) — fail fast instead.
    Promise.all([pubClient.ping(), subClient.ping()]).catch((err) => {
        logger.error('Socket.io Redis adapter unavailable at startup', { error: (err as Error).message });
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    });

    const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);

    if (process.env.NODE_ENV !== 'production') {
        allowedOrigins.push('http://localhost:3000', 'http://localhost:3001', 'http://localhost:8081');
    }

    io = new SocketServer(httpServer, {
        cors: {
            // Use a function (not an array) so requests with no Origin header
            // (React Native / mobile apps) are allowed, matching app.ts CORS behavior.
            origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
                if (!origin) return callback(null, true); // mobile apps, curl
                if (allowedOrigins.includes(origin)) return callback(null, true);
                callback(null, false);
            },
            methods: ['GET', 'POST'],
            credentials: true,
        },
        adapter: createAdapter(pubClient, subClient),
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    io.use(socketAuthMiddleware);

    io.on('connection', (socket) => {
        const { userId, userType } = socket.data;
        logger.info('Socket connected', {
            socketId: socket.id,
            userType,
            userId,
        });

        // Join personal room for targeted notifications
        socket.join(`${userType}:${userId}`);

        registerChatHandlers(io, socket);

        const reverifyTimer = setInterval(async () => {
            try {
                const stillActive = userType === 'client'
                    ? await prisma.client.findFirst({ where: { id: userId, isActive: true, loginEnabled: true }, select: { id: true } })
                    : await prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } });
                if (!stillActive) {
                    logger.info('Disconnecting socket — principal no longer active', { socketId: socket.id, userId, userType });
                    socket.disconnect(true);
                }
            } catch (err) {
                // Transient DB error — keep the socket, retry next interval
                logger.warn('Socket re-verification check failed', { socketId: socket.id, error: (err as Error).message });
            }
        }, SOCKET_REVERIFY_INTERVAL_MS);

        socket.on('disconnect', (reason) => {
            clearInterval(reverifyTimer);
            logger.info('Socket disconnected', { socketId: socket.id, reason, userId, userType });
            // Socket.io auto-cleans room memberships on disconnect
            // Personal room and conversation rooms are handled automatically
        });
    });

    logger.info('Socket.io initialized with Redis adapter');
    return io;
}

export function getIO(): SocketServer {
    if (!io) throw new Error('Socket.io not initialized');
    return io;
}
