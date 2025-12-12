import { tokenManager } from './token-manager';

interface ApiConfig {
  version?: 'v2' | undefined; // v1 removed - always use v2
  useAuth?: boolean | undefined;
  contentType?: string | null | undefined;
}

interface ApiResponse<T = unknown> {
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

export class ApiClient {
  private static instance: ApiClient | undefined;
  // Feature flags removed - always use v2
  private baseUrl = '';
  private isRedirectingToRateLimit = false; // Prevent multiple redirects

  private constructor() {
    // Set base URL based on environment
    this.baseUrl = window.location.origin;
  }

  static getInstance(): ApiClient {
    ApiClient.instance ??= new ApiClient();
    return ApiClient.instance;
  }

  /**
   * Set tokens (delegates to TokenManager)
   * @deprecated Use tokenManager.setTokens() directly instead
   */
  setTokens(accessToken: string, refreshToken: string): void {
    tokenManager.setTokens(accessToken, refreshToken);
  }

  // Removed setVersion - always v2

  // Feature flags removed - always use v2

  private determineVersion(_endpoint: string, _config: ApiConfig): 'v2' {
    // Always return v2 - feature flags removed
    return 'v2';
  }

  private buildHeaders(options: RequestInit, config: ApiConfig, _version: 'v2'): Record<string, string> {
    const headers: Record<string, string> = {};

    // Copy existing headers if they exist
    if (options.headers !== undefined) {
      const h = options.headers as Record<string, string>;
      for (const [key, value] of Object.entries(h)) {
        // eslint-disable-next-line security/detect-object-injection
        headers[key] = value; // Safe: key comes from Object.entries()
      }
    }

    // Only set Content-Type for requests with body
    if (options.body !== undefined && config.contentType !== undefined && config.contentType !== null) {
      headers['Content-Type'] = config.contentType;
    } else if (options.body !== undefined && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Add auth header (always v2 now, get token from TokenManager)
    const token = tokenManager.getAccessToken();
    if (config.useAuth !== false && token !== null) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleTokenExpiredRetry<T>(
    url: string,
    options: RequestInit,
    headers: Record<string, string>,
    version: 'v2',
    config: ApiConfig,
  ): Promise<T | null> {
    const refreshToken = tokenManager.getRefreshToken();
    if (config.useAuth === false || refreshToken === null) {
      return null;
    }

    console.info('[API v2] Token expired, attempting refresh...');
    const refreshed = await tokenManager.refreshIfNeeded();

    if (!refreshed) {
      return null;
    }

    // Retry request with new token
    const newToken = tokenManager.getAccessToken();
    headers['Authorization'] = `Bearer ${newToken ?? ''}`;
    const retryResponse = await fetch(url, {
      ...options,
      headers,
      credentials: 'omit',
    });
    return await this.handleResponse<T>(retryResponse, version);
  }

  /**
   * Check if token should be proactively refreshed before making a request
   * Delegates to TokenManager which handles the logic
   *
   * CRITICAL: Background polling endpoints are excluded to prevent "heartbeat keeps session alive" bug
   * - Without exclusion: Background API calls (e.g., /chat/unread-count every 10 min) would automatically
   *   refresh tokens even when user is completely inactive, preventing automatic logout on token expiry
   * - With exclusion: Only user-initiated API calls refresh tokens, allowing proper token expiry logout
   */
  private async proactivelyRefreshTokenIfNeeded(endpoint: string, headers: Record<string, string>): Promise<void> {
    // Skip refresh for auth endpoints (prevent infinite loop) AND background polling endpoints (prevent heartbeat bug)
    const skipRefreshEndpoints = [
      '/auth/refresh', // Auth endpoints - prevent infinite loop
      '/auth/login',
      '/auth/logout',
      '/chat/unread-count', // Background polling - should NOT keep session alive
      '/notifications/stream', // SSE connection - should NOT keep session alive
    ];

    // Check if endpoint matches any skip pattern
    if (skipRefreshEndpoints.some((skipEndpoint: string) => endpoint.includes(skipEndpoint))) {
      return;
    }

    // TokenManager handles: check if expired (logout) or expiring soon (refresh)
    const refreshed = await tokenManager.refreshIfNeeded();

    if (refreshed) {
      // Token is fresh, update header with current token
      const token = tokenManager.getAccessToken();
      // False positive: We're only checking token existence (null vs string), not comparing token content
      // eslint-disable-next-line security/detect-possible-timing-attacks
      if (token !== null) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    // If refresh failed, TokenManager already handled logout/redirect
  }

  async request<T = unknown>(endpoint: string, options: RequestInit = {}, config: ApiConfig = {}): Promise<T> {
    const version = this.determineVersion(endpoint, config);
    const baseApiPath = '/api/v2'; // Always v2
    const url = `${this.baseUrl}${baseApiPath}${endpoint}`;
    const headers = this.buildHeaders(options, config, version);

    // PROACTIVE TOKEN REFRESH: Ensure active users always have a fresh token (resets timer on activity)
    await this.proactivelyRefreshTokenIfNeeded(endpoint, headers);

    try {
      console.info(`[API ${version}] ${options.method ?? 'GET'} ${url}`);

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'omit', // v2 doesn't use cookies
      });

      // Handle token refresh for v2
      if (response.status === 401) {
        const retryResult = await this.handleTokenExpiredRetry<T>(url, options, headers, version, config);
        if (retryResult !== null) {
          return retryResult;
        }
      }

      return await this.handleResponse<T>(response, version);
    } catch (error) {
      console.error(`[API ${version}] Request failed:`, error);
      throw this.handleError(error);
    }
  }

  // Removed extractApiName - no longer needed without feature flags

  private handleRateLimit(): void {
    console.error('[API] Rate limit exceeded');
    tokenManager.clearTokens('logout');

    if (!this.isRedirectingToRateLimit) {
      this.isRedirectingToRateLimit = true;
      console.log('[API] Redirecting to rate limit page...');
      window.location.href = '/rate-limit';
    }

    throw new ApiError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429);
  }

