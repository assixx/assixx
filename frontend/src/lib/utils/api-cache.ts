/**
 * API Cache - In-memory LRU cache with TTL
 *
 * Provides:
 * - Endpoint-specific TTL configuration
 * - LRU eviction when exceeding max size
 * - Request deduplication for concurrent GET requests
 * - Cache hit/miss metrics
 */

// =============================================================================
// CACHE CONFIGURATION - TTL in milliseconds
// =============================================================================

/** Default cache TTL: 30 seconds */
const DEFAULT_CACHE_TTL = 30_000;

/** Maximum number of cache entries (LRU eviction when exceeded) */
const MAX_CACHE_SIZE = 100;

/** Endpoint-specific cache TTL configuration */
const CACHE_TTL_CONFIG: Partial<Record<string, number>> = {
  // User data - cache for 2 minutes (rarely changes)
  '/users/me': 120_000,
  '/users': 60_000,

  // Organization data - cache for 5 minutes (rarely changes)
  '/departments': 300_000,
  '/teams': 300_000,
  '/areas': 300_000,

  // Documents - cache for 1 minute
  '/documents': 60_000,

  // Blackboard - cache for 30 seconds (might change more often)
  '/blackboard': 30_000,

  // Calendar - cache for 1 minute
  '/calendar': 60_000,

  // Assets - cache for 2 minutes
  '/assets': 120_000,

  // Surveys - cache for 1 minute
  '/surveys': 60_000,

  // KVP - cache for 1 minute
  '/kvp': 60_000,

  // Shifts - cache for 30 seconds (important for real-time)
  '/shifts': 30_000,
};

/** Endpoints that should NEVER be cached */
const NO_CACHE_ENDPOINTS = ['/auth/', '/chat/', '/notifications/', '/health'];

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

// =============================================================================
// API CACHE CLASS
// =============================================================================

/**
 * LRU cache with TTL for API responses.
 * Handles caching, invalidation, request deduplication, and metrics.
 */
export class ApiCache {
  private cache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, Promise<unknown>>();
  private cacheHits = 0;
  private cacheMisses = 0;

  /**
   * Get TTL for an endpoint (checks config, falls back to default)
   */
  getTtl(endpoint: string): number {
    const exactMatch = CACHE_TTL_CONFIG[endpoint];
    if (exactMatch !== undefined) {
      return exactMatch;
    }

    // Check prefix match (e.g., '/users' matches '/users?role=employee')
    for (const [pattern, ttl] of Object.entries(CACHE_TTL_CONFIG)) {
      if (ttl !== undefined && endpoint.startsWith(pattern)) {
        return ttl;
      }
    }

    return DEFAULT_CACHE_TTL;
  }

  /**
   * Check if endpoint should be cached
   */
  shouldCache(endpoint: string): boolean {
    return !NO_CACHE_ENDPOINTS.some((pattern) => endpoint.includes(pattern));
  }

  /**
   * Get cached data if valid (tracks hits/misses for metrics)
   */
  get(cacheKey: string): unknown {
    const entry = this.cache.get(cacheKey);
    if (entry === undefined) {
      this.cacheMisses++;
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Cache expired
      this.cache.delete(cacheKey);
      this.cacheMisses++;
      return null;
    }

    this.cacheHits++;

    // LRU: Move accessed entry to end (most recently used)
    // Map maintains insertion order, so delete + re-set moves to end
    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, entry);

    return entry.data;
  }

  /**
   * Store data in cache (with LRU eviction when exceeding MAX_CACHE_SIZE)
   */
  set(cacheKey: string, data: unknown, ttl: number): void {
    // LRU EVICTION: Remove oldest entry if at capacity
    // Map.keys().next() returns the oldest (first inserted) key
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Invalidate cache entries matching a pattern.
   * Called after POST/PUT/PATCH/DELETE to ensure fresh data.
   */
  invalidate(endpoint: string): void {
    // Extract the base path (e.g., '/users/123' -> '/users')
    const segments = endpoint.split('/').filter(Boolean);

    // Guard: empty or root endpoint has nothing to invalidate
    if (segments.length === 0) {
      return;
    }

    const basePath = '/' + segments[0];

    for (const key of this.cache.keys()) {
      if (key.startsWith(basePath)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached data (e.g., on logout)
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get pending request promise for deduplication
   */
  getPending(endpoint: string): Promise<unknown> | undefined {
    return this.pendingRequests.get(endpoint);
  }

  /**
   * Track a pending request for deduplication
   */
  setPending(endpoint: string, promise: Promise<unknown>): void {
    this.pendingRequests.set(endpoint, promise);
  }

  /**
   * Remove a pending request after completion
   */
  deletePending(endpoint: string): void {
    this.pendingRequests.delete(endpoint);
  }

  /**
   * Get cache stats for debugging and monitoring
   */
  getStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
    keys: string[];
  } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      size: this.cache.size,
      maxSize: MAX_CACHE_SIZE,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Reset cache metrics (useful for testing or monitoring periods)
   */
  resetMetrics(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}
