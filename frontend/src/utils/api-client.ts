interface ApiConfig {
  version?: 'v1' | 'v2';
  useAuth?: boolean;
  contentType?: string;
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
  private token: string | null = null;
  private refreshToken: string | null = null;
  private version: 'v1' | 'v2' = 'v2';
  private baseUrl = '';
  private isRedirectingToRateLimit = false; // Prevent multiple redirects

  private constructor() {
    this.loadTokens();
    // Set base URL based on environment
    this.baseUrl = window.location.origin;
  }

  static getInstance(): ApiClient {
    ApiClient.instance ??= new ApiClient();
    return ApiClient.instance;
  }

  private loadTokens(): void {
    this.token = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.token = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  setVersion(version: 'v1' | 'v2'): void {
    this.version = version;
  }

  private checkFeatureFlag(endpoint: string): boolean {
    const featureKey = `USE_API_V2_${this.extractApiName(endpoint).toUpperCase()}`;

    if (window.FEATURE_FLAGS === undefined || typeof window.FEATURE_FLAGS !== 'object') {
      return false;
    }

    const flags = window.FEATURE_FLAGS as Record<string, unknown>;
    for (const [key, value] of Object.entries(flags)) {
      if (key === featureKey && value === true) {
        return true;
      }
    }

    return false;
  }

  private determineVersion(endpoint: string, config: ApiConfig): 'v1' | 'v2' {
    const useV2 = this.checkFeatureFlag(endpoint);
    return useV2 ? 'v2' : (config.version ?? this.version);
  }

  private buildHeaders(options: RequestInit, config: ApiConfig, version: 'v1' | 'v2'): Record<string, string> {
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
    if (options.body !== undefined && config.contentType !== undefined) {
      headers['Content-Type'] = config.contentType;
    } else if (options.body !== undefined && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Add auth header for v2
    if (version === 'v2' && config.useAuth !== false && this.token !== null && this.token !== '') {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async handleTokenExpiredRetry<T>(
    url: string,
    options: RequestInit,
    headers: Record<string, string>,
    version: 'v1' | 'v2',
    config: ApiConfig,
  ): Promise<T | null> {
    if (version !== 'v2' || config.useAuth === false || this.refreshToken === null || this.refreshToken === '') {
      return null;
    }

    console.info('[API v2] Token expired, attempting refresh...');
    const refreshed = await this.refreshAccessToken();

    if (!refreshed) {
      return null;
    }

    // Retry request with new token
    headers.Authorization = `Bearer ${this.token ?? ''}`;
    const retryResponse = await fetch(url, {
      ...options,
      headers,
      credentials: 'omit',
    });
    return await this.handleResponse<T>(retryResponse, version);
  }

  private shouldFallbackToV1(error: unknown, version: 'v1' | 'v2', config: ApiConfig): boolean {
    const isClientError = error instanceof ApiError && error.status >= 400 && error.status < 500;
    return version === 'v2' && config.version === undefined && this.version !== 'v1' && !isClientError;
  }

  async request<T = unknown>(endpoint: string, options: RequestInit = {}, config: ApiConfig = {}): Promise<T> {
    const version = this.determineVersion(endpoint, config);
    const baseApiPath = version === 'v2' ? '/api/v2' : '/api';
    const url = `${this.baseUrl}${baseApiPath}${endpoint}`;
    const headers = this.buildHeaders(options, config, version);

    try {
      console.info(`[API ${version}] ${options.method ?? 'GET'} ${url}`);

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: version === 'v1' ? 'include' : 'omit',
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

      // Attempt fallback to v1 if applicable
      if (this.shouldFallbackToV1(error, version, config)) {
        console.info('[API] v2 failed with server error, falling back to v1...');
        return await this.request<T>(endpoint, options, { ...config, version: 'v1' });
      }

      throw this.handleError(error);
    }
  }

  private extractApiName(endpoint: string): string {
    // Extract API name from endpoint (e.g., /auth/login -> auth)
    const part = endpoint.split('/').find(Boolean);
    return part ?? '';
  }

  private handleRateLimit(): void {
    console.error('[API] Rate limit exceeded');
    this.clearTokens();

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
      typeof data.details === 'string' ? data.details : typeof error?.details === 'string' ? error.details : '';

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
      this.clearTokens();
      window.location.href = '/login?session=expired';
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
    // Check if response has the standard v2 format with success flag
    if ('success' in data && typeof data.success === 'boolean') {
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

  private handleV1Response(response: Response, data: Record<string, unknown>): unknown {
    if (!response.ok) {
      throw new ApiError(
        typeof data.message === 'string'
          ? data.message
          : typeof data.error === 'string'
            ? data.error
            : 'Request failed',
        'API_ERROR',
        response.status,
        data as unknown,
      );
    }

    return data;
  }

  private async handleResponse<T>(response: Response, version: 'v1' | 'v2'): Promise<T> {
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

    // Handle version-specific response formats
    return (version === 'v2' ? this.handleV2Response(response, data) : this.handleV1Response(response, data)) as T;
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v2/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: this.refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = (await response.json()) as {
        success?: boolean;
        data?: { accessToken: string; refreshToken: string };
      };

      if (data.success === true && data.data !== undefined) {
        this.setTokens(data.data.accessToken, data.data.refreshToken);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[API] Token refresh failed:', error);
      // Refresh failed, clear tokens and redirect to login with session expired message
      this.clearTokens();
      window.location.href = '/login?session=expired';
      return false;
    }
  }

  clearTokens(): void {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
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
    return await this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: data !== undefined && data !== null ? JSON.stringify(data) : undefined,
      },
      config,
    );
  }

  async put<T = unknown>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<T> {
    return await this.request<T>(
      endpoint,
      {
        method: 'PUT',
        body: data !== undefined && data !== null ? JSON.stringify(data) : undefined,
      },
      config,
    );
  }

  async patch<T = unknown>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<T> {
    return await this.request<T>(
      endpoint,
      {
        method: 'PATCH',
        body: data !== undefined && data !== null ? JSON.stringify(data) : undefined,
      },
      config,
    );
  }

  async delete<T = unknown>(endpoint: string, config?: ApiConfig): Promise<T> {
    return await this.request<T>(endpoint, { method: 'DELETE' }, config);
  }

  async upload<T = unknown>(endpoint: string, formData: FormData, config?: ApiConfig): Promise<T> {
    return await this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: formData,
      },
      { ...config, contentType: undefined }, // Let browser set content-type for multipart
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
    FEATURE_FLAGS?: Record<string, boolean | undefined>;
    ApiClient: typeof ApiClient;
    apiClient: ApiClient;
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
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason instanceof ApiError) {
    console.error('[API] Unhandled API Error:', event.reason);

    // Handle specific error codes
    if (
      event.reason.code === 'UNAUTHORIZED' ||
      event.reason.code === 'SESSION_EXPIRED' ||
      event.reason.status === 401
    ) {
      // Token might be invalid or expired, redirect to login with session expired message
      event.preventDefault(); // Prevent console error
      apiClient.clearTokens();
      window.location.href = '/login?session=expired';
    }
  }
});
