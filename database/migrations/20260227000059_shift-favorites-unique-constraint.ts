/**
 * Migration: Shift favorites — replace UNIQUE constraint
 * Date: 2026-02-27
 *
 * Replaces the MySQL-legacy UNIQUE on (tenant_id, user_id, name) with a
 * proper UNIQUE on (tenant_id, user_id, team_id, machine_id).
 *
 * The old constraint was name-based, which broke when the same team had
 * multiple machines assigned. The new constraint ensures uniqueness on
 * actual entity IDs — one favorite per user per team+machine combo.
 *
 * Depends on: 20260227000058_shift-favorites-cleanup-names.ts
 *   (duplicates must be cleaned before this constraint can be created)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Pre-check: no duplicate combos must exist (FAIL LOUD)
    DO $$
    DECLARE
      dup_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO dup_count
      FROM (
        SELECT tenant_id, user_id, team_id, machine_id
        FROM shift_favorites
        GROUP BY tenant_id, user_id, team_id, machine_id
        HAVING COUNT(*) > 1
      ) duplicates;

      IF dup_count > 0 THEN
        RAISE EXCEPTION
          'Cannot create UNIQUE constraint: % duplicate (tenant, user, team, machine) combos exist',
          dup_count;
      END IF;
    END $$;

    -- Drop MySQL-legacy UNIQUE constraint
    DROP INDEX idx_19510_unique_user_favorite;

    -- Create proper UNIQUE constraint on entity IDs
    ALTER TABLE shift_favorites
      ADD CONSTRAINT unique_shift_favorites_user_combination
      UNIQUE (tenant_id, user_id, team_id, machine_id);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Drop the new constraint
    ALTER TABLE shift_favorites
      DROP CONSTRAINT IF EXISTS unique_shift_favorites_user_combination;

    -- Restore legacy UNIQUE on name
    CREATE UNIQUE INDEX idx_19510_unique_user_favorite
      ON shift_favorites (tenant_id, user_id, name);
  `);
}
