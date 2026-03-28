/**
 * Migration: Fix rotation pattern unique constraint
 * Date: 2026-02-19
 *
 * Problem:
 *   The UNIQUE index on (tenant_id, name) is unconditional — it blocks
 *   creating new patterns with the same name even when the old pattern
 *   was soft-deleted (is_active = 4) or deactivated (is_active = 0).
 *
 * Fix:
 *   Replace unconditional UNIQUE with a partial UNIQUE index that only
 *   enforces uniqueness for active patterns (is_active = 1).
 *
 * Dependencies:
 *   - shift_rotation_patterns table (baseline)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Drop the unconditional unique index
    DROP INDEX IF EXISTS idx_19543_uk_rotation_pattern_name;

    -- Create partial unique index: only active patterns must have unique names per tenant
    CREATE UNIQUE INDEX uk_rotation_pattern_name_active
      ON shift_rotation_patterns (tenant_id, name)
      WHERE is_active = 1;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Drop the partial unique index
    DROP INDEX IF EXISTS uk_rotation_pattern_name_active;

    -- Recreate the original unconditional unique index
    CREATE UNIQUE INDEX idx_19543_uk_rotation_pattern_name
      ON shift_rotation_patterns (tenant_id, name);
  `);
}
