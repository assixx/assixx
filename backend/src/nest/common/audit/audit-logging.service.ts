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
import { AuditMetadataService } from './audit-metadata.service.js';
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

  constructor(
    private readonly db: DatabaseService,
    private readonly metadataService: AuditMetadataService,
  ) {}

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

    const changes = buildAuditChanges(metadata.action, request, httpMeta, preMutationData);

    const resourceName = this.resolveResourceName(request, metadata, preMutationData);
    const resourceId = this.resolveResourceId(metadata, preMutationData);

    const params: AuditLogParams = {
      tenantId: user?.tenantId ?? 0,
      userId: user?.id ?? 0,
      userName: user !== undefined ? buildUserName(user) : extractLoginEmail(request),
      userRole: user?.activeRole ?? null,
      action: metadata.action,
      resourceType: metadata.resourceType,
      resourceId,
      resourceName,
      changes,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      status: 'success',
      errorMessage: null,
      requestId: metadata.requestId,
    };

    // For VIEW with missing resource_name, enrich asynchronously
    if (
      metadata.action === 'view' &&
      resourceName === null &&
      user !== undefined &&
      (metadata.resourceId !== null || metadata.resourceUuid !== null)
    ) {
      void this.logWithNameEnrichment(params, metadata, user.tenantId);
    } else {
      void this.logToAuditTrail(params);
    }
  }

  /**
   * Log failed request to audit_trail.
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

    const changes = buildAuditChanges(metadata.action, request, httpMeta, preMutationData);

    const resourceName = this.resolveResourceName(request, metadata, preMutationData);
    const resourceId = this.resolveResourceId(metadata, preMutationData);

    void this.logToAuditTrail({
      tenantId: user?.tenantId ?? 0,
      userId: user?.id ?? 0,
      userName: user !== undefined ? buildUserName(user) : extractLoginEmail(request),
      userRole: user?.activeRole ?? null,
      action: metadata.action,
      resourceType: metadata.resourceType,
      resourceId,
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
   * Extract resource name: body first, then pre-fetched data for mutations.
   */
  private resolveResourceName(
    request: FastifyRequest,
    metadata: AuditRequestMetadata,
    preMutationData: Record<string, unknown> | null,
  ): string | null {
    const name = extractResourceName(request);
    if (name !== null) {
      return name;
    }

    if (
      (metadata.action === 'delete' || metadata.action === 'update') &&
      preMutationData !== null
    ) {
      return extractNameFromData(preMutationData, metadata.resourceType);
    }

    return null;
  }

  /**
   * Resolve numeric resource_id for audit_trail column.
   * When UUID was used, extract numeric id from pre-fetched data.
   */
  private resolveResourceId(
    metadata: AuditRequestMetadata,
    preMutationData: Record<string, unknown> | null,
  ): number | null {
    if (metadata.resourceId !== null) {
      return metadata.resourceId;
    }

    // Extract numeric id from pre-fetched data (UUID lookup returns full row)
    if (preMutationData !== null) {
      const id = preMutationData['id'];
      if (typeof id === 'number') {
        return id;
      }
    }

    return null;
  }

  /**
   * Enrich VIEW log entry with resource name from DB, then persist.
   */
  private async logWithNameEnrichment(
    params: AuditLogParams,
    metadata: AuditRequestMetadata,
    tenantId: number,
  ): Promise<void> {
    const name = await this.metadataService.fetchResourceName(
      metadata.resourceType,
      metadata.resourceId,
      metadata.resourceUuid,
      tenantId,
    );

    if (name !== null) {
      params.resourceName = name;
    }

    await this.logToAuditTrail(params);
  }

  /**
   * Log entry to audit_trail table.
   * Fire-and-forget - never throws.
   */
  private async logToAuditTrail(params: AuditLogParams): Promise<void> {
    try {
      await this.db.queryAsTenant(
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
        params.tenantId,
      );
    } catch (error: unknown) {
      // NEVER throw - logging failures should not break main operations
      this.logger.warn(
        `Failed to log audit entry: ${params.action} ${params.resourceType}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