  private handleNonJsonResponse(response: Response): unknown {
    if (response.status === 429) {
      this.handleRateLimit();
    }

    if (!response.ok) {
      throw new ApiError(`Request failed with status ${response.status}`, 'NON_JSON_ERROR', response.status);
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
      typeof data['details'] === 'string' ? data['details'] : typeof error?.details === 'string' ? error.details : '';

    return { message, details };
  }

  private handleAuthenticationError(data: Record<string, unknown>): void {
    const { message, details } = this.extractErrorMessage(data);

    if (
      message.toLowerCase().includes('expired') ||
      message.toLowerCase().includes('invalid token') ||
      (details !== '' && details.toLowerCase().includes('expired'))
    ) {
      console.info('[API] Token expired, redirecting to login with session expired message');
      // TokenManager handles logout and redirect
      tokenManager.clearTokens('token_expired');
      throw new ApiError('Session expired', 'SESSION_EXPIRED', 401);
    }
  }

  private createApiError(response: Response, data: Record<string, unknown>): ApiError {
    const error = data['error'] as { message?: string; code?: string; details?: unknown } | undefined;

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
    // Check if response has the standard v2 format with success flag
    if ('success' in data && typeof data['success'] === 'boolean') {
      const apiResponse = data as unknown as ApiResponse;

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

    // Some v2 endpoints return data directly without wrapper
    if (!response.ok) {
      throw this.createApiError(response, data);
    }

    return data;
  }

  private async handleResponse<T>(response: Response, _version: 'v2'): Promise<T> {
    const contentType = response.headers.get('content-type');

    // Handle non-JSON responses
    if (contentType?.includes('application/json') !== true) {
      return this.handleNonJsonResponse(response) as T;
    }

    const data = (await response.json()) as Record<string, unknown>;

    // Check for rate limit
    if (response.status === 429) {
      this.handleRateLimit();
    }

    // Check for authentication errors
    if (response.status === 401 || response.status === 403) {
      this.handleAuthenticationError(data);
    }

    // Always use v2 response format
    return this.handleV2Response(response, data) as T;
  }

  /**
   * Check if current token expires soon and proactively refresh it
   * Should be called on page load to ensure fresh token for active users
   * @deprecated Use tokenManager.refreshIfNeeded() directly instead
   */
  async ensureFreshToken(): Promise<void> {
    await tokenManager.refreshIfNeeded();
  }

  /**
   * Clear tokens (delegates to TokenManager)
   * @deprecated Use tokenManager.clearTokens() directly instead
   */
  clearTokens(): void {
    tokenManager.clearTokens('logout');
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

  // Convenience methods
  async get<T = unknown>(endpoint: string, config?: ApiConfig): Promise<T> {
    return await this.request<T>(endpoint, { method: 'GET' }, config);
  }

  async post<T = unknown>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<T> {
    // FormData must NOT be stringified - browser handles multipart/form-data encoding
    const body = data === undefined || data === null ? null : data instanceof FormData ? data : JSON.stringify(data);

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
      {
        method: 'POST',
        body: formData,
      },
      { ...config, contentType: null }, // Let browser set content-type for multipart
    );
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Declare global types
declare global {
  interface Window {
    ApiClient?: typeof ApiClient;
    apiClient?: ApiClient;
  }
}

// Export singleton instance
export const apiClient = ApiClient.getInstance();

// Make ApiClient available globally for inline scripts
if (typeof window !== 'undefined') {
  window.ApiClient = ApiClient;
  window.apiClient = apiClient;
}

// Global error handler for unhandled API errors
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  const reason: unknown = event.reason;
  if (reason instanceof ApiError) {
    console.error('[API] Unhandled API Error:', reason);

    // Handle specific error codes
    if (reason.code === 'UNAUTHORIZED' || reason.code === 'SESSION_EXPIRED' || reason.status === 401) {
      // Token might be invalid or expired, redirect to login with session expired message
      event.preventDefault(); // Prevent console error
      tokenManager.clearTokens('token_expired');
    }
  }
});
