/**
 * Migration: <DESCRIPTION>
 *
 * Purpose: <WHY this migration exists>
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- TODO: Implement up migration
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- TODO: Implement down migration
  `);
}
