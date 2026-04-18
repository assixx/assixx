/**
 * Audit Trail Constants & Types
 *
 * Single source of truth for audit configuration.
 * Contains all constants, types, and interfaces used across audit modules.
 *
 * @see ADR-009 Central Audit Logging
 */

/**
 * Audit action types - more specific than just HTTP methods
 */
export type AuditAction =
  | 'login'
  | 'logout'
  | 'refresh'
  | 'switch'
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'list'
  | 'export';

/**
 * Audit trail status type matching database enum
 */
export type AuditStatus = 'success' | 'failure';

/**
 * Sensitive fields that should NEVER be logged (OWASP, GDPR compliance).
 * These are removed from request bodies before storing in audit trail.
 *
 * ALL entries MUST be lowercase — sanitizeData() compares via key.toLowerCase().
 */
export const SENSITIVE_FIELDS: readonly string[] = [
  // Authentication & Security
  'password',
  'passwordhash',
  'password_hash',
  'currentpassword',
  'current_password',
  'newpassword',
  'new_password',
  'confirmpassword',
  'confirm_password',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'secret',
  'apikey',
  'api_key',
  'privatekey',
  'private_key',
  // Personal Identifiable Information (GDPR)
  'ssn',
  'socialsecurity',
  'social_security',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'pin',
] as const;

/**
 * Resource type to database table mapping for DELETE pre-fetch.
 * Maps the extracted resource type to the actual table name and name field.
 */
export const RESOURCE_TABLE_MAP: Record<string, { table: string; nameField: string }> = {
  user: { table: 'users', nameField: 'username' },
  department: { table: 'departments', nameField: 'name' },
  team: { table: 'teams', nameField: 'name' },
  area: { table: 'areas', nameField: 'name' },
  asset: { table: 'assets', nameField: 'name' },
  blackboard: { table: 'blackboard_entries', nameField: 'title' },
  calendar: { table: 'calendar_events', nameField: 'title' },
  document: { table: 'documents', nameField: 'original_filename' },
  kvp: { table: 'kvp_suggestions', nameField: 'title' },
  survey: { table: 'surveys', nameField: 'title' },
  notification: { table: 'notifications', nameField: 'title' },
  shift: { table: 'shifts', nameField: 'date' },
  'shift-plan': { table: 'shift_plans', nameField: 'name' },
  addon: { table: 'tenant_addons', nameField: 'addon_id' },
  setting: { table: 'tenant_settings', nameField: 'setting_key' },
  role: { table: 'roles', nameField: 'name' },
  // Admin management resources
  // NOTE: 'admin-permission' intentionally NOT mapped here — it's an AGGREGATED
  // resource (users.has_full_access + admin_area_permissions +
  // admin_department_permissions). Handled by dedicated fetchers in
  // AuditMetadataService (fetchAdminPermissionSnapshot / fetchAdminPermissionName).
  // Previous entry pointed at non-existent table "admin_permissions" and
  // caused spurious ERROR logs on every admin permission change.
  tenant: { table: 'tenants', nameField: 'company_name' },
  // Vacation module resources (ADR-023)
  request: { table: 'vacation_requests', nameField: 'id' },
  blackout: { table: 'vacation_blackouts', nameField: 'name' },
  holiday: { table: 'vacation_holidays', nameField: 'name' },
  'staffing-rule': { table: 'vacation_staffing_rules', nameField: 'id' },
  entitlement: { table: 'vacation_entitlements', nameField: 'id' },
  // TPM module resources (ADR-026)
  'tpm-plan': { table: 'tpm_maintenance_plans', nameField: 'name' },
  'tpm-card': { table: 'tpm_cards', nameField: 'title' },
  'tpm-execution': { table: 'tpm_card_executions', nameField: 'id' },
};

/**
 * Endpoints to completely exclude from audit logging.
 * These are high-frequency or non-relevant endpoints.
 */
export const EXCLUDED_PATHS: readonly string[] = [
  '/health',
  '/api/v2/health',
  '/metrics',
  '/api/v2/metrics',
  '/notifications/stream',
  '/api/v2/notifications/stream',
  '/favicon.ico',
  // SSE connection tickets — high-frequency, not user actions
  '/auth/connection-ticket',
  '/api/v2/auth/connection-ticket',
  // Theme toggles — cosmetic UI preference, not business-relevant
  '/settings/user/theme',
  '/api/v2/settings/user/theme',
] as const;

/**
 * Path prefixes to exclude (static assets, etc.)
 *
 * IMPORTANT: Chat is excluded for DSGVO/GDPR compliance!
 * Chat messages may contain private/personal data and should not be logged.
 */
export const EXCLUDED_PREFIXES: readonly string[] = [
  '/static/',
  '/assets/',
  '/_app/',
  '/chat',
  '/api/v2/chat',
] as const;

/**
 * Sub-resource suffixes to skip for GET requests (reduce noise).
 * These are typically data-fetching endpoints, not page visits.
 *
 * Dashboard widgets and status endpoints are skipped to prevent
 * 7+ log entries per single dashboard page load.
 */
