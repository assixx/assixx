/**
 * Migration: Drop kvp_comments admin-only trigger
 *
 * Purpose: The DB trigger `trg_kvp_comments_admin_only` blocked employees from
 * adding comments even when they have `kvp-comments.canWrite` permission in
 * `user_addon_permissions`. Access control is now handled by PermissionGuard
 * (ADR-020) — the trigger is redundant and contradicts the permission system.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_kvp_comments_admin_only ON kvp_comments;
    DROP FUNCTION IF EXISTS check_kvp_comment_permission();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION check_kvp_comment_permission()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      user_role VARCHAR(50);
    BEGIN
      SELECT role INTO user_role
      FROM users
      WHERE id = NEW.user_id;

      IF user_role IS NULL THEN
        RAISE EXCEPTION 'User not found: %', NEW.user_id;
      END IF;

      IF user_role NOT IN ('admin', 'root') THEN
        RAISE EXCEPTION 'Permission denied: Only admin and root users can add KVP comments. User role: %', user_role;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER trg_kvp_comments_admin_only
      BEFORE INSERT ON kvp_comments
      FOR EACH ROW
      EXECUTE FUNCTION check_kvp_comment_permission();
  `);
}
