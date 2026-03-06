/**
 * Migration: TPM Card Weekday Override
 * Date: 2026-02-21
 *
 * Adds optional weekday_override column to tpm_cards.
 * Allows individual weekly cards to use a different weekday
 * than the plan's base_weekday.
 *
 * Constraint: weekday_override may only be set on weekly cards (0-6, Mo-So).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tpm_cards
      ADD COLUMN weekday_override INTEGER;

    ALTER TABLE tpm_cards
      ADD CONSTRAINT chk_tpm_cards_weekday_override
      CHECK (
        weekday_override IS NULL
        OR (
          interval_type = 'weekly'
          AND weekday_override >= 0
          AND weekday_override <= 6
        )
      );
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tpm_cards DROP CONSTRAINT IF EXISTS chk_tpm_cards_weekday_override;
    ALTER TABLE tpm_cards DROP COLUMN IF EXISTS weekday_override;
  `);
}
