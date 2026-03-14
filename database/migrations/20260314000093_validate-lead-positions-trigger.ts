/**
 * Migration: DB-Level Lead Position Validation Triggers
 *
 * Purpose: Enforce lead assignment rules at the database level (defense-in-depth).
 * - teams.team_lead_id / deputy_lead_id → user must have position='team_lead'
 * - departments.department_lead_id → user must have role IN ('admin', 'root')
 * - areas.area_lead_id → user must have role IN ('admin', 'root')
 *
 * NULL values pass (no leader assigned = valid).
 * Only fires when lead columns actually change (performance: skip unchanged rows).
 *
 * @see ADR-035 (Organizational Hierarchy), ADR-036 (Scope Access Control)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // Team lead validation: position must be 'team_lead'
  pgm.sql(`
    CREATE OR REPLACE FUNCTION validate_team_lead_position() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.team_lead_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.team_lead_id IS DISTINCT FROM NEW.team_lead_id) THEN
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.team_lead_id AND position = 'team_lead') THEN
          RAISE EXCEPTION 'team_lead_id (%) must reference a user with position=team_lead', NEW.team_lead_id;
        END IF;
      END IF;

      IF NEW.deputy_lead_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.deputy_lead_id IS DISTINCT FROM NEW.deputy_lead_id) THEN
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.deputy_lead_id AND position = 'team_lead') THEN
          RAISE EXCEPTION 'deputy_lead_id (%) must reference a user with position=team_lead', NEW.deputy_lead_id;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_validate_team_lead
      BEFORE INSERT OR UPDATE ON teams
      FOR EACH ROW EXECUTE FUNCTION validate_team_lead_position();
  `);

  // Department lead validation: role must be admin or root
  pgm.sql(`
    CREATE OR REPLACE FUNCTION validate_dept_lead_role() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.department_lead_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.department_lead_id IS DISTINCT FROM NEW.department_lead_id) THEN
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.department_lead_id AND role IN ('admin', 'root')) THEN
          RAISE EXCEPTION 'department_lead_id (%) must reference an admin or root user', NEW.department_lead_id;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_validate_dept_lead
      BEFORE INSERT OR UPDATE ON departments
      FOR EACH ROW EXECUTE FUNCTION validate_dept_lead_role();
  `);

  // Area lead validation: role must be admin or root
  pgm.sql(`
    CREATE OR REPLACE FUNCTION validate_area_lead_role() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.area_lead_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.area_lead_id IS DISTINCT FROM NEW.area_lead_id) THEN
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.area_lead_id AND role IN ('admin', 'root')) THEN
          RAISE EXCEPTION 'area_lead_id (%) must reference an admin or root user', NEW.area_lead_id;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_validate_area_lead
      BEFORE INSERT OR UPDATE ON areas
      FOR EACH ROW EXECUTE FUNCTION validate_area_lead_role();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_validate_team_lead ON teams;
    DROP FUNCTION IF EXISTS validate_team_lead_position();

    DROP TRIGGER IF EXISTS trg_validate_dept_lead ON departments;
    DROP FUNCTION IF EXISTS validate_dept_lead_role();

    DROP TRIGGER IF EXISTS trg_validate_area_lead ON areas;
    DROP FUNCTION IF EXISTS validate_area_lead_role();
  `);
}
