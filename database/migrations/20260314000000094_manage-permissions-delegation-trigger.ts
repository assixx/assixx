/**
 * Migration: DB-Level Trigger for manage-permissions Delegation Safety
 *
 * Purpose: Defense-in-depth — prevent manage-permissions.canWrite from being
 * granted by anyone other than root or admin with full_access.
 * Backend service already checks this (Regel 4), trigger is safety net
 * for direct SQL / migration / seed scenarios.
 *
 * @see docs/FEAT_DELEGATED_PERMISSION_MANAGEMENT_MASTERPLAN.md Step 3.3
 * @see ADR-036 (Organizational Scope Access Control)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION prevent_manage_permissions_self_grant() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.addon_code = 'manage_hierarchy'
         AND NEW.module_code = 'manage-permissions'
         AND NEW.can_write = true THEN
        -- Only root or admin with full_access may grant manage-permissions.canWrite
        IF NOT EXISTS (
          SELECT 1 FROM users
          WHERE id = NEW.assigned_by
            AND (role = 'root' OR (role = 'admin' AND has_full_access = true))
        ) THEN
          RAISE EXCEPTION 'manage-permissions.canWrite can only be granted by root or admin with full_access (assigned_by=%)', NEW.assigned_by;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_prevent_manage_permissions_self_grant
      BEFORE INSERT OR UPDATE ON user_addon_permissions
      FOR EACH ROW EXECUTE FUNCTION prevent_manage_permissions_self_grant();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_prevent_manage_permissions_self_grant ON user_addon_permissions;
    DROP FUNCTION IF EXISTS prevent_manage_permissions_self_grant();
  `);
}
