/**
 * Migration: Blackout Multi-Scope (Junction Table)
 * Date: 2026-02-13
 *
 * Converts vacation_blackouts from single-scope (scope_type + scope_id) to
 * multi-scope using a junction table — mirroring blackboard_entry_organizations.
 *
 * Changes:
 *   1. Add is_global BOOLEAN to vacation_blackouts
 *   2. Create vacation_blackout_scopes junction table with org_type ENUM
 *   3. Migrate existing scope_type/scope_id data into new structure
 *   4. Drop old scope_type, scope_id columns + CHECK constraint
 *
 * References: blackboard_entry_organizations pattern (ADR-019 RLS applied)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- Step 1: Create ENUM for organization types
    -- ==========================================================================

    CREATE TYPE vacation_blackout_org_type AS ENUM (
        'department', 'team', 'area'
    );

    -- ==========================================================================
    -- Step 2: Add is_global column to vacation_blackouts
    -- ==========================================================================

    ALTER TABLE vacation_blackouts
        ADD COLUMN is_global BOOLEAN NOT NULL DEFAULT false;

    -- ==========================================================================
    -- Step 3: Create junction table (mirrors blackboard_entry_organizations)
    -- ==========================================================================

    CREATE TABLE vacation_blackout_scopes (
        id              SERIAL PRIMARY KEY,
        blackout_id     UUID NOT NULL REFERENCES vacation_blackouts(id) ON DELETE CASCADE,
        org_type        vacation_blackout_org_type NOT NULL,
        org_id          INTEGER NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        UNIQUE(blackout_id, org_type, org_id)
    );

    CREATE INDEX idx_vbs_blackout ON vacation_blackout_scopes(blackout_id);
    CREATE INDEX idx_vbs_org ON vacation_blackout_scopes(org_type, org_id);

    -- RLS (same pattern as parent table)
    ALTER TABLE vacation_blackout_scopes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE vacation_blackout_scopes FORCE ROW LEVEL SECURITY;

    -- RLS policy: join to parent for tenant isolation
    CREATE POLICY tenant_isolation ON vacation_blackout_scopes
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR blackout_id IN (
                SELECT id FROM vacation_blackouts
                WHERE tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
            )
        );

    GRANT SELECT, INSERT, UPDATE, DELETE ON vacation_blackout_scopes TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE vacation_blackout_scopes_id_seq TO app_user;

    -- ==========================================================================
    -- Step 4: Migrate existing data
    -- ==========================================================================

    -- Set is_global from scope_type
    UPDATE vacation_blackouts
    SET is_global = true
    WHERE scope_type = 'global';

    -- Move team/department scopes into junction table
    INSERT INTO vacation_blackout_scopes (blackout_id, org_type, org_id)
    SELECT id,
           scope_type::vacation_blackout_org_type,
           scope_id
    FROM vacation_blackouts
    WHERE scope_type IN ('team', 'department')
      AND scope_id IS NOT NULL;

    -- ==========================================================================
    -- Step 5: Drop old columns and constraint
    -- ==========================================================================

    ALTER TABLE vacation_blackouts DROP CONSTRAINT valid_scope;
    ALTER TABLE vacation_blackouts DROP COLUMN scope_type;
    ALTER TABLE vacation_blackouts DROP COLUMN scope_id;

    -- Replace old scope index with new is_global index
    DROP INDEX IF EXISTS idx_vb_scope;
    CREATE INDEX idx_vb_global ON vacation_blackouts(tenant_id, is_global)
        WHERE is_active = 1;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Re-add scope columns
    ALTER TABLE vacation_blackouts
        ADD COLUMN scope_type VARCHAR(20) NOT NULL DEFAULT 'global',
        ADD COLUMN scope_id INTEGER;

    -- Migrate data back: is_global → scope_type='global'
    UPDATE vacation_blackouts SET scope_type = 'global' WHERE is_global = true;

    -- Migrate junction data back (take first entry per blackout)
    UPDATE vacation_blackouts vb
    SET scope_type = vbs.org_type::text,
        scope_id = vbs.org_id
    FROM (
        SELECT DISTINCT ON (blackout_id) blackout_id, org_type, org_id
        FROM vacation_blackout_scopes
        ORDER BY blackout_id, id ASC
    ) vbs
    WHERE vb.id = vbs.blackout_id;

    -- Re-add constraint
    ALTER TABLE vacation_blackouts ADD CONSTRAINT valid_scope CHECK (
        (scope_type = 'global' AND scope_id IS NULL)
        OR (scope_type IN ('team', 'department') AND scope_id IS NOT NULL)
    );

    -- Drop new structures
    DROP INDEX IF EXISTS idx_vb_global;
    CREATE INDEX idx_vb_scope ON vacation_blackouts(tenant_id, scope_type, scope_id)
        WHERE is_active = 1;

    ALTER TABLE vacation_blackouts DROP COLUMN is_global;

    DROP TABLE IF EXISTS vacation_blackout_scopes CASCADE;
    DROP TYPE IF EXISTS vacation_blackout_org_type CASCADE;
  `);
}
