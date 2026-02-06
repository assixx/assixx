/**
 * Migration: KVP Comments - Admin/Root Only Trigger
 * Date: 2026-01-22 (original) / 2026-01-27 (wrapped)
 *
 * Defense in Depth: Database-level enforcement that only admin/root
 * users can add comments to KVP suggestions. Also enforced at API level.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION check_kvp_comment_permission()
    RETURNS TRIGGER AS $$
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
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_kvp_comments_admin_only ON kvp_comments;

    CREATE TRIGGER trg_kvp_comments_admin_only
        BEFORE INSERT ON kvp_comments
        FOR EACH ROW
        EXECUTE FUNCTION check_kvp_comment_permission();

    COMMENT ON TRIGGER trg_kvp_comments_admin_only ON kvp_comments IS
        'Security: Only admin/root users can add comments to KVP suggestions';

    COMMENT ON FUNCTION check_kvp_comment_permission() IS
        'Validates that only admin/root users can insert KVP comments';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_kvp_comments_admin_only ON kvp_comments;
    DROP FUNCTION IF EXISTS check_kvp_comment_permission();
  `);
}
