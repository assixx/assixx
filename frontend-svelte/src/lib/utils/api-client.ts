/**
 * API Client for SvelteKit
 * 1:1 Copy from frontend/src/utils/api-client.ts + SSR adaptations
 *
 * Provides centralized API communication with:
 * - Automatic token refresh
 * - Error handling
 * - Rate limit protection
 * - Type-safe responses
 */

import { getTokenManager } from './token-manager';
import { browser } from '$app/environment';

interface ApiConfig {
  version?: 'v2' | undefined; // Always v2
  useAuth?: boolean | undefined;
  contentType?: string | null | undefined;
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

  private constructor() {
    if (browser) {
      this.baseUrl = window.location.origin;
    }
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
   * Clear tokens
   * @deprecated Use getTokenManager().clearTokens() directly
   */
  clearTokens(): void {
    if (browser) {
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
    return await this.request<T>(endpoint, { method: 'GET' }, config);
  }

  async post<T = unknown>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<T> {
    const body =
      data === undefined || data === null
        ? null
        : data instanceof FormData
          ? data
          : JSON.stringify(data);

    return await this.request<T>(endpoint, { method: 'POST', body }, config);
  }

  async put<T = unknown>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<T> {
    return await this.request<T>(
      endpoint,
      {
        method: 'PUT',
        body: data !== undefined && data !== null ? JSON.stringify(data) : null,
      },
      config,
    );
  }

  async patch<T = unknown>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<T> {
    return await this.request<T>(
      endpoint,
      {
        method: 'PATCH',
        body: data !== undefined && data !== null ? JSON.stringify(data) : null,
      },
      config,
    );
  }

  async delete<T = unknown>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<T> {
    return await this.request<T>(
      endpoint,
      {
        method: 'DELETE',
        body: data !== undefined && data !== null ? JSON.stringify(data) : null,
      },
      config,
    );
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
