/**
 * API Service
 * Centralized API communication with TypeScript
 */

import type { ApiResponse, User, LoginRequest, LoginResponse, Document } from '../../types/api.types';
import type { PaginationParams, PaginatedResponse } from '../../types/utils.types';
import { apiClient } from '../../utils/api-client';
import { ResponseAdapter } from '../../utils/response-adapter';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

/**
 *
 */
export class ApiService {
  private baseURL: string;
  private token: string | null;
  private useV2 = false;

  /**
   *
   * @param baseURL
   */
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
    // Check for v2 token first, then v1
    this.token = localStorage.getItem('accessToken') ?? localStorage.getItem('token');
    // Check if any v2 API is enabled
    this.useV2 = window.FEATURE_FLAGS?.USE_API_V2_GLOBAL ?? false;
  }

  /**
   * Set authentication token
   * @param token
   * @param refreshToken
   */
  setToken(token: string | null, refreshToken?: string | null): void {
    this.token = token;
    if (token !== null && token !== '') {
      // Store in both formats for compatibility
      localStorage.setItem('token', token);
      localStorage.setItem('accessToken', token);
      if (refreshToken !== null && refreshToken !== undefined && refreshToken !== '') {
        localStorage.setItem('refreshToken', refreshToken);
      }
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  /**
   * Get token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Get headers for requests
   * @param customHeaders
   */
  private getHeaders(customHeaders?: HeadersInit): Headers {
    const headers = new Headers({
      'Content-Type': 'application/json',
    });

    // Add custom headers if provided
    if (customHeaders) {
      const customHeadersObj = new Headers(customHeaders);
      customHeadersObj.forEach((value, key) => {
        headers.set(key, value);
      });
    }

    if (this.token !== null && this.token !== '') {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    return headers;
  }

  /**
   * Build URL with query parameters
   * @param endpoint
   * @param params
   */
  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean>): string {
    const url = `${this.baseURL}${endpoint}`;

    if (!params || Object.keys(params).length === 0) {
      return url;
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });

    return `${url}?${searchParams.toString()}`;
  }

  /**
   * Check if should use v2 API based on feature flags
   */
  private shouldUseV2Api(endpoint: string): boolean {
    const featureKey = `USE_API_V2_${endpoint.split('/')[1]?.toUpperCase()}`;
    // Safe: featureKey is constructed from endpoint string, not user input
    // eslint-disable-next-line security/detect-object-injection
    return window.FEATURE_FLAGS?.[featureKey] ?? this.useV2;
  }

  /**
   * Handle v2 API request
   */
  private async handleV2Request<T>(
    method: HttpMethod,
    endpoint: string,
    data?: unknown,
    params?: Record<string, string | number | boolean>,
  ): Promise<T> {
    const queryString = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    const fullEndpoint = endpoint + queryString;

    switch (method) {
      case 'GET':
        return (await apiClient.get(fullEndpoint)) as T;
      case 'POST':
        if (data instanceof FormData) {
          return (await apiClient.upload(endpoint, data)) as T;
        }
        return (await apiClient.post(endpoint, data)) as T;
      case 'PUT':
        return (await apiClient.put(endpoint, data)) as T;
      case 'PATCH':
        return (await apiClient.patch(endpoint, data)) as T;
      case 'DELETE':
        return (await apiClient.delete(endpoint)) as T;
      default:
        throw new Error(`Unsupported HTTP method: ${method as string}`);
    }
  }

  /**
   * Prepare request options for v1 API
   */
  private prepareV1RequestOptions(
    method: HttpMethod,
    data: unknown,
    fetchOptions: Omit<RequestOptions, 'params'>,
  ): RequestInit {
    const requestOptions: RequestInit = {
      method,
      headers: this.getHeaders(fetchOptions.headers),
      ...fetchOptions,
    };

    if (data === undefined || data === null || !['POST', 'PUT', 'PATCH'].includes(method)) {
      return requestOptions;
    }

    if (data instanceof FormData) {
      // Remove Content-Type header for FormData
      requestOptions.headers = new Headers(requestOptions.headers);
      requestOptions.headers.delete('Content-Type');
      requestOptions.body = data;
    } else {
      requestOptions.body = JSON.stringify(data);
    }

    return requestOptions;
  }

  /**
   * Handle v1 API response
   */
  private async handleV1Response<T>(response: Response): Promise<T> {
    // Handle 401 Unauthorized
    if (response.status === 401) {
      this.setToken(null);
      // Safe: window.location is a global property, no race condition possible

      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    // Parse JSON response
    const responseData = (await response.json()) as { error?: string; message?: string } & T;

    if (!response.ok) {
      throw new Error(responseData.error ?? responseData.message ?? `HTTP error! status: ${response.status}`);
    }

    return responseData as T;
  }

  /**
   * Make API request
   * @param method
   * @param endpoint
   * @param data
   * @param options
   */
  async request<T = unknown>(
    method: HttpMethod,
    endpoint: string,
    data?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const { params, ...fetchOptions } = options ?? {};

    try {
      if (this.shouldUseV2Api(endpoint)) {
        return await this.handleV2Request<T>(method, endpoint, data, params);
      }

      // Use original v1 implementation
      const url = this.buildUrl(endpoint, params);
      const requestOptions = this.prepareV1RequestOptions(method, data, fetchOptions);
      const response = await fetch(url, requestOptions);
      return await this.handleV1Response<T>(response);
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Convenience methods
  /**
   *
   * @param endpoint
   * @param params
   */
  async get<T = unknown>(endpoint: string, params?: Record<string, string | number | boolean>): Promise<T> {
    return await this.request<T>('GET', endpoint, null, { params });
  }

  /**
   *
   * @param endpoint
   * @param data
   */
  async post<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    return await this.request<T>('POST', endpoint, data);
  }

  /**
   *
   * @param endpoint
   * @param data
   */
  async put<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    return await this.request<T>('PUT', endpoint, data);
  }

  /**
   *
   * @param endpoint
   * @param data
   */
  async patch<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    return await this.request<T>('PATCH', endpoint, data);
  }

  /**
   *
   * @param endpoint
   */
  async delete<T = unknown>(endpoint: string): Promise<T> {
    return await this.request<T>('DELETE', endpoint);
  }

  // Auth endpoints
  /**
   *
   * @param credentials
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH ?? this.useV2;

    if (useV2) {
      // Use API client for v2
      const response = await apiClient.post<{
        accessToken?: string;
        refreshToken?: string;
        user?: User;
      }>('/auth/login', credentials);

      // v2 response format has accessToken and refreshToken
      if (
        response.accessToken !== undefined &&
        response.accessToken !== '' &&
        response.refreshToken !== undefined &&
        response.refreshToken !== ''
      ) {
        this.setToken(response.accessToken, response.refreshToken);

        // Convert v2 response to v1 format for compatibility
        return {
          token: response.accessToken,
          user: response.user,
          role: response.user?.role,
          message: 'Login successful',
        } as LoginResponse;
      }

      throw new Error('Invalid response format');
    } else {
      // Use v1 implementation
      const response = await this.post<LoginResponse>('/auth/login', credentials);
      if (response.token !== '') {
        this.setToken(response.token);
      }
      return response;
    }
  }

  /**
   *
   */
  async logout(): Promise<void> {
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH ?? this.useV2;

    try {
      if (useV2) {
        // Use API client for v2
        await apiClient.post('/auth/logout', {});
      } else {
        // Use v1 implementation
        await this.post('/auth/logout');
      }
    } catch {
      // Ignore logout errors
    } finally {
      this.setToken(null);
      // Safe: window.location is a global property, no race condition possible
      // eslint-disable-next-line require-atomic-updates
      window.location.href = '/login';
    }
  }

  /**
   *
   */
  async checkAuth(): Promise<ApiResponse<{ authenticated: boolean }>> {
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH ?? this.useV2;

    if (useV2) {
      try {
        const response = await apiClient.get<{ valid?: boolean; message?: string }>('/auth/validate');
        // Convert v2 response to v1 format
        return {
          success: response.valid === true,
          data: { authenticated: response.valid === true },
          message: response.message ?? 'Authentication check complete',
        };
      } catch (error) {
        return {
          success: false,
          data: { authenticated: false },
          message: (error as Error).message,
        };
      }
    } else {
      return await this.get('/auth/check');
    }
  }

  // User endpoints
  /**
   *
   */
  async getProfile(): Promise<User> {
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH ?? this.useV2;

    if (useV2) {
      const response = await apiClient.get<User>('/users/me');
      // Convert v2 response (camelCase) to v1 format (snake_case)
      return ResponseAdapter.adaptUserResponse(response) as User;
    } else {
      return await this.get<User>('/user/profile');
    }
  }

  /**
   *
   * @param data
   */
  async updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH ?? this.useV2;

    if (useV2) {
      try {
        // Convert v1 format (snake_case) to v2 format (camelCase) for request
        const v2Data = ResponseAdapter.adaptUserRequest(data);
        const response = await apiClient.patch('/users/me', v2Data);
        // Convert v2 response back to v1 format
        const adaptedUser = ResponseAdapter.adaptUserResponse(response) as User;
        return {
          success: true,
          data: adaptedUser,
          message: 'Profile updated successfully',
        };
      } catch (error) {
        return {
          success: false,
          message: (error as Error).message,
        };
      }
    } else {
      return await this.patch('/user/profile', data);
    }
  }

  /**
   *
   * @param file
   */
  async uploadProfilePicture(file: File): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('profilePicture', file);

    return await this.post('/user/profile-picture', formData);
  }

  // Document endpoints
  /**
   *
   * @param params
   */
  async getDocuments(params?: PaginationParams & { category?: string }): Promise<PaginatedResponse<Document>> {
    const queryParams = params ? ({ ...params } as Record<string, string | number | boolean>) : undefined;
    return await this.get('/documents', queryParams);
  }

  /**
   *
   * @param id
   */
  async getDocument(id: number): Promise<Document> {
    return await this.get(`/documents/${id}`);
  }

  /**
   *
   * @param formData
   */
  async uploadDocument(formData: FormData): Promise<ApiResponse<Document>> {
    return await this.post('/documents', formData);
  }

  /**
   *
   * @param id
   */
  async deleteDocument(id: number): Promise<ApiResponse> {
    return await this.delete(`/documents/${id}`);
  }

  // Employee endpoints
  /**
   *
   * @param params
   */
  async getEmployees(params?: PaginationParams): Promise<PaginatedResponse<User>> {
    const queryParams = params ? ({ ...params } as Record<string, string | number | boolean>) : undefined;
    return await this.get('/users', queryParams);
  }

  /**
   *
   * @param id
   */
  async getEmployee(id: number): Promise<User> {
    return await this.get(`/users/${id}`);
  }

  /**
   *
   * @param data
   */
  async createEmployee(data: Partial<User>): Promise<ApiResponse<User>> {
    return await this.post('/users', data);
  }

  /**
   *
   * @param id
   * @param data
   */
  async updateEmployee(id: number, data: Partial<User>): Promise<ApiResponse<User>> {
    return await this.patch(`/users/${id}`, data);
  }

  /**
   *
   * @param id
   */
  async deleteEmployee(id: number): Promise<ApiResponse> {
    return await this.delete(`/users/${id}`);
  }
}

// Create default instance
const apiService = new ApiService();

// Export default instance
export default apiService;

// Extend window for API service
declare global {
  interface Window {
    ApiService: typeof ApiService;
    apiService: ApiService;
  }
}

// Also export for backwards compatibility
if (typeof window !== 'undefined') {
  window.ApiService = ApiService;
  window.apiService = apiService;
}
