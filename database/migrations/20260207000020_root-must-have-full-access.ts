/**
 * Migration: Root must have full access
 * Date: 2026-02-07
 *
 * Enforces at DB level that users with role='root' MUST have has_full_access=true.
 * Prevents any INSERT or UPDATE that would set has_full_access=false for root users.
 *
 * Defense-in-depth: Even if application code has a bug, the DB rejects invalid state.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Safety: fix any existing root users that somehow have has_full_access = false
    UPDATE users SET has_full_access = true WHERE role = 'root' AND has_full_access = false;

    -- Enforce: root users MUST always have has_full_access = true
    ALTER TABLE users ADD CONSTRAINT chk_root_full_access
      CHECK (role != 'root'::users_role OR has_full_access = true);

    COMMENT ON CONSTRAINT chk_root_full_access ON users IS
      'Root users must always have has_full_access=true. Defense-in-depth.';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_root_full_access;`);
}
