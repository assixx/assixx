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

// Valid user roles in the system
export type UserRole = 'root' | 'admin' | 'employee';

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

/**
 * Get the auth token from localStorage
 * Matches Vite: getAuthToken() in auth/index.ts
 * @returns The token or null if not found
 */
export function getAuthToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/**
 * Get refresh token status.
 *
 * INTERNAL USE ONLY - Do not import directly!
 * Use getTokenManager().getRefreshToken() instead.
 *
 * IMPORTANT: The actual refresh token is now in an HttpOnly cookie (cannot be read by JS).
 * This function returns a placeholder if user appears logged in (has accessToken).
 * Kept for internal backward compatibility only - NOT exported from index.ts.
 */
export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  // Can't read HttpOnly cookie, but assume it exists if we have accessToken
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  return accessToken !== null ? 'HTTPONLY_COOKIE' : null;
}

/**
 * Set the auth token in localStorage.
 *
 * NOTE: Only stores accessToken. The refreshToken is now stored as an HttpOnly cookie
 * by the backend - it cannot and should not be stored via JavaScript.
 *
 * @param token The access token to store
 * @param _refreshToken DEPRECATED: Ignored. Refresh token is set as HttpOnly cookie by backend.
 */
export function setAuthToken(token: string, _refreshToken?: string): void {
  if (!isBrowser()) return;
  // Primary: accessToken
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  // Legacy: token (for backward compatibility)
  localStorage.setItem(STORAGE_KEYS.TOKEN_LEGACY, token);
  // Token received timestamp (for clock skew fix)
  localStorage.setItem(STORAGE_KEYS.TOKEN_RECEIVED_AT, Date.now().toString());
  // NOTE: refreshToken is NOT stored in localStorage anymore (HttpOnly cookie)
}

/**
 * Remove the auth token (logout)
 *
 * NOTE: The HttpOnly refresh token cookie is cleared by the backend on /auth/logout.
 * This function only clears localStorage items that JavaScript can access.
 */
export function removeAuthToken(): void {
  if (!isBrowser()) return;

  // ===========================================
  // AUTH TOKENS (CRITICAL - must be cleared)
  // ===========================================
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  // NOTE: refreshToken is in HttpOnly cookie, cleared by backend on logout
  localStorage.removeItem(STORAGE_KEYS.TOKEN_RECEIVED_AT);
  localStorage.removeItem(STORAGE_KEYS.TOKEN_LEGACY);
  localStorage.removeItem('authToken'); // Legacy v1 token

  // ===========================================
  // USER DATA
  // ===========================================
  localStorage.removeItem('user');
  localStorage.removeItem('role'); // Legacy role
  clearUserRole(); // Clears userRole + activeRole

  // NOTE: HttpOnly cookies (refreshToken) are cleared by backend on /auth/logout
}

/**
 * Build Authorization header
 */
export function getAuthHeader(): Record<string, string> {
  const token = getAuthToken();
  if (token === null) return {};
  return { Authorization: `Bearer ${token}` };
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
 * Get the active role (for role switching functionality)
 * Falls back to getUserRole if no active role is set
 */
export function getActiveRole(): UserRole | null {
  if (!isBrowser()) return null;

  const activeRole = localStorage.getItem(STORAGE_KEYS.ACTIVE_ROLE);

  // Explicit null and empty string check and validate that the role is a valid UserRole
  if (
    activeRole !== null &&
    activeRole !== '' &&
    (activeRole === 'root' || activeRole === 'admin' || activeRole === 'employee')
  ) {
    return activeRole;
  }

  // Fall back to user's actual role
  return getUserRole();
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

/**
 * Set active role for role switching
 * Returns true if successful, false if invalid role or insufficient permissions
 */
export function setActiveRole(targetRole: UserRole): boolean {
  if (!isBrowser()) return false;

  const currentRole = getUserRole();

  if (currentRole === null) {
    return false;
  }

  // Validate that user can switch to target role
  if (targetRole === 'root' && currentRole !== 'root') {
    log.warn({ targetRole, currentRole }, 'Only root users can switch to root role');
    return false;
  }

  if (targetRole === 'admin' && currentRole === 'employee') {
    log.warn({ targetRole, currentRole }, 'Employees cannot switch to admin role');
    return false;
  }

  localStorage.setItem(STORAGE_KEYS.ACTIVE_ROLE, targetRole);
  return true;
}

/**
 * Clear user role from localStorage (for logout)
 */
export function clearUserRole(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_ROLE);
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
 * Check if the current user is an admin (admin or root)
 */
export function isAdmin(): boolean {
  const role = getUserRole();
  return role === 'admin' || role === 'root';
}

/**
 * Check if the current user is root
 */
export function isRoot(): boolean {
  const role = getUserRole();
  return role === 'root';
}

/**
 * Check if the current user is an employee
 */
export function isEmployee(): boolean {
  const role = getUserRole();
  return role === 'employee';
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

/**
 * Check if the user has exactly the specified role
 */
export function hasExactRole(targetRole: UserRole): boolean {
  const role = getUserRole();
  return role === targetRole;
}

// =============================================================================
// PERMISSION CHECKS (from Vite auth-helpers.ts)
// =============================================================================

/**
 * Check if user can perform administrative actions
 * (Same as isAdmin but more semantic)
 */
export function canPerformAdminActions(): boolean {
  return isAdmin();
}

/**
 * Check if user can access user management features
 */
export function canManageUsers(): boolean {
  return isAdmin();
}

/**
 * Check if user can access department management
 */
export function canManageDepartments(): boolean {
  return isAdmin();
}

/**
 * Check if user can access team management
 */
export function canManageTeams(): boolean {
  return isAdmin();
}

/**
 * Check if user can view all employees
 */
export function canViewAllEmployees(): boolean {
  return isAdmin();
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

// =============================================================================
// FULL LOGOUT (combines token + role cleanup)
// =============================================================================

/**
 * Full logout - clears ALL auth and session data
 * Call this when user logs out manually or session expires
 */
export function logout(): void {
  if (!isBrowser()) return;

  // ===========================================
  // STEP 1: Clear auth tokens (via removeAuthToken)
  // ===========================================
  removeAuthToken();

  // ===========================================
  // STEP 2: Clear session data
  // ===========================================
  localStorage.removeItem('tenantId');
  localStorage.removeItem('lastActivity');

  // ===========================================
  // STEP 3: Clear fingerprint data
  // ===========================================
  localStorage.removeItem('browserFingerprint');
  localStorage.removeItem('fingerprintTimestamp');

  // ===========================================
  // STEP 4: Clear UI state (clean slate on next login)
  // ===========================================
  localStorage.removeItem('sidebarCollapsed');
  localStorage.removeItem('openSubmenu');
  localStorage.removeItem('activeNavigation');
  localStorage.removeItem('profilePictureCache');

  // ===========================================
  // STEP 5: Clear feature-specific state
  // ===========================================
  localStorage.removeItem('lastKvpClickTimestamp');
  localStorage.removeItem('lastKnownKvpCount');
  localStorage.removeItem('shifts_context');
  localStorage.removeItem('rateLimitTimestamp');
}
