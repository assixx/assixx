/**
 * Audit Trail Interceptor
 *
 * Global interceptor that logs requests to the audit_trail table.
 * Provides audit trail for compliance and security monitoring.
 *
 * LOGGING STRATEGY (OWASP compliant):
 * - ALL mutations (POST, PUT, PATCH, DELETE) - always logged with data changes
 * - ALL auth events (login, logout) - always logged, even unauthenticated
 * - GET with resource ID - logged as "view" (viewing specific item)
 * - GET without ID - logged as "list" (page visit) for primary endpoints only
 * - Sub-resources (/stats, /count, etc.) - skipped to reduce noise
 *
 * CHANGES FIELD STRATEGY (Best Practice):
 * - CREATE: created field with sanitized request body
 * - UPDATE: updated field with sanitized request body
 * - DELETE: deleted field with fetched resource data before deletion
 * - LIST:   query field with query params, _http metadata
 * - VIEW:   resource_id field, _http metadata
 *
 * CRITICAL: This interceptor is fire-and-forget - it NEVER throws errors.
 * Logging failures should never break the main operation.
 *
 * @see ADR-009 Central Audit Logging
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { QueryResultRow } from 'pg';
import { Observable, catchError, from, mergeMap, tap, throwError } from 'rxjs';

import { DatabaseService } from '../../database/database.service.js';
import type { NestAuthUser } from '../interfaces/auth.interface.js';

/**
 * Audit action types - more specific than just HTTP methods
 */
type AuditAction = 'login' | 'logout' | 'create' | 'update' | 'delete' | 'view' | 'list';

/**
 * Sensitive fields that should NEVER be logged (OWASP, GDPR compliance).
 * These are removed from request bodies before storing in audit trail.
 */
const SENSITIVE_FIELDS: readonly string[] = [
  // Authentication & Security
  'password',
  'passwordHash',
  'password_hash',
  'currentPassword',
  'current_password',
  'newPassword',
  'new_password',
  'confirmPassword',
  'confirm_password',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'secret',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
  // Personal Identifiable Information (GDPR)
  'ssn',
  'socialSecurity',
  'social_security',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'pin',
] as const;

/**
 * Resource type to database table mapping for DELETE pre-fetch.
 * Maps the extracted resource type to the actual table name and name field.
 */
const RESOURCE_TABLE_MAP: Record<string, { table: string; nameField: string }> = {
  user: { table: 'users', nameField: 'username' },
  department: { table: 'departments', nameField: 'name' },
  team: { table: 'teams', nameField: 'name' },
  area: { table: 'areas', nameField: 'name' },
  machine: { table: 'machines', nameField: 'name' },
  blackboard: { table: 'blackboard_entries', nameField: 'title' },
  calendar: { table: 'calendar_events', nameField: 'title' },
  document: { table: 'documents', nameField: 'original_filename' },
  kvp: { table: 'kvp_suggestions', nameField: 'title' },
  survey: { table: 'surveys', nameField: 'title' },
  notification: { table: 'notifications', nameField: 'title' },
  shift: { table: 'shift_entries', nameField: 'id' },
  feature: { table: 'tenant_features', nameField: 'feature_key' },
  plan: { table: 'subscription_plans', nameField: 'name' },
  setting: { table: 'tenant_settings', nameField: 'setting_key' },
  role: { table: 'roles', nameField: 'name' },
};

/**
 * Endpoints to completely exclude from audit logging.
 * These are high-frequency or non-relevant endpoints.
 */
const EXCLUDED_PATHS: readonly string[] = [
  '/health',
  '/api/v2/health',
  '/metrics',
  '/api/v2/metrics',
  '/notifications/stream',
  '/api/v2/notifications/stream',
  '/favicon.ico',
] as const;

/**
 * Path prefixes to exclude (static assets, etc.)
 *
 * IMPORTANT: Chat is excluded for DSGVO/GDPR compliance!
 * Chat messages may contain private/personal data and should not be logged.
 */
