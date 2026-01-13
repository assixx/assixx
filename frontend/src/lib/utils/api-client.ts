/* eslint-disable max-lines */
/**
 * API Client for SvelteKit
 * 1:1 Copy from frontend/src/utils/api-client.ts + SSR adaptations
 *
 * Provides centralized API communication with:
 * - Automatic token refresh
 * - Error handling
 * - Rate limit protection
 * - Type-safe responses
 * - PERFORMANCE: In-memory cache with TTL for GET requests
 */

import { browser } from '$app/environment';

import { createLogger } from './logger';
import { getTokenManager, registerCacheClearCallback } from './token-manager';

import type { LogoutReason } from './auth-types';

const log = createLogger('ApiClient');

// =============================================================================
// AUTH TOKEN PROVIDER INTERFACE
// =============================================================================

/**
 * AuthTokenProvider - Abstraction layer for token management.
 *
 * PURPOSE: Decouples ApiClient from concrete TokenManager implementation.
 *
 * BENEFITS:
 * 1. TESTABILITY: Mock the provider in unit tests
 * 2. FLEXIBILITY: Swap token storage (localStorage → sessionStorage → cookie)
 * 3. SSR-SAFETY: Provider handles browser checks
 * 4. DECOUPLING: No direct dependency on TokenManager internals
 *
 * USAGE:
 * ```typescript
 * // In app initialization (e.g., +layout.svelte)
 * import { getApiClient } from '$lib/utils/api-client';
 * import { getTokenManager } from '$lib/utils/token-manager';
 *
 * getApiClient().setAuthProvider({
 *   getAccessToken: () => getTokenManager().getAccessToken(),
 *   getRefreshToken: () => getTokenManager().getRefreshToken(),
 *   refreshIfNeeded: () => getTokenManager().refreshIfNeeded(),
 *   clearTokens: (reason) => getTokenManager().clearTokens(reason),
 * });
 * ```
 *
 * TESTING:
 * ```typescript
 * const mockProvider: AuthTokenProvider = {
 *   getAccessToken: () => 'mock-token',
 *   getRefreshToken: () => 'mock-refresh',
 *   refreshIfNeeded: async () => true,
 *   clearTokens: vi.fn(),
 * };
 * apiClient.setAuthProvider(mockProvider);
 * ```
 */
export interface AuthTokenProvider {
  /** Get current access token for Authorization header */
  getAccessToken(): string | null;

  /** Get refresh token (used to check if refresh is possible) */
  getRefreshToken(): string | null;

  /** Refresh tokens if needed. Returns true if refresh succeeded or wasn't needed */
  refreshIfNeeded(): Promise<boolean>;

  /** Clear all tokens and redirect to login (reason determines redirect params) */
  clearTokens(reason: LogoutReason): void;
}

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

  // Machines - cache for 2 minutes
  '/machines': 120_000,

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

/** Default request timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 30_000;

interface ApiConfig {
  version?: 'v2' | undefined; // Always v2
  useAuth?: boolean | undefined;
  contentType?: string | null | undefined;
  /** Skip cache for this request */
  skipCache?: boolean | undefined;
  /** Custom TTL for this request (ms) */
  cacheTtl?: number | undefined;
  /** AbortSignal for request cancellation (e.g., on component unmount) */
  signal?: AbortSignal | undefined;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number | undefined;
}

interface ApiResponseWrapper<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * API Client Singleton
 */
export class ApiClient {
  private static instance: ApiClient | undefined;
  private baseUrl = '';
  private isRedirectingToRateLimit = false;

  // PERFORMANCE: In-memory cache for GET requests
  private cache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, Promise<unknown>>();

  // CACHE METRICS: Track cache effectiveness
  private cacheHits = 0;
  private cacheMisses = 0;

  // AUTH PROVIDER: Decoupled token management
  private authProvider: AuthTokenProvider | null = null;

  private constructor() {
    if (browser) {
      this.baseUrl = window.location.origin;

      // Register cache clear callback with TokenManager
      // This allows TokenManager to clear API cache without importing api-client (avoiding cycle)
      registerCacheClearCallback(() => {
        this.clearCache();
      });
    }
  }

  // =============================================================================
  // AUTH PROVIDER METHODS
  // =============================================================================

