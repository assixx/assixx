/**
 * Migration: Rename remaining 'machine' references to 'asset'
 *
 * Scope:
 *   1. ENUM value: kvp_suggestions_org_level 'machine' -> 'asset'
 *   2. Data: kvp_suggestion_organizations.org_type 'machine' -> 'asset'
 *   3. CHECK constraint: chk_kvp_sug_org_type 'machine' -> 'asset'
 *   4. Table COMMENTs: asset_teams, assets, teams
 *
 * Why: Migration #071 renamed tables/columns/types but missed enum VALUES,
 * CHECK constraint literals, actual data, and SQL COMMENTs.
 *
 * Data change: UPDATE is necessary — constraint swap requires data to match
 * the new allowed values. Pre-check ensures no unexpected org_type values.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // Pre-check: ensure no unexpected org_type values exist
  pgm.sql(`
    DO $$
    DECLARE
      bad_count INTEGER;
    BEGIN
      SELECT COUNT(*) INTO bad_count
        FROM kvp_suggestion_organizations
       WHERE org_type NOT IN ('team', 'machine');

      IF bad_count > 0 THEN
        RAISE EXCEPTION 'Found % rows with unexpected org_type (not team/machine). Fix data first!', bad_count;
      END IF;
    END $$;
  `);

  pgm.sql(`
    -- =========================================================================
    -- Step 1: Rename ENUM value 'machine' -> 'asset' in kvp_suggestions_org_level
    -- =========================================================================
    ALTER TYPE kvp_suggestions_org_level RENAME VALUE 'machine' TO 'asset';

    -- =========================================================================
    -- Step 2: Drop CHECK constraint BEFORE updating data
    -- =========================================================================
    ALTER TABLE kvp_suggestion_organizations
      DROP CONSTRAINT chk_kvp_sug_org_type;

    -- =========================================================================
    -- Step 3: Update data, then recreate constraint with new value
    -- =========================================================================
    UPDATE kvp_suggestion_organizations
       SET org_type = 'asset'
     WHERE org_type = 'machine';

    ALTER TABLE kvp_suggestion_organizations
      ADD CONSTRAINT chk_kvp_sug_org_type
      CHECK (org_type = ANY(ARRAY['team', 'asset']));

    -- =========================================================================
    -- Step 4: Update table COMMENTs
    -- =========================================================================
    COMMENT ON TABLE assets IS 'Assets (Anlagen) managed per tenant — ISO 55000 aligned';
    COMMENT ON TABLE asset_teams IS 'Junction table: which teams work on which assets';
    COMMENT ON TABLE teams IS 'Teams that work in departments and operate assets';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Revert COMMENTs
    COMMENT ON TABLE teams IS 'Teams that work in departments and operate machines';
    COMMENT ON TABLE asset_teams IS 'Junction table: which teams work on which machines';
    COMMENT ON TABLE assets IS 'Machines located in departments/areas';

    -- Revert CHECK constraint
    ALTER TABLE kvp_suggestion_organizations
      DROP CONSTRAINT chk_kvp_sug_org_type;

    ALTER TABLE kvp_suggestion_organizations
      ADD CONSTRAINT chk_kvp_sug_org_type
      CHECK (org_type = ANY(ARRAY['team', 'machine']));

    -- Revert data
    UPDATE kvp_suggestion_organizations
       SET org_type = 'machine'
     WHERE org_type = 'asset';

    -- Revert ENUM value
    ALTER TYPE kvp_suggestions_org_level RENAME VALUE 'asset' TO 'machine';
  `);
}
