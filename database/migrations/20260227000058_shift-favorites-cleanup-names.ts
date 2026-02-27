/**
 * Migration: Shift favorites — clean up duplicate data + update names
 * Date: 2026-02-27
 *
 * Bug: Favorite names used only team.name (e.g. "Das B-Team"). When a team
 * is assigned to multiple machines, the second machine's favorite hits a
 * UNIQUE constraint on (tenant_id, user_id, name) → 409 CONFLICT.
 *
 * This data migration:
 * 1. Pre-check: detect duplicate (tenant_id, user_id, team_id, machine_id) combos
 * 2. Delete exact duplicates (keep lowest id per combo)
 * 3. Update names to "team_name - machine_name" format
 *
 * WARNING: One-way migration. Rollback restores old name format but cannot
 * restore deleted duplicate rows.
 *
 * Related schema migration: 20260227000059_shift-favorites-unique-constraint.ts
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Step 1: Delete exact duplicates (keep lowest id per combination)
    DELETE FROM shift_favorites
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM shift_favorites
      GROUP BY tenant_id, user_id, team_id, machine_id
    );

    -- Step 2: Verify no duplicates remain (FAIL LOUD)
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
          'shift_favorites still has % duplicate (tenant, user, team, machine) combos after cleanup',
          dup_count;
      END IF;
    END $$;

    -- Step 3: Update names to "team_name - machine_name" format
    -- Only update rows where machine_name is not empty
    UPDATE shift_favorites
    SET name = team_name || ' - ' || machine_name
    WHERE machine_name IS NOT NULL
      AND machine_name <> '';
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Restore old name format (team_name only)
  // WARNING: Deleted duplicates cannot be restored
  pgm.sql(`
    UPDATE shift_favorites
    SET name = team_name;
  `);
}
