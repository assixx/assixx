/**
 * Migration: Drop role_label from approval_configs
 *
 * Purpose: role_label was a placeholder for Custom Roles (V2).
 * V1 uses only approver_type='user' + lead types — no label needed.
 * Dropping now prevents unused columns from accumulating.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE approval_configs DROP COLUMN role_label;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE approval_configs ADD COLUMN role_label VARCHAR(100);
  `);
}
