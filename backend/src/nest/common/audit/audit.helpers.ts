/**
 * Audit Trail Helpers
 *
 * Pure functions for audit trail operations.
 * No dependencies, no side effects, no state.
 *
 * @see ADR-009 Central Audit Logging
 */
import type { FastifyRequest } from 'fastify';

import type { NestAuthUser } from '../interfaces/auth.interface.js';
import {
  type AuditAction,
  type AuditChanges,
  CURRENT_USER_ENDPOINTS,
  EXCLUDED_PATHS,
  EXCLUDED_PREFIXES,
  type HttpMetadata,
  PAGE_INIT_ENDPOINTS,
  REFERENCE_DATA_ENDPOINTS,
  RESOURCE_TABLE_MAP,
  SENSITIVE_FIELDS,
  SKIPPED_GET_SUFFIXES,
} from './audit.constants.js';

// ==========================================================================
// DATA SANITIZATION
// ==========================================================================

/**
 * Sanitize data by removing sensitive fields (passwords, tokens, etc.).
 * CRITICAL: Never log sensitive data to audit trail!
 */
export function sanitizeData(data: unknown): Record<string, unknown> | null {
  if (data === null || data === undefined || typeof data !== 'object') {
    return null;
  }

  const result: Record<string, unknown> = {};
  const obj = data as Record<string, unknown>;

  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive fields
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      result[key] = '[REDACTED]';
      continue;
    }

    // Recursively sanitize nested objects (but not arrays)
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeData(value);
    } else {
      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

// ==========================================================================
// AUDIT CHANGES BUILDING
// ==========================================================================

/**
 * Build the structured AuditChanges object based on action type.
 * This is the core of the improved audit trail logging.
 */
export function buildAuditChanges(
  action: AuditAction,
  request: FastifyRequest,
  httpMeta: HttpMetadata,
  preMutationData?: Record<string, unknown> | null,
): AuditChanges {
  const changes: AuditChanges = {
    _http: httpMeta,
  };

  // Delegate to action-specific handlers to reduce complexity
  if (action === 'create') {
    addMutationChanges(changes, request);
  } else if (action === 'update') {
    addUpdateChanges(changes, request, preMutationData);
  } else if (action === 'delete') {
    addDeleteChanges(changes, preMutationData);
  } else if (action === 'list') {
    addListChanges(changes, request);
  } else if (action === 'view') {
    addViewChanges(changes, request);
  }
  // login/logout: HTTP metadata is sufficient, no additional data needed

  return changes;
}

/** Add changes for CREATE action (sanitized request body) */
function addMutationChanges(
  changes: AuditChanges,
  request: FastifyRequest,
): void {
  const sanitized = sanitizeData(request.body);
  if (sanitized !== null) {
    changes.created = sanitized;
  }
}

/**
 * Add changes for UPDATE action.
 * Includes both "previous" (pre-mutation state) and "updated" (new values from request).
 * This enables compliance tracking: "what was changed FROM X TO Y"
 */
function addUpdateChanges(
  changes: AuditChanges,
  request: FastifyRequest,
  preMutationData: Record<string, unknown> | null | undefined,
): void {
  // Add previous state (what the resource looked like before the update)
  if (preMutationData !== null && preMutationData !== undefined) {
    changes.previous = preMutationData;
  }

  // Add updated values (sanitized request body)
  const sanitized = sanitizeData(request.body);
  if (sanitized !== null) {
    changes.updated = sanitized;
  }
}

/** Add changes for DELETE action (pre-fetched data before deletion) */
function addDeleteChanges(
  changes: AuditChanges,
  preMutationData: Record<string, unknown> | null | undefined,
): void {
  if (preMutationData !== null && preMutationData !== undefined) {
    changes.deleted = preMutationData;
  }
}

/** Add changes for list action (query parameters) */
function addListChanges(changes: AuditChanges, request: FastifyRequest): void {
  const query = request.query;
  if (
    query !== null &&
    typeof query === 'object' &&
    Object.keys(query).length > 0
  ) {
    changes.query = query as Record<string, unknown>;
  }
}

/** Add changes for view action (resource ID/UUID accessed) */
function addViewChanges(changes: AuditChanges, request: FastifyRequest): void {
  const params = request.params as Record<string, string>;
  const resourceId = extractResourceId(request.url, params);
  if (resourceId !== null) {
    changes.resource_id = resourceId;
  } else {
    const uuid = extractResourceUuid(request.url, params);
    if (uuid !== null) {
      changes.resource_id = uuid;
    }
  }
}

// ==========================================================================
// ACTION DETERMINATION
// ==========================================================================

/**
 * Determine the audit action based on method and path.
 */
export function determineAction(
  method: string,
  path: string,
  request: FastifyRequest,
): AuditAction {
  // Check for special path-based actions first
  const pathAction = getPathBasedAction(path);
  if (pathAction !== null) {
    return pathAction;
  }

  // Map HTTP methods to actions
  switch (method) {
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return 'update';
    case 'DELETE':
      return 'delete';
    case 'GET':
    case 'HEAD':
      return determineGetAction(path, request);
    default:
      return 'view';
  }
}

/**
 * Get action based on special path patterns (auth, role-switch).
 * Returns null if no special path pattern matches.
 */
export function getPathBasedAction(path: string): AuditAction | null {
  if (path.includes('/auth/login')) {
    return 'login';
  }
  if (path.includes('/auth/logout')) {
    return 'logout';
  }
  if (path.includes('/auth/refresh')) {
    return 'refresh';
  }
  if (path.includes('/role-switch')) {
    return 'switch';
  }
  return null;
}

/**
 * Determine action for GET/HEAD requests.
 */
function determineGetAction(
  path: string,
  request: FastifyRequest,
): AuditAction {
  // Export endpoints - security-critical, always track data exports
  if (path.includes('/export')) {
    return 'export';
  }
  // "Current user" endpoints are always 'view' (viewing own profile)
  if (isCurrentUserEndpoint(path)) {
    return 'view';
  }
  // GET with ID = viewing specific item, GET without ID = listing/page visit
  const resourceId = extractResourceId(
    path,
    request.params as Record<string, string>,
  );
  return resourceId !== null ? 'view' : 'list';
}

/**
 * Check if this is a "current user" endpoint (e.g., /users/me).
 */
export function isCurrentUserEndpoint(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return CURRENT_USER_ENDPOINTS.some((endpoint: string) =>
    lowerPath.endsWith(endpoint),
  );
}

/**
 * Check if this is an authentication endpoint.
 */
export function isAuthEndpoint(path: string): boolean {
  return (
    path.includes('/auth/login') ||
    path.includes('/auth/logout') ||
    path.includes('/auth/refresh')
  );
}

// ==========================================================================
// REQUEST FILTERING
// ==========================================================================

/**
 * Check if a GET request should be skipped (sub-resource endpoints).
 */
export function shouldSkipGetRequest(path: string): boolean {
  const lowerPath = path.toLowerCase();

  // Skip sub-resource endpoints that are just data fetching
  for (const suffix of SKIPPED_GET_SUFFIXES) {
    if (lowerPath.endsWith(suffix)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if request URL should be excluded from logging.
 */
export function shouldExclude(url: string): boolean {
  // Remove query string for path matching
  const path = url.split('?')[0] ?? url;

  // Check exact matches
  if (EXCLUDED_PATHS.includes(path)) {
    return true;
  }

  // Check prefix matches
  for (const prefix of EXCLUDED_PREFIXES) {
    if (path.startsWith(prefix)) {
      return true;
    }
  }

  // Check reference data endpoints (dropdowns/filters - loaded on every page)
  for (const endpoint of REFERENCE_DATA_ENDPOINTS) {
    if (path === endpoint || path.endsWith(endpoint)) {
      return true;
    }
  }

  // Check page initialization endpoints (auth/state checks on every page)
  for (const endpoint of PAGE_INIT_ENDPOINTS) {
    if (path === endpoint || path.endsWith(endpoint)) {
      return true;
    }
  }

  return false;
}

// ==========================================================================
// RESOURCE EXTRACTION
// ==========================================================================

/**
 * Extract resource type from URL path.
 * Examples:
 *   /api/v2/users/123 → user
 *   /api/v2/departments → department
 *   /api/v2/blackboard/entries → blackboard
 */
export function extractResourceType(url: string): string {
  // Remove query string
  const path = url.split('?')[0] ?? url;

  // Remove /api/v2/ prefix and get first segment
  const withoutPrefix = path.replace(/^\/api\/v2\/?/, '');
  const segments = withoutPrefix.split('/').filter(Boolean);

  if (segments.length === 0) {
    return 'root';
  }

  // Get first segment and singularize
  const firstSegment = segments[0];
  if (firstSegment === undefined) {
    return 'unknown';
  }

  // Handle nested resources like /shifts/plan/2 → shift-plan
  const secondSegment = segments[1];
  if (secondSegment !== undefined && !/^\d+$/.test(secondSegment)) {
    const combined = `${singularize(firstSegment)}-${singularize(secondSegment)}`;
    // Only return combined if we have a mapping for it
    if (combined in RESOURCE_TABLE_MAP) {
      return combined;
    }
  }

  return singularize(firstSegment);
}

/** UUID v4/v7 pattern: 8-4-4-4-12 hex characters */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extract numeric resource ID from URL or params.
 * Skips UUID-looking segments to avoid false positives (e.g., "019c..." → 19).
 */
export function extractResourceId(
  url: string,
  params: Record<string, string> | undefined,
): number | null {
  // Try to get from params first
  const fromParams = parseNumericParam(params);
  if (fromParams !== null) {
    return fromParams;
  }

  // Try to extract from URL path segments
  return findNumericSegment(url);
}

/** Parse numeric ID from params['id'], skipping UUIDs */
function parseNumericParam(
  params: Record<string, string> | undefined,
): number | null {
  if (params === undefined) {
    return null;
  }
  const id = params['id'];
  if (id === undefined || UUID_PATTERN.test(id)) {
    return null;
  }
  const parsed = Number.parseInt(id, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Find first numeric (non-UUID) segment in a URL path */
function findNumericSegment(url: string): number | null {
  const path = url.split('?')[0] ?? url;
  const segments = path.split('/').filter(Boolean);

  for (const segment of segments) {
    if (UUID_PATTERN.test(segment)) {
      continue;
    }
    const parsed = Number.parseInt(segment, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

/**
 * Extract UUID from URL path or params.
 * Returns null if no UUID found.
 */
export function extractResourceUuid(
  url: string,
  params: Record<string, string> | undefined,
): string | null {
  // Try params first (common param names for UUID)
  if (params !== undefined) {
    for (const key of ['uuid', 'id']) {
      const value = params[key];
      if (value !== undefined && UUID_PATTERN.test(value)) {
        return value;
      }
    }
  }

  // Try URL segments
  const path = url.split('?')[0] ?? url;
  const segments = path.split('/').filter(Boolean);

  for (const segment of segments) {
    if (UUID_PATTERN.test(segment)) {
      return segment;
    }
  }

  return null;
}

/**
 * Extract resource name from request body (for create/update).
 */
export function extractResourceName(request: FastifyRequest): string | null {
  const body = request.body;
  if (body === null || body === undefined || typeof body !== 'object') {
    return null;
  }

  // Try common name fields
  const bodyObj = body as Record<string, unknown>;
  const nameFields = ['name', 'title', 'subject', 'email', 'username'];

  for (const field of nameFields) {
    const value = bodyObj[field];
    if (typeof value === 'string' && value.length > 0) {
      // Truncate to 255 chars (database limit)
      return value.slice(0, 255);
    }
  }

  return null;
}

/**
 * Extract resource name from pre-fetched data based on resource type.
 * Uses RESOURCE_TABLE_MAP to determine the name field.
 */
export function extractNameFromData(
  data: Record<string, unknown>,
  resourceType: string,
): string | null {
  const mapping = RESOURCE_TABLE_MAP[resourceType];
  if (mapping === undefined) {
    return null;
  }

  const nameValue = data[mapping.nameField];
  if (typeof nameValue === 'string' && nameValue.length > 0) {
    return nameValue.slice(0, 255); // Truncate to DB limit
  }

  // Fallback to common name fields
  for (const field of ['name', 'title', 'username', 'email']) {
    const value = data[field];
    if (typeof value === 'string' && value.length > 0) {
      return value.slice(0, 255);
    }
  }

  return null;
}

/**
 * Extract email from login request body (for unauthenticated login attempts).
 */
export function extractLoginEmail(request: FastifyRequest): string | null {
  const body = request.body;
  if (body !== null && body !== undefined && typeof body === 'object') {
    const bodyObj = body as Record<string, unknown>;
    const email = bodyObj['email'];
    if (typeof email === 'string' && email.length > 0) {
      return email;
    }
  }
  return null;
}

/**
 * Extract client IP address from Fastify request.
 * Handles X-Forwarded-For header for proxied requests.
 */
export function extractIpAddress(request: FastifyRequest): string {
  // Check X-Forwarded-For header (set by nginx)
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    // X-Forwarded-For can contain multiple IPs, take the first (client)
    const firstIp = forwarded.split(',')[0]?.trim();
    if (firstIp !== undefined && firstIp.length > 0) {
      return firstIp;
    }
  }

  // Fall back to direct IP (always available in Fastify)
  return request.ip;
}

// ==========================================================================
// USER & ERROR HELPERS
// ==========================================================================

/**
 * Build user display name from NestAuthUser.
 */
export function buildUserName(user: NestAuthUser): string {
  if (user.firstName !== undefined && user.lastName !== undefined) {
    return `${user.firstName} ${user.lastName}`.trim();
  }
  if (user.firstName !== undefined) {
    return user.firstName;
  }
  return user.email;
}

/**
 * Extract detailed error message from various error types.
 * Handles NestJS HttpExceptions, Zod validation errors, and plain errors.
 *
 * @example
 * // Zod error → "email: Invalid email; password: String must contain at least 12 character(s)"
 * // HttpException → "User not found"
 * // Generic → "Something went wrong"
 */
export function extractDetailedErrorMessage(error: unknown): string {
  // Handle null/undefined
  if (error === null || error === undefined) {
    return 'Unknown error';
  }

  // Standard Error object
  if (error instanceof Error) {
    return error.message;
  }

  // String error
  if (typeof error === 'string') {
    return error;
  }

  // Check for NestJS HttpException with response details (includes Zod errors)
  if (typeof error === 'object' && 'getResponse' in error) {
    return extractHttpExceptionMessage(error as { getResponse: () => unknown });
  }

  // Last resort - safely stringify
  return 'Unknown error';
}

/**
 * Extract message from NestJS HttpException.
 * Handles Zod validation errors and standard error responses.
 */
function extractHttpExceptionMessage(httpError: {
  getResponse: () => unknown;
}): string {
  const response = httpError.getResponse();

  if (typeof response !== 'object' || response === null) {
    return 'Request failed';
  }

  const responseObj = response as Record<string, unknown>;

  // Zod validation errors from our custom ZodValidationPipe
  // Format: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: [...] }
  if (
    responseObj['code'] === 'VALIDATION_ERROR' &&
    Array.isArray(responseObj['details'])
  ) {
    return formatZodValidationErrors(responseObj['details']);
  }

  // Standard NestJS error response { message: '...', error: '...' }
  if (typeof responseObj['message'] === 'string') {
    return responseObj['message'];
  }

  // Array of messages (class-validator style)
  if (Array.isArray(responseObj['message'])) {
    const messages = responseObj['message'] as unknown[];
    return messages
      .slice(0, 5)
      .map((m: unknown) => String(m))
      .join('; ');
  }

  return 'Request failed';
}

/**
 * Format Zod validation error details into a readable string.
 */
function formatZodValidationErrors(details: unknown[]): string {
  interface ZodErrorDetail {
    field?: string;
    message?: string;
  }

  const fieldErrors = details
    .slice(0, 5) // Limit to first 5 errors to avoid huge messages
    .map((detail: unknown) => {
      const d = detail as ZodErrorDetail;
      if (d.field !== undefined && d.message !== undefined) {
        return `${d.field}: ${d.message}`;
      }
      return d.message ?? null;
    })
    .filter((msg: string | null): msg is string => msg !== null)
    .join('; ');

  return fieldErrors.length > 0 ? fieldErrors : 'Validation failed';
}

/**
 * Simple singularization of resource names.
 * Examples: users → user, departments → department
 */
export function singularize(word: string): string {
  // Handle common special cases
  const specialCases: Record<string, string> = {
    entries: 'entry',
    activities: 'activity',
    categories: 'category',
    companies: 'company',
    inventories: 'inventory',
  };

  const lower = word.toLowerCase();
  if (specialCases[lower] !== undefined) {
    return specialCases[lower];
  }

  // Simple rule: remove trailing 's' if present
  if (lower.endsWith('s') && lower.length > 1) {
    return lower.slice(0, -1);
  }

  return lower;
}
