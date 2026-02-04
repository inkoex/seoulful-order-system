type CacheEntry<T> = {
    value: T;
    expiresAt: number;
};

const cache = new Map<string, CacheEntry<any>>();

/**
 * Get or set a cache value with a TTL in milliseconds.
 */
export async function getOrSetCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number
): Promise<T> {
    const now = Date.now();
    const cached = cache.get(key);

    if (cached && cached.expiresAt > now) {
        return cached.value;
    }

    const value = await fetcher();
    cache.set(key, {
        value,
        expiresAt: now + ttlMs,
    });

    return value;
}

/**
 * Invalidate a specific cache key.
 */
export function invalidateCache(key: string) {
    cache.delete(key);
}

/**
 * Clear the entire cache.
 */
export function clearCache() {
    cache.clear();
}
