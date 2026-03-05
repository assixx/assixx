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

/** CSV column headers */
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
   */
  private addEntityInfo(parts: string[], entry: UnifiedLogEntry): void {
    if (entry.entityType !== '') {
      parts.push(`entity=${entry.entityType}`);
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
   * Add optional markers (details, changes, status, source) to TXT output.
   */
  private addOptionalMarkers(parts: string[], entry: UnifiedLogEntry): void {
    // Details (truncated)
    if (entry.details !== undefined && entry.details !== '') {
      const truncated =
        entry.details.length > 50 ? `${entry.details.slice(0, 47)}...` : entry.details;
      parts.push(`"${truncated}"`);
    }

    // Change summary for mutations
    this.addChangeSummary(parts, entry);

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
   * Shows which fields were affected without full JSON dump.
   */
  private addChangeSummary(parts: string[], entry: UnifiedLogEntry): void {
    if (entry.changes === undefined) {
      return;
    }

    const updated = entry.changes['updated'] as Record<string, unknown> | undefined;
    const deleted = entry.changes['deleted'] as Record<string, unknown> | undefined;

    if (entry.action === 'update' && updated !== undefined) {
      const fields = Object.keys(updated).filter((k: string) => k !== '_http').slice(0, 5);
      if (fields.length > 0) {
        parts.push(`[changed: ${fields.join(', ')}]`);
      }
    } else if (entry.action === 'delete' && deleted !== undefined) {
      const fields = Object.keys(deleted).filter((k: string) => k !== '_http').slice(0, 5);
      if (fields.length > 0) {
        parts.push(`[deleted-fields: ${fields.join(', ')}]`);
      }
    }
  }

  /**
   * Generate CSV header row.
   */
  generateCsvHeader(): string {
    return CSV_HEADERS.join(',') + '\n';
  }

  /**
   * Format a single log entry as CSV row.
   */
  formatLogAsCsv(entry: UnifiedLogEntry): string {
    const row = [
      entry.id,
      entry.timestamp,
      entry.source,
      entry.userId,
      this.escapeCsvField(entry.userName),
      this.escapeCsvField(entry.userRole),
      this.escapeCsvField(entry.action),
      this.escapeCsvField(entry.entityType),
      entry.entityId ?? '',
      this.escapeCsvField(entry.details ?? ''),
      entry.ipAddress ?? '',
      entry.status,
      entry.wasRoleSwitched === true ? 'Yes' : 'No',
    ];

    return row.join(',') + '\n';
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
