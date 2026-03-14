/**
 * Migration: Enforce manage-permissions target must be a lead
 *
 * Per design: manage-permissions can ONLY be granted to users who hold
 * a lead position (team_lead_id, deputy_lead_id, department_lead_id, area_lead_id).
 * Root/admin-full bypass PermissionGuard via hasFullAccess — they don't need the row.
 *
 * Defense-in-depth: Backend service checks this, trigger is safety net for direct SQL.
 *
 * @see docs/FEAT_DELEGATED_PERMISSION_MANAGEMENT_MASTERPLAN.md
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION enforce_manage_permissions_target_is_lead() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.addon_code = 'manage_hierarchy'
         AND NEW.module_code = 'manage-permissions'
         AND (NEW.can_read = true OR NEW.can_write = true) THEN
        -- Target user must be a lead at any level
        IF NOT EXISTS (
          SELECT 1 FROM users u WHERE u.id = NEW.user_id AND (
            EXISTS (SELECT 1 FROM teams t WHERE (t.team_lead_id = u.id OR t.deputy_lead_id = u.id) AND t.is_active = 1)
            OR EXISTS (SELECT 1 FROM departments d WHERE d.department_lead_id = u.id AND d.is_active = 1)
            OR EXISTS (SELECT 1 FROM areas a WHERE a.area_lead_id = u.id AND a.is_active = 1)
          )
        ) THEN
          RAISE EXCEPTION 'manage-permissions can only be granted to users with a lead position (user_id=%)', NEW.user_id;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_enforce_manage_permissions_target_is_lead
      BEFORE INSERT OR UPDATE ON user_addon_permissions
      FOR EACH ROW EXECUTE FUNCTION enforce_manage_permissions_target_is_lead();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_enforce_manage_permissions_target_is_lead ON user_addon_permissions;
    DROP FUNCTION IF EXISTS enforce_manage_permissions_target_is_lead();
  `);
}
