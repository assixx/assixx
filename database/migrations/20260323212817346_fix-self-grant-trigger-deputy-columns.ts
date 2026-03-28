/**
 * Migration: Fix prevent_manage_permissions_self_grant trigger
 *
 * Purpose: The trigger function still references the old column name
 * `t.deputy_lead_id` (renamed to `t.team_deputy_lead_id` in migration
 * 20260321133339772). Also adds missing department/area deputy checks.
 *
 * Migration 20260321133453484 updated two other triggers but missed this one.
 *
 * @see Migration 094 (manage-permissions-delegation-trigger) — original trigger
 * @see Migration 20260321133453484 (update-deputy-lead-triggers) — partial fix
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION prevent_manage_permissions_self_grant() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.addon_code = 'manage_hierarchy'
         AND NEW.module_code = 'manage-permissions'
         AND NEW.can_write = true THEN
        -- assigned_by must be root, admin with full_access, OR any lead/deputy
        IF NOT EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = NEW.assigned_by
            AND (
              u.role = 'root'
              OR (u.role = 'admin' AND u.has_full_access = true)
              OR EXISTS (SELECT 1 FROM teams t WHERE (t.team_lead_id = u.id OR t.team_deputy_lead_id = u.id) AND t.is_active = 1)
              OR EXISTS (SELECT 1 FROM departments d WHERE (d.department_lead_id = u.id OR d.department_deputy_lead_id = u.id) AND d.is_active = 1)
              OR EXISTS (SELECT 1 FROM areas a WHERE (a.area_lead_id = u.id OR a.area_deputy_lead_id = u.id) AND a.is_active = 1)
            )
        ) THEN
          RAISE EXCEPTION 'manage-permissions.canWrite can only be granted by root, admin with full_access, or a lead/deputy (assigned_by=%)', NEW.assigned_by;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Restore the previous version (matches DB state before this fix)
  pgm.sql(`
    CREATE OR REPLACE FUNCTION prevent_manage_permissions_self_grant() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.addon_code = 'manage_hierarchy'
         AND NEW.module_code = 'manage-permissions'
         AND NEW.can_write = true THEN
        IF NOT EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = NEW.assigned_by
            AND (
              u.role = 'root'
              OR (u.role = 'admin' AND u.has_full_access = true)
              OR EXISTS (SELECT 1 FROM teams t WHERE (t.team_lead_id = u.id OR t.deputy_lead_id = u.id) AND t.is_active = 1)
              OR EXISTS (SELECT 1 FROM departments d WHERE d.department_lead_id = u.id AND d.is_active = 1)
              OR EXISTS (SELECT 1 FROM areas a WHERE a.area_lead_id = u.id AND a.is_active = 1)
            )
        ) THEN
          RAISE EXCEPTION 'manage-permissions.canWrite can only be granted by root, admin with full_access, or a lead (assigned_by=%)', NEW.assigned_by;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
}
