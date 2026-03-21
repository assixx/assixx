/**
 * Migration: Audit Log Table Partitioning
 * Date: 2026-01-19 (original) / 2026-01-27 (wrapped)
 * ADR: ADR-009 Central Audit Logging
 *
 * Partitions audit_trail and root_logs tables by month for:
 * - 10-100x faster date-range queries
 * - Efficient data archival/deletion (DROP PARTITION vs DELETE)
 * - Consistent ~50MB RAM during exports
 *
 * ROLLBACK: Old tables remain as *_old suffix.
 */
import type { MigrationBuilder } from 'node-pg-migrate';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function up(pgm: MigrationBuilder): void {
  const sql = readFileSync(join(__dirname, 'archive', '004-audit-log-partitioning.sql'), 'utf-8');
  pgm.sql(sql);
}

export function down(): void {
  throw new Error(
    'Cannot auto-rollback partitioning migration. Manual rollback:\n' +
      'DROP TABLE audit_trail; ALTER TABLE audit_trail_old RENAME TO audit_trail;\n' +
      'DROP TABLE root_logs; ALTER TABLE root_logs_old RENAME TO root_logs;',
  );
}
