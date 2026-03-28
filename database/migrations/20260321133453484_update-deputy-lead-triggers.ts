/**
 * Migration: Update DB triggers for renamed deputy_lead_id columns
 *
 * Purpose: Two existing triggers reference the old `deputy_lead_id` column name
 * (now renamed to `team_deputy_lead_id`). This migration:
 * 1. Updates validate_team_lead_position() → references team_deputy_lead_id
 * 2. Updates enforce_manage_permissions_target_is_lead() → references team_deputy_lead_id
 *    + adds area/department deputy checks
 * 3. Adds validate_area_deputy_lead_role() trigger on areas
 * 4. Adds validate_dept_deputy_lead_role() trigger on departments
 *
 * @see Migration 093 (validate-lead-positions-trigger) — original trigger
 * @see Migration 095 (enforce-manage-permissions-target-is-lead) — original trigger
 * @see docs/FEAT_DEPUTY_LEADS_MASTERPLAN.md (Step 1.4)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // 1. Update team lead validation trigger — rename deputy_lead_id → team_deputy_lead_id
  pgm.sql(`
    CREATE OR REPLACE FUNCTION validate_team_lead_position() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.team_lead_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.team_lead_id IS DISTINCT FROM NEW.team_lead_id) THEN
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.team_lead_id AND position = 'team_lead') THEN
          RAISE EXCEPTION 'team_lead_id (%) must reference a user with position=team_lead', NEW.team_lead_id;
        END IF;
      END IF;

      IF NEW.team_deputy_lead_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.team_deputy_lead_id IS DISTINCT FROM NEW.team_deputy_lead_id) THEN
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.team_deputy_lead_id AND position = 'team_lead') THEN
          RAISE EXCEPTION 'team_deputy_lead_id (%) must reference a user with position=team_lead', NEW.team_deputy_lead_id;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // 2. Update manage-permissions enforcement trigger — add all deputy columns
  pgm.sql(`
    CREATE OR REPLACE FUNCTION enforce_manage_permissions_target_is_lead() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.addon_code = 'manage_hierarchy'
         AND NEW.module_code = 'manage-permissions'
         AND (NEW.can_read = true OR NEW.can_write = true) THEN
        IF NOT EXISTS (
          SELECT 1 FROM users u WHERE u.id = NEW.user_id AND (
            EXISTS (SELECT 1 FROM teams t WHERE (t.team_lead_id = u.id OR t.team_deputy_lead_id = u.id) AND t.is_active = 1)
            OR EXISTS (SELECT 1 FROM departments d WHERE (d.department_lead_id = u.id OR d.department_deputy_lead_id = u.id) AND d.is_active = 1)
            OR EXISTS (SELECT 1 FROM areas a WHERE (a.area_lead_id = u.id OR a.area_deputy_lead_id = u.id) AND a.is_active = 1)
          )
        ) THEN
          RAISE EXCEPTION 'manage-permissions can only be granted to users with a lead or deputy position (user_id=%)', NEW.user_id;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // 3. Add area deputy lead validation trigger — role must be admin or root
  pgm.sql(`
    CREATE OR REPLACE FUNCTION validate_area_deputy_lead_role() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.area_deputy_lead_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.area_deputy_lead_id IS DISTINCT FROM NEW.area_deputy_lead_id) THEN
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.area_deputy_lead_id AND role IN ('admin', 'root')) THEN
          RAISE EXCEPTION 'area_deputy_lead_id (%) must reference an admin or root user', NEW.area_deputy_lead_id;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_validate_area_deputy_lead
      BEFORE INSERT OR UPDATE ON areas
      FOR EACH ROW EXECUTE FUNCTION validate_area_deputy_lead_role();
  `);

  // 4. Add department deputy lead validation trigger — role must be admin or root
  pgm.sql(`
    CREATE OR REPLACE FUNCTION validate_dept_deputy_lead_role() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.department_deputy_lead_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.department_deputy_lead_id IS DISTINCT FROM NEW.department_deputy_lead_id) THEN
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.department_deputy_lead_id AND role IN ('admin', 'root')) THEN
          RAISE EXCEPTION 'department_deputy_lead_id (%) must reference an admin or root user', NEW.department_deputy_lead_id;
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_validate_dept_deputy_lead
      BEFORE INSERT OR UPDATE ON departments
      FOR EACH ROW EXECUTE FUNCTION validate_dept_deputy_lead_role();
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Drop new deputy triggers
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_validate_area_deputy_lead ON areas;
    DROP FUNCTION IF EXISTS validate_area_deputy_lead_role();

    DROP TRIGGER IF EXISTS trg_validate_dept_deputy_lead ON departments;
    DROP FUNCTION IF EXISTS validate_dept_deputy_lead_role();
  `);

  // Restore original validate_team_lead_position with old column name
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
  `);

  // Restore original enforce_manage_permissions without deputy checks
  pgm.sql(`
    CREATE OR REPLACE FUNCTION enforce_manage_permissions_target_is_lead() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.addon_code = 'manage_hierarchy'
         AND NEW.module_code = 'manage-permissions'
         AND (NEW.can_read = true OR NEW.can_write = true) THEN
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
  `);
}
