/**
 * Migration: KVP Multi-Team & Machine Support
 * Date: 2026-02-18
 *
 * 1. Drops `idx_ut_one_team_per_user` UNIQUE index on user_teams(user_id)
 *    to allow users to belong to multiple teams.
 *
 * 2. Adds 'machine' value to kvp_suggestions_org_level enum.
 *
 * 3. Creates `kvp_suggestion_organizations` junction table
 *    for N:M relationship between suggestions and teams/machines.
 *
 * 4. Adds RLS policy for tenant isolation.
 *
 * 5. Truncates existing KVP test data for clean slate.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- =========================================================================
    -- 1. Drop one-team-per-user constraint (allow multi-team membership)
    -- =========================================================================
    DROP INDEX IF EXISTS idx_ut_one_team_per_user;

    -- =========================================================================
    -- 2. Add 'machine' to kvp_suggestions_org_level enum
    -- =========================================================================
    ALTER TYPE kvp_suggestions_org_level ADD VALUE IF NOT EXISTS 'machine';

    -- =========================================================================
    -- 3. Truncate KVP test data (clean slate, cascading to related tables)
    -- =========================================================================
    TRUNCATE kvp_suggestions CASCADE;

    -- =========================================================================
    -- 4. Create junction table for KVP → teams/machines (N:M)
    -- =========================================================================
    CREATE TABLE kvp_suggestion_organizations (
        id          SERIAL PRIMARY KEY,
        suggestion_id INTEGER NOT NULL,
        org_type    VARCHAR(10) NOT NULL,
        org_id      INTEGER NOT NULL,
        tenant_id   INTEGER NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),

        CONSTRAINT fk_kvp_sug_org_suggestion
            FOREIGN KEY (suggestion_id)
            REFERENCES kvp_suggestions(id)
            ON UPDATE CASCADE ON DELETE CASCADE,

        CONSTRAINT fk_kvp_sug_org_tenant
            FOREIGN KEY (tenant_id)
            REFERENCES tenants(id)
            ON UPDATE RESTRICT ON DELETE CASCADE,

        CONSTRAINT chk_kvp_sug_org_type
            CHECK (org_type IN ('team', 'machine')),

        CONSTRAINT uq_kvp_sug_org
            UNIQUE (suggestion_id, org_type, org_id)
    );

    -- Indexes for common access patterns
    CREATE INDEX idx_kvp_sug_org_suggestion
        ON kvp_suggestion_organizations(suggestion_id);

    CREATE INDEX idx_kvp_sug_org_type_id
        ON kvp_suggestion_organizations(org_type, org_id);

    CREATE INDEX idx_kvp_sug_org_tenant
        ON kvp_suggestion_organizations(tenant_id);

    -- =========================================================================
    -- 5. RLS policy for tenant isolation
    -- =========================================================================
    ALTER TABLE kvp_suggestion_organizations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE kvp_suggestion_organizations FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON kvp_suggestion_organizations
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON kvp_suggestion_organizations TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE kvp_suggestion_organizations_id_seq TO app_user;

    -- =========================================================================
    -- 6. Check constraint: max 3 team entries per suggestion
    -- =========================================================================
    CREATE OR REPLACE FUNCTION check_kvp_max_teams()
    RETURNS TRIGGER AS $$
    BEGIN
        IF NEW.org_type = 'team' THEN
            IF (
                SELECT COUNT(*)
                FROM kvp_suggestion_organizations
                WHERE suggestion_id = NEW.suggestion_id
                  AND org_type = 'team'
                  AND id != COALESCE(NEW.id, 0)
            ) >= 3 THEN
                RAISE EXCEPTION 'Maximal 3 Teams pro KVP-Vorschlag erlaubt.';
            END IF;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_kvp_max_teams
        BEFORE INSERT OR UPDATE ON kvp_suggestion_organizations
        FOR EACH ROW
        EXECUTE FUNCTION check_kvp_max_teams();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Drop trigger and function
    DROP TRIGGER IF EXISTS trg_kvp_max_teams ON kvp_suggestion_organizations;
    DROP FUNCTION IF EXISTS check_kvp_max_teams();

    -- Drop junction table (CASCADE removes RLS policy)
    DROP TABLE IF EXISTS kvp_suggestion_organizations CASCADE;

    -- Note: Cannot remove enum value in PostgreSQL, but it's harmless to keep.

    -- Restore one-team-per-user constraint
    -- First remove duplicate team memberships (keep earliest entry per user)
    DELETE FROM user_teams
    WHERE id NOT IN (
        SELECT MIN(id) FROM user_teams GROUP BY user_id
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_ut_one_team_per_user
        ON user_teams(user_id);
  `);
}
