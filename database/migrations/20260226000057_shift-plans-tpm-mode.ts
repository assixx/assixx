/**
 * Migration: Add is_tpm_mode to shift_plans
 * Date: 2026-02-26
 *
 * Adds a boolean flag to shift_plans that marks a plan as a TPM (maintenance) plan.
 * When an admin activates "TPM-Modus" in the shift planning UI and saves,
 * the plan gets is_tpm_mode = true. This distinguishes maintenance teams
 * from production teams on the same date/shift — critical for the TPM
 * Gesamtansicht to show which employees are assigned to which maintenance.
 *
 * See: docs/FEAT_TPM_SHIFT_ASSIGNMENT_MASTERPLAN.md
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Add TPM mode flag (all existing plans default to false = production)
    ALTER TABLE shift_plans
      ADD COLUMN is_tpm_mode BOOLEAN NOT NULL DEFAULT false;

    -- Partial index: only TPM plans need fast lookup
    CREATE INDEX idx_shift_plans_tpm_mode
      ON shift_plans (tenant_id)
      WHERE is_tpm_mode = true;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_shift_plans_tpm_mode;
    ALTER TABLE shift_plans DROP COLUMN IF EXISTS is_tpm_mode;
  `);
}
