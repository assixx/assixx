/**
 * API Client - Types, Interfaces, and Error Class
 *
 * Shared type definitions for the API client module.
 * Separated from api-client.ts to keep files within the 400-line limit.
 */

import type { LogoutReason } from './auth-types';

// =============================================================================
// AUTH TOKEN PROVIDER INTERFACE
// =============================================================================

/**
 * AuthTokenProvider - Abstraction layer for token management.
 *
 * PURPOSE: Decouples ApiClient from concrete TokenManager implementation.
 *
 * BENEFITS:
 * 1. TESTABILITY: Mock the provider in unit tests
 * 2. FLEXIBILITY: Swap token storage (localStorage → sessionStorage → cookie)
 * 3. SSR-SAFETY: Provider handles browser checks
 * 4. DECOUPLING: No direct dependency on TokenManager internals
 *
 * USAGE:
 * ```typescript
 * // In app initialization (e.g., +layout.svelte)
 * import { getApiClient } from '$lib/utils/api-client';
 * import { getTokenManager } from '$lib/utils/token-manager';
 *
 * getApiClient().setAuthProvider({
 *   getAccessToken: () => getTokenManager().getAccessToken(),
 *   getRefreshToken: () => getTokenManager().getRefreshToken(),
 *   refreshIfNeeded: () => getTokenManager().refreshIfNeeded(),
 *   clearTokens: (reason) => getTokenManager().clearTokens(reason),
 * });
 * ```
 *
 * TESTING:
 * ```typescript
 * const mockProvider: AuthTokenProvider = {
 *   getAccessToken: () => 'mock-token',
 *   getRefreshToken: () => 'mock-refresh',
 *   refreshIfNeeded: async () => true,
 *   clearTokens: vi.fn(),
 * };
 * apiClient.setAuthProvider(mockProvider);
 * ```
 */
export interface AuthTokenProvider {
  /** Get current access token for Authorization header */
  getAccessToken(): string | null;

  /** Get refresh token (used to check if refresh is possible) */
  getRefreshToken(): string | null;

  /** Refresh tokens if needed. Returns true if refresh succeeded or wasn't needed */
  refreshIfNeeded(): Promise<boolean>;

  /** Clear all tokens and redirect to login (reason determines redirect params) */
  clearTokens(reason: LogoutReason): void;
}

// =============================================================================
// REQUEST CONFIGURATION
// =============================================================================

/** Default request timeout in milliseconds */
export const DEFAULT_TIMEOUT_MS = 30_000;

export interface ApiConfig {
  version?: 'v2' | undefined; // Always v2
  useAuth?: boolean | undefined;
  contentType?: string | null | undefined;
  /** Skip cache for this request */
  skipCache?: boolean | undefined;
  /** Custom TTL for this request (ms) */
  cacheTtl?: number | undefined;
  /** AbortSignal for request cancellation (e.g., on component unmount) */
  signal?: AbortSignal | undefined;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number | undefined;
  /** Suppress error logging for expected failures (e.g., optional settings lookup) */
  silent?: boolean | undefined;
}

export interface ApiResponseWrapper<T = unknown> {
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

// =============================================================================
// API ERROR CLASS
// =============================================================================

/**
 * Custom API Error class with status code and error code.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// =============================================================================
// ERROR MESSAGE EXTRACTION
// =============================================================================

/** Type guard for validation detail objects from API error responses */
function isValidationDetail(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

/**
 * Extract user-friendly message from API error, including field-level validation details.
 * Falls back to err.message, then to the provided fallback string.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) {
    return err instanceof Error ? err.message : fallback;
  }

  if (Array.isArray(err.details) && err.details.length > 0) {
    const messages = err.details.filter(isValidationDetail).map((d) => d.message);
    if (messages.length > 0) return messages.join(', ');
  }

  return err.message;
}

// Re-export types for consumers
export type { LogoutReason };
