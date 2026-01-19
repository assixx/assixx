/**
 * Audit Trail Interceptor
 *
 * Global interceptor that logs requests to the audit_trail table.
 * Provides audit trail for compliance and security monitoring.
 *
 * LOGGING STRATEGY (OWASP compliant):
 * - ALL mutations (POST, PUT, PATCH, DELETE) - always logged
 * - ALL auth events (login, logout) - always logged, even unauthenticated
 * - GET with resource ID - logged as "view" (viewing specific item)
 * - GET without ID - logged as "list" (page visit) for primary endpoints only
 * - Sub-resources (/stats, /count, etc.) - skipped to reduce noise
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
import { Observable, catchError, tap, throwError } from 'rxjs';

import { DatabaseService } from '../../database/database.service.js';
import type { NestAuthUser } from '../interfaces/auth.interface.js';

/**
 * Audit action types - more specific than just HTTP methods
 */
type AuditAction = 'login' | 'logout' | 'create' | 'update' | 'delete' | 'view' | 'list';

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
 */
const SKIPPED_GET_SUFFIXES: readonly string[] = [
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
] as const;

/**
 * Endpoints that represent "current user/session" info.
 * These are logged as 'view' (not 'list') and can be throttled.
 */
const CURRENT_USER_ENDPOINTS: readonly string[] = ['/users/me', '/auth/me', '/me'] as const;

/**
 * Audit trail status type matching database enum
 */
type AuditStatus = 'success' | 'failure';

/**
 * Metadata stored in JSONB 'changes' field for additional context
 */
interface AuditChangesMetadata {
  endpoint: string;
  http_method: string;
  http_status?: number;
  duration_ms: number;
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
  changes: AuditChangesMetadata | null;
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

  /**
   * Intercept requests and log to audit_trail table.
   * CRITICAL: Never throws - all errors are caught and logged.
   *
   * Logging strategy:
   * - Auth endpoints: Always log (login/logout), even unauthenticated
   * - Mutations (POST/PUT/PATCH/DELETE): Always log
   * - GET with ID: Log as "view"
   * - GET without ID: Log as "list" (page visit), skip sub-resources
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

    // Check if this is an auth endpoint (login/logout)
    const isAuthEndpoint = this.isAuthEndpoint(path);
    const user = request.user;

    // For non-auth endpoints: skip if unauthenticated
    if (!isAuthEndpoint && user === undefined) {
      return next.handle();
    }

    // For GET requests: apply smart filtering to reduce noise
    if (method === 'GET' && !isAuthEndpoint && this.shouldSkipGetRequest(path)) {
      return next.handle();
    }

    // Throttle "current user" endpoints (e.g., /users/me) - only log once per interval
    if (
      method === 'GET' &&
      this.isCurrentUserEndpoint(path) &&
      user !== undefined &&
      this.shouldThrottleCurrentUser(user.id, path)
    ) {
      return next.handle();
    }

    const startTime = Date.now();
    const action = this.determineAction(method, path, request);
    const metadata = this.extractRequestMetadata(request, action);

    return next.handle().pipe(
      tap(() => {
        this.logSuccess(user, metadata, startTime, request, response);
      }),
      catchError((error: unknown) =>
        this.logFailure(user, metadata, startTime, request, response, error),
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
   */
  private logSuccess(
    user: NestAuthUser | undefined,
    metadata: ReturnType<typeof this.extractRequestMetadata>,
    startTime: number,
    request: FastifyRequest,
    response: FastifyReply,
  ): void {
    const duration = Date.now() - startTime;

    void this.logToAuditTrail({
      tenantId: user?.tenantId ?? 0,
      userId: user?.id ?? 0,
      userName: user !== undefined ? this.buildUserName(user) : this.extractLoginEmail(request),
      userRole: user?.activeRole ?? null,
      action: metadata.action,
      resourceType: metadata.resourceType,
      resourceId: metadata.resourceId,
      resourceName: this.extractResourceName(request),
      changes: {
        endpoint: metadata.endpoint,
        http_method: metadata.httpMethod,
        http_status: response.statusCode,
        duration_ms: duration,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      status: 'success',
      errorMessage: null,
    });
  }

  /**
   * Log failed request to audit_trail and re-throw error.
   */
  private logFailure(
    user: NestAuthUser | undefined,
    metadata: ReturnType<typeof this.extractRequestMetadata>,
    startTime: number,
    request: FastifyRequest,
    response: FastifyReply,
    error: unknown,
  ): Observable<never> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = response.statusCode >= 400 ? response.statusCode : 500;
    const duration = Date.now() - startTime;

    void this.logToAuditTrail({
      tenantId: user?.tenantId ?? 0,
      userId: user?.id ?? 0,
      userName: user !== undefined ? this.buildUserName(user) : this.extractLoginEmail(request),
      userRole: user?.activeRole ?? null,
      action: metadata.action,
      resourceType: metadata.resourceType,
      resourceId: metadata.resourceId,
      resourceName: this.extractResourceName(request),
      changes: {
        endpoint: metadata.endpoint,
        http_method: metadata.httpMethod,
        http_status: statusCode,
        duration_ms: duration,
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      status: 'failure',
      errorMessage: `[${statusCode}] ${errorMessage}`,
    });

    return throwError(() => error);
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
