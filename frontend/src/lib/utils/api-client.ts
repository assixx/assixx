/**
 * API Client for SvelteKit
 *
 * Provides centralized API communication with:
 * - Automatic token refresh
 * - Error handling
 * - Rate limit protection
 * - Type-safe responses
 * - PERFORMANCE: In-memory cache with TTL for GET requests
 */

import { browser } from '$app/environment';
import { goto } from '$app/navigation';

import { showErrorAlert } from '$lib/stores/toast';

import { ApiCache } from './api-cache';
import {
  ApiError,
  DEFAULT_TIMEOUT_MS,
  type ApiConfig,
  type ApiResponseWrapper,
  type AuthTokenProvider,
} from './api-client.types';
import {
  combineSignals,
  createApiError,
  createTimeoutSignal,
  extractErrorMessage,
  getContentType,
  getCredentialsMode,
  humanizePermissionError,
  isAbortError,
  isTimeoutError,
  wrapError,
} from './api-client.utils';
import { createLogger } from './logger';
import { perf } from './perf-logger';
import { getTokenManager, registerCacheClearCallback } from './token-manager';

const log = createLogger('ApiClient');

/**
 * API Client Singleton
 */
export class ApiClient {
  private static instance: ApiClient | undefined;
  private readonly baseUrl: string = '';
  private isRedirectingToRateLimit = false;
  private readonly apiCache = new ApiCache();
  private authProvider: AuthTokenProvider | null = null;

