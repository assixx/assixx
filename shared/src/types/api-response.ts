/**
 * API Response Types
 *
 * Canonical response shapes matching what the backend ResponseInterceptor sends.
 * Both frontend and backend should use these types.
 */

/** Pagination metadata returned by paginated endpoints */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Generic metadata container */
export interface ResponseMeta {
  pagination?: PaginationMeta;
}

/** Successful API response */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp?: string;
  meta?: ResponseMeta;
}

/** Error API response */
export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  /** Error code for programmatic handling */
  code?: string;
  timestamp?: string;
  errors?: ValidationError[];
}

/** Field-level validation error */
export interface ValidationError {
  field: string;
  message: string;
  /** Original value that failed validation */
  value?: unknown;
}

/** Discriminated union of success/error responses */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
