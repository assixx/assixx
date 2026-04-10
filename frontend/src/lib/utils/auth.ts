/**
 * Centralized Auth Utilities
 * 1:1 Copy from frontend/src/utils/auth-helpers.ts + extended for SvelteKit
 *
 * WHY: Prevents typos like 'token' vs 'auth_token' that TypeScript/ESLint can't catch
 *
 * IMPORTANT: Keys must match Vite frontend (frontend/src/scripts/auth/index.ts)
 * - Primary: 'accessToken' (v2 API)
 * - Legacy: 'token' (backward compatibility)
 */

import { createLogger } from './logger';

// Valid user roles in the system - single source of truth from @assixx/shared
import type { UserRole } from '@assixx/shared';

const log = createLogger('Auth');

// Storage key constants - MUST match Vite frontend!
// NOTE: REFRESH_TOKEN is now stored as HttpOnly cookie, not in localStorage
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken', // Primary (v2)
  // REFRESH_TOKEN: NOT used anymore - stored in HttpOnly cookie by backend
  TOKEN_LEGACY: 'token', // Legacy compatibility
  TOKEN_RECEIVED_AT: 'tokenReceivedAt', // Clock skew fix
  USER_ROLE: 'userRole',
  ACTIVE_ROLE: 'activeRole',
} as const;

export type { UserRole } from '@assixx/shared';

// =============================================================================
// SSR SAFETY HELPER
// =============================================================================

/**
 * Check if we're running in browser (not SSR)
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

// =============================================================================
// TOKEN MANAGEMENT
// =============================================================================

/** Get the auth token from localStorage. Matches Vite: getAuthToken() in auth/index.ts. */
export function getAuthToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Set the auth token in localStorage.
 *
 * NOTE: Only stores accessToken. The refreshToken is now stored as an HttpOnly cookie
 * by the backend - it cannot and should not be stored via JavaScript.
 */
export function setAuthToken(token: string): void {
  if (!isBrowser()) return;
  // Primary: accessToken
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  // Legacy: token (for backward compatibility)
  localStorage.setItem(STORAGE_KEYS.TOKEN_LEGACY, token);
  // Token received timestamp (for clock skew fix)
  localStorage.setItem(STORAGE_KEYS.TOKEN_RECEIVED_AT, Date.now().toString());
  // NOTE: refreshToken is NOT stored in localStorage anymore (HttpOnly cookie)
}

// =============================================================================
// ROLE MANAGEMENT (from Vite auth-helpers.ts)
// =============================================================================

/**
 * Get the current user's role from localStorage
 * Returns null if no role is set or if the value is empty
 */
export function getUserRole(): UserRole | null {
  if (!isBrowser()) return null;

  const role = localStorage.getItem(STORAGE_KEYS.USER_ROLE);

  // Explicit null and empty string check as per TYPESCRIPT-STANDARDS.md
  if (role === null || role === '') {
    return null;
  }

  // Validate that the role is a valid UserRole
  if (role === 'root' || role === 'admin' || role === 'employee') {
    return role;
  }

  // Invalid role value, log warning and return null
  log.warn({ role }, 'Invalid user role found in localStorage');
  return null;
}

/**
 * Set user role in localStorage (for login)
 * Returns true if successful, false if invalid role
 */
export function setUserRole(role: string): boolean {
  if (!isBrowser()) return false;

  // Validate role
  if (role !== 'root' && role !== 'admin' && role !== 'employee') {
    log.error({ role }, 'Attempted to set invalid user role');
    return false;
  }

  localStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
  return true;
}

// =============================================================================
// ACTIVE ROLE MANAGEMENT (localStorage + Cookie for SSR)
// =============================================================================

/**
 * Set the active role in localStorage AND as a cookie.
 * The cookie enables SSR to render the role-switch banner without waiting for hydration.
 * Not a security concern — activeRole is pure UI state ('admin'/'root'/'employee'),
 * not an auth token. All real auth decisions use the JWT httpOnly cookie.
 */
export function setActiveRole(role: string): void {
  if (!isBrowser()) return;
  if (role !== 'root' && role !== 'admin' && role !== 'employee') {
    log.error({ role }, 'Attempted to set invalid active role');
    return;
  }
  localStorage.setItem(STORAGE_KEYS.ACTIVE_ROLE, role);
  document.cookie = `activeRole=${role}; path=/; SameSite=Strict; max-age=86400`;
}

/**
 * Clear the active role from localStorage AND cookie (logout / session destroy).
 */
export function clearActiveRole(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_ROLE);
  document.cookie = 'activeRole=; path=/; max-age=0';
}

// =============================================================================
// ROLE CHECKS (from Vite auth-helpers.ts)
// =============================================================================

/**
 * Check if user is authenticated (has any valid role)
 */
export function isAuthenticated(): boolean {
  const token = getAuthToken();
  const role = getUserRole();
  return token !== null && role !== null;
}

/**
 * Check if the user has at least the specified permission level
 * Permission hierarchy: root > admin > employee
 */
export function hasPermission(requiredRole: UserRole): boolean {
  const role = getUserRole();

  if (role === null) {
    return false;
  }

  // Root has all permissions
  if (role === 'root') {
    return true;
  }

  // Admin has admin and employee permissions
  if (role === 'admin') {
    return requiredRole === 'admin' || requiredRole === 'employee';
  }

  // Employee only has employee permission
  return requiredRole === 'employee';
}

// =============================================================================
// DISPLAY HELPERS (from Vite auth-helpers.ts)
// =============================================================================

/**
 * Get the display name for a role
 */
export function getRoleDisplayName(role: UserRole | null): string {
  if (role === null) {
    return 'Unbekannt';
  }

  switch (role) {
    case 'root':
      return 'Root';
    case 'admin':
      return 'Admin';
    case 'employee':
      return 'Mitarbeiter';
    default:
      return 'Unbekannt';
  }
}
