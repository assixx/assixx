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

import { getTokenManager } from './token-manager';
import { browser } from '$app/environment';

// =============================================================================
// CACHE CONFIGURATION - TTL in milliseconds
// =============================================================================

/** Default cache TTL: 30 seconds */
const DEFAULT_CACHE_TTL = 30_000;

/** Endpoint-specific cache TTL configuration */
const CACHE_TTL_CONFIG: Record<string, number> = {
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

interface ApiConfig {
  version?: 'v2' | undefined; // Always v2
  useAuth?: boolean | undefined;
  contentType?: string | null | undefined;
  /** Skip cache for this request */
  skipCache?: boolean | undefined;
  /** Custom TTL for this request (ms) */
  cacheTtl?: number | undefined;
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

  private constructor() {
    if (browser) {
      this.baseUrl = window.location.origin;
    }
  }

  // =============================================================================
  // CACHE METHODS
  // =============================================================================

  /**
   * Get TTL for an endpoint (checks config, falls back to default)
   */
  private getCacheTtl(endpoint: string): number {
    // Check exact match first
    if (CACHE_TTL_CONFIG[endpoint] !== undefined) {
      return CACHE_TTL_CONFIG[endpoint];
    }

    // Check prefix match (e.g., '/users' matches '/users?role=employee')
    for (const [pattern, ttl] of Object.entries(CACHE_TTL_CONFIG)) {
      if (endpoint.startsWith(pattern)) {
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
   * Get cached data if valid
   */
  private getCached<T>(cacheKey: string): T | null {
    const entry = this.cache.get(cacheKey);
    if (entry === undefined) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Cache expired
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Store data in cache
   */
  private setCache<T>(cacheKey: string, data: T, ttl: number): void {
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
    const basePath = '/' + endpoint.split('/').filter(Boolean)[0];

    let invalidatedCount = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(basePath)) {
        this.cache.delete(key);
        invalidatedCount++;
      }
    }

    if (invalidatedCount > 0) {
      console.info(`[API Cache] Invalidated ${invalidatedCount} entries for ${basePath}`);
    }
  }

  /**
   * Clear all cache (e.g., on logout)
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    if (size > 0) {
      console.info(`[API Cache] Cleared ${size} entries`);
    }
  }

  /**
   * Get cache stats for debugging
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
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

  private buildHeaders(options: RequestInit, config: ApiConfig): Record<string, string> {
    const headers: Record<string, string> = {};

    // Copy existing headers
    if (options.headers !== undefined) {
      const h = options.headers as Record<string, string>;
      for (const [key, value] of Object.entries(h)) {
        headers[key] = value;
      }
    }

    // Set Content-Type for requests with body
    const hasBody = options.body !== undefined && options.body !== null;
    if (hasBody && config.contentType !== undefined && config.contentType !== null) {
      headers['Content-Type'] = config.contentType;
    } else if (hasBody && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Add auth header
    if (browser) {
      const tokenManager = getTokenManager();
      const token = tokenManager.getAccessToken();
      if (config.useAuth !== false && token !== null) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async handleTokenExpiredRetry<T>(
    url: string,
    options: RequestInit,
    headers: Record<string, string>,
    config: ApiConfig,
  ): Promise<T | null> {
    if (!browser) return null;

    const tokenManager = getTokenManager();
    const refreshToken = tokenManager.getRefreshToken();

    if (config.useAuth === false || refreshToken === null) {
      return null;
    }

    console.info('[API v2] Token expired, attempting refresh...');
    const refreshed = await tokenManager.refreshIfNeeded();

    if (!refreshed) {
      return null;
    }

    // Retry with new token
    const newToken = tokenManager.getAccessToken();
    headers['Authorization'] = `Bearer ${newToken ?? ''}`;

    const retryResponse = await fetch(url, {
      ...options,
      headers,
      credentials: 'omit',
    });

    return await this.handleResponse<T>(retryResponse);
  }

  /**
   * Proactively refresh token if needed
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

    const tokenManager = getTokenManager();
    const refreshed = await tokenManager.refreshIfNeeded();

    if (refreshed) {
      const token = tokenManager.getAccessToken();
      if (token !== null) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  }

  /**
   * Main request method
   */
  async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    config: ApiConfig = {},
  ): Promise<T> {
    const baseApiPath = '/api/v2';
    const url = `${this.baseUrl}${baseApiPath}${endpoint}`;
    const headers = this.buildHeaders(options, config);

    // Proactive token refresh
    await this.proactivelyRefreshTokenIfNeeded(endpoint, headers);

    try {
      console.info(`[API v2] ${options.method ?? 'GET'} ${url}`);

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'omit',
      });

      // Handle 401 with token refresh
      if (response.status === 401) {
        const retryResult = await this.handleTokenExpiredRetry<T>(url, options, headers, config);
        if (retryResult !== null) {
          return retryResult;
        }
      }

      return await this.handleResponse<T>(response);
    } catch (error) {
      // Check for abort (page navigation)
      const isAbortError =
        error instanceof Error &&
        (error.name === 'AbortError' ||
          error.message.includes('NetworkError') ||
          error.message.includes('aborted'));

      if (isAbortError) {
        console.info('[API v2] Request aborted (page navigation)');
      } else {
        console.error('[API v2] Request failed:', error);
      }

      throw this.handleError(error);
    }
  }

  private handleRateLimit(): never {
    console.error('[API] Rate limit exceeded');

    if (browser) {
      getTokenManager().clearTokens('logout');

      if (!this.isRedirectingToRateLimit) {
        this.isRedirectingToRateLimit = true;
        window.location.href = '/rate-limit';
      }
    }

    throw new ApiError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429);
  }

  private handleNonJsonResponse(response: Response): unknown {
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

    return response as unknown;
  }

  private extractErrorMessage(data: Record<string, unknown>): { message: string; details: string } {
    const error = data['error'] as { message?: string; details?: string } | undefined;

    const message =
      typeof error?.message === 'string'
        ? error.message
        : typeof data['error'] === 'string'
          ? data['error']
          : typeof data['message'] === 'string'
            ? data['message']
            : '';

    const details =
      typeof data['details'] === 'string'
        ? data['details']
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
      console.info('[API] Token expired, redirecting to login');
      if (browser) {
        getTokenManager().clearTokens('token_expired');
      }
      throw new ApiError('Session expired', 'SESSION_EXPIRED', 401);
    }
  }

  private createApiError(response: Response, data: Record<string, unknown>): ApiError {
    const error = data['error'] as
      | { message?: string; code?: string; details?: unknown }
      | undefined;

    const message =
      typeof error?.message === 'string'
        ? error.message
        : typeof data['message'] === 'string'
          ? data['message']
          : `Request failed with status ${response.status}`;

    const code = typeof error?.code === 'string' ? error.code : 'API_ERROR';

    return new ApiError(message, code, response.status, error?.details);
  }

  private handleV2Response(response: Response, data: Record<string, unknown>): unknown {
    if ('success' in data && typeof data['success'] === 'boolean') {
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
      return this.handleNonJsonResponse(response) as T;
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
      getTokenManager().clearTokens('logout');
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
    const startTime = performance.now();
    const useCache = config?.skipCache !== true && this.shouldCache(endpoint);

    // PERFORMANCE: Check cache first for GET requests
    if (useCache) {
      const cached = this.getCached<T>(endpoint);
      if (cached !== null) {
        const duration = (performance.now() - startTime).toFixed(1);
        console.info(`[API Cache] HIT ${endpoint} (${duration}ms)`);
        return cached;
      }

      // PERFORMANCE: Deduplicate concurrent requests for same endpoint
      const pending = this.pendingRequests.get(endpoint);
      if (pending !== undefined) {
        console.info(`[API Cache] DEDUP ${endpoint} (waiting for pending request)`);
        return pending as Promise<T>;
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
        const duration = (performance.now() - startTime).toFixed(1);
        console.info(`[API Cache] MISS ${endpoint} - cached for ${ttl / 1000}s (${duration}ms)`);
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

// Debug mode: expose cache stats to window
if (browser) {
  (window as unknown as { apiClient: ApiClient }).apiClient = apiClient;
  console.info('[API Client] Debug mode - available as window.apiClient');
  console.info('[API Client] Cache commands: apiClient.getCacheStats(), apiClient.clearCache()');
}
