/**
 * Audit Metadata Service
 *
 * Handles metadata extraction and resource pre-fetching for audit trail.
 * Extracts request metadata and fetches resource data before mutations.
 *
 * @see ADR-009 Central Audit Logging
 */
import { Injectable, Logger } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ClsService } from 'nestjs-cls';
import type { QueryResultRow } from 'pg';

import { DatabaseService } from '../../database/database.service.js';
import {
  type AuditAction,
  type AuditRequestMetadata,
  RESOURCE_TABLE_MAP,
} from './audit.constants.js';
import {
  extractIpAddress,
  extractResourceId,
  extractResourceType,
  sanitizeData,
} from './audit.helpers.js';

@Injectable()
export class AuditMetadataService {
  private readonly logger = new Logger(AuditMetadataService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly cls: ClsService,
  ) {}

  /**
   * Extract all request metadata for audit logging.
   */
  extractRequestMetadata(
    request: FastifyRequest,
    action: AuditAction,
  ): AuditRequestMetadata {
    const path = request.url.split('?')[0] ?? request.url;

    // Get requestId from CLS context (set by ClsModule middleware in app.module.ts)
    const requestId = this.cls.get<string | undefined>('requestId') ?? null;

    return {
      action,
      resourceType: extractResourceType(request.url),
      resourceId: extractResourceId(
        request.url,
        request.params as Record<string, string>,
      ),
      endpoint: path,
      httpMethod: request.method.toUpperCase(),
      ipAddress: extractIpAddress(request),
      userAgent: request.headers['user-agent'] ?? null,
      requestId,
    };
  }

  /**
   * Fetch resource data BEFORE mutation (DELETE or UPDATE) for audit trail.
   * Returns null if resource type is unknown or fetch fails (fire-and-forget).
   */
  async fetchResourceBeforeMutation(
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
      return sanitizeData(data);
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
}
