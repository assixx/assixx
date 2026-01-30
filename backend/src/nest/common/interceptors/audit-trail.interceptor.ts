/**
 * Audit Trail Interceptor (Facade)
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
 * CRITICAL: This interceptor is fire-and-forget - it NEVER throws errors.
 * Logging failures should never break the main operation.
 *
 * @see ADR-009 Central Audit Logging
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Observable, catchError, from, mergeMap, tap, throwError } from 'rxjs';

import { AuditLoggingService } from '../audit/audit-logging.service.js';
import { AuditMetadataService } from '../audit/audit-metadata.service.js';
import { AuditRequestFilterService } from '../audit/audit-request-filter.service.js';
import {
  determineAction,
  isAuthEndpoint,
  shouldExclude,
} from '../audit/audit.helpers.js';
import type { NestAuthUser } from '../interfaces/auth.interface.js';

@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
  constructor(
    private readonly requestFilter: AuditRequestFilterService,
    private readonly metadataService: AuditMetadataService,
    private readonly loggingService: AuditLoggingService,
  ) {}

  /** Main intercept method - delegates to specialized handlers */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: NestAuthUser }>();
    const response = context.switchToHttp().getResponse<FastifyReply>();
    const path = request.url.split('?')[0] ?? request.url;
    const method = request.method.toUpperCase();

    // Skip excluded endpoints or OPTIONS preflight
    if (shouldExclude(request.url) || method === 'OPTIONS') {
      return next.handle();
    }

    // Check if request should be skipped (unauthenticated, throttled, etc.)
    const user = request.user;
    if (this.shouldSkipLogging(method, path, user)) {
      return next.handle();
    }

    // Extract metadata and check for throttling
    const startTime = Date.now();
    const action = determineAction(method, path, request);
    const metadata = this.metadataService.extractRequestMetadata(
      request,
      action,
    );

    if (
      this.requestFilter.shouldThrottleListOrView(
        action,
        user,
        metadata.endpoint,
      )
    ) {
      return next.handle();
    }

    // Route to appropriate handler
    const needsPreFetch =
      (action === 'delete' || action === 'update') &&
      metadata.resourceId !== null;

    if (needsPreFetch && user !== undefined) {
      return this.handleMutationWithPreFetch(
        user,
        metadata,
        startTime,
        request,
        response,
        next,
      );
    }

    return this.handleStandardLogging(
      user,
      metadata,
      startTime,
      request,
      response,
      next,
    );
  }

  /** Check if request should skip audit logging */
  private shouldSkipLogging(
    method: string,
    path: string,
    user: NestAuthUser | undefined,
  ): boolean {
    const isAuthEndpointFlag = isAuthEndpoint(path);
    return this.requestFilter.shouldSkipRequest(
      method,
      path,
      isAuthEndpointFlag,
      user,
    );
  }

  /** Handle standard request logging (no pre-fetch needed) */
  private handleStandardLogging(
    user: NestAuthUser | undefined,
    metadata: ReturnType<AuditMetadataService['extractRequestMetadata']>,
    startTime: number,
    request: FastifyRequest,
    response: FastifyReply,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      tap(() => {
        this.loggingService.logSuccess(
          user,
          metadata,
          startTime,
          request,
          response,
          null,
        );
      }),
      catchError((error: unknown) => {
        this.loggingService.logFailure(
          user,
          metadata,
          startTime,
          request,
          response,
          error,
          null,
        );
        return throwError(() => error);
      }),
    );
  }

  /**
   * Handle DELETE and UPDATE requests with pre-fetch for audit compliance.
   * Fetches resource data BEFORE mutation to capture "previous" state.
   */
  private handleMutationWithPreFetch(
    user: NestAuthUser,
    metadata: ReturnType<AuditMetadataService['extractRequestMetadata']>,
    startTime: number,
    request: FastifyRequest,
    response: FastifyReply,
    next: CallHandler,
  ): Observable<unknown> {
    return from(
      this.metadataService.fetchResourceBeforeMutation(
        metadata.resourceType,
        metadata.resourceId,
        user.tenantId,
      ),
    ).pipe(
      mergeMap((preMutationData: Record<string, unknown> | null) =>
        next.handle().pipe(
          tap(() => {
            this.loggingService.logSuccess(
              user,
              metadata,
              startTime,
              request,
              response,
              preMutationData,
            );
          }),
          catchError((error: unknown) => {
            this.loggingService.logFailure(
              user,
              metadata,
              startTime,
              request,
              response,
              error,
              preMutationData,
            );
            return throwError(() => error);
          }),
        ),
      ),
    );
  }
}
