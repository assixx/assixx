/**
 * Log Formatters Service
 *
 * Provides formatting utilities for exporting logs in different formats:
 * - TXT: Human-readable format with header and footer
 * - CSV: Standard CSV with headers
 * - JSON: Streaming JSON array
 *
 * @see ADR-009 Central Audit Logging
 */
import { Injectable } from '@nestjs/common';

import type { ExportMetadata, UnifiedLogEntry } from './dto/export-logs.dto.js';

/**
 * CSV column headers.
 *
 * NOTE: New columns are appended at the end (Request ID, HTTP Method, Endpoint).
 * This preserves backward-compat for any external CSV consumers that index by
 * column position — old positions stay stable, new data is purely additive.
 * ADR-009 P1-1/P1-2 (2026-04-22).
 */
const CSV_HEADERS = [
  'ID',
  'Timestamp',
  'Source',
  'User ID',
  'User Name',
  'User Role',
  'Action',
  'Entity Type',
  'Entity ID',
  'Details',
  'IP Address',
  'Status',
  'Role Switched',
  // Compliance enrichment (ADR-009 P1-1, P1-2):
  'Request ID',
  'HTTP Method',
  'Endpoint',
];

@Injectable()
export class LogFormattersService {
  /**
   * Get header for the specified format.
   * Unified method for stream generation.
   */
  getHeader(format: 'json' | 'csv' | 'txt', metadata?: ExportMetadata): string {
    switch (format) {
      case 'txt':
        return metadata !== undefined ? this.generateTxtHeader(metadata) : '';
      case 'csv':
        return this.generateCsvHeader();
      case 'json':
        return '[\n';
    }
  }

  /**
   * Format a single entry for the specified format.
   * Unified method for stream generation.
   */
  formatEntry(entry: UnifiedLogEntry, format: 'json' | 'csv' | 'txt', isFirst: boolean): string {
    switch (format) {
      case 'txt':
        return this.formatLogAsTxt(entry) + '\n';
      case 'csv':
        return this.formatLogAsCsv(entry);
      case 'json':
        return (isFirst ? '' : ',\n') + this.formatLogAsJson(entry);
    }
  }

  /**
   * Get footer for the specified format.
   * Unified method for stream generation.
   */
  getFooter(format: 'json' | 'csv' | 'txt'): string {
    switch (format) {
      case 'txt':
        return this.generateTxtFooter();
      case 'csv':
        return '';
      case 'json':
        return '\n]';
    }
  }

  /**
   * Generate TXT file header with metadata.
   */
  generateTxtHeader(metadata: ExportMetadata): string {
    const separator = '='.repeat(80);
    const tenantDisplay =
      metadata.tenantName !== undefined && metadata.tenantName !== ''
        ? `${metadata.tenantName} (ID: ${metadata.tenantId})`
        : `Tenant ID: ${metadata.tenantId}`;

    const sourceDisplay =
      metadata.source === 'all'
        ? 'audit_trail + root_logs'
        : metadata.source;

    return [
      separator,
      'ASSIXX AUDIT LOG EXPORT',
      `Tenant: ${tenantDisplay}`,
      `Source: ${sourceDisplay}`,
      `Period: ${this.formatDateForTxt(metadata.dateFrom)} to ${this.formatDateForTxt(metadata.dateTo)}`,
      `Generated: ${metadata.generatedAt}`,
      `Total Entries: ${metadata.totalEntries.toLocaleString('de-DE')}`,
      separator,
      '',
    ].join('\n');
  }

  /**
   * Generate TXT file footer.
   */
  generateTxtFooter(): string {
    const separator = '='.repeat(80);
    return [
      '',
      separator,
      'END OF EXPORT',
      separator,
      '',
    ].join('\n');
  }

