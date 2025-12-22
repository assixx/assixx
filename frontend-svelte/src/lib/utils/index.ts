/**
 * Utils Barrel Export
 * 1:1 mirrored structure from frontend/src/utils/
 *
 * Usage:
 * import { getAuthToken, formatDate, parseJwt } from '$lib/utils';
 */

// Auth utilities (auth.ts + auth-helpers.ts combined)
export {
  // Token management
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  removeAuthToken,
  getAuthHeader,
  // Role management
  getUserRole,
  getActiveRole,
  setUserRole,
  setActiveRole,
  clearUserRole,
  // Role checks
  isAuthenticated,
  isAdmin,
  isRoot,
  isEmployee,
  hasPermission,
  hasExactRole,
  // Permission checks
  canPerformAdminActions,
  canManageUsers,
  canManageDepartments,
  canManageTeams,
  canViewAllEmployees,
  // Display helpers
  getRoleDisplayName,
  // Full logout
  logout,
  // Type
  type UserRole,
} from './auth';

// JWT utilities
export { parseJwt, isTokenExpired, getTokenExpiryTime, type JWTPayload } from './jwt-utils';

// Date helpers
export {
  formatDate,
  formatDateTime,
  formatTime,
  formatRelativeDate,
  isToday,
  isWithinDays,
} from './date-helpers';

// Token manager (singleton)
export { TokenManager, getTokenManager, type LogoutReason } from './token-manager';

// HTML sanitization (XSS prevention)
export {
  sanitizeHtml,
  sanitizeWithLineBreaks,
  escapeHtml,
  containsDangerousHtml,
} from './sanitize-html';

// API Client
export { ApiClient, ApiError, getApiClient, apiClient } from './api-client';

// Password strength (lazy-loaded zxcvbn-ts)
export {
  initPasswordStrength,
  checkPasswordStrength,
  analyzePassword,
  getStrengthLabel,
  getStrengthColor,
  getStrengthClass,
  formatCrackTime,
  isPasswordStrengthLoading,
  isPasswordStrengthReady,
  type PasswordStrengthResult,
} from './password-strength';

// Session manager (singleton) - handles inactivity timeout + warning modal
export { SessionManager, getSessionManager } from './session-manager';

// Avatar helpers (color assignment + initials)
export { getAvatarColor, getAvatarColorClass, getInitials } from './avatar-helpers';
