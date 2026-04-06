/**
 * Utils Barrel Export
 * 1:1 mirrored structure from frontend/src/utils/
 *
 * Usage:
 * import { getAuthToken, formatDate, parseJwt } from '$lib/utils';
 */

// Auth utilities (auth.ts + auth-helpers.ts combined)
// NOTE: getRefreshToken is NOT exported - use getTokenManager().getRefreshToken() instead
// Refresh tokens are now stored in HttpOnly cookies (not accessible via JS)
export {
  // Token management
  getAuthToken,
  setAuthToken,
  // Role management
  getUserRole,
  setUserRole,
  // Active role (localStorage + Cookie for SSR banner)
  setActiveRole,
  clearActiveRole,
  // Role checks
  isAuthenticated,
  hasPermission,
  // Display helpers
  getRoleDisplayName,
  // Type
  type UserRole,
} from './auth';

// JWT utilities
export { parseJwt } from './jwt-utils';

// Date helpers
export { formatDate, formatDateTime, formatTime, formatRelativeDate } from './date-helpers';

// Token manager (singleton)
export { TokenManager, getTokenManager, type LogoutReason } from './token-manager';

// HTML sanitization (XSS prevention)
export { sanitizeHtml, sanitizeWithLineBreaks, escapeHtml } from './sanitize-html';

// API Client
export { ApiClient, ApiError, getApiClient, apiClient } from './api-client';

// Password strength (lazy-loaded zxcvbn-ts)
export { analyzePassword, type PasswordStrengthResult } from './password-strength';

// Session manager (singleton) - handles inactivity timeout + warning modal
export { SessionManager, getSessionManager } from './session-manager';

// Avatar helpers (color assignment + initials)
export { getAvatarColor, getAvatarColorClass, getInitials } from './avatar-helpers';

// Alert utilities (toast notifications + confirm dialogs)
export {
  showAlert,
  showErrorAlert,
  showSuccessAlert,
  showWarningAlert,
  showConfirm,
  showConfirmDanger,
  showConfirmWarning,
} from './alerts';

// Organization filter utilities (Area/Department inheritance)
export {
  filterAvailableDepartments,
  filterDepartmentIdsByAreas,
  filterAvailableTeams,
  filterTeamIdsByDepartments,
  type FilterableDepartment,
  type FilterableTeam,
} from './org-filter';
