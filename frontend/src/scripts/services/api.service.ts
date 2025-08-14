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

export class ApiService {
  private baseURL: string;
  private token: string | null;
  private useV2 = false;

  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
    // Check for v2 token first, then v1
    this.token = localStorage.getItem('accessToken') ?? localStorage.getItem('token');
    // Check if any v2 API is enabled
    this.useV2 = window.FEATURE_FLAGS?.USE_API_V2_GLOBAL ?? false;
  }

  /**
   * Set authentication token
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
   * Make API request
   */
  async request<T = unknown>(
    method: HttpMethod,
    endpoint: string,
    data?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const { params, ...fetchOptions } = options ?? {};

    // Check if we should use v2 API
    const featureKey = `USE_API_V2_${endpoint.split('/')[1]?.toUpperCase()}`;
    const useV2ForThisEndpoint = window.FEATURE_FLAGS?.[featureKey] ?? this.useV2;

    if (useV2ForThisEndpoint) {
      // Use new API client for v2
      try {
        let response: unknown;

        // Build query string for GET requests
        const queryString = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
        const fullEndpoint = endpoint + queryString;

        switch (method) {
          case 'GET':
            response = await apiClient.get(fullEndpoint);
            break;
          case 'POST':
            if (data instanceof FormData) {
              response = await apiClient.upload(endpoint, data);
            } else {
              response = await apiClient.post(endpoint, data);
            }
            break;
          case 'PUT':
            response = await apiClient.put(endpoint, data);
            break;
          case 'PATCH':
            response = await apiClient.patch(endpoint, data);
            break;
          case 'DELETE':
            response = await apiClient.delete(endpoint);
            break;
        }

        return response as T;
      } catch (error) {
        console.error('API request failed:', error);
        throw error;
      }
    } else {
      // Use original v1 implementation
      const url = this.buildUrl(endpoint, params);

      const requestOptions: RequestInit = {
        method,
        headers: this.getHeaders(fetchOptions.headers),
        ...fetchOptions,
      };

      if (data !== undefined && data !== null && ['POST', 'PUT', 'PATCH'].includes(method)) {
        if (data instanceof FormData) {
          // Remove Content-Type header for FormData
          requestOptions.headers = new Headers(requestOptions.headers);
          requestOptions.headers.delete('Content-Type');
          requestOptions.body = data;
        } else {
          requestOptions.body = JSON.stringify(data);
        }
      }

      try {
        const response = await fetch(url, requestOptions);

        // Handle 401 Unauthorized
        if (response.status === 401) {
          this.setToken(null);
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
      } catch (error) {
        console.error('API request failed:', error);
        throw error;
      }
    }
  }

  // Convenience methods
  async get<T = unknown>(endpoint: string, params?: Record<string, string | number | boolean>): Promise<T> {
    return this.request<T>('GET', endpoint, null, { params });
  }

  async post<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>('POST', endpoint, data);
  }

  async put<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>('PUT', endpoint, data);
  }

  async patch<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>('PATCH', endpoint, data);
  }

  async delete<T = unknown>(endpoint: string): Promise<T> {
    return this.request<T>('DELETE', endpoint);
  }

  // Auth endpoints
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
      window.location.href = '/login';
    }
  }

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
      return this.get('/auth/check');
    }
  }

  // User endpoints
  async getProfile(): Promise<User> {
    const useV2 = window.FEATURE_FLAGS?.USE_API_V2_AUTH ?? this.useV2;

    if (useV2) {
      const response = await apiClient.get<User>('/users/me');
      // Convert v2 response (camelCase) to v1 format (snake_case)
      return ResponseAdapter.adaptUserResponse(response) as User;
    } else {
      return this.get<User>('/user/profile');
    }
  }

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
      return this.patch('/user/profile', data);
    }
  }

  async uploadProfilePicture(file: File): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('profilePicture', file);

    return this.post('/user/profile-picture', formData);
  }

  // Document endpoints
  async getDocuments(params?: PaginationParams & { category?: string }): Promise<PaginatedResponse<Document>> {
    const queryParams = params ? ({ ...params } as Record<string, string | number | boolean>) : undefined;
    return this.get('/documents', queryParams);
  }

  async getDocument(id: number): Promise<Document> {
    return this.get(`/documents/${id}`);
  }

  async uploadDocument(formData: FormData): Promise<ApiResponse<Document>> {
    return this.post('/documents', formData);
  }

  async deleteDocument(id: number): Promise<ApiResponse> {
    return this.delete(`/documents/${id}`);
  }

  // Employee endpoints
  async getEmployees(params?: PaginationParams): Promise<PaginatedResponse<User>> {
    const queryParams = params ? ({ ...params } as Record<string, string | number | boolean>) : undefined;
    return this.get('/users', queryParams);
  }

  async getEmployee(id: number): Promise<User> {
    return this.get(`/users/${id}`);
  }

  async createEmployee(data: Partial<User>): Promise<ApiResponse<User>> {
    return this.post('/users', data);
  }

  async updateEmployee(id: number, data: Partial<User>): Promise<ApiResponse<User>> {
    return this.patch(`/users/${id}`, data);
  }

  async deleteEmployee(id: number): Promise<ApiResponse> {
    return this.delete(`/users/${id}`);
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
