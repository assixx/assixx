/**
 * Migration: KVP Suggestions - Daily Limit Trigger
 * Date: 2026-01-22 (original) / 2026-01-27 (wrapped)
 *
 * Defense in Depth: Database-level enforcement that employees can only
 * create 1 KVP suggestion per day. Admins and root are unlimited.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION check_kvp_daily_limit()
    RETURNS TRIGGER AS $$
    DECLARE
        user_role VARCHAR(50);
        today_count INTEGER;
    BEGIN
        SELECT role INTO user_role
        FROM users
        WHERE id = NEW.submitted_by;

        IF user_role IN ('admin', 'root') THEN
            RETURN NEW;
        END IF;

        SELECT COUNT(*) INTO today_count
        FROM kvp_suggestions
        WHERE tenant_id = NEW.tenant_id
          AND submitted_by = NEW.submitted_by
          AND created_at >= CURRENT_DATE
          AND created_at < CURRENT_DATE + INTERVAL '1 day';

        IF today_count >= 1 THEN
            RAISE EXCEPTION 'Tageslimit erreicht: Mitarbeiter können nur 1 KVP-Vorschlag pro Tag einreichen.';
        END IF;

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_kvp_daily_limit ON kvp_suggestions;

    CREATE TRIGGER trg_kvp_daily_limit
        BEFORE INSERT ON kvp_suggestions
        FOR EACH ROW
        EXECUTE FUNCTION check_kvp_daily_limit();

    COMMENT ON TRIGGER trg_kvp_daily_limit ON kvp_suggestions IS
        'Rate Limit: Employees can only create 1 KVP suggestion per day';

    COMMENT ON FUNCTION check_kvp_daily_limit() IS
        'Validates that employees do not exceed 1 KVP suggestion per day';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_kvp_daily_limit ON kvp_suggestions;
    DROP FUNCTION IF EXISTS check_kvp_daily_limit();
  `);
}