  /**
   * Format a single log entry as TXT line.
   *
   * Format: [TIMESTAMP] ACTION entity=TYPE id=ID by=USER ip=IP [status]
   */
  formatLogAsTxt(entry: UnifiedLogEntry): string {
    const parts: string[] = [
      `[${this.formatDateForTxt(entry.timestamp)}]`,
      entry.action.toUpperCase(),
    ];

    // Add entity and user info
    this.addEntityInfo(parts, entry);
    this.addUserInfo(parts, entry);

    // Add optional markers
    this.addOptionalMarkers(parts, entry);

    return parts.join(' ');
  }

  /**
   * Add entity-related parts to TXT output.
   *
   * Normalizes entity_type for cross-source consistency (P2-2):
   * - audit_trail uses kebab-case (extractResourceType → "shift-plan")
   * - root_logs uses snake_case (ActivityEntityType union → "shift_plan")
   * Display unifies to kebab-case so auditor-grep finds both.
   */
  private addEntityInfo(parts: string[], entry: UnifiedLogEntry): void {
    if (entry.entityType !== '') {
      parts.push(`entity=${this.normalizeEntityType(entry.entityType)}`);
    }
    if (entry.entityId !== undefined) {
      parts.push(`id=${entry.entityId}`);
    }
  }

  /**
   * Add user-related parts to TXT output.
   */
  private addUserInfo(parts: string[], entry: UnifiedLogEntry): void {
    parts.push(`by=${entry.userName}`);
    if (entry.userRole !== '') {
      parts.push(`role=${entry.userRole}`);
    }
    if (entry.ipAddress !== undefined && entry.ipAddress !== '') {
      parts.push(`ip=${entry.ipAddress}`);
    }
  }

  /**
   * Add optional markers (details, HTTP context, changes, request-id, status, source).
   *
   * Render order optimized for auditor scan-flow (ADR-009 P1-1, P1-2):
   *   timestamp ACTION entity=X id=N by=user role=R ip=IP "details"
   *   METHOD /endpoint
   *   [diff: name: "old" → "new"]      ← compliance-grade evidence (was missing!)
   *   [req:abcd1234]                   ← session correlation
   *   [FAILURE] [ROLE-SWITCHED] [audit_trail]
   */
  private addOptionalMarkers(parts: string[], entry: UnifiedLogEntry): void {
    // Details (resource name from DB, truncated)
    if (entry.details !== undefined && entry.details !== '') {
      const truncated =
        entry.details.length > 50 ? `${entry.details.slice(0, 47)}...` : entry.details;
      parts.push(`"${truncated}"`);
    }

    // HTTP method + endpoint (P1-2): "LIST entity=user" alone is ambiguous
    // (30+ user endpoints) — auditor needs the actual URL.
    const endpoint = this.getEndpoint(entry);
    if (endpoint !== '') {
      parts.push(`${this.getHttpMethod(entry)} ${endpoint}`.trim());
    }

    // Change summary for mutations — renders actual values (P0-2),
    // not just field names. Required for GDPR Art. 30 / SOC2 compliance.
    this.addChangeSummary(parts, entry);

    // Request correlation ID (P1-1) — auditor groups N audit rows from same
    // HTTP request via shared request_id. Truncated to 8 chars for scanability;
    // full UUID in JSON/CSV export.
    if (entry.requestId !== undefined && entry.requestId !== '') {
      parts.push(`[req:${entry.requestId.slice(0, 8)}]`);
    }

    // Status and markers
    if (entry.status === 'failure') {
      parts.push('[FAILURE]');
    }
    if (entry.wasRoleSwitched === true) {
      parts.push('[ROLE-SWITCHED]');
    }
    parts.push(`[${entry.source}]`);
  }

  /**
   * Add a condensed change summary for UPDATE/DELETE/CREATE actions.
   *
   * Renders ACTUAL VALUES (ADR-009 P0-2 fix, 2026-04-22) — previously this
   * showed only field names ("[changed: name, type]") which is useless for
   * compliance audits. GDPR Art. 30 + SOC2 require evidence of WHAT changed,
   * not just WHICH columns. The values are already sanitized at write time
   * (see `audit.helpers.ts:sanitizeData` — passwords/tokens → [REDACTED]).
   *
   * Output limits keep TXT scannable; full payload remains in JSON export.
   */
  private addChangeSummary(parts: string[], entry: UnifiedLogEntry): void {
    if (entry.changes === undefined) {
      return;
    }

    if (entry.action === 'update') {
      this.addUpdateMarker(parts, entry.changes);
    } else if (entry.action === 'delete') {
      this.addDeleteMarker(parts, entry.changes);
    } else if (entry.action === 'create') {
      this.addCreateMarker(parts, entry.changes);
    }
  }

