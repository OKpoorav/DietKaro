import Redis from 'ioredis';
import logger from './logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        logger.warn('Redis reconnecting', { attempt: times, delay });
        return delay;
    },
    lazyConnect: true,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', { error: err.message }));
redis.on('close', () => logger.warn('Redis connection closed'));

// Connect eagerly so failures surface at startup
redis.connect().catch((err) => {
    logger.error('Redis initial connection failed', { error: err.message });
});

// Graceful shutdown is handled by server.ts — no duplicate handlers here

export default redis;
