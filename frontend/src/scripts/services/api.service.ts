/**
 * API Service
 * Centralized API communication with TypeScript
 */

import type { ApiResponse, User, LoginRequest, LoginResponse, Document } from '../../types/api.types';
import type { PaginationParams, PaginatedResponse } from '../../types/utils.types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

export class ApiService {
  private baseURL: string;
  private token: string | null;

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('token');
  }

  /**
   * Set authentication token
   */
  setToken(token: string | null): void {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
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
      ...customHeaders,
    });

    if (this.token) {
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
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
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
    const url = this.buildUrl(endpoint, params);

    const requestOptions: RequestInit = {
      method,
      headers: this.getHeaders(fetchOptions.headers),
      ...fetchOptions,
    };

    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      if (data instanceof FormData) {
        // Remove Content-Type header for FormData
        requestOptions.headers = new Headers(requestOptions.headers);
        (requestOptions.headers as Headers).delete('Content-Type');
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
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error ?? responseData.message ?? `HTTP error! status: ${response.status}`);
      }

      return responseData as T;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Convenience methods
  get<T = unknown>(endpoint: string, params?: Record<string, string | number | boolean>): Promise<T> {
    return this.request<T>('GET', endpoint, null, { params });
  }

  post<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>('POST', endpoint, data);
  }

  put<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>('PUT', endpoint, data);
  }

  patch<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>('PATCH', endpoint, data);
  }

  delete<T = unknown>(endpoint: string): Promise<T> {
    return this.request<T>('DELETE', endpoint);
  }

  // Auth endpoints
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.post<LoginResponse>('/auth/login', credentials);
    if (response.token) {
      this.setToken(response.token);
    }
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.post('/auth/logout');
    } catch {
      // Ignore logout errors
    } finally {
      this.setToken(null);
      window.location.href = '/login';
    }
  }

  checkAuth(): Promise<ApiResponse<{ authenticated: boolean }>> {
    return this.get('/auth/check');
  }

  // User endpoints
  getProfile(): Promise<User> {
    return this.get<User>('/user/profile');
  }

  updateProfile(data: Partial<User>): Promise<ApiResponse<User>> {
    return this.patch('/user/profile', data);
  }

  uploadProfilePicture(file: File): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('profilePicture', file);

    return this.post('/user/profile-picture', formData);
  }

  // Document endpoints
  getDocuments(params?: PaginationParams & { category?: string }): Promise<PaginatedResponse<Document>> {
    const queryParams = params ? ({ ...params } as Record<string, string | number | boolean>) : undefined;
    return this.get('/documents', queryParams);
  }

  getDocument(id: number): Promise<Document> {
    return this.get(`/documents/${id}`);
  }

  uploadDocument(formData: FormData): Promise<ApiResponse<Document>> {
    return this.post('/documents', formData);
  }

  deleteDocument(id: number): Promise<ApiResponse> {
    return this.delete(`/documents/${id}`);
  }

  // Employee endpoints
  getEmployees(params?: PaginationParams): Promise<PaginatedResponse<User>> {
    const queryParams = params ? ({ ...params } as Record<string, string | number | boolean>) : undefined;
    return this.get('/users', queryParams);
  }

  getEmployee(id: number): Promise<User> {
    return this.get(`/users/${id}`);
  }

  createEmployee(data: Partial<User>): Promise<ApiResponse<User>> {
    return this.post('/users', data);
  }

  updateEmployee(id: number, data: Partial<User>): Promise<ApiResponse<User>> {
    return this.patch(`/users/${id}`, data);
  }

  deleteEmployee(id: number): Promise<ApiResponse> {
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