  /** UPDATE → `[diff: name: "old" → "new"]`. */
  private addUpdateMarker(parts: string[], changes: Record<string, unknown>): void {
    const updated = changes['updated'] as Record<string, unknown> | undefined;
    if (updated === undefined) return;
    const previous = changes['previous'] as Record<string, unknown> | undefined;
    const diff = this.formatUpdateDiff(previous, updated);
    if (diff !== '') parts.push(`[diff: ${diff}]`);
  }

  /** DELETE → `[deleted: name="value", ...]` from pre-fetched snapshot. */
  private addDeleteMarker(parts: string[], changes: Record<string, unknown>): void {
    const deleted = changes['deleted'] as Record<string, unknown> | undefined;
    if (deleted === undefined) return;
    const values = this.formatFieldValues(deleted);
    if (values !== '') parts.push(`[deleted: ${values}]`);
  }

  /** CREATE → `[created: name="value", ...]` from sanitized request body. */
  private addCreateMarker(parts: string[], changes: Record<string, unknown>): void {
    const created = changes['created'] as Record<string, unknown> | undefined;
    if (created === undefined) return;
    const values = this.formatFieldValues(created);
    if (values !== '') parts.push(`[created: ${values}]`);
  }

  /**
   * Format UPDATE diff as `field: oldValue → newValue` pairs.
   * Limited to first 5 fields to keep TXT line scannable; full data in JSON.
   * `(new)` marker appears when pre-mutation snapshot is missing — typically
   * because the resource_type lacks a RESOURCE_TABLE_MAP entry (ADR-009 P0-3).
   */
  private formatUpdateDiff(
    previous: Record<string, unknown> | undefined,
    updated: Record<string, unknown>,
  ): string {
    const fields = Object.keys(updated).filter((k: string) => k !== '_http').slice(0, 5);
    return fields
      .map((k: string) => {
        const oldVal =
          previous !== undefined && k in previous ? this.formatValue(previous[k]) : '(new)';
        const newVal = this.formatValue(updated[k]);
        return `${k}: ${oldVal} → ${newVal}`;
      })
      .join('; ');
  }

  /**
   * Format CREATE/DELETE payload as `field=value` pairs.
   * Limited to first 5 fields; full data in JSON.
   */
  private formatFieldValues(data: Record<string, unknown>): string {
    const fields = Object.keys(data).filter((k: string) => k !== '_http').slice(0, 5);
    return fields.map((k: string) => `${k}=${this.formatValue(data[k])}`).join(', ');
  }

