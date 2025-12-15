/**
 * JWT Token Configuration
 *
 * SINGLE SOURCE OF TRUTH for all token expiration times.
 *
 * CRITICAL: All token generation MUST use these constants to ensure consistency.
 * Inconsistent token lifetimes are a SECURITY RISK!
 *
 * History:
 * - 2025-11-07: Created to fix inconsistent token expiry (role-switch used 24h instead of 30m!)
 *
 * @see backend/src/routes/v2/auth/auth.controller.ts
 * @see backend/src/routes/v2/role-switch/role-switch.service.ts
 * @see backend/src/auth.ts (v1 legacy)
 */

/**
 * Access Token Expiration Time
 *
 * MUST be consistent across ALL token generation:
 * - Normal login (auth.controller.ts)
 * - Role switching (role-switch.service.ts)
 * - Legacy v1 auth (auth.ts)
 *
 * Value: 30 minutes (1800 seconds)
 * Rationale: Balance between security (short-lived) and UX (not too frequent re-auth)
 */
export const ACCESS_TOKEN_EXPIRES = '30m';

/**
 * Refresh Token Expiration Time
 *
 * Used to obtain new access tokens without re-login.
 *
 * Value: 7 days
 * Rationale: Long enough for "remember me" UX, short enough for security
 */
export const REFRESH_TOKEN_EXPIRES = '7d';

/**
 * Token Expiration in Seconds (for calculations)
 *
 * Used by frontend TokenManager for countdown timers.
 */
export const ACCESS_TOKEN_EXPIRES_SECONDS = 30 * 60; // 1800 seconds
export const REFRESH_TOKEN_EXPIRES_SECONDS = 7 * 24 * 60 * 60; // 604800 seconds
