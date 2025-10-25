/**
 * Error handling utilities
 * Centralized error response creation and formatting
 */

/**
 * Generate a unique trace ID for error tracking in production
 * @returns Unique trace ID string in format ERR-timestamp-random
 */
function generateTraceId(): string {
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
