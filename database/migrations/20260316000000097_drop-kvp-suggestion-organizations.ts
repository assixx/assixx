/**
 * Migration: Drop kvp_suggestion_organizations junction table
 *
 * Purpose: The junction table was designed for multi-team KVP assignment
 * but was never populated correctly. KVP visibility uses the hierarchical
 * org_level/org_id/team_id fields on kvp_suggestions directly.
 * Removing dead complexity (KISS).
 *
 * WARNING: One-way migration. Rollback recreates the table but not its data.
 * Since the table was always empty in production, no data loss occurs.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Drop trigger first (depends on function)
    DROP TRIGGER trg_kvp_max_teams ON kvp_suggestion_organizations;

    -- Drop the table (CASCADE removes FKs, indexes, policies, check constraints)
    DROP TABLE kvp_suggestion_organizations CASCADE;

    -- Drop the trigger function (no longer needed)
    DROP FUNCTION check_kvp_max_teams();

    -- Remove 'asset' from kvp_suggestions_org_level enum
    -- Step 1: Drop default (depends on the enum type, blocks DROP TYPE)
    ALTER TABLE kvp_suggestions ALTER COLUMN org_level DROP DEFAULT;

    -- Step 2: Detach column from enum
    ALTER TABLE kvp_suggestions ALTER COLUMN org_level TYPE text;

    -- Step 3: Drop old enum
    DROP TYPE kvp_suggestions_org_level;

    -- Step 4: Recreate without 'asset'
    CREATE TYPE kvp_suggestions_org_level AS ENUM ('company', 'department', 'area', 'team');

    -- Step 5: Reattach column to new enum + restore default
    ALTER TABLE kvp_suggestions
      ALTER COLUMN org_level TYPE kvp_suggestions_org_level
      USING org_level::kvp_suggestions_org_level;

    ALTER TABLE kvp_suggestions
      ALTER COLUMN org_level SET DEFAULT 'team'::kvp_suggestions_org_level;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Re-add 'asset' to enum
    ALTER TABLE kvp_suggestions ALTER COLUMN org_level TYPE text;
    DROP TYPE kvp_suggestions_org_level;
    CREATE TYPE kvp_suggestions_org_level AS ENUM ('company', 'department', 'area', 'team', 'asset');
    ALTER TABLE kvp_suggestions
      ALTER COLUMN org_level TYPE kvp_suggestions_org_level
      USING org_level::kvp_suggestions_org_level;
    ALTER TABLE kvp_suggestions
      ALTER COLUMN org_level SET DEFAULT 'team'::kvp_suggestions_org_level;

    -- Recreate junction table
    CREATE TABLE kvp_suggestion_organizations (
      id SERIAL PRIMARY KEY,
      suggestion_id INTEGER NOT NULL,
      org_type VARCHAR(10) NOT NULL,
      org_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT chk_kvp_sug_org_type CHECK (org_type IN ('team', 'asset')),
      CONSTRAINT uq_kvp_sug_org UNIQUE (suggestion_id, org_type, org_id),
      CONSTRAINT fk_kvp_sug_org_suggestion FOREIGN KEY (suggestion_id)
        REFERENCES kvp_suggestions(id) ON UPDATE CASCADE ON DELETE CASCADE,
      CONSTRAINT fk_kvp_sug_org_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE
    );

    CREATE INDEX idx_kvp_sug_org_suggestion ON kvp_suggestion_organizations(suggestion_id);
    CREATE INDEX idx_kvp_sug_org_tenant ON kvp_suggestion_organizations(tenant_id);
    CREATE INDEX idx_kvp_sug_org_type_id ON kvp_suggestion_organizations(org_type, org_id);

    -- RLS
    ALTER TABLE kvp_suggestion_organizations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE kvp_suggestion_organizations FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON kvp_suggestion_organizations
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    GRANT SELECT, INSERT, UPDATE, DELETE ON kvp_suggestion_organizations TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE kvp_suggestion_organizations_id_seq TO app_user;

    -- Recreate trigger function
    CREATE OR REPLACE FUNCTION check_kvp_max_teams()
    RETURNS TRIGGER AS $$
    BEGIN
      IF (SELECT COUNT(*) FROM kvp_suggestion_organizations
          WHERE suggestion_id = NEW.suggestion_id AND org_type = 'team') >= 3 THEN
        RAISE EXCEPTION 'Maximal 3 Teams pro KVP-Vorschlag erlaubt';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_kvp_max_teams
      BEFORE INSERT OR UPDATE ON kvp_suggestion_organizations
      FOR EACH ROW EXECUTE FUNCTION check_kvp_max_teams();
  `);
}
