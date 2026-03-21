/**
 * Migration: Cleanup orphan deputy_lead position entries
 *
 * Purpose: After renaming deputy_lead → team_deputy_lead (migration 112),
 * a backend restart with old code re-created deputy_lead via ensureSystemPositions().
 * This removes the orphan entries that are no longer referenced by SYSTEM_POSITIONS.
 *
 * WARNING: One-way migration. Rollback does NOT restore deleted rows.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    DELETE FROM position_catalog
    WHERE name = 'deputy_lead' AND is_system = true;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`-- Lossy: orphan rows are not restored`);
}
