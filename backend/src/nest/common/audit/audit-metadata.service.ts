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
  extractResourceUuid,
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
    const params = request.params as Record<string, string>;

    // Get requestId from CLS context (set by ClsModule middleware in app.module.ts)
    const requestId = this.cls.get<string | undefined>('requestId') ?? null;

    return {
      action,
      resourceType: extractResourceType(request.url),
      resourceId: extractResourceId(request.url, params),
      resourceUuid: extractResourceUuid(request.url, params),
      endpoint: path,
      httpMethod: request.method.toUpperCase(),
      ipAddress: extractIpAddress(request),
      userAgent: request.headers['user-agent'] ?? null,
      requestId,
    };
  }

  /**
   * Fetch resource data BEFORE mutation (DELETE or UPDATE) for audit trail.
   * Supports both numeric IDs and UUIDs.
   * Returns null if resource type is unknown or fetch fails (fire-and-forget).
   */
  async fetchResourceBeforeMutation(
    resourceType: string,
    resourceId: number | null,
    resourceUuid: string | null,
    tenantId: number,
  ): Promise<Record<string, unknown> | null> {
    const lookup = this.buildLookup(resourceType, resourceId, resourceUuid);
    if (lookup === null) {
      return null;
    }

    try {
      const rows = await this.db.query<QueryResultRow>(
        `SELECT * FROM ${lookup.table} WHERE ${lookup.column} = $1 AND tenant_id = $2 LIMIT 1`,
        [lookup.value, tenantId],
      );

      if (rows.length === 0) {
        return null;
      }

      return sanitizeData(rows[0] as Record<string, unknown>);
    } catch (error: unknown) {
      const identifier = String(resourceId ?? resourceUuid);
      this.logger.warn(
        `Failed to fetch ${resourceType}/${identifier} before mutation: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /**
   * Fetch resource name for VIEW/LIST enrichment.
   * Lightweight single-column lookup — only name field, no full row.
   */
  async fetchResourceName(
    resourceType: string,
    resourceId: number | null,
    resourceUuid: string | null,
    tenantId: number,
  ): Promise<string | null> {
    const lookup = this.buildLookup(resourceType, resourceId, resourceUuid);
    if (lookup === null) {
      return null;
    }

    const mapping = RESOURCE_TABLE_MAP[resourceType];
    if (mapping === undefined) {
      return null;
    }

    try {
      const rows = await this.db.query<QueryResultRow>(
        `SELECT ${mapping.nameField} FROM ${lookup.table} WHERE ${lookup.column} = $1 AND tenant_id = $2 LIMIT 1`,
        [lookup.value, tenantId],
      );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0] as Record<string, unknown>;
      const name = row[mapping.nameField];
      return typeof name === 'string' && name.length > 0 ?
          name.slice(0, 255)
        : null;
    } catch {
      return null;
    }
  }

  /**
   * Build lookup params for resource queries.
   * Returns null if no valid identifier or table mapping exists.
   */
  private buildLookup(
    resourceType: string,
    resourceId: number | null,
    resourceUuid: string | null,
  ): { table: string; column: string; value: number | string } | null {
    if (resourceId === null && resourceUuid === null) {
      return null;
    }

    const mapping = RESOURCE_TABLE_MAP[resourceType];
    if (mapping === undefined) {
      this.logger.debug(`No table mapping for resource type: ${resourceType}`);
      return null;
    }

    return {
      table: mapping.table,
      column: resourceId !== null ? 'id' : 'uuid',
      value: resourceId !== null ? resourceId : (resourceUuid as string),
    };
  }
}
