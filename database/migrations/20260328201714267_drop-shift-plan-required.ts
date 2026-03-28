/**
 * Migration: Drop shift_plan_required from tpm_maintenance_plans
 *
 * Purpose: The shiftPlanRequired feature is deprecated. The slot assistant
 * no longer checks for shift plan coverage (E15 validation removed).
 * The column and its default value are no longer used by any code path.
 *
 * Lossy rollback: down() restores the column with DEFAULT true but cannot
 * recover per-plan values that existed before this migration.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tpm_maintenance_plans DROP COLUMN shift_plan_required;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tpm_maintenance_plans
      ADD COLUMN shift_plan_required BOOLEAN NOT NULL DEFAULT true;
  `);
}
