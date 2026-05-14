/**
 * Query Cache - In-memory cache for API responses with TTL
 *
 * Provides a simple caching layer for frequently accessed,
 * infrequently changing data like tags, artists, and playlists.
 */

const DEFAULT_TTL = 30_000 // 30 seconds default TTL

/**
 * Cache entry with timestamp-based expiration
 */
class CacheEntry {
  constructor(data, ttl) {
    this.data = data
    this.timestamp = Date.now()
    this.ttl = ttl || DEFAULT_TTL
  }

  get expired() {
    return Date.now() - this.timestamp > this.ttl
  }
}

/**
 * Query cache singleton
 */
class QueryCache {
  constructor() {
    this._cache = new Map()
  }

  /**
   * Get a cached value
   * @param {string} key - Cache key
   * @returns {*|null} Cached data or null if not found/expired
   */
  get(key) {
    const entry = this._cache.get(key)
    if (!entry) return null
    if (entry.expired) {
      this._cache.delete(key)
      return null
    }
    return entry.data
  }

  /**
   * Set a cached value
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   * @param {number} [ttl] - Time-to-live in milliseconds
   */
  set(key, data, ttl) {
    this._cache.set(key, new CacheEntry(data, ttl))
  }

  /**
   * Check if a key exists and is not expired
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    const entry = this._cache.get(key)
    if (!entry) return false
    if (entry.expired) {
      this._cache.delete(key)
      return false
    }
    return true
  }

  /**
   * Invalidate a specific cache key
   * @param {string} key
   */
  invalidate(key) {
    this._cache.delete(key)
  }

  /**
   * Invalidate all cache entries matching a prefix
   * @param {string} prefix - Key prefix to match
   */
  invalidateByPrefix(prefix) {
    for (const key of this._cache.keys()) {
      if (key.startsWith(prefix)) {
        this._cache.delete(key)
      }
    }
  }

  /**
   * Clear the entire cache
   */
  clear() {
    this._cache.clear()
  }

  /**
   * Get the number of cached entries
   * @returns {number}
   */
  get size() {
    return this._cache.size
  }

  /**
   * Remove all expired entries
   */
  prune() {
    const now = Date.now()
    for (const [key, entry] of this._cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this._cache.delete(key)
      }
    }
  }
}

// Singleton instance
const cache = new QueryCache()

// Prune expired entries every 60 seconds
setInterval(() => cache.prune(), 60_000)

/**
 * Cache TTL constants (in milliseconds)
 */
export const TTL = {
  SHORT: 5_000,      // 5 seconds
  MEDIUM: 30_000,    // 30 seconds
  LONG: 120_000,     // 2 minutes
  STALE: 300_000     // 5 minutes (data that rarely changes)
}

/**
 * Cached fetch wrapper: checks cache first, fetches only if needed
 * @param {string} key - Cache key
 * @param {Function} fetcher - Async function that fetches data
 * @param {number} [ttl] - TTL in milliseconds
 * @returns {Promise<*>} Cached or fresh data
 */
export async function withCache(key, fetcher, ttl) {
  const cached = cache.get(key)
  if (cached !== null) {
    return cached
  }

  const data = await fetcher()
  cache.set(key, data, ttl)
  return data
}

/**
 * Invalidate cache entries by key or prefix
 * @param {string} key - Exact key or prefix to invalidate
 */
export function invalidateCache(key) {
  // If this is a known prefix, invalidate all matching
  const prefixes = ['tags', 'artists', 'playlists', 'songs']
  if (prefixes.includes(key)) {
    cache.invalidateByPrefix(key)
  } else {
    cache.invalidate(key)
  }
}

/**
 * Clear entire cache
 */
export function clearCache() {
  cache.clear()
}

export { cache as queryCache }
export default cache
