/**
 * Central Response Type Definitions
 * Standardized response formats for API consistency
 */

// Base API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp?: string;
}

// Paginated Response
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Error Response
export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  statusCode: number;
  details?: unknown;
  timestamp: string;
}

// Validation Error Response
export interface ValidationErrorResponse extends ErrorResponse {
  errors: Array<{
    field: string;
    message: string;
    value?: unknown;
  }>;
}

// Auth Response Types
export interface LoginResponse {
  success: boolean;
  token: string;
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
    tenantId: number;
    tenantName?: string;
  };
  expiresIn: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  token: string;
  expiresIn: string;
}

// File Upload Response
export interface FileUploadResponse {
  success: boolean;
  file: {
    id: number;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url?: string;
  };
}

// Batch Operation Response
export interface BatchOperationResponse {
  success: boolean;
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    id: number | string;
    success: boolean;
    error?: string;
  }>;
}

// Health Check Response
export interface HealthCheckResponse {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: boolean;
    redis?: boolean;
    email?: boolean;
  };
}

// Statistics Response
export interface StatsResponse {
  success: boolean;
  stats: {
    [key: string]: number | string;
  };
  period?: {
    start: string;
    end: string;
  };
}

// Generic CRUD Response Types
export interface CreateResponse<T> extends ApiResponse<T> {
  id: number;
}

export interface UpdateResponse<T> extends ApiResponse<T> {
  updated: boolean;
}

export interface DeleteResponse {
  success: boolean;
  deleted: boolean;
  id: number;
}

// List Response with optional filters
export interface ListResponse<T> extends ApiResponse<T[]> {
  count: number;
  filters?: {
    [key: string]: unknown;
  };
}

// Response Helper Functions
export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

export function errorResponse(
  error: string,
  statusCode: number = 500,
  code?: string
): ErrorResponse {
  return {
    success: false,
    error,
    code,
    statusCode,
    timestamp: new Date().toISOString(),
  };
}

export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