export const SKIPPED_GET_SUFFIXES: readonly string[] = [
  // Data aggregation endpoints
  '/stats',
  '/count',
  '/counts',
  // NOTE: /export is NOT skipped - we log export actions for security tracking
  '/search',
  '/suggestions',
  '/options',
  '/autocomplete',
  '/validate',
  '/check',
  '/preview',
  // Dashboard widget data (reduce noise from single page load)
  '/unread',
  '/unread-count',
  '/upcoming',
  '/upcoming-count',
  '/unconfirmed',
  '/unconfirmed-count',
  '/status',
  '/recent',
  '/summary',
  '/overview',
  '-count', // Catch-all for any *-count endpoints
  // Sub-resource data endpoints (loaded alongside main resource)
  '/board',
  '/time-estimates',
  '/interval-matrix',
  '/schedule-projection',
  '/eligible-participants',
] as const;

/**
 * Endpoints that represent "current user/session" info.
 * These are logged as 'view' (not 'list') and can be throttled.
 */
export const CURRENT_USER_ENDPOINTS: readonly string[] = ['/users/me', '/auth/me', '/me'] as const;

/**
 * Reference data endpoints to COMPLETELY skip.
 * These are loaded on almost every page for dropdowns/filters.
 * Logging them adds no value - they're not real user actions.
 */
export const REFERENCE_DATA_ENDPOINTS: readonly string[] = [
  '/api/v2/departments',
  '/api/v2/areas',
  '/api/v2/teams',
  '/api/v2/roles',
  '/api/v2/users', // User list for dropdowns/mentions
  '/departments',
  '/areas',
  '/teams',
  '/roles',
  '/users',
  // TPM config/reference data (loaded on every TPM page for UI rendering)
  '/api/v2/tpm/config/colors',
  '/api/v2/tpm/config/interval-colors',
  '/api/v2/tpm/config/category-colors',
  '/api/v2/tpm/config/templates',
  '/api/v2/tpm/locations',
  '/tpm/config/colors',
  '/tpm/config/interval-colors',
  '/tpm/config/category-colors',
  '/tpm/config/templates',
  '/tpm/locations',
] as const;

/**
 * Page initialization endpoints to COMPLETELY skip.
 * These are called on EVERY page load for auth/state - not real user actions.
 * User visiting "Blackboard" should NOT log "checked profile, checked notifications".
 */
export const PAGE_INIT_ENDPOINTS: readonly string[] = [
  // Auth/Profile checks
  '/api/v2/users/me',
  '/users/me',
  // Notification status checks
  '/api/v2/notifications/stats/me',
  '/notifications/stats/me',
  '/api/v2/notifications/stats',
  '/notifications/stats',
  // Addon checks (for UI state)
  '/api/v2/addons/my-addons',
  '/addons/my-addons',
  // E2E encryption key checks (loaded on every page for message decryption)
  '/api/v2/e2e/keys/me',
  '/e2e/keys/me',
  '/api/v2/e2e/escrow',
  '/e2e/escrow',
] as const;

/**
 * Throttle window for LIST/VIEW actions (in milliseconds).
 * Same user + same endpoint within this window = only log once.
 * This ensures "User visited Blackboard" logs once, not 6 times.
 */
export const LIST_ACTION_THROTTLE_MS = 30_000; // 30 seconds

/**
 * Throttle window for "current user" endpoints (in milliseconds).
 * Only log /users/me once per this interval per user.
 */
export const CURRENT_USER_THROTTLE_MS = 30_000; // 30 seconds

/**
 * HTTP metadata (secondary info, stored in _http field)
 */
export interface HttpMetadata {
  endpoint: string;
  method: string;
  status?: number;
  duration_ms: number;
}

/**
 * Structured audit changes field (Best Practice compliant).
 * Contains actual data changes, not just HTTP metadata.
 */
export interface AuditChanges {
  // For CREATE: the created data (sanitized)
  created?: Record<string, unknown>;
  // For UPDATE: the previous state (before change) - compliance: "what was changed from"
  previous?: Record<string, unknown>;
  // For UPDATE: the updated fields (sanitized request body)
  updated?: Record<string, unknown>;
  // For DELETE: the deleted resource data (fetched before deletion)
  deleted?: Record<string, unknown>;
  // For LIST: query parameters used
  query?: Record<string, unknown>;
  // For VIEW: which resource was accessed
  resource_id?: number | string;
  // HTTP metadata (secondary, always included for context)
  _http: HttpMetadata;
}

/**
 * Parameters for audit log entry
 */
export interface AuditLogParams {
  tenantId: number;
  userId: number;
  userName: string | null;
  userRole: string | null;
  action: string;
  resourceType: string;
  resourceId: number | null;
  resourceName: string | null;
  changes: AuditChanges | null;
  ipAddress: string;
  userAgent: string | null;
  status: AuditStatus;
  errorMessage: string | null;
  requestId: string | null;
}

/**
 * Request metadata extracted for audit logging
 */
export interface AuditRequestMetadata {
  action: AuditAction;
  resourceType: string;
  resourceId: number | null;
  /** UUID extracted from URL for UUID-based resources (e.g., TPM plans) */
  resourceUuid: string | null;
  endpoint: string;
  httpMethod: string;
  ipAddress: string;
  userAgent: string | null;
  requestId: string | null;
}
