/**
 * Migration 049: Add buffer_hours to tpm_maintenance_plans
 *
 * Purpose: Define maintenance time windows (base_time + buffer_hours = end time).
 * Existing plans get DEFAULT 4 hours. Enables schedule projection for cross-plan
 * conflict detection when creating new plans.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tpm_maintenance_plans
      ADD COLUMN buffer_hours NUMERIC(4,1) NOT NULL DEFAULT 4;

    ALTER TABLE tpm_maintenance_plans
      ADD CONSTRAINT chk_tpm_plans_buffer
      CHECK (buffer_hours > 0 AND buffer_hours <= 24);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tpm_maintenance_plans
      DROP CONSTRAINT IF EXISTS chk_tpm_plans_buffer;

    ALTER TABLE tpm_maintenance_plans
      DROP COLUMN IF EXISTS buffer_hours;
  `);
}
