/**
 * Audit Logging Service
 *
 * Handles audit trail persistence to database.
 * Fire-and-forget pattern - never throws errors.
 *
 * @see ADR-009 Central Audit Logging
 */
import { Injectable, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { DatabaseService } from '../../database/database.service.js';
import type { NestAuthUser } from '../interfaces/auth.interface.js';
import {
  type AuditLogParams,
  type AuditRequestMetadata,
  type HttpMetadata,
} from './audit.constants.js';
import {
  buildAuditChanges,
  buildUserName,
  extractDetailedErrorMessage,
  extractLoginEmail,
  extractNameFromData,
  extractResourceName,
} from './audit.helpers.js';

@Injectable()
export class AuditLoggingService {
  private readonly logger = new Logger(AuditLoggingService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Log successful request to audit_trail.
   * Uses buildAuditChanges to create structured changes based on action type.
   */
  logSuccess(
    user: NestAuthUser | undefined,
    metadata: AuditRequestMetadata,
    startTime: number,
    request: FastifyRequest,
    response: FastifyReply,
    preMutationData: Record<string, unknown> | null,
  ): void {
    const duration = Date.now() - startTime;

    const httpMeta: HttpMetadata = {
      endpoint: metadata.endpoint,
      method: metadata.httpMethod,
      status: response.statusCode,
      duration_ms: duration,
    };

    const changes = buildAuditChanges(
      metadata.action,
      request,
      httpMeta,
      preMutationData,
    );

    // For DELETE, try to extract resource_name from pre-fetched data
    let resourceName = extractResourceName(request);
    if (
      metadata.action === 'delete' &&
      preMutationData !== null &&
      resourceName === null
    ) {
      resourceName = extractNameFromData(
        preMutationData,
        metadata.resourceType,
      );
    }

    void this.logToAuditTrail({
      tenantId: user?.tenantId ?? 0,
      userId: user?.id ?? 0,
      userName:
        user !== undefined ? buildUserName(user) : extractLoginEmail(request),
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
      requestId: metadata.requestId,
    });
  }

  /**
   * Log failed request to audit_trail.
   * Uses buildAuditChanges to create structured changes based on action type.
   * Returns the error message for the caller to use.
   */
  logFailure(
    user: NestAuthUser | undefined,
    metadata: AuditRequestMetadata,
    startTime: number,
    request: FastifyRequest,
    response: FastifyReply,
    error: unknown,
    preMutationData: Record<string, unknown> | null,
  ): string {
    const errorMessage = extractDetailedErrorMessage(error);
    const statusCode = response.statusCode >= 400 ? response.statusCode : 500;
    const duration = Date.now() - startTime;

    const httpMeta: HttpMetadata = {
      endpoint: metadata.endpoint,
      method: metadata.httpMethod,
      status: statusCode,
      duration_ms: duration,
    };

    const changes = buildAuditChanges(
      metadata.action,
      request,
      httpMeta,
      preMutationData,
    );

    // For DELETE, try to extract resource_name from pre-fetched data
    let resourceName = extractResourceName(request);
    if (
      metadata.action === 'delete' &&
      preMutationData !== null &&
      resourceName === null
    ) {
      resourceName = extractNameFromData(
        preMutationData,
        metadata.resourceType,
      );
    }

    void this.logToAuditTrail({
      tenantId: user?.tenantId ?? 0,
      userId: user?.id ?? 0,
      userName:
        user !== undefined ? buildUserName(user) : extractLoginEmail(request),
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
      requestId: metadata.requestId,
    });

    return errorMessage;
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
          resource_id, resource_name, changes, ip_address, user_agent, status, error_message, request_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
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
          params.requestId,
        ],
      );

      // Note: No console log for success - the DB insert IS the audit trail.
      // Use LOG_LEVEL=debug + add temporary logging only when troubleshooting.
    } catch (error: unknown) {
      // NEVER throw - logging failures should not break main operations
      this.logger.warn(
        `Failed to log audit entry: ${params.action} ${params.resourceType}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
