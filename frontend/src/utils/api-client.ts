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
  private static instance: ApiClient;
  private token: string | null = null;
  private refreshToken: string | null = null;
  private version: 'v1' | 'v2' = 'v2';
  private baseUrl: string = '';

  private constructor() {
    this.loadTokens();
    // Set base URL based on environment
    this.baseUrl = window.location.origin;
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private loadTokens() {
    this.token = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.token = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  setVersion(version: 'v1' | 'v2') {
    this.version = version;
  }

  async request<T = unknown>(endpoint: string, options: RequestInit = {}, config: ApiConfig = {}): Promise<T> {
    // Check feature flags to determine version
    const featureKey = `USE_API_V2_${this.extractApiName(endpoint).toUpperCase()}`;
    const version = window.FEATURE_FLAGS?.[featureKey] ? 'v2' : (config.version ?? this.version);

    const baseApiPath = version === 'v2' ? '/api/v2' : '/api';
    const url = `${this.baseUrl}${baseApiPath}${endpoint}`;

    const headers: Record<string, string> = {};

    // Copy existing headers if they exist
    if (options.headers) {
      const h = options.headers as Record<string, string>;
      Object.keys(h).forEach((key) => {
        headers[key] = h[key];
      });
    }

    // Only set Content-Type for requests with body
    if (options.body && config.contentType !== undefined) {
      if (config.contentType) {
        headers['Content-Type'] = config.contentType;
      }
    } else if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Add auth header for v2
    if (version === 'v2' && config.useAuth !== false && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      console.log(`[API ${version}] ${options.method ?? 'GET'} ${url}`);

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: version === 'v1' ? 'include' : 'omit',
      });

      // Handle token refresh for v2
      if (version === 'v2' && response.status === 401 && this.refreshToken && config.useAuth !== false) {
        console.log('[API v2] Token expired, attempting refresh...');
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry request with new token
          headers['Authorization'] = `Bearer ${this.token}`;
          const retryResponse = await fetch(url, {
            ...options,
            headers,
            credentials: 'omit',
          });
          return this.handleResponse<T>(retryResponse, version);
        }
      }

      return this.handleResponse<T>(response, version);
    } catch (error) {
      console.error(`[API ${version}] Request failed:`, error);

      // If v2 fails and we're not explicitly using v2, try v1 as fallback
      if (version === 'v2' && !config.version && this.version !== 'v1') {
        console.log('[API] v2 failed, falling back to v1...');
        return this.request<T>(endpoint, options, { ...config, version: 'v1' });
      }

      throw this.handleError(error);
    }
  }

  private extractApiName(endpoint: string): string {
    // Extract API name from endpoint (e.g., /auth/login -> auth)
    const parts = endpoint.split('/').filter(Boolean);
    return parts[0] || '';
  }

  private async handleResponse<T>(response: Response, version: 'v1' | 'v2'): Promise<T> {
    const contentType = response.headers.get('content-type');

    // Handle non-JSON responses (e.g., file downloads)
    if (!contentType?.includes('application/json')) {
      if (!response.ok) {
        throw new ApiError(`Request failed with status ${response.status}`, 'NON_JSON_ERROR', response.status);
      }
      return response as unknown as T;
    }

    const data = await response.json();

    if (version === 'v2') {
      const apiResponse = data as ApiResponse<T>;

      // v2 uses success flag
      if (!apiResponse.success) {
        throw new ApiError(
          apiResponse.error?.message ?? 'Unknown error',
          apiResponse.error?.code ?? 'UNKNOWN_ERROR',
          response.status,
          apiResponse.error?.details,
        );
      }

      return apiResponse.data as T;
    } else {
      // v1 response handling
      if (!response.ok) {
        throw new ApiError(data.message ?? data.error ?? 'Request failed', 'API_ERROR', response.status, data);
      }

      return data as T;
    }
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

      const data = await response.json();

      if (data.success && data.data) {
        this.setTokens(data.data.accessToken, data.data.refreshToken);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[API] Token refresh failed:', error);
      // Refresh failed, clear tokens and redirect to login
      this.clearTokens();
      window.location.href = '/login.html';
      return false;
    }
  }

  clearTokens() {
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
      return new ApiError(error.message ?? 'Network error', 'NETWORK_ERROR', 0);
    }

    return new ApiError('Unknown error occurred', 'UNKNOWN_ERROR', 0);
  }

  // Convenience methods
  async get<T = unknown>(endpoint: string, config?: ApiConfig): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, config);
  }

  async post<T = unknown>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      },
      config,
    );
  }

  async put<T = unknown>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
      },
      config,
    );
  }

  async patch<T = unknown>(endpoint: string, data?: unknown, config?: ApiConfig): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
      },
      config,
    );
  }

  async delete<T = unknown>(endpoint: string, config?: ApiConfig): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' }, config);
  }

  async upload<T = unknown>(endpoint: string, formData: FormData, config?: ApiConfig): Promise<T> {
    return this.request<T>(
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
  }
}

// Export singleton instance
export const apiClient = ApiClient.getInstance();

// Global error handler for unhandled API errors
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason instanceof ApiError) {
    console.error('[API] Unhandled API Error:', event.reason);

    // Handle specific error codes
    if (event.reason.code === 'UNAUTHORIZED' || event.reason.status === 401) {
      // Token might be invalid, redirect to login
      apiClient.clearTokens();
      window.location.href = '/login.html';
    }
  }
});
