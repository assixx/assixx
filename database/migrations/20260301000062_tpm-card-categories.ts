/**
 * Migration: Add card categories to TPM cards
 *
 * Purpose: Each TPM card can be categorized as Reinigung (cleaning),
 * Wartung (maintenance), and/or Instandhaltung (repair).
 * Stored as PostgreSQL array for multi-select support.
 *
 * Changes:
 *   1. CREATE TYPE tpm_card_category ENUM (reinigung, wartung, instandhaltung)
 *   2. ADD COLUMN card_categories tpm_card_category[] on tpm_cards
 *   3. GIN index for array containment queries (@>, &&)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- 1. Create ENUM type
    CREATE TYPE tpm_card_category AS ENUM ('reinigung', 'wartung', 'instandhaltung');

    -- 2. Add array column (empty array = not yet categorized)
    ALTER TABLE tpm_cards
      ADD COLUMN card_categories tpm_card_category[] NOT NULL DEFAULT '{}'::tpm_card_category[];

    -- 3. GIN index for efficient array queries (e.g. WHERE card_categories @> '{reinigung}')
    CREATE INDEX idx_tpm_cards_categories
      ON tpm_cards USING GIN (card_categories);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_tpm_cards_categories;
    ALTER TABLE tpm_cards DROP COLUMN IF EXISTS card_categories;
    DROP TYPE IF EXISTS tpm_card_category;
  `);
}
