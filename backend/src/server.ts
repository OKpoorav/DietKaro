import 'dotenv/config'; // Prevents hoisting issues
import { env } from './config/env'; // Validates env vars — crashes early if invalid
import http from 'http';
import app from './app';
import { initializeSocket, getIO } from './socket';
import { startDocumentProcessorWorker, stopDocumentProcessorWorker } from './jobs/workers/document-processor.worker';
import logger from './utils/logger';
import prisma from './utils/prisma';
import redis from './utils/redis';

const server = http.createServer(app);
initializeSocket(server);

// Start BullMQ worker for background document processing
startDocumentProcessorWorker();

server.listen(env.PORT, () => {
    logger.info(`Server is running on port ${env.PORT}`);
});

// ── Graceful shutdown ────────────────────────────────────────────────
async function gracefulShutdown(signal: string) {
    logger.info(`Received ${signal}, starting graceful shutdown…`);

    // Hard timeout — force exit if cleanup hangs
    const forceTimer = setTimeout(() => {
        logger.error('Graceful shutdown timed out after 10s, forcing exit');
        process.exit(1);
    }, 10_000);
    forceTimer.unref();

    try {
        // 1. Stop accepting new HTTP connections
        logger.info('Closing HTTP server…');
        await new Promise<void>((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
        });

        // 2. Close Socket.io
        logger.info('Closing Socket.io…');
        try {
            const io = getIO();
            await io.close();
        } catch {
            // Socket.io may not have been initialized
        }

        // 3. Stop BullMQ worker
        logger.info('Stopping BullMQ worker…');
        await stopDocumentProcessorWorker();

        // 4. Disconnect Prisma
        logger.info('Disconnecting Prisma…');
        await prisma.$disconnect();

        // 5. Close Redis
        logger.info('Closing Redis connection…');
        await redis.quit();

        logger.info('Graceful shutdown complete');
        process.exit(0);
    } catch (err) {
        logger.error('Error during graceful shutdown', { error: err });
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

