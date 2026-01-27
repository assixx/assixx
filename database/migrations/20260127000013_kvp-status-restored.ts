/**
 * Migration: Add 'restored' status to kvp_suggestions_status ENUM
 * Date: 2026-01-23 (original) / 2026-01-27 (wrapped)
 *
 * Adds 'restored' (Wiederhergestellt) status for unarchived KVP suggestions.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(
    `ALTER TYPE kvp_suggestions_status ADD VALUE IF NOT EXISTS 'restored';`,
  );
}

export function down(): void {
  throw new Error(
    'Cannot remove ENUM values in PostgreSQL. The "restored" value will remain.',
  );
}
