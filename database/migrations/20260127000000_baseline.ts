/**
 * Migration: Baseline Schema
 * Date: 2026-01-27
 *
 * Applies the complete database schema (109 tables, 89 RLS policies, 474 indexes).
 * For fresh installs only. On existing databases, use --fake to skip execution.
 *
 * Source: archive/001_baseline_complete_schema.sql (676KB pg_dump)
 */
import type { MigrationBuilder } from 'node-pg-migrate';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function up(pgm: MigrationBuilder): void {
  const schemaSQL = readFileSync(
    join(__dirname, 'archive', '001_baseline_complete_schema.sql'),
    'utf-8',
  );
  pgm.sql(schemaSQL);
}

export function down(): void {
  throw new Error(
    'Cannot rollback baseline migration. Restore from pg_dump backup instead.',
  );
}
