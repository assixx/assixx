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
  extractRequestMetadata(request: FastifyRequest, action: AuditAction): AuditRequestMetadata {
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
    // Aggregated resources — can't be fetched via the generic single-table
    // RESOURCE_TABLE_MAP lookup because their state lives across multiple
    // tables. Each aggregated type gets its own dedicated fetcher.
    // See: ADR-009 Central Audit Logging + related refactor discussion.
    if (resourceType === 'admin-permission') {
      if (resourceId === null) return null;
      return await this.fetchAdminPermissionSnapshot(resourceId, tenantId);
    }

    const lookup = this.buildLookup(resourceType, resourceId, resourceUuid);
    if (lookup === null) {
      return null;
    }

    try {
      const rows = await this.db.tenantQuery<QueryResultRow>(
        `SELECT * FROM ${lookup.table} WHERE ${lookup.column} = $1 AND tenant_id = $2 LIMIT 1`,
        [lookup.value, tenantId],
      );

      if (rows.length === 0) {
        return null;
      }

      return sanitizeData(rows[0]);
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
    // Aggregated resources bypass RESOURCE_TABLE_MAP — see note in
    // fetchResourceBeforeMutation above. For admin-permission the readable
    // name is derived from the target user (first/last name or email).
    if (resourceType === 'admin-permission') {
      if (resourceId === null) return null;
      return await this.fetchAdminPermissionName(resourceId, tenantId);
    }

    const lookup = this.buildLookup(resourceType, resourceId, resourceUuid);
    if (lookup === null) {
      return null;
    }

    const mapping = RESOURCE_TABLE_MAP[resourceType];
    if (mapping === undefined) {
      return null;
    }

    try {
      const rows = await this.db.tenantQuery<QueryResultRow>(
        `SELECT ${mapping.nameField} FROM ${lookup.table} WHERE ${lookup.column} = $1 AND tenant_id = $2 LIMIT 1`,
        [lookup.value, tenantId],
      );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0] as Record<string, unknown>;
      const name = row[mapping.nameField];
      return typeof name === 'string' && name.length > 0 ? name.slice(0, 255) : null;
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

  // ==========================================================================
  // AGGREGATED RESOURCE FETCHERS
  // --------------------------------------------------------------------------
  // Some resource types don't map to a single table — e.g. "admin-permission"
  // lives across users.has_full_access + admin_area_permissions +
  // admin_department_permissions. The generic RESOURCE_TABLE_MAP pattern can't
  // express this. Each aggregated type gets a dedicated fetcher below.
  // WHY: ADR-009 audit_trail.changes is JSONB — free-form snapshot is fine.
  // ==========================================================================

  /**
   * Snapshot the complete admin-permission state for a given admin user
   * BEFORE a mutation (PATCH full-access, POST areas, POST/DELETE departments).
   * Produces the `previous`/`deleted` payload consumed by the audit interceptor.
   */
  private async fetchAdminPermissionSnapshot(
    adminId: number,
    tenantId: number,
  ): Promise<Record<string, unknown> | null> {
    try {
      const [userRows, areaRows, deptRows] = await Promise.all([
        this.db.tenantQuery<{ has_full_access: boolean }>(
          'SELECT has_full_access FROM users WHERE id = $1 AND tenant_id = $2 LIMIT 1',
          [adminId, tenantId],
        ),
        this.db.tenantQuery<AreaPermissionRow>(
          `SELECT area_id, can_read, can_write, can_delete
             FROM admin_area_permissions
            WHERE admin_user_id = $1 AND tenant_id = $2
            ORDER BY area_id`,
          [adminId, tenantId],
        ),
        this.db.tenantQuery<DepartmentPermissionRow>(
          `SELECT department_id, can_read, can_write, can_delete
             FROM admin_department_permissions
            WHERE admin_user_id = $1 AND tenant_id = $2
            ORDER BY department_id`,
          [adminId, tenantId],
        ),
      ]);

      const userRow = userRows[0];
      if (userRow === undefined) {
        // Admin doesn't exist (or foreign tenant) — no snapshot, not an error.
        return null;
      }

      return {
        adminId,
        hasFullAccess: userRow.has_full_access,
        areaPermissions: areaRows.map(mapAreaPermissionRow),
        departmentPermissions: deptRows.map(mapDepartmentPermissionRow),
      };
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to fetch admin-permission/${String(adminId)} snapshot: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /**
   * Derive a human-readable name for an admin-permission audit entry from
   * the target user. Prefers "First Last", falls back to email.
   * Silent on errors — name enrichment is best-effort (matches existing pattern).
   */
  private async fetchAdminPermissionName(
    adminId: number,
    tenantId: number,
  ): Promise<string | null> {
    try {
      const rows = await this.db.tenantQuery<{
        first_name: string | null;
        last_name: string | null;
        email: string;
      }>(
        `SELECT first_name, last_name, email
           FROM users
          WHERE id = $1 AND tenant_id = $2
          LIMIT 1`,
        [adminId, tenantId],
      );
      const row = rows[0];
      if (row === undefined) return null;
      const fullName = [row.first_name, row.last_name]
        .filter((n: string | null): n is string => n !== null && n.length > 0)
        .join(' ')
        .trim();
      const display = fullName.length > 0 ? fullName : row.email;
      return display.slice(0, 255);
    } catch {
      return null;
    }
  }
}

// ==========================================================================
// HELPERS — file-local, not part of the service's public API
// ==========================================================================

interface AreaPermissionRow {
  area_id: number;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

interface DepartmentPermissionRow {
  department_id: number;
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
}

/** Map raw admin_area_permissions row to camelCase for audit payload. */
function mapAreaPermissionRow(row: AreaPermissionRow): Record<string, unknown> {
  return {
    areaId: row.area_id,
    canRead: row.can_read,
    canWrite: row.can_write,
    canDelete: row.can_delete,
  };
}

/** Map raw admin_department_permissions row to camelCase for audit payload. */
function mapDepartmentPermissionRow(row: DepartmentPermissionRow): Record<string, unknown> {
  return {
    departmentId: row.department_id,
    canRead: row.can_read,
    canWrite: row.can_write,
    canDelete: row.can_delete,
  };
}
