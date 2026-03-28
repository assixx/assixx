/**
 * Migration: add-approval-config-scope
 *
 * Purpose: Add organizational scope columns to approval_configs so that
 * approval masters (type='user' or 'position') can be scoped to specific
 * areas, departments, or teams instead of the entire tenant.
 *
 * NULL scope = whole tenant (backward compatible with existing configs).
 * Hierarchy-based types (team_lead, area_lead, department_lead) have
 * implicit scope via org membership — these columns are ignored for them.
 *
 * Related: FEAT_APPROVAL_SCOPE_MASTERPLAN.md, ADR-037
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // 1. Add 3 nullable INTEGER[] columns
  pgm.sql(`
    ALTER TABLE approval_configs ADD COLUMN scope_area_ids INTEGER[] DEFAULT NULL;
    ALTER TABLE approval_configs ADD COLUMN scope_department_ids INTEGER[] DEFAULT NULL;
    ALTER TABLE approval_configs ADD COLUMN scope_team_ids INTEGER[] DEFAULT NULL;
  `);

  // 2. Create immutable helper function for array-to-text in indexes.
  // PostgreSQL's array::text cast is STABLE (not IMMUTABLE) due to locale
  // dependency. For INTEGER arrays the output is deterministic, so we wrap
  // it in an IMMUTABLE function. This is safe and standard practice.
  pgm.sql(`
    CREATE OR REPLACE FUNCTION immutable_int_array_text(arr INTEGER[])
    RETURNS TEXT
    LANGUAGE SQL
    IMMUTABLE
    PARALLEL SAFE
    AS $$ SELECT COALESCE(arr::text, '') $$;
  `);

  // 3. Drop existing unique index
  pgm.sql(`
    DROP INDEX IF EXISTS idx_approval_configs_unique;
  `);

  // 4. Recreate unique index including scope
  // Backend MUST sort scope arrays before INSERT to ensure {1,2} == {2,1}.
  pgm.sql(`
    CREATE UNIQUE INDEX idx_approval_configs_unique
      ON approval_configs (
        tenant_id,
        addon_code,
        approver_type,
        COALESCE(approver_user_id, 0),
        COALESCE(approver_position_id, '00000000-0000-0000-0000-000000000000'::uuid),
        immutable_int_array_text(scope_area_ids),
        immutable_int_array_text(scope_department_ids),
        immutable_int_array_text(scope_team_ids)
      )
      WHERE is_active = 1;
  `);

  // 4. Add GIN indexes for array containment queries (ANY / @>)
  pgm.sql(`
    CREATE INDEX idx_approval_configs_scope_areas
      ON approval_configs USING GIN (scope_area_ids)
      WHERE is_active = 1;

    CREATE INDEX idx_approval_configs_scope_depts
      ON approval_configs USING GIN (scope_department_ids)
      WHERE is_active = 1;

    CREATE INDEX idx_approval_configs_scope_teams
      ON approval_configs USING GIN (scope_team_ids)
      WHERE is_active = 1;
  `);

  // NOTE: Existing CHECK constraint `chk_approver_type_fields` does NOT need changes.
  // It only validates approver_user_id/approver_position_id based on approver_type.
  // The new scope columns are orthogonal and not part of the check.

  // NOTE: app_user already has full CRUD on approval_configs — no GRANT needed.
}

export function down(pgm: MigrationBuilder): void {
  // 1. Drop GIN indexes
  pgm.sql(`
    DROP INDEX IF EXISTS idx_approval_configs_scope_areas;
    DROP INDEX IF EXISTS idx_approval_configs_scope_depts;
    DROP INDEX IF EXISTS idx_approval_configs_scope_teams;
  `);

  // 2. Drop unique index with scope
  pgm.sql(`
    DROP INDEX IF EXISTS idx_approval_configs_unique;
  `);

  // 3. Restore original unique index (without scope)
  pgm.sql(`
    CREATE UNIQUE INDEX idx_approval_configs_unique
      ON approval_configs (
        tenant_id,
        addon_code,
        approver_type,
        COALESCE(approver_user_id, 0),
        COALESCE(approver_position_id, '00000000-0000-0000-0000-000000000000'::uuid)
      )
      WHERE is_active = 1;
  `);

  // 4. Drop scope columns
  pgm.sql(`
    ALTER TABLE approval_configs DROP COLUMN IF EXISTS scope_area_ids;
    ALTER TABLE approval_configs DROP COLUMN IF EXISTS scope_department_ids;
    ALTER TABLE approval_configs DROP COLUMN IF EXISTS scope_team_ids;
  `);

  // 5. Drop immutable helper function
  pgm.sql(`
    DROP FUNCTION IF EXISTS immutable_int_array_text(INTEGER[]);
  `);
}