  /**
   * Set the authentication provider for token management.
   *
   * WHEN TO CALL: Early in app lifecycle (e.g., +layout.svelte onMount)
   * WHY: Decouples ApiClient from TokenManager for testability and flexibility.
   *
   * If not set, falls back to direct TokenManager usage (backward compatible).
   */
  setAuthProvider(provider: AuthTokenProvider): void {
    this.authProvider = provider;
  }

  /**
   * Get the auth provider, with fallback to direct TokenManager.
   *
   * FALLBACK STRATEGY:
   * - If authProvider is set → use it (testable, decoupled)
   * - If not set → create wrapper around TokenManager (backward compatible)
   *
   * This ensures existing code works without changes while enabling
   * proper dependency injection for new code and tests.
   */
  private getAuthProvider(): AuthTokenProvider {
    if (this.authProvider !== null) {
      return this.authProvider;
    }

    // Fallback: Create wrapper around TokenManager for backward compatibility
    // NOTE: This keeps the direct dependency but allows gradual migration
    const tokenManager = getTokenManager();
    return {
      getAccessToken: () => tokenManager.getAccessToken(),
      getRefreshToken: () => tokenManager.getRefreshToken(),
      refreshIfNeeded: () => tokenManager.refreshIfNeeded(),
      clearTokens: (reason) => {
        tokenManager.clearTokens(reason);
      },
    };
  }

  // =============================================================================
  // CACHE METHODS
  // =============================================================================

