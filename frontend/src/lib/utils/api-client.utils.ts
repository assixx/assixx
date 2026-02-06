/**
 * API Client - Pure Utility Functions
 *
 * Stateless helper functions extracted from ApiClient.
 * None of these access class state (no `this`).
 */

import { ApiError, type ApiConfig } from './api-client.types';

// =============================================================================
// ABORT SIGNAL UTILITIES
// =============================================================================

/**
 * Combine multiple AbortSignals into one.
 * The combined signal aborts when ANY of the input signals abort.
 */
export function combineSignals(
  ...signals: (AbortSignal | undefined)[]
): AbortSignal {
  const controller = new AbortController();
  const validSignals = signals.filter((s): s is AbortSignal => s !== undefined);

  for (const signal of validSignals) {
    // If already aborted, abort immediately
    if (signal.aborted) {
      // AbortSignal.reason is typed as 'any' in DOM lib - explicitly type it
      const abortReason: unknown = signal.reason;
      controller.abort(abortReason);
      return controller.signal;
    }

    // Listen for abort on each signal
    signal.addEventListener(
      'abort',
      () => {
        // AbortSignal.reason is typed as 'any' in DOM lib - explicitly type it
        const abortReason: unknown = signal.reason;
        controller.abort(abortReason);
      },
      { once: true },
    );
  }

  return controller.signal;
}

/**
 * Create a timeout signal that aborts after the specified duration.
 * Returns both the signal and a cleanup function to clear the timeout.
 */
export function createTimeoutSignal(timeoutMs: number): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException('Request timeout', 'TimeoutError'));
  }, timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
    },
  };
}

// =============================================================================
// ERROR TYPE CHECKS
// =============================================================================

/**
 * Check if error is a timeout error
 */
export function isTimeoutError(error: Error): boolean {
  if (error.name === 'TimeoutError') {
    return true;
  }
  return error instanceof DOMException && error.message === 'Request timeout';
}

/**
 * Check if error is an abort error (expected during navigation)
 */
export function isAbortError(error: Error): boolean {
  if (error.name === 'AbortError') {
    return true;
  }
  return (
    error.message.includes('NetworkError') || error.message.includes('aborted')
  );
}

/**
 * Wrap an unknown error into a typed Error (ApiError or Error)
 */
export function wrapError(error: unknown): Error {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 'NETWORK_ERROR', 0);
  }

  return new ApiError('Unknown error occurred', 'UNKNOWN_ERROR', 0);
}

// =============================================================================
// REQUEST HELPERS
// =============================================================================

/**
 * Determine the Content-Type header value for a request
 */
export function getContentType(
  options: RequestInit,
  config: ApiConfig,
): string | null {
  const hasBody = options.body !== undefined && options.body !== null;
  if (!hasBody) {
    return null;
  }

  // Explicit content type from config
  if (config.contentType !== undefined && config.contentType !== null) {
    return config.contentType;
  }

  // FormData: let browser set Content-Type with boundary
  if (options.body instanceof FormData) {
    return null;
  }

  return 'application/json';
}

/**
 * Determine credentials mode for a request.
 *
 * Auth endpoints need 'include' to send HttpOnly refresh token cookie.
 * Other endpoints use 'omit' to avoid unnecessary cookie transmission.
 */
export function getCredentialsMode(endpoint: string): RequestCredentials {
  // Auth endpoints need cookies for HttpOnly refresh token
  const authEndpoints = ['/auth/login', '/auth/logout', '/auth/refresh'];
  const isAuthEndpoint = authEndpoints.some((auth) =>
    endpoint.startsWith(auth),
  );
  return isAuthEndpoint ? 'include' : 'omit';
}

/**
 * Extract error message and details from API response data
 */
export function extractErrorMessage(data: Record<string, unknown>): {
  message: string;
  details: string;
} {
  const error = data.error as
    | { message?: string; details?: string }
    | undefined;

  const message =
    typeof error?.message === 'string' ? error.message
    : typeof data.error === 'string' ? data.error
    : typeof data.message === 'string' ? data.message
    : '';

  const details =
    typeof data.details === 'string' ? data.details
    : typeof error?.details === 'string' ? error.details
    : '';

  return { message, details };
}

/**
 * Create an ApiError from a non-V2 response
 */
export function createApiError(
  response: Response,
  data: Record<string, unknown>,
): ApiError {
  const error = data.error as
    | { message?: string; code?: string; details?: unknown }
    | undefined;

  const message =
    typeof error?.message === 'string' ? error.message
    : typeof data.message === 'string' ? data.message
    : `Request failed with status ${response.status}`;

  const code = typeof error?.code === 'string' ? error.code : 'API_ERROR';

  return new ApiError(message, code, response.status, error?.details);
}