  /**
   * Format a single value for TXT/CSV display.
   * - Strings: quoted, truncated >30 chars, escaped quotes
   * - Numbers/booleans: as-is
   * - Arrays: `[N]` (length only)
   * - Objects: `{…}` (placeholder; full data in JSON)
   * - null/undefined: `null`
   */
  private formatValue(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') {
      const truncated = value.length > 30 ? `${value.slice(0, 27)}...` : value;
      return `"${truncated.replaceAll('"', '\\"')}"`;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'bigint') return `${value.toString()}n`;
    if (Array.isArray(value)) return `[${value.length}]`;
    if (typeof value === 'object') return '{…}';
    // Catch-all for `function`/`symbol` — non-stringifiable safely.
    // Audit data should never contain these (sanitizeData filters request bodies).
    return '?';
  }

  /**
   * Extract HTTP method from `changes._http` JSONB metadata.
   * Returns '' when missing — entries pre-dating the metadata schema or
   * sources without HTTP context (root_logs business events).
   */
  private getHttpMethod(entry: UnifiedLogEntry): string {
    if (entry.changes === undefined) return '';
    const http = entry.changes['_http'] as { method?: string } | undefined;
    return http?.method ?? '';
  }

  /**
   * Extract HTTP endpoint from `changes._http` JSONB metadata.
   * Returns '' when missing — see getHttpMethod note.
   */
  private getEndpoint(entry: UnifiedLogEntry): string {
    if (entry.changes === undefined) return '';
    const http = entry.changes['_http'] as { endpoint?: string } | undefined;
    return http?.endpoint ?? '';
  }

  /**
   * Normalize entity_type for cross-source consistency (ADR-009 P2-2).
   * audit_trail uses kebab-case, root_logs uses snake_case — we display
   * unified kebab-case so `grep "shift-plan"` finds entries from both tables.
   */
  private normalizeEntityType(entityType: string): string {
    return entityType.replaceAll('_', '-');
  }

  /**
   * Generate CSV header row.
   */
  generateCsvHeader(): string {
    return CSV_HEADERS.join(',') + '\n';
  }

  /**
   * Format a single log entry as CSV row.
   *
   * Column order MUST match CSV_HEADERS. Three trailing columns added
   * by ADR-009 P1-1/P1-2 (Request ID, HTTP Method, Endpoint) for
   * compliance auditing — append-only to keep position indices stable
   * for any external CSV consumers.
   *
   * entity_type is normalized (snake → kebab) for cross-source consistency
   * — see normalizeEntityType for rationale.
   */
  formatLogAsCsv(entry: UnifiedLogEntry): string {
    const row = [
      ...this.buildCoreCsvColumns(entry),
      ...this.buildEnrichmentCsvColumns(entry),
    ];

    return row.join(',') + '\n';
  }

  /** 13 base columns — kept stable for backward-compat with CSV consumers. */
  private buildCoreCsvColumns(entry: UnifiedLogEntry): (string | number)[] {
    return [
      entry.id,
      entry.timestamp,
      entry.source,
      entry.userId,
      this.escapeCsvField(entry.userName),
      this.escapeCsvField(entry.userRole),
      this.escapeCsvField(entry.action),
      this.escapeCsvField(this.normalizeEntityType(entry.entityType)),
      entry.entityId ?? '',
      this.escapeCsvField(entry.details ?? ''),
      entry.ipAddress ?? '',
      entry.status,
      entry.wasRoleSwitched === true ? 'Yes' : 'No',
    ];
  }

  /** 3 enrichment columns added by ADR-009 P1-1/P1-2 (compliance). */
  private buildEnrichmentCsvColumns(entry: UnifiedLogEntry): string[] {
    return [
      this.escapeCsvField(entry.requestId ?? ''),
      this.escapeCsvField(this.getHttpMethod(entry)),
      this.escapeCsvField(this.getEndpoint(entry)),
    ];
  }

  /**
   * Format a single log entry as JSON line.
   * For streaming JSON array.
   */
  formatLogAsJson(entry: UnifiedLogEntry): string {
    return JSON.stringify(entry);
  }

  /**
   * Escape a field for CSV output.
   * Wraps in quotes if it contains comma, quote, or newline.
   */
  private escapeCsvField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      // Escape double quotes by doubling them
      const escaped = value.replaceAll('"', '""');
      return `"${escaped}"`;
    }
    return value;
  }

  /**
   * Format ISO date string for TXT output.
   * Returns: YYYY-MM-DD HH:mm:ss
   */
  private formatDateForTxt(isoDate: string): string {
    try {
      const date = new Date(isoDate);
      const pad = (n: number): string => n.toString().padStart(2, '0');

      return [
        date.getFullYear(),
        '-',
        pad(date.getMonth() + 1),
        '-',
        pad(date.getDate()),
        ' ',
        pad(date.getHours()),
        ':',
        pad(date.getMinutes()),
        ':',
        pad(date.getSeconds()),
      ].join('');
    } catch {
      return isoDate;
    }
  }
}
