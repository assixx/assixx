/**
 * Error handling utilities
 * Centralized error response creation and formatting
 */

/**
 * Generate a unique trace ID for error tracking in production
 * @returns Unique trace ID string in format ERR-timestamp-random
 */
export function generateTraceId(): string {
  return `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create standardized error response object
 * @param code - Error code (e.g., 'VALIDATION_ERROR', 'INTERNAL_SERVER_ERROR')
 * @param message - Human-readable error message
 * @param statusCode - HTTP status code
 * @param details - Optional error details (only shown in development)
 * @returns Object with status code and formatted response body
 */
export function createErrorResponse(
  code: string,
  message: string,
  statusCode: number,
  details?: unknown,
): { status: number; body: object } {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const timestamp = new Date().toISOString();

  return {
    status: statusCode,
    body: {
      success: false,
      error: {
        code,
        message,
        details: isDevelopment ? details : undefined,
      },
      meta: {
        timestamp,
        traceId: !isDevelopment ? generateTraceId() : undefined,
      },
    },
  };
}

/**
 * Common error codes used throughout the application
 */
export const ERROR_CODES = {
  // Client errors (4xx)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Server errors (5xx)
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

/**
 * Type for error codes
 */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
