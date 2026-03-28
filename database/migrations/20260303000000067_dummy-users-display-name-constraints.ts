/**
 * Migration: Add display_name column + dummy constraints to users table
 * Date: 2026-03-03
 *
 * Part 2 of 2 for Dummy Users feature.
 *
 * Purpose:
 *   Adds the display_name column and CHECK constraints for the 'dummy' role.
 *   The enum value 'dummy' was added and committed in migration 066.
 *
 * Changes:
 *   1. Add display_name VARCHAR(100) column to users table
 *   2. Add CHECK constraint: dummies cannot have has_full_access=true
 *   3. Add CHECK constraint: dummies must have a display_name
 *   4. Add partial index on display_name for search
 *
 * Dependencies:
 *   - Migration 066 (users_role enum must contain 'dummy')
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // ====================================================================
  // Step 1: Add display_name column
  // ====================================================================
  pgm.sql(`ALTER TABLE users ADD COLUMN display_name VARCHAR(100);`);

  // ====================================================================
  // Step 2: CHECK constraint — dummies cannot have full access
  // ====================================================================
  pgm.sql(`
    ALTER TABLE users ADD CONSTRAINT chk_dummy_no_full_access
      CHECK (role != 'dummy' OR has_full_access = false);
  `);

  // ====================================================================
  // Step 3: CHECK constraint — dummies must have a display_name
  // ====================================================================
  pgm.sql(`
    ALTER TABLE users ADD CONSTRAINT chk_dummy_display_name
      CHECK (role != 'dummy' OR display_name IS NOT NULL);
  `);

  // ====================================================================
  // Step 4: Partial index on display_name for search queries
  // ====================================================================
  pgm.sql(`
    CREATE INDEX idx_users_display_name
      ON users(display_name)
      WHERE display_name IS NOT NULL;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP INDEX IF EXISTS idx_users_display_name;`);
  pgm.sql(`ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_dummy_display_name;`);
  pgm.sql(`ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_dummy_no_full_access;`);
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS display_name;`);
}
