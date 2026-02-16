/**
 * Migration: Root-Logs Denormalization
 * Date: 2026-02-16
 *
 * Adds 8 denormalized columns to root_logs for eliminating 6 JOINs
 * at query time. Audit logs are historical snapshots — the user's
 * department/team at the time of the action is what matters,
 * not their current assignment.
 *
 * Context: ADR-009 (Central Audit Logging), ADR-025 (pg_stat_statements)
 * Motivation: 36 partitions × 6 JOINs = 42ms planning time → < 5ms
 *
 * Columns added:
 *   user_name       — username at time of action
 *   user_role       — role at time of action
 *   employee_number — employee number at time of action
 *   first_name      — first name at time of action
 *   last_name       — last name at time of action
 *   department_name — primary department name at time of action
 *   area_name       — area name at time of action
 *   team_name       — team name at time of action (first alphabetically if multi-team)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // Step 1: Add 8 denormalized columns to parent table.
  // PostgreSQL 17 propagates ADD COLUMN to all 36 partitions automatically.
  pgm.sql(`
    ALTER TABLE root_logs
      ADD COLUMN IF NOT EXISTS user_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS user_role VARCHAR(50),
      ADD COLUMN IF NOT EXISTS employee_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS department_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS area_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS team_name VARCHAR(255);
  `);

  // Step 2: Backfill existing rows with current user context.
  // DISTINCT ON (u.id) prevents non-deterministic duplicates from
  // the 1:N user_teams JOIN. ORDER BY t.name ASC picks the first
  // team alphabetically for consistency.
  // COALESCE handles deleted users gracefully (NULL columns stay NULL).
  pgm.sql(`
    UPDATE root_logs rl SET
      user_name = sub.username,
      user_role = sub.role,
      employee_number = sub.employee_number,
      first_name = sub.first_name,
      last_name = sub.last_name,
      department_name = sub.department_name,
      area_name = sub.area_name,
      team_name = sub.team_name
    FROM (
      SELECT DISTINCT ON (u.id)
        u.id AS user_id,
        u.username,
        u.role,
        u.employee_number,
        u.first_name,
        u.last_name,
        d.name AS department_name,
        a.name AS area_name,
        t.name AS team_name
      FROM users u
      LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.is_primary = true
      LEFT JOIN departments d ON ud.department_id = d.id
      LEFT JOIN areas a ON d.area_id = a.id
      LEFT JOIN user_teams ut ON u.id = ut.user_id
      LEFT JOIN teams t ON ut.team_id = t.id
      ORDER BY u.id, t.name ASC NULLS LAST
    ) sub
    WHERE rl.user_id = sub.user_id
      AND rl.user_name IS NULL;
  `);

  // Step 3: BEFORE INSERT trigger — auto-fills denormalized columns
  // for any INSERT that doesn't provide them (auth, role-switch, etc.).
  // ActivityLoggerService already sets these, so trigger is a no-op for it.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION root_logs_denormalize_on_insert()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.user_name IS NULL OR NEW.user_name = '' THEN
        SELECT u.username, u.role, u.employee_number,
               u.first_name, u.last_name,
               d.name, a.name, t.name
        INTO NEW.user_name, NEW.user_role, NEW.employee_number,
             NEW.first_name, NEW.last_name,
             NEW.department_name, NEW.area_name, NEW.team_name
        FROM users u
        LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.is_primary = true
        LEFT JOIN departments d ON ud.department_id = d.id
        LEFT JOIN areas a ON d.area_id = a.id
        LEFT JOIN user_teams ut ON u.id = ut.user_id
        LEFT JOIN teams t ON ut.team_id = t.id
        WHERE u.id = NEW.user_id
        LIMIT 1;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_root_logs_denormalize
      BEFORE INSERT ON root_logs
      FOR EACH ROW
      EXECUTE FUNCTION root_logs_denormalize_on_insert();
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Drop trigger + function first
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_root_logs_denormalize ON root_logs;
    DROP FUNCTION IF EXISTS root_logs_denormalize_on_insert();
  `);

  pgm.sql(`
    ALTER TABLE root_logs
      DROP COLUMN IF EXISTS user_name,
      DROP COLUMN IF EXISTS user_role,
      DROP COLUMN IF EXISTS employee_number,
      DROP COLUMN IF EXISTS first_name,
      DROP COLUMN IF EXISTS last_name,
      DROP COLUMN IF EXISTS department_name,
      DROP COLUMN IF EXISTS area_name,
      DROP COLUMN IF EXISTS team_name;
  `);
}
