/**
 * Shared types and constants for the tenant deletion service split.
 *
 * WHY this file exists:
 * The tenant deletion domain has 4 sub-services (executor, exporter, analyzer, audit)
 * that share interfaces and constants. Single source of truth prevents drift.
 */
import type { QueryResultRow } from 'pg';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Grace period before tenant deletion (in minutes)
 * Default: 43200 (30 days)
 * For testing: Set TENANT_DELETION_GRACE_MINUTES=5 in .env
 */
const parsedGracePeriod = Number(process.env['TENANT_DELETION_GRACE_MINUTES']);
export const GRACE_PERIOD_MINUTES: number = parsedGracePeriod > 0 ? parsedGracePeriod : 43200;

/**
 * Tables excluded from normal tenant deletion.
 * WHY: These contain audit/compliance data with legal retention requirements.
 */
export const CRITICAL_TABLES: readonly string[] = [
  'tenant_deletion_queue',
  'deletion_audit_trail',
  'tenant_deletion_backups',
  'archived_tenant_invoices',
  'tenant_data_exports',
  'legal_holds',
  'audit_trail',
];

/**
 * Maximum number of deletion passes before giving up.
 * WHY: Prevents infinite loops in case of circular FK dependencies.
 */
export const MAX_DELETION_PASSES = 15;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface TableNameRow extends QueryResultRow {
  TABLE_NAME: string;
}

/**
 * PostgreSQL COUNT(*) returns bigint which pg driver serializes as STRING.
 * ALWAYS use Number() when using this value in arithmetic operations.
 */
export interface CountResult extends QueryResultRow {
  count: string | number;
}

export interface TenantInfoRow extends QueryResultRow {
  id: number;
  company_name: string;
  subdomain: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  created_at?: string | Date;
}

export interface QueueRow extends QueryResultRow {
  id: number;
  tenant_id: number;
  approval_status: string;
  created_by: number;
  status: string;
  scheduled_deletion_date?: Date;
  created_at?: Date;
  deletion_reason?: string;
  ip_address?: string;
}

export interface LegalHoldResult extends QueryResultRow {
  reason: string;
  active: number;
}

export interface DeletionResult {
  success: boolean;
  tablesAffected: number;
  totalRowsDeleted: number;
  details: { table: string; deleted: number }[];
}

export interface DeletionLog {
  table: string;
  deleted: number;
}

export interface LegalHoldRow extends QueryResultRow {
  id: number;
  tenant_id: number;
  reason?: string;
  active: number;
}

/**
 * Minimal user interface for email notifications.
 * Only the fields needed for sending deletion warning emails.
 */
export interface DeletionWarningUser extends QueryResultRow {
  email: string;
  first_name: string | null;
  last_name: string | null;
}
