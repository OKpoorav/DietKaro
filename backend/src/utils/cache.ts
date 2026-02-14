import NodeCache from 'node-cache';

// Default TTL: 5 minutes, check for expired keys every 60 seconds
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Build a cache key scoped to a client.
 */
export function clientCacheKey(clientId: string, endpoint: string): string {
    return `client:${clientId}:${endpoint}`;
}

/**
 * Invalidate all cached entries for a given client.
 */
export function invalidateClientCache(clientId: string): void {
    const prefix = `client:${clientId}:`;
    const keys = cache.keys().filter(k => k.startsWith(prefix));
    if (keys.length > 0) cache.del(keys);
}

export default cache;
