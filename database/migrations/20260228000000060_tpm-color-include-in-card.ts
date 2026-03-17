/**
 * Migration: Add include_in_card to tpm_color_config
 * Date: 2026-02-28
 *
 * Adds a boolean flag to control whether the interval color
 * should be used on Kamishibai board cards in "Erledigt" (green) state.
 *
 * When include_in_card = true for an interval type (e.g., 'daily'),
 * the board card uses the interval color instead of the status green color.
 * Status color entries always have include_in_card = false (default).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tpm_color_config
    ADD COLUMN include_in_card BOOLEAN NOT NULL DEFAULT false;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tpm_color_config
    DROP COLUMN include_in_card;
  `);
}