  private constructor() {
    if (browser) {
      this.baseUrl = window.location.origin;

      // Register cache clear callback with TokenManager
      // This allows TokenManager to clear API cache without importing api-client (avoiding cycle)
      registerCacheClearCallback(() => {
        this.apiCache.clear();
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
   */
  private getAuthProvider(): AuthTokenProvider {
    if (this.authProvider !== null) {
      return this.authProvider;
    }

    // Fallback: Create wrapper around TokenManager for backward compatibility
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

  static getInstance(): ApiClient {
    ApiClient.instance ??= new ApiClient();
    return ApiClient.instance;
  }

  /**
   * Set tokens (delegates to TokenManager)
   * @deprecated Use getTokenManager().setTokens() directly
   */
  setTokens(accessToken: string): void {
    if (!browser) return;
    getTokenManager().setTokens(accessToken);
  }

  // =============================================================================
  // HEADER BUILDING
  // =============================================================================

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

  private buildHeaders(
    options: RequestInit,
    config: ApiConfig,
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    // Copy existing headers
    if (options.headers !== undefined) {
      const h = options.headers as Record<string, string>;
      for (const [key, value] of Object.entries(h)) {
        headers[key] = value;
      }
    }

    // Set Content-Type
    const contentType = getContentType(options, config);
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

  // =============================================================================
  // TOKEN REFRESH
  // =============================================================================

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
    if (newToken === null) {
      // Don't send invalid "Bearer " header - remove it entirely
      delete headers.Authorization;
    } else {
      headers.Authorization = `Bearer ${newToken}`;
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

  // =============================================================================
  // CORE REQUEST METHOD
  // =============================================================================

  /** Main request method with AbortController and timeout support */
  async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    config: ApiConfig = {},
  ): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase();
    const endPerf = perf.start(`api:${method}:${endpoint}`, {
      method,
      endpoint,
    });
    const baseApiPath = '/api/v2';
    const url = `${this.baseUrl}${baseApiPath}${endpoint}`;
    const headers = this.buildHeaders(options, config);

    // Create timeout signal (default 30s, configurable via config.timeout)
    const timeoutMs = config.timeout ?? DEFAULT_TIMEOUT_MS;
    const { signal: timeoutSignal, cleanup: cleanupTimeout } =
      createTimeoutSignal(timeoutMs);

    // Combine user signal (if provided) with timeout signal
    const combinedSignal = combineSignals(config.signal, timeoutSignal);

    // Proactive token refresh
    await this.proactivelyRefreshTokenIfNeeded(endpoint, headers);

    // Auth endpoints need credentials: 'include' for HttpOnly cookie
    const credentialsMode = getCredentialsMode(endpoint);

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
          endPerf();
          return retryResult;
        }
      }

      const result = await this.handleResponse<T>(response);
      endPerf();
      return result;
    } catch (error: unknown) {
      endPerf();
      this.handleRequestError(error, timeoutMs, config.silent);
    } finally {
      // Always clean up timeout to prevent memory leaks
      cleanupTimeout();
    }
  }

  // =============================================================================
  // RESPONSE & ERROR HANDLING
  // =============================================================================

  /**
   * Handle errors from fetch requests
   */
  private handleRequestError(
    error: unknown,
    timeoutMs: number,
    silent?: boolean,
  ): never {
    if (error instanceof Error) {
      if (isTimeoutError(error)) {
        throw new ApiError(
          `Request timeout after ${timeoutMs}ms`,
          'TIMEOUT',
          0,
        );
      }

      // Don't log abort errors (expected during navigation)
      // Don't log silent errors (expected failures like optional settings lookup)
      if (!isAbortError(error) && silent !== true) {
        log.error({ err: error }, 'Request failed');
      }
    }

    throw wrapError(error);
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
    return await response.text();
  }

  private handleAuthenticationError(data: Record<string, unknown>): void {
    const { message, details } = extractErrorMessage(data);

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

  private handleV2Response(
    response: Response,
    data: Record<string, unknown>,
  ): unknown {
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
      throw createApiError(response, data);
    }

    return data;
  }

  /**
   * Handle 403 Forbidden responses:
   * - Feature not enabled → redirect to /feature-unavailable
   * - Permission denied → humanize message + show toast
   */
  private handleForbidden(data: Record<string, unknown>): void {
    const { message } = extractErrorMessage(data);

    if (message.toLowerCase().includes('feature is not enabled')) {
      if (browser) {
        void goto('/feature-unavailable');
      }
      throw new ApiError('Feature nicht verfügbar', 'FEATURE_DISABLED', 403);
    }

    const humanMessage = humanizePermissionError(message);
    if (humanMessage !== null) {
      if (browser) {
        showErrorAlert(humanMessage, 6000);
      }
      throw new ApiError(humanMessage, 'PERMISSION_DENIED', 403);
    }
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

    if (response.status === 403) {
      this.handleForbidden(data);
    }

    // Auth errors: expired token or invalid token → clear session
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
      this.apiCache.clear(); // Clear API cache on logout
      this.getAuthProvider().clearTokens('logout');
    }
  }

  // =============================================================================
  // CACHE DELEGATION
  // =============================================================================

  /** Clear all cache (e.g., on logout) */
  clearCache(): void {
    this.apiCache.clear();
  }

  /** Get cache stats for debugging and monitoring */
  getCacheStats(): ReturnType<ApiCache['getStats']> {
    return this.apiCache.getStats();
  }

  /** Reset cache metrics (useful for testing or monitoring periods) */
  resetCacheMetrics(): void {
    this.apiCache.resetMetrics();
  }

  // =============================================================================
  // CONVENIENCE METHODS
  // =============================================================================

  async get<T = unknown>(endpoint: string, config?: ApiConfig): Promise<T> {
    const useCache =
      config?.skipCache !== true && this.apiCache.shouldCache(endpoint);

    // PERFORMANCE: Check cache first for GET requests
    if (useCache) {
      const cached = this.apiCache.get(endpoint);
      if (cached !== null) {
        log.debug({ endpoint, source: 'cache' }, `⚡ Cache HIT: ${endpoint}`);
        return cached as T;
      }

      // PERFORMANCE: Deduplicate concurrent requests for same endpoint
      const pending = this.apiCache.getPending(endpoint);
      if (pending !== undefined) {
        log.debug(
          { endpoint, source: 'dedup' },
          `⚡ Request DEDUP: ${endpoint}`,
        );
        return await (pending as Promise<T>);
      }
    }

    // Create the request promise
    const requestPromise = this.request<T>(endpoint, { method: 'GET' }, config);

    // Track pending request for deduplication
    if (useCache) {
      this.apiCache.setPending(endpoint, requestPromise);
    }

    try {
      const result = await requestPromise;

      // Cache successful response
      if (useCache) {
        const ttl = config?.cacheTtl ?? this.apiCache.getTtl(endpoint);
        this.apiCache.set(endpoint, result, ttl);
      }

      return result;
    } finally {
      // Remove from pending requests
      this.apiCache.deletePending(endpoint);
    }
  }

  async post<T = unknown>(
    endpoint: string,
    data?: unknown,
    config?: ApiConfig,
  ): Promise<T> {
    let body: FormData | string | null = null;
    if (data instanceof FormData) {
      body = data;
    } else if (data !== undefined && data !== null) {
      body = JSON.stringify(data);
    }

    const result = await this.request<T>(
      endpoint,
      { method: 'POST', body },
      config,
    );

    // Invalidate related cache entries after successful POST
    this.apiCache.invalidate(endpoint);

    return result;
  }

  async put<T = unknown>(
    endpoint: string,
    data?: unknown,
    config?: ApiConfig,
  ): Promise<T> {
    const result = await this.request<T>(
      endpoint,
      {
        method: 'PUT',
        body: data !== undefined && data !== null ? JSON.stringify(data) : null,
      },
      config,
    );

    // Invalidate related cache entries after successful PUT
    this.apiCache.invalidate(endpoint);

    return result;
  }

  async patch<T = unknown>(
    endpoint: string,
    data?: unknown,
    config?: ApiConfig,
  ): Promise<T> {
    const result = await this.request<T>(
      endpoint,
      {
        method: 'PATCH',
        body: data !== undefined && data !== null ? JSON.stringify(data) : null,
      },
      config,
    );

    // Invalidate related cache entries after successful PATCH
    this.apiCache.invalidate(endpoint);

    return result;
  }

  async delete<T = unknown>(
    endpoint: string,
    data?: unknown,
    config?: ApiConfig,
  ): Promise<T> {
    const result = await this.request<T>(
      endpoint,
      {
        method: 'DELETE',
        body: data !== undefined && data !== null ? JSON.stringify(data) : null,
      },
      config,
    );

    // Invalidate related cache entries after successful DELETE
    this.apiCache.invalidate(endpoint);

    return result;
  }

  async upload<T = unknown>(
    endpoint: string,
    formData: FormData,
    config?: ApiConfig,
  ): Promise<T> {
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

// Re-export for backward compatibility (consumers import from api-client)
export { ApiError } from './api-client.types';
export type { AuthTokenProvider, LogoutReason } from './api-client.types';

// Debug mode: expose cache stats to window (DEV only for security)
if (browser && import.meta.env.DEV) {
  (window as unknown as { apiClient: ApiClient }).apiClient = apiClient;
}