  /**
   * Get TTL for an endpoint (checks config, falls back to default)
   */
  private getCacheTtl(endpoint: string): number {
    // Check exact match first
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
  private shouldCache(endpoint: string): boolean {
    return !NO_CACHE_ENDPOINTS.some((pattern) => endpoint.includes(pattern));
  }

  /**
   * Get cached data if valid (tracks hits/misses for metrics)
   */
  private getCached(cacheKey: string): unknown {
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
  private setCache(cacheKey: string, data: unknown, ttl: number): void {
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
   * Invalidate cache entries matching a pattern
   * Called after POST/PUT/PATCH/DELETE to ensure fresh data
   */
  private invalidateCache(endpoint: string): void {
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
   * Clear all cache (e.g., on logout)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats for debugging and monitoring
   */
  getCacheStats(): {
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
  resetCacheMetrics(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  // =============================================================================
  // ABORT CONTROLLER METHODS
  // =============================================================================

  /**
   * Combine multiple AbortSignals into one.
   * The combined signal aborts when ANY of the input signals abort.
   */
  private combineSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
    const controller = new AbortController();
    const validSignals = signals.filter((s): s is AbortSignal => s !== undefined);

    for (const signal of validSignals) {
      // If already aborted, abort immediately
      if (signal.aborted) {
        // AbortSignal.reason is typed as 'any' in DOM lib - explicitly type it
        const abortReason: unknown = signal.reason;
        controller.abort(abortReason);
        return controller.signal;
      }

      // Listen for abort on each signal
      signal.addEventListener(
        'abort',
        () => {
          // AbortSignal.reason is typed as 'any' in DOM lib - explicitly type it
          const abortReason: unknown = signal.reason;
          controller.abort(abortReason);
        },
        { once: true },
      );
    }

    return controller.signal;
  }

  /**
   * Create a timeout signal that aborts after the specified duration.
   * Returns both the signal and a cleanup function to clear the timeout.
   */
  private createTimeoutSignal(timeoutMs: number): {
    signal: AbortSignal;
    cleanup: () => void;
  } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new DOMException('Request timeout', 'TimeoutError'));
    }, timeoutMs);

    return {
      signal: controller.signal,
      cleanup: () => {
        clearTimeout(timeoutId);
      },
    };
  }

  static getInstance(): ApiClient {
    ApiClient.instance ??= new ApiClient();
    return ApiClient.instance;
  }

  /**
   * Set tokens (delegates to TokenManager)
   * @deprecated Use getTokenManager().setTokens() directly
   */
  setTokens(accessToken: string, refreshToken: string): void {
    if (!browser) return;
    getTokenManager().setTokens(accessToken, refreshToken);
  }

  /**
   * Determine the Content-Type header value for a request
   */
  private getContentType(options: RequestInit, config: ApiConfig): string | null {
    const hasBody = options.body !== undefined && options.body !== null;
    if (!hasBody) {
      return null;
    }

    // Explicit content type from config
    if (config.contentType !== undefined && config.contentType !== null) {
      return config.contentType;
    }

    // FormData: let browser set Content-Type with boundary
    if (options.body instanceof FormData) {
      return null;
    }

    return 'application/json';
  }

  /**
   * Get Authorization header value if applicable
   */
  private getAuthHeader(config: ApiConfig): string | null {
    if (!browser || config.useAuth === false) {
      return null;
    }

    const token = this.getAuthProvider().getAccessToken();
    if (token === null) {
      return null;
    }

    return `Bearer ${token}`;
  }

  private buildHeaders(options: RequestInit, config: ApiConfig): Record<string, string> {
    const headers: Record<string, string> = {};

    // Copy existing headers
    if (options.headers !== undefined) {
      const h = options.headers as Record<string, string>;
      for (const [key, value] of Object.entries(h)) {
        headers[key] = value;
      }
    }

    // Set Content-Type
    const contentType = this.getContentType(options, config);
    if (contentType !== null) {
      headers['Content-Type'] = contentType;
    }

    // Set Authorization
    const authHeader = this.getAuthHeader(config);
    if (authHeader !== null) {
      headers.Authorization = authHeader;
    }

    return headers;
  }

  private async handleTokenExpiredRetry<T>(
    url: string,
    options: RequestInit,
    headers: Record<string, string>,
    config: ApiConfig,
    signal: AbortSignal,
  ): Promise<T | null> {
    if (!browser) return null;

    const authProvider = this.getAuthProvider();
    const refreshToken = authProvider.getRefreshToken();

    if (config.useAuth === false || refreshToken === null) {
      return null;
    }

    const refreshed = await authProvider.refreshIfNeeded();

    if (!refreshed) {
      return null;
    }

    // Retry with new token
    const newToken = authProvider.getAccessToken();
    if (newToken !== null) {
      headers.Authorization = `Bearer ${newToken}`;
    } else {
      // Don't send invalid "Bearer " header - remove it entirely
      delete headers.Authorization;
    }

    const retryResponse = await fetch(url, {
      ...options,
      headers,
      credentials: 'omit',
      signal, // Use same signal for retry
    });

    return await this.handleResponse<T>(retryResponse);
  }

  /**
   * Proactively refresh token if needed (uses auth provider for decoupling)
   */
  private async proactivelyRefreshTokenIfNeeded(
    endpoint: string,
    headers: Record<string, string>,
  ): Promise<void> {
    if (!browser) return;

    // Skip for auth endpoints and background polling
    const skipRefreshEndpoints = [
      '/auth/refresh',
      '/auth/login',
      '/auth/logout',
      '/chat/unread-count',
      '/notifications/stream',
    ];

    if (skipRefreshEndpoints.some((skip) => endpoint.includes(skip))) {
      return;
    }

    const authProvider = this.getAuthProvider();
    const refreshed = await authProvider.refreshIfNeeded();

    if (refreshed) {
      const token = authProvider.getAccessToken();
      if (token !== null) {
        headers.Authorization = `Bearer ${token}`;
      }
    }
  }

  /**
   * Determine credentials mode for a request.
   *
   * Auth endpoints need 'include' to send HttpOnly refresh token cookie.
   * Other endpoints use 'omit' to avoid unnecessary cookie transmission.
   */
  private getCredentialsMode(endpoint: string): RequestCredentials {
    // Auth endpoints need cookies for HttpOnly refresh token
    const authEndpoints = ['/auth/login', '/auth/logout', '/auth/refresh'];
    const isAuthEndpoint = authEndpoints.some((auth) => endpoint.startsWith(auth));
    return isAuthEndpoint ? 'include' : 'omit';
  }

  /**
   * Main request method with AbortController and timeout support
   *
   * @param endpoint - API endpoint (e.g., '/users')
   * @param options - Standard fetch RequestInit options
   * @param config - ApiConfig with signal, timeout, auth options
   */
  async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    config: ApiConfig = {},
  ): Promise<T> {
    const baseApiPath = '/api/v2';
    const url = `${this.baseUrl}${baseApiPath}${endpoint}`;
    const headers = this.buildHeaders(options, config);

    // Create timeout signal (default 30s, configurable via config.timeout)
    const timeoutMs = config.timeout ?? DEFAULT_TIMEOUT_MS;
    const { signal: timeoutSignal, cleanup: cleanupTimeout } = this.createTimeoutSignal(timeoutMs);

    // Combine user signal (if provided) with timeout signal
    const combinedSignal = this.combineSignals(config.signal, timeoutSignal);

    // Proactive token refresh
    await this.proactivelyRefreshTokenIfNeeded(endpoint, headers);

    // Auth endpoints need credentials: 'include' for HttpOnly cookie
    const credentialsMode = this.getCredentialsMode(endpoint);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: credentialsMode,
        signal: combinedSignal,
      });

      // Handle 401 with token refresh
      if (response.status === 401) {
        const retryResult = await this.handleTokenExpiredRetry<T>(
          url,
          options,
          headers,
          config,
          combinedSignal,
        );
        if (retryResult !== null) {
          return retryResult;
        }
      }

      return await this.handleResponse<T>(response);
    } catch (error) {
      this.handleRequestError(error, timeoutMs);
    } finally {
      // Always clean up timeout to prevent memory leaks
      cleanupTimeout();
    }
  }

  /**
   * Check if error is a timeout error
   */
  private isTimeoutError(error: Error): boolean {
    if (error.name === 'TimeoutError') {
      return true;
    }
    return error instanceof DOMException && error.message === 'Request timeout';
  }

  /**
   * Check if error is an abort error (expected during navigation)
   */
  private isAbortError(error: Error): boolean {
    if (error.name === 'AbortError') {
      return true;
    }
    return error.message.includes('NetworkError') || error.message.includes('aborted');
  }

  /**
   * Handle errors from fetch requests
   */
  private handleRequestError(error: unknown, timeoutMs: number): never {
    if (error instanceof Error) {
      if (this.isTimeoutError(error)) {
        throw new ApiError(`Request timeout after ${timeoutMs}ms`, 'TIMEOUT', 0);
      }

      // Don't log abort errors (expected during navigation)
      if (!this.isAbortError(error)) {
        log.error({ err: error }, 'Request failed');
      }
    }

    throw this.handleError(error);
  }

  private handleRateLimit(): never {
    log.error('Rate limit exceeded');

    // NOTE: Do NOT clear tokens here!
    // 429 = "slow down", NOT "session invalid"
    // User session is still valid, just temporarily rate limited
    if (browser && !this.isRedirectingToRateLimit) {
      this.isRedirectingToRateLimit = true;
      window.location.href = '/rate-limit';
    }

    throw new ApiError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429);
  }

  private async handleNonJsonResponse(response: Response): Promise<unknown> {
    if (response.status === 429) {
      this.handleRateLimit();
    }

    if (!response.ok) {
      throw new ApiError(
        `Request failed with status ${response.status}`,
        'NON_JSON_ERROR',
        response.status,
      );
    }

    // 204 No Content - return null
    if (response.status === 204) {
      return null;
    }

    // For other successful non-JSON responses, return text content
    // This is more useful than returning the raw Response object
    return await response.text();
  }

  private extractErrorMessage(data: Record<string, unknown>): { message: string; details: string } {
    const error = data.error as { message?: string; details?: string } | undefined;

    const message =
      typeof error?.message === 'string'
        ? error.message
        : typeof data.error === 'string'
          ? data.error
          : typeof data.message === 'string'
            ? data.message
            : '';

    const details =
      typeof data.details === 'string'
        ? data.details
        : typeof error?.details === 'string'
          ? error.details
          : '';

    return { message, details };
  }

  private handleAuthenticationError(data: Record<string, unknown>): void {
    const { message, details } = this.extractErrorMessage(data);

    if (
      message.toLowerCase().includes('expired') ||
      message.toLowerCase().includes('invalid token') ||
      (details !== '' && details.toLowerCase().includes('expired'))
    ) {
      if (browser) {
        this.getAuthProvider().clearTokens('token_expired');
      }
      throw new ApiError('Session expired', 'SESSION_EXPIRED', 401);
    }
  }

  private createApiError(response: Response, data: Record<string, unknown>): ApiError {
    const error = data.error as { message?: string; code?: string; details?: unknown } | undefined;

    const message =
      typeof error?.message === 'string'
        ? error.message
        : typeof data.message === 'string'
          ? data.message
          : `Request failed with status ${response.status}`;

    const code = typeof error?.code === 'string' ? error.code : 'API_ERROR';

    return new ApiError(message, code, response.status, error?.details);
  }

  private handleV2Response(response: Response, data: Record<string, unknown>): unknown {
    if ('success' in data && typeof data.success === 'boolean') {
      const apiResponse = data as unknown as ApiResponseWrapper;

      if (!apiResponse.success) {
        throw new ApiError(
          apiResponse.error?.message ?? 'Unknown error',
          apiResponse.error?.code ?? 'UNKNOWN_ERROR',
          response.status,
          apiResponse.error?.details,
        );
      }

      return apiResponse.data;
    }

    if (!response.ok) {
      throw this.createApiError(response, data);
    }

    return data;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json') !== true) {
      return (await this.handleNonJsonResponse(response)) as T;
    }

    const data = (await response.json()) as Record<string, unknown>;

    if (response.status === 429) {
      this.handleRateLimit();
    }

    if (response.status === 401 || response.status === 403) {
      this.handleAuthenticationError(data);
    }

    return this.handleV2Response(response, data) as T;
  }

  /**
   * Clear tokens AND cache
   * @deprecated Use getTokenManager().clearTokens() directly
   */
  clearTokens(): void {
    if (browser) {
      this.clearCache(); // Clear API cache on logout
      this.getAuthProvider().clearTokens('logout');
    }
  }

  private handleError(error: unknown): Error {
    if (error instanceof ApiError) {
      return error;
    }

    if (error instanceof Error) {
      return new ApiError(error.message, 'NETWORK_ERROR', 0);
    }

    return new ApiError('Unknown error occurred', 'UNKNOWN_ERROR', 0);
  }

  // =============================================================================
  // CONVENIENCE METHODS
  // =============================================================================

  async get<T = unknown>(endpoint: string, config?: ApiConfig): Promise<T> {
    const useCache = config?.skipCache !== true && this.shouldCache(endpoint);

    // PERFORMANCE: Check cache first for GET requests
    if (useCache) {
      const cached = this.getCached(endpoint);
      if (cached !== null) {
        return cached as T;
      }

      // PERFORMANCE: Deduplicate concurrent requests for same endpoint
      const pending = this.pendingRequests.get(endpoint);
      if (pending !== undefined) {
        return await (pending as Promise<T>);
      }
    }

    // Create the request promise
    const requestPromise = this.request<T>(endpoint, { method: 'GET' }, config);

    // Track pending request for deduplication
    if (useCache) {
      this.pendingRequests.set(endpoint, requestPromise);
    }

    try {
      const result = await requestPromise;

      // Cache successful response
      if (useCache) {
        const ttl = config?.cacheTtl ?? this.getCacheTtl(endpoint);
        this.setCache(endpoint, result, ttl);
      }

      return result;
    } finally {
      // Remove from pending requests
      this.pendingRequests.delete(endpoint);
    }
  }

  async post<T = unknown>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<T> {
    const body =
      data === undefined || data === null
        ? null
        : data instanceof FormData
          ? data
          : JSON.stringify(data);

    const result = await this.request<T>(endpoint, { method: 'POST', body }, config);

    // Invalidate related cache entries after successful POST
    this.invalidateCache(endpoint);

    return result;
  }

  async put<T = unknown>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<T> {
    const result = await this.request<T>(
      endpoint,
      {
        method: 'PUT',
        body: data !== undefined && data !== null ? JSON.stringify(data) : null,
      },
      config,
    );

    // Invalidate related cache entries after successful PUT
    this.invalidateCache(endpoint);

    return result;
  }

  async patch<T = unknown>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<T> {
    const result = await this.request<T>(
      endpoint,
      {
        method: 'PATCH',
        body: data !== undefined && data !== null ? JSON.stringify(data) : null,
      },
      config,
    );

    // Invalidate related cache entries after successful PATCH
    this.invalidateCache(endpoint);

    return result;
  }

  async delete<T = unknown>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<T> {
    const result = await this.request<T>(
      endpoint,
      {
        method: 'DELETE',
        body: data !== undefined && data !== null ? JSON.stringify(data) : null,
      },
      config,
    );

    // Invalidate related cache entries after successful DELETE
    this.invalidateCache(endpoint);

    return result;
  }

  async upload<T = unknown>(endpoint: string, formData: FormData, config?: ApiConfig): Promise<T> {
    return await this.request<T>(
      endpoint,
      { method: 'POST', body: formData },
      { ...config, contentType: null },
    );
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

/** Get API client instance (SSR-safe) */
export function getApiClient(): ApiClient {
  return ApiClient.getInstance();
}

/** Singleton instance for convenience */
export const apiClient = ApiClient.getInstance();

// Re-export types for consumers
export type { LogoutReason };

// Debug mode: expose cache stats to window (DEV only for security)
if (browser && import.meta.env.DEV) {
  (window as unknown as { apiClient: ApiClient }).apiClient = apiClient;
}
