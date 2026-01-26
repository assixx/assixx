/**
 * Export Logs DTO
 *
 * Query parameters for exporting unified audit logs (audit_trail + root_logs).
 * Supports streaming export in JSON, CSV, and TXT formats.
 *
 * @see ADR-009 Central Audit Logging
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IdSchema } from '../../../schemas/common.schema.js';

/**
 * Export format enum - JSON, CSV, or human-readable TXT
 */
export const ExportFormatSchema = z.enum(['json', 'csv', 'txt'], {
  message: 'Format must be json, csv, or txt',
});

/**
 * Log source filter - audit_trail, root_logs, or both
 */
export const LogSourceSchema = z.enum(['audit_trail', 'root_logs', 'all'], {
  message: 'Source must be audit_trail, root_logs, or all',
});

/**
 * Date string schema - accepts YYYY-MM-DD or ISO 8601
 * More flexible than DateSchema for user input
 *
 * Uses string parsing instead of regex for security (avoid ReDoS)
 */
const FlexibleDateSchema = z.string().refine(
  (val: string) => {
    // Validate date by parsing - safer than regex
    // Accepts: YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS, ISO 8601 with timezone
    const parsed = new Date(val);
    if (Number.isNaN(parsed.getTime())) return false;

    // Additional check: must start with 4-digit year
    const year = Number.parseInt(val.slice(0, 4), 10);
    return year >= 1900 && year <= 2100;
  },
  { message: 'Invalid date format. Use YYYY-MM-DD or ISO 8601' },
);

/**
 * Export logs query schema
 *
 * CRITICAL: dateFrom and dateTo are REQUIRED for exports
 * to prevent accidental full table scans on large datasets.
 */
export const ExportLogsQuerySchema = z.object({
  /** Export format (default: json) */
  format: ExportFormatSchema.default('json'),

  /** Start date - REQUIRED to prevent full table scans */
  dateFrom: FlexibleDateSchema,

  /** End date - REQUIRED to prevent full table scans */
  dateTo: FlexibleDateSchema,

  /** Log source filter (default: all) */
  source: LogSourceSchema.default('all'),

  /** Filter by specific action (optional) */
  action: z.string().trim().min(1).optional(),

  /** Filter by specific user ID (optional) */
  userId: IdSchema.optional(),

  /** Filter by specific entity type (optional) */
  entityType: z.string().trim().min(1).optional(),
});

/**
 * DTO for export logs query parameters
 */
export class ExportLogsQueryDto extends createZodDto(ExportLogsQuerySchema) {}

/**
 * Unified log entry - combines audit_trail and root_logs format
 *
 * Note: Optional properties use `| undefined` for exactOptionalPropertyTypes compatibility
 */
export interface UnifiedLogEntry {
  /** Unique ID (from source table) */
  id: number;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Tenant ID for multi-tenant isolation */
  tenantId: number;

  /** User who performed the action */
  userId: number;

  /** User display name */
  userName: string;

  /** User role at time of action */
  userRole: string;

  /** Source table: audit_trail or root_logs */
  source: 'audit_trail' | 'root_logs';

  /** Action performed (e.g., create, update, delete, login) */
  action: string;

  /** Type of entity affected */
  entityType: string;

  /** ID of entity affected (if applicable) */
  entityId?: number | undefined;

  /** Human-readable details or resource name */
  details?: string | undefined;

  /** Client IP address */
  ipAddress?: string | undefined;

  /** Action status */
  status: 'success' | 'failure';

  /** Changes made (JSON) - from audit_trail */
  changes?: Record<string, unknown> | undefined;

  /** Old values before change - from root_logs */
  oldValues?: Record<string, unknown> | undefined;

  /** New values after change - from root_logs */
  newValues?: Record<string, unknown> | undefined;

  /** Was this action performed during role switch? */
  wasRoleSwitched?: boolean | undefined;
}

/**
 * Export metadata included in TXT header
 *
 * Note: Optional properties use `| undefined` for exactOptionalPropertyTypes compatibility
 */
export interface ExportMetadata {
  tenantId: number;
  tenantName?: string | undefined;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  totalEntries: number;
  source: 'audit_trail' | 'root_logs' | 'all';
}
