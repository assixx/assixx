/**
 * Migration: Fix root_logs denormalize trigger — non-deterministic LIMIT 1
 *
 * Bug: Migration 036 created fn root_logs_denormalize_on_insert() with
 * `LIMIT 1` but no `ORDER BY`. When a user belongs to multiple teams,
 * PostgreSQL returns an arbitrary row. The backfill in the same migration
 * correctly used `ORDER BY t.name ASC NULLS LAST` — the trigger must match.
 *
 * Fix: Add `ORDER BY t.name ASC NULLS LAST` before `LIMIT 1`.
 * CREATE OR REPLACE FUNCTION updates the function in-place for all
 * 97 triggers (parent + 96 partitions) without recreating them.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
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
        ORDER BY t.name ASC NULLS LAST
        LIMIT 1;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
}

export function down(pgm: MigrationBuilder): void {
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
  `);
}
