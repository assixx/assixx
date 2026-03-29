/**
 * Migration: TPM Plan Approval Version Columns
 *
 * Purpose: Add approval_version + revision_minor to tpm_maintenance_plans and
 * tpm_plan_revisions for the TPM Plan Approval feature (ADR-037 integration).
 *
 * approval_version = approval count (major version displayed as v{approval_version}.{revision_minor})
 * revision_minor   = draft edits since last approval
 * revision_number  = UNCHANGED (total edit count, no semantic shift)
 *
 * Existing active/archived plans are backfilled with approval_version = 1 (legacy-approved).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- 1. Add columns to tpm_maintenance_plans
    ALTER TABLE tpm_maintenance_plans
      ADD COLUMN approval_version INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN revision_minor INTEGER NOT NULL DEFAULT 0;

    -- 2. Add columns to tpm_plan_revisions
    ALTER TABLE tpm_plan_revisions
      ADD COLUMN approval_version INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN revision_minor INTEGER NOT NULL DEFAULT 0;

    -- 3. Backfill existing active + archived plans as legacy-approved (v1.0)
    UPDATE tpm_maintenance_plans
      SET approval_version = 1
      WHERE is_active IN (1, 3);

    -- 4. Backfill existing revisions as legacy-approved
    UPDATE tpm_plan_revisions
      SET approval_version = 1;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tpm_plan_revisions
      DROP COLUMN IF EXISTS revision_minor,
      DROP COLUMN IF EXISTS approval_version;

    ALTER TABLE tpm_maintenance_plans
      DROP COLUMN IF EXISTS revision_minor,
      DROP COLUMN IF EXISTS approval_version;
  `);
}
