/**
 * Migration: Position Catalog — Tables + Constraints (Step 2 of 2)
 *
 * Purpose: Create position_catalog and user_positions tables, extend approval_configs
 * with approver_position_id column, CHECK constraint, and rebuilt unique index.
 * See ADR-038 for architecture decision.
 *
 * DEPENDS ON: 20260320140411753_position-catalog (ENUM extension must be committed first)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- Pre-checks: FAIL LOUD if tables already exist
    -- ==========================================================================
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'position_catalog') THEN
        RAISE EXCEPTION 'Table position_catalog already exists';
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_positions') THEN
        RAISE EXCEPTION 'Table user_positions already exists';
      END IF;
    END $$;

    -- ==========================================================================
    -- 1. ENUM: position_role_category
    -- ==========================================================================
    CREATE TYPE position_role_category AS ENUM ('employee', 'admin', 'root');

    -- ==========================================================================
    -- 2. TABLE: position_catalog
    -- ==========================================================================
    CREATE TABLE position_catalog (
      id            UUID PRIMARY KEY,
      tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name          VARCHAR(100) NOT NULL,
      role_category position_role_category NOT NULL,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      is_system     BOOLEAN NOT NULL DEFAULT false,
      is_active     SMALLINT NOT NULL DEFAULT 1,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Partial unique index: only active positions must be unique.
    -- Soft-deleted positions (is_active=4) do NOT block re-creation of the same name.
    CREATE UNIQUE INDEX idx_position_catalog_unique
      ON position_catalog (tenant_id, name, role_category)
      WHERE is_active = 1;

    CREATE INDEX idx_position_catalog_tenant ON position_catalog(tenant_id);
    CREATE INDEX idx_position_catalog_active ON position_catalog(tenant_id, is_active)
      WHERE is_active = 1;

    -- RLS: tenant isolation (standard policy template)
    ALTER TABLE position_catalog ENABLE ROW LEVEL SECURITY;
    ALTER TABLE position_catalog FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON position_catalog
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    GRANT SELECT, INSERT, UPDATE, DELETE ON position_catalog TO app_user;

    -- Update trigger (reuses existing function)
    CREATE TRIGGER update_position_catalog_updated_at
      BEFORE UPDATE ON position_catalog
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    -- ==========================================================================
    -- 3. TABLE: user_positions (N:M junction)
    -- ==========================================================================
    CREATE TABLE user_positions (
      id          UUID PRIMARY KEY,
      tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      position_id UUID NOT NULL REFERENCES position_catalog(id) ON DELETE RESTRICT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, user_id, position_id)
    );

    CREATE INDEX idx_user_positions_tenant ON user_positions(tenant_id);
    CREATE INDEX idx_user_positions_user ON user_positions(user_id);
    CREATE INDEX idx_user_positions_position ON user_positions(position_id);

    -- RLS: tenant isolation
    ALTER TABLE user_positions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_positions FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON user_positions
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    GRANT SELECT, INSERT, UPDATE, DELETE ON user_positions TO app_user;

    -- ==========================================================================
    -- 4. COLUMN: approval_configs.approver_position_id
    -- ==========================================================================
    ALTER TABLE approval_configs
      ADD COLUMN approver_position_id UUID REFERENCES position_catalog(id) ON DELETE RESTRICT;

    -- Mutual exclusivity: exactly one of approver_user_id / approver_position_id / neither
    -- must be set, matching the approver_type.
    ALTER TABLE approval_configs ADD CONSTRAINT chk_approver_type_fields CHECK (
      (approver_type = 'user' AND approver_user_id IS NOT NULL AND approver_position_id IS NULL)
      OR (approver_type = 'position' AND approver_position_id IS NOT NULL AND approver_user_id IS NULL)
      OR (approver_type IN ('team_lead', 'area_lead', 'department_lead')
          AND approver_user_id IS NULL AND approver_position_id IS NULL)
    );

    -- ==========================================================================
    -- 5. INDEX: rebuild unique index to include approver_position_id
    -- ==========================================================================
    -- Current: UNIQUE (tenant_id, addon_code, approver_type, COALESCE(approver_user_id, 0))
    -- Problem: For approver_type='position', approver_user_id is always NULL -> COALESCE=0,
    -- which means only ONE position-config per addon per tenant would be allowed.
    -- Fix: Add approver_position_id dimension.
    DROP INDEX idx_approval_configs_unique;
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
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- 1. DELETE position-type rows FIRST — prevents index collision + ENUM cast failure
    DELETE FROM approval_configs WHERE approver_type = 'position';

    -- 2. Rebuild old unique index (safe now — no position rows remain)
    DROP INDEX IF EXISTS idx_approval_configs_unique;
    CREATE UNIQUE INDEX idx_approval_configs_unique
      ON approval_configs (tenant_id, addon_code, approver_type, COALESCE(approver_user_id, 0))
      WHERE is_active = 1;

    -- 3. Drop CHECK constraint + position column
    ALTER TABLE approval_configs DROP CONSTRAINT IF EXISTS chk_approver_type_fields;
    ALTER TABLE approval_configs DROP COLUMN IF EXISTS approver_position_id;

    -- 4. Drop tables (CASCADE handles policies, indexes, triggers)
    DROP TABLE IF EXISTS user_positions CASCADE;
    DROP TABLE IF EXISTS position_catalog CASCADE;

    -- 5. Drop position_role_category ENUM
    DROP TYPE IF EXISTS position_role_category;

    -- NOTE: ENUM rollback (approval_approver_type) is handled by the companion
    -- migration 20260320140411753_position-catalog.down()
  `);
}
