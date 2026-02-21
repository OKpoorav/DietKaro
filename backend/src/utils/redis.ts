import Redis from 'ioredis';
import logger from './logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', { error: err.message }));

// Connect eagerly so failures surface at startup
redis.connect().catch((err) => {
    logger.error('Redis initial connection failed', { error: err.message });
});

// Graceful shutdown
const shutdown = () => { redis.disconnect(); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default redis;