const EXCLUDED_PREFIXES: readonly string[] = [
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
const SKIPPED_GET_SUFFIXES: readonly string[] = [
  // Data aggregation endpoints
  '/stats',
  '/count',
  '/counts',
  '/export',
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
] as const;

/**
 * Endpoints that represent "current user/session" info.
 * These are logged as 'view' (not 'list') and can be throttled.
 */
const CURRENT_USER_ENDPOINTS: readonly string[] = ['/users/me', '/auth/me', '/me'] as const;

/**
 * Reference data endpoints to COMPLETELY skip.
 * These are loaded on almost every page for dropdowns/filters.
 * Logging them adds no value - they're not real user actions.
 */
const REFERENCE_DATA_ENDPOINTS: readonly string[] = [
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
] as const;

/**
 * Page initialization endpoints to COMPLETELY skip.
 * These are called on EVERY page load for auth/state - not real user actions.
 * User visiting "Blackboard" should NOT log "checked profile, checked notifications".
 */
const PAGE_INIT_ENDPOINTS: readonly string[] = [
  // Auth/Profile checks
  '/api/v2/users/me',
  '/users/me',
  // Notification status checks
  '/api/v2/notifications/stats/me',
  '/notifications/stats/me',
  '/api/v2/notifications/stats',
  '/notifications/stats',
  // Feature/Plan checks (for UI state)
  '/api/v2/features/my-features',
  '/features/my-features',
  '/api/v2/plans/current',
  '/plans/current',
] as const;

/**
 * Throttle window for LIST/VIEW actions (in milliseconds).
 * Same user + same endpoint within this window = only log once.
 * This ensures "User visited Blackboard" logs once, not 6 times.
 */
const LIST_ACTION_THROTTLE_MS = 30_000; // 30 seconds

/**
 * Audit trail status type matching database enum
 */
type AuditStatus = 'success' | 'failure';

/**
 * HTTP metadata (secondary info, stored in _http field)
 */
interface HttpMetadata {
  endpoint: string;
  method: string;
  status?: number;
  duration_ms: number;
}

/**
 * Structured audit changes field (Best Practice compliant).
 * Contains actual data changes, not just HTTP metadata.
 */
interface AuditChanges {
  // For CREATE: the created data (sanitized)
  created?: Record<string, unknown>;
  // For UPDATE: the updated fields (sanitized)
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
interface AuditLogParams {
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
}

/**
 * Throttle window for "current user" endpoints (in milliseconds).
 * Only log /users/me once per this interval per user.
 */
const CURRENT_USER_THROTTLE_MS = 30_000; // 30 seconds

@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditTrailInterceptor.name);

  /**
   * In-memory cache to throttle repeated /users/me calls.
   * Key: `${userId}-${endpoint}`, Value: timestamp of last log
   */
  private readonly recentLogs = new Map<string, number>();

  constructor(private readonly db: DatabaseService) {
    // Clean up old entries every 5 minutes to prevent memory leak
    setInterval(
      () => {
        this.cleanupRecentLogs();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Remove expired entries from recentLogs cache.
   */
  private cleanupRecentLogs(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.recentLogs) {
      if (now - timestamp > CURRENT_USER_THROTTLE_MS * 2) {
        this.recentLogs.delete(key);
      }
    }
  }

  // ==========================================================================
  // DATA SANITIZATION & CHANGES BUILDING
  // ==========================================================================

  /**
   * Sanitize data by removing sensitive fields (passwords, tokens, etc.).
   * CRITICAL: Never log sensitive data to audit trail!
   */
  private sanitizeData(data: unknown): Record<string, unknown> | null {
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
        result[key] = this.sanitizeData(value);
      } else {
        result[key] = value;
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Build the structured AuditChanges object based on action type.
   * This is the core of the improved audit trail logging.
   */
  private buildAuditChanges(
    action: AuditAction,
    request: FastifyRequest,
    httpMeta: HttpMetadata,
    preDeleteData?: Record<string, unknown> | null,
  ): AuditChanges {
    const changes: AuditChanges = {
      _http: httpMeta,
    };

    // Delegate to action-specific handlers to reduce complexity
    if (action === 'create' || action === 'update') {
      this.addMutationChanges(changes, action, request);
    } else if (action === 'delete') {
      this.addDeleteChanges(changes, preDeleteData);
    } else if (action === 'list') {
      this.addListChanges(changes, request);
    } else if (action === 'view') {
      this.addViewChanges(changes, request);
    }
    // login/logout: HTTP metadata is sufficient, no additional data needed

    return changes;
  }

  /** Add changes for create/update mutations (sanitized request body) */
  private addMutationChanges(
    changes: AuditChanges,
    action: 'create' | 'update',
    request: FastifyRequest,
  ): void {
    const sanitized = this.sanitizeData(request.body);
    if (sanitized === null) {
      return;
    }
    if (action === 'create') {
      changes.created = sanitized;
    } else {
      changes.updated = sanitized;
    }
  }

  /** Add changes for delete action (pre-fetched data before deletion) */
  private addDeleteChanges(
    changes: AuditChanges,
    preDeleteData: Record<string, unknown> | null | undefined,
  ): void {
    if (preDeleteData !== null && preDeleteData !== undefined) {
      changes.deleted = preDeleteData;
    }
  }

  /** Add changes for list action (query parameters) */
  private addListChanges(changes: AuditChanges, request: FastifyRequest): void {
    const query = request.query;
    if (query !== null && typeof query === 'object' && Object.keys(query).length > 0) {
      changes.query = query as Record<string, unknown>;
    }
  }

  /** Add changes for view action (resource ID accessed) */
  private addViewChanges(changes: AuditChanges, request: FastifyRequest): void {
    const resourceId = this.extractResourceId(
      request.url,
      request.params as Record<string, string>,
    );
    if (resourceId !== null) {
      changes.resource_id = resourceId;
    }
  }

  /**
   * Fetch resource data BEFORE deletion for audit trail.
   * Returns null if resource type is unknown or fetch fails (fire-and-forget).
   */
  private async fetchResourceBeforeDelete(
    resourceType: string,
    resourceId: number | null,
    tenantId: number,
  ): Promise<Record<string, unknown> | null> {
    // Can't fetch without ID
    if (resourceId === null) {
      return null;
    }

    // Get table mapping for this resource type
    const mapping = RESOURCE_TABLE_MAP[resourceType];
    if (mapping === undefined) {
      this.logger.debug(`No table mapping for resource type: ${resourceType}`);
      return null;
    }

    try {
      // Fetch the resource data before it gets deleted
      const rows = await this.db.query<QueryResultRow>(
        `SELECT * FROM ${mapping.table} WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [resourceId, tenantId],
      );

      if (rows.length === 0) {
        return null;
      }

      // Sanitize the fetched data (remove any sensitive fields)
      const data = rows[0] as Record<string, unknown>;
      return this.sanitizeData(data);
    } catch (error: unknown) {
      // Fire-and-forget - don't let fetch failure break the DELETE
      this.logger.warn(
        `Failed to fetch ${resourceType}/${resourceId} before delete: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /**
   * Check if request should be skipped from logging (early returns).
   * Combines all skip logic to reduce cognitive complexity in intercept().
   */
  private shouldSkipRequest(
    method: string,
    path: string,
    isAuthEndpoint: boolean,
    user: NestAuthUser | undefined,
  ): boolean {
    // For non-auth endpoints: skip if unauthenticated
    if (!isAuthEndpoint && user === undefined) {
      return true;
    }

    // For GET requests: apply smart filtering to reduce noise
    if (method === 'GET' && !isAuthEndpoint && this.shouldSkipGetRequest(path)) {
      return true;
    }

    // Throttle "current user" endpoints (e.g., /users/me) - only log once per interval
    if (method === 'GET' && this.isCurrentUserEndpoint(path) && user !== undefined) {
      return this.shouldThrottleCurrentUser(user.id, path);
    }

    return false;
  }

  /**
   * Intercept requests and log to audit_trail table.
   * CRITICAL: Never throws - all errors are caught and logged.
   *
   * Logging strategy:
   * - Auth endpoints: Always log (login/logout), even unauthenticated
   * - Mutations (POST/PUT/PATCH/DELETE): Always log with data changes
   * - GET with ID: Log as "view"
   * - GET without ID: Log as "list" (page visit), skip sub-resources
   *
   * DELETE special handling:
   * - Fetches resource data BEFORE deletion for audit compliance
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: NestAuthUser }>();
    const response = context.switchToHttp().getResponse<FastifyReply>();
    const path = request.url.split('?')[0] ?? request.url;
    const method = request.method.toUpperCase();

    // Skip excluded endpoints or OPTIONS preflight
    if (this.shouldExclude(request.url) || method === 'OPTIONS') {
      return next.handle();
    }

    const isAuthEndpoint = this.isAuthEndpoint(path);
    const user = request.user;

    // Combined early-return checks
    if (this.shouldSkipRequest(method, path, isAuthEndpoint, user)) {
      return next.handle();
    }

    const startTime = Date.now();
    const action = this.determineAction(method, path, request);
    const metadata = this.extractRequestMetadata(request, action);

    // Throttle list/view actions - ensures "User visited Blackboard" logs once, not 6 times
    const isListOrView = action === 'list' || action === 'view';
    if (
      isListOrView &&
      user !== undefined &&
      this.shouldThrottleListAction(user.id, metadata.endpoint)
    ) {
      return next.handle();
    }

    // For DELETE: fetch resource data BEFORE deletion (async pipeline)
    if (action === 'delete' && user !== undefined) {
      return this.handleDeleteWithPreFetch(user, metadata, startTime, request, response, next);
    }

    // For all other actions: standard logging
    return next.handle().pipe(
      tap(() => {
        this.logSuccess(user, metadata, startTime, request, response, null);
      }),
      catchError((error: unknown) =>
        this.logFailure(user, metadata, startTime, request, response, error, null),
      ),
    );
  }

  /**
   * Handle DELETE requests with pre-fetch for audit compliance.
   * Extracted to reduce cognitive complexity in intercept().
   */
  private handleDeleteWithPreFetch(
    user: NestAuthUser,
    metadata: ReturnType<typeof this.extractRequestMetadata>,
    startTime: number,
    request: FastifyRequest,
    response: FastifyReply,
    next: CallHandler,
  ): Observable<unknown> {
    return from(
      this.fetchResourceBeforeDelete(metadata.resourceType, metadata.resourceId, user.tenantId),
    ).pipe(
      mergeMap((preDeleteData: Record<string, unknown> | null) =>
        next.handle().pipe(
          tap(() => {
            this.logSuccess(user, metadata, startTime, request, response, preDeleteData);
          }),
          catchError((error: unknown) =>
            this.logFailure(user, metadata, startTime, request, response, error, preDeleteData),
          ),
        ),
      ),
    );
  }

  /**
   * Check if this is an authentication endpoint.
   */
  private isAuthEndpoint(path: string): boolean {
    return (
      path.includes('/auth/login') ||
      path.includes('/auth/logout') ||
      path.includes('/auth/refresh')
    );
  }

  /**
   * Determine the audit action based on method and path.
   */
  private determineAction(method: string, path: string, request: FastifyRequest): AuditAction {
    // Special handling for auth endpoints
    if (path.includes('/auth/login')) {
      return 'login';
    }
    if (path.includes('/auth/logout')) {
      return 'logout';
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
      case 'HEAD': {
        // "Current user" endpoints are always 'view' (viewing own profile)
        if (this.isCurrentUserEndpoint(path)) {
          return 'view';
        }
        // GET with ID = viewing specific item, GET without ID = listing/page visit
        const resourceId = this.extractResourceId(path, request.params as Record<string, string>);
        return resourceId !== null ? 'view' : 'list';
      }
      default:
        return 'view';
    }
  }

  /**
   * Check if this is a "current user" endpoint (e.g., /users/me).
   */
  private isCurrentUserEndpoint(path: string): boolean {
    const lowerPath = path.toLowerCase();
    return CURRENT_USER_ENDPOINTS.some((endpoint: string) => lowerPath.endsWith(endpoint));
  }

  /**
   * Check if a "current user" endpoint should be throttled.
   * Returns true if we should SKIP logging (already logged recently).
   */
  private shouldThrottleCurrentUser(userId: number, path: string): boolean {
    const key = `${userId}-${path}`;
    const now = Date.now();
    const lastLogged = this.recentLogs.get(key);

    if (lastLogged !== undefined && now - lastLogged < CURRENT_USER_THROTTLE_MS) {
      // Already logged within throttle window - skip
      return true;
    }

    // Update timestamp and allow logging
    this.recentLogs.set(key, now);
    return false;
  }

  /**
   * Check if a list/view action should be throttled.
   * Returns true if we should SKIP logging (already logged recently).
   *
   * PURPOSE: Ensure "User visited Blackboard" logs ONCE, not 6 times.
   * Multiple API calls from same page load within 30s = single log entry.
   */
  private shouldThrottleListAction(userId: number, endpoint: string): boolean {
    // Normalize endpoint: remove query params and trailing IDs for grouping
    // e.g., /blackboard/entries?page=1 and /blackboard/entries?page=2 → same key
    const normalizedEndpoint = endpoint.split('?')[0] ?? endpoint;
    const key = `list-${userId}-${normalizedEndpoint}`;
    const now = Date.now();
    const lastLogged = this.recentLogs.get(key);

    if (lastLogged !== undefined && now - lastLogged < LIST_ACTION_THROTTLE_MS) {
      // Already logged within throttle window - skip
      return true;
    }

    // Update timestamp and allow logging
    this.recentLogs.set(key, now);
    return false;
  }

  /**
   * Check if a GET request should be skipped (sub-resource endpoints).
   */
  private shouldSkipGetRequest(path: string): boolean {
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
   * Extract all request metadata for audit logging.
   */
  private extractRequestMetadata(
    request: FastifyRequest,
    action: AuditAction,
  ): {
    action: AuditAction;
    resourceType: string;
    resourceId: number | null;
    endpoint: string;
    httpMethod: string;
    ipAddress: string;
    userAgent: string | null;
  } {
    const path = request.url.split('?')[0] ?? request.url;
    return {
      action,
      resourceType: this.extractResourceType(request.url),
      resourceId: this.extractResourceId(request.url, request.params as Record<string, string>),
      endpoint: path,
      httpMethod: request.method.toUpperCase(),
      ipAddress: this.extractIpAddress(request),
      userAgent: request.headers['user-agent'] ?? null,
    };
  }

  /**
   * Log successful request to audit_trail.
   * Uses buildAuditChanges to create structured changes based on action type.
   */
  private logSuccess(
    user: NestAuthUser | undefined,
    metadata: ReturnType<typeof this.extractRequestMetadata>,
    startTime: number,
    request: FastifyRequest,
    response: FastifyReply,
    preDeleteData: Record<string, unknown> | null,
  ): void {
    const duration = Date.now() - startTime;

    const httpMeta: HttpMetadata = {
      endpoint: metadata.endpoint,
      method: metadata.httpMethod,
      status: response.statusCode,
      duration_ms: duration,
    };

    const changes = this.buildAuditChanges(metadata.action, request, httpMeta, preDeleteData);

    // For DELETE, try to extract resource_name from pre-fetched data
    let resourceName = this.extractResourceName(request);
    if (metadata.action === 'delete' && preDeleteData !== null && resourceName === null) {
      resourceName = this.extractNameFromData(preDeleteData, metadata.resourceType);
    }

    void this.logToAuditTrail({
      tenantId: user?.tenantId ?? 0,
      userId: user?.id ?? 0,
      userName: user !== undefined ? this.buildUserName(user) : this.extractLoginEmail(request),
      userRole: user?.activeRole ?? null,
      action: metadata.action,
      resourceType: metadata.resourceType,
      resourceId: metadata.resourceId,
      resourceName,
      changes,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      status: 'success',
      errorMessage: null,
    });
  }

  /**
   * Log failed request to audit_trail and re-throw error.
   * Uses buildAuditChanges to create structured changes based on action type.
   */
  private logFailure(
    user: NestAuthUser | undefined,
    metadata: ReturnType<typeof this.extractRequestMetadata>,
    startTime: number,
    request: FastifyRequest,
    response: FastifyReply,
    error: unknown,
    preDeleteData: Record<string, unknown> | null,
  ): Observable<never> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = response.statusCode >= 400 ? response.statusCode : 500;
    const duration = Date.now() - startTime;

    const httpMeta: HttpMetadata = {
      endpoint: metadata.endpoint,
      method: metadata.httpMethod,
      status: statusCode,
      duration_ms: duration,
    };

    const changes = this.buildAuditChanges(metadata.action, request, httpMeta, preDeleteData);

    // For DELETE, try to extract resource_name from pre-fetched data
    let resourceName = this.extractResourceName(request);
    if (metadata.action === 'delete' && preDeleteData !== null && resourceName === null) {
      resourceName = this.extractNameFromData(preDeleteData, metadata.resourceType);
    }

    void this.logToAuditTrail({
      tenantId: user?.tenantId ?? 0,
      userId: user?.id ?? 0,
      userName: user !== undefined ? this.buildUserName(user) : this.extractLoginEmail(request),
      userRole: user?.activeRole ?? null,
      action: metadata.action,
      resourceType: metadata.resourceType,
      resourceId: metadata.resourceId,
      resourceName,
      changes,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      status: 'failure',
      errorMessage: `[${statusCode}] ${errorMessage}`,
    });

    return throwError(() => error);
  }

  /**
   * Extract resource name from pre-fetched data based on resource type.
   * Uses RESOURCE_TABLE_MAP to determine the name field.
   */
  private extractNameFromData(data: Record<string, unknown>, resourceType: string): string | null {
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
  private extractLoginEmail(request: FastifyRequest): string | null {
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
   * Log entry to audit_trail table.
   * Fire-and-forget - never throws.
   */
  private async logToAuditTrail(params: AuditLogParams): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO audit_trail
         (tenant_id, user_id, user_name, user_role, action, resource_type,
          resource_id, resource_name, changes, ip_address, user_agent, status, error_message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
        [
          params.tenantId,
          params.userId,
          params.userName,
          params.userRole,
          params.action,
          params.resourceType,
          params.resourceId,
          params.resourceName,
          params.changes !== null ? JSON.stringify(params.changes) : null,
          params.ipAddress,
          params.userAgent,
          params.status,
          params.errorMessage,
        ],
      );

      this.logger.debug(
        `Audit logged: ${params.action} ${params.resourceType} by user ${params.userId} [${params.status}]`,
      );
    } catch (error: unknown) {
      // NEVER throw - logging failures should not break main operations
      this.logger.warn(
        `Failed to log audit entry: ${params.action} ${params.resourceType}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Check if request URL should be excluded from logging.
   */
  private shouldExclude(url: string): boolean {
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

  /**
   * Extract resource type from URL path.
   * Examples:
   *   /api/v2/users/123 → user
   *   /api/v2/departments → department
   *   /api/v2/blackboard/entries → blackboard
   */
  private extractResourceType(url: string): string {
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

    return this.singularize(firstSegment);
  }

  /**
   * Extract resource ID from URL or params.
   */
  private extractResourceId(
    url: string,
    params: Record<string, string> | undefined,
  ): number | null {
    // Try to get from params first
    if (params !== undefined) {
      const id = params['id'];
      if (id !== undefined) {
        const parsed = Number.parseInt(id, 10);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }

    // Try to extract from URL path
    const path = url.split('?')[0] ?? url;
    const segments = path.split('/').filter(Boolean);

    // Look for numeric segment (likely an ID)
    for (const segment of segments) {
      const parsed = Number.parseInt(segment, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return null;
  }

  /**
   * Extract resource name from request body (for create/update).
   */
  private extractResourceName(request: FastifyRequest): string | null {
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
   * Build user display name from NestAuthUser.
   */
  private buildUserName(user: NestAuthUser): string {
    if (user.firstName !== undefined && user.lastName !== undefined) {
      return `${user.firstName} ${user.lastName}`.trim();
    }
    if (user.firstName !== undefined) {
      return user.firstName;
    }
    return user.email;
  }

  /**
   * Extract client IP address from Fastify request.
   * Handles X-Forwarded-For header for proxied requests.
   */
  private extractIpAddress(request: FastifyRequest): string {
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

  /**
   * Simple singularization of resource names.
   * Examples: users → user, departments → department
   */
  private singularize(word: string): string {
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
}
