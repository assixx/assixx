import { randomUUID } from "crypto";

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
}

/**
 * Successful API response structure
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    version: string;
    pagination?: PaginationMeta;
  };
}

/**
 * Error API response structure
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: {
      field: string;
      message: string;
    }[];
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

/**
 * Create a successful API response
 * @param data - The response data
 * @param message - Optional message (deprecated, kept for compatibility)
 * @returns Formatted success response
 */
export function successResponse<T>(
  data: T,
  _message?: string,
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: "2.0",
    },
  };
}

/**
 * Create an error API response
 * @param code - Error code (e.g., 'VALIDATION_ERROR', 'NOT_FOUND')
 * @param message - Human-readable error message
 * @param details - Optional array of detailed error information
 * @returns Formatted error response
 */
export function errorResponse(
  code: string,
  message: string,
  details?: {
    field: string;
    message: string;
  }[],
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
    },
  };
}

/**
 * Create a paginated success response
 * @param data - The response data
 * @param pagination - Pagination metadata
 * @returns Formatted success response with pagination
 */
export function paginatedResponse<T>(
  data: T,
  pagination: PaginationMeta,
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: "2.0",
      pagination,
    },
  };
}
