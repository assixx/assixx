/**
 * Migration: TPM Execution Enhanced Fields
 * Date: 2026-02-23
 *
 * Adds 3 new columns to tpm_card_executions for real-world maintenance documentation:
 *
 *   1. no_issues_found  BOOLEAN  — "Ohne Beanstandung" checkbox (80% fast path)
 *   2. actual_duration_minutes INTEGER — IST-Dauer für SOLL/IST-Vergleich
 *   3. actual_staff_count      INTEGER — IST-MA-Anzahl für Ressourcenplanung
 *
 * Also makes execution_date client-provided (was auto-set to NOW() before).
 * The column already exists as DATE NOT NULL — no schema change needed,
 * only the backend service needs to accept it from the DTO.
 *
 * Truncates existing test data (4 executions + 3 photos) to allow NOT NULL
 * with DEFAULT on no_issues_found without conflict.
 *
 * References: brainstorming-TPM.md, ADR-026
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- Step 1: Truncate test data (photos first due to FK)
    -- ==========================================================================
    TRUNCATE TABLE tpm_card_execution_photos CASCADE;
    TRUNCATE TABLE tpm_card_executions CASCADE;

    -- ==========================================================================
    -- Step 2: Add enhanced documentation fields
    -- ==========================================================================

    -- "Ohne Beanstandung" — the 80% fast path for routine maintenance
    ALTER TABLE tpm_card_executions
      ADD COLUMN no_issues_found BOOLEAN NOT NULL DEFAULT false;

    -- IST-Dauer in Minuten (SOLL kommt aus tpm_time_estimates)
    ALTER TABLE tpm_card_executions
      ADD COLUMN actual_duration_minutes INTEGER;

    -- IST-MA-Anzahl (SOLL kommt aus tpm_time_estimates.staff_count)
    ALTER TABLE tpm_card_executions
      ADD COLUMN actual_staff_count INTEGER;

    -- ==========================================================================
    -- Step 3: Constraints
    -- ==========================================================================

    ALTER TABLE tpm_card_executions
      ADD CONSTRAINT chk_tpm_exec_duration
        CHECK (actual_duration_minutes IS NULL OR actual_duration_minutes > 0);

    ALTER TABLE tpm_card_executions
      ADD CONSTRAINT chk_tpm_exec_staff
        CHECK (actual_staff_count IS NULL OR actual_staff_count > 0);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tpm_card_executions
      DROP CONSTRAINT IF EXISTS chk_tpm_exec_staff;

    ALTER TABLE tpm_card_executions
      DROP CONSTRAINT IF EXISTS chk_tpm_exec_duration;

    ALTER TABLE tpm_card_executions
      DROP COLUMN IF EXISTS actual_staff_count;

    ALTER TABLE tpm_card_executions
      DROP COLUMN IF EXISTS actual_duration_minutes;

    ALTER TABLE tpm_card_executions
      DROP COLUMN IF EXISTS no_issues_found;
  `);
}
