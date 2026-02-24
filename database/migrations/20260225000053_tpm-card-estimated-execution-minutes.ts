/**
 * Migration 053: Add estimated_execution_minutes to tpm_cards
 *
 * Purpose: Optional per-card execution time estimate (minutes).
 * Allows admins to define how long a specific maintenance task takes.
 * Nullable — not every card needs an estimate.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tpm_cards
      ADD COLUMN estimated_execution_minutes INTEGER;

    ALTER TABLE tpm_cards
      ADD CONSTRAINT chk_tpm_cards_estimated_minutes
      CHECK (estimated_execution_minutes IS NULL
        OR (estimated_execution_minutes >= 1 AND estimated_execution_minutes <= 10080));
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tpm_cards
      DROP CONSTRAINT IF EXISTS chk_tpm_cards_estimated_minutes;

    ALTER TABLE tpm_cards
      DROP COLUMN IF EXISTS estimated_execution_minutes;
  `);
}
