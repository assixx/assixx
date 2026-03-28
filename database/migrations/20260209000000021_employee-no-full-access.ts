/**
 * Migration: Employee must NOT have full access
 * Date: 2026-02-09
 *
 * Enforces at DB level that users with role='employee' MUST have has_full_access=false.
 * Prevents any INSERT or UPDATE that would set has_full_access=true for employees.
 *
 * Complements chk_root_full_access (migration 20260207000020):
 * - Root: MUST be true  (chk_root_full_access)
 * - Employee: MUST be false (chk_employee_no_full_access) ← THIS
 * - Admin: can be true or false (no constraint)
 *
 * Defense-in-depth: Even if application code has a bug, the DB rejects invalid state.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Safety: fix any existing employees that somehow have has_full_access = true
    UPDATE users SET has_full_access = false WHERE role = 'employee' AND has_full_access = true;

    -- Enforce: employee users MUST always have has_full_access = false
    ALTER TABLE users ADD CONSTRAINT chk_employee_no_full_access
      CHECK (role != 'employee'::users_role OR has_full_access = false);

    COMMENT ON CONSTRAINT chk_employee_no_full_access ON users IS
      'Employees must never have has_full_access=true. Defense-in-depth. See also chk_root_full_access.';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_employee_no_full_access;`);
}
