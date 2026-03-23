import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import logger from '../utils/logger';
import { socketAuthMiddleware } from './auth.middleware';
import { registerChatHandlers } from './chat.handlers';

let io: SocketServer;

export function initializeSocket(httpServer: HttpServer): SocketServer {
    const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

    // Socket.io adapter needs its own dedicated pub/sub connections
    const pubClient = new Redis(REDIS_URL);
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => logger.error('Socket.io Redis pub error', { error: err.message }));
    subClient.on('error', (err) => logger.error('Socket.io Redis sub error', { error: err.message }));

    // Validate pub/sub connections before proceeding
    Promise.all([pubClient.ping(), subClient.ping()]).catch((err) => {
        logger.error('Socket.io Redis adapter unavailable at startup', { error: (err as Error).message });
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
            origin: allowedOrigins,
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

        socket.on('disconnect', (reason) => {
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
