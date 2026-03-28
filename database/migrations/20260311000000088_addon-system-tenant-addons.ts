/**
 * Migration: Addon System — New tenant_addons + Data Migration (Step 1.2)
 * Date: 2026-03-11
 *
 * Replaces tenant_features (flat activation table) with tenant_addons
 * (licensing-aware: status, trial dates, payment reference).
 *
 * Only non-core addons are migrated — core addons are always active
 * and don't need tenant_addons entries.
 *
 * Data flow:
 *   tenant_features (40 rows) → filter non-core → tenant_addons (24 rows)
 *   Core addon rows (16) are intentionally discarded.
 *
 * SPEC DEVIATION D1: Uses gen_random_uuid() (v4) instead of uuid_generate_v7()
 * because pg_uuidv7 extension is not installed. App layer generates UUIDv7
 * via npm uuid package for new records.
 *
 * @see docs/infrastructure/adr/ADR-033-addon-based-saas-model.md
 * @see docs/FEAT_ADDON_SYSTEM_MASTERPLAN.md (Phase 1, Step 1.2)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // ═══════════════════════════════════════════════════
  // PRE-CHECKS — FAIL LOUD if unexpected state
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenant_features'
      ) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: tenant_features table does not exist';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'addons'
      ) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: addons table does not exist (run Step 1.1 first)';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'tenant_addons_status'
      ) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: old tenant_addons_status ENUM does not exist';
      END IF;

      IF EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'tenant_addon_status'
      ) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: new tenant_addon_status ENUM already exists';
      END IF;
    END $$
  `);

  // ═══════════════════════════════════════════════════
  // STEP 1: Drop old tenant_addons_status ENUM
  // (belonged to the old capacity-based tenant_addons,
  // dropped in Step 1.1 — only the ENUM survived)
  // ═══════════════════════════════════════════════════
  pgm.sql(`DROP TYPE tenant_addons_status`);

  // ═══════════════════════════════════════════════════
  // STEP 2: Create new tenant_addon_status ENUM
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    CREATE TYPE tenant_addon_status AS ENUM ('trial', 'active', 'expired', 'cancelled')
  `);

  // ═══════════════════════════════════════════════════
  // STEP 3: Preserve non-core data in temp table
  // Only purchasable addons need tenant_addons entries.
  // Core addons are always active (checked by is_core flag).
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    CREATE TEMP TABLE _tf_migration AS
    SELECT
      tf.tenant_id,
      tf.feature_id AS addon_id,
      tf.is_active,
      tf.activated_at,
      tf.activated_by,
      tf.expires_at,
      tf.custom_config,
      tf.created_at
    FROM tenant_features tf
    JOIN addons a ON a.id = tf.feature_id
    WHERE a.is_core = false
  `);

  // ═══════════════════════════════════════════════════
  // STEP 4: Drop tenant_features
  // CASCADE removes FK constraints, RLS policies,
  // triggers, and indexes
  // ═══════════════════════════════════════════════════
  pgm.sql(`DROP TABLE tenant_features CASCADE`);

  // ═══════════════════════════════════════════════════
  // STEP 5: Drop orphaned trigger function
  // (survived the table DROP)
  // ═══════════════════════════════════════════════════
  pgm.sql(`DROP FUNCTION on_update_current_timestamp_tenant_features()`);

  // ═══════════════════════════════════════════════════
  // STEP 6: Create new tenant_addons table
  // gen_random_uuid() = v4 (no pg_uuidv7 extension).
  // App layer uses npm uuid v13 for UUIDv7.
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    CREATE TABLE tenant_addons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id INTEGER NOT NULL
        REFERENCES tenants(id) ON DELETE CASCADE,
      addon_id INTEGER NOT NULL
        REFERENCES addons(id),
      status tenant_addon_status NOT NULL DEFAULT 'trial',
      trial_started_at TIMESTAMPTZ,
      trial_ends_at TIMESTAMPTZ,
      activated_at TIMESTAMPTZ,
      deactivated_at TIMESTAMPTZ,
      payment_reference TEXT,
      custom_price NUMERIC(8,2),
      is_active SMALLINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(tenant_id, addon_id)
    )
  `);

  // ═══════════════════════════════════════════════════
  // STEP 7: RLS + GRANT
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    ALTER TABLE tenant_addons ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tenant_addons FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_addons_isolation ON tenant_addons
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INTEGER
      );

    GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_addons TO app_user;
  `);

  // ═══════════════════════════════════════════════════
  // STEP 8: Indexes (partial — only active records)
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    CREATE INDEX idx_tenant_addons_tenant ON tenant_addons(tenant_id) WHERE is_active = 1;
    CREATE INDEX idx_tenant_addons_status ON tenant_addons(tenant_id, status) WHERE is_active = 1;
  `);

  // ═══════════════════════════════════════════════════
  // STEP 9: Triggers (updated_at)
  // Reuses the shared update_updated_at_column() function
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    CREATE TRIGGER update_tenant_addons_updated_at
      BEFORE UPDATE ON tenant_addons FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `);

  // ═══════════════════════════════════════════════════
  // STEP 10: Migrate data from temp table
  // All existing addons are treated as 'active' (they
  // were fully activated in the old system, not trials).
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    INSERT INTO tenant_addons
      (tenant_id, addon_id, status, is_active, activated_at, created_at, updated_at)
    SELECT
      m.tenant_id,
      m.addon_id,
      'active'::tenant_addon_status,
      m.is_active,
      COALESCE(m.activated_at, m.created_at),
      m.created_at,
      now()
    FROM _tf_migration m
  `);

  // ═══════════════════════════════════════════════════
  // STEP 11: Cleanup temp table
  // ═══════════════════════════════════════════════════
  pgm.sql(`DROP TABLE _tf_migration`);

  // ═══════════════════════════════════════════════════
  // POST-CHECK: Verify migration count
  // Expected: 24 rows (2 tenants × 12 non-core addons)
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    DO $$ BEGIN
      IF (SELECT COUNT(*) FROM tenant_addons) <> 24 THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: expected 24 rows in tenant_addons, got %',
          (SELECT COUNT(*) FROM tenant_addons);
      END IF;
    END $$
  `);
}

export function down(pgm: MigrationBuilder): void {
  // ═══════════════════════════════════════════════════
  // RECREATE tenant_features with original structure
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    CREATE TABLE tenant_features (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL
        REFERENCES tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE,
      feature_id INTEGER NOT NULL
        REFERENCES addons(id) ON UPDATE RESTRICT ON DELETE CASCADE,
      is_active SMALLINT DEFAULT 1,
      activated_at TIMESTAMPTZ,
      activated_by INTEGER
        REFERENCES users(id) ON UPDATE RESTRICT ON DELETE SET NULL,
      expires_at TIMESTAMPTZ,
      custom_config JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(tenant_id, feature_id)
    )
  `);

  // ═══════════════════════════════════════════════════
  // Restore data: non-core from tenant_addons + core addons for each tenant
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    INSERT INTO tenant_features (tenant_id, feature_id, is_active, activated_at, created_at, updated_at)
    SELECT
      ta.tenant_id,
      ta.addon_id,
      ta.is_active,
      ta.activated_at,
      ta.created_at,
      ta.updated_at
    FROM tenant_addons ta;

    INSERT INTO tenant_features (tenant_id, feature_id, is_active, created_at, updated_at)
    SELECT
      t.id,
      a.id,
      1,
      now(),
      now()
    FROM tenants t
    CROSS JOIN addons a
    WHERE a.is_core = true
    ON CONFLICT (tenant_id, feature_id) DO NOTHING;
  `);

  // ═══════════════════════════════════════════════════
  // RLS + GRANT on tenant_features
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    ALTER TABLE tenant_features ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tenant_features FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tenant_features
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INTEGER
      );

    GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_features TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tenant_features_id_seq TO app_user;
  `);

  // ═══════════════════════════════════════════════════
  // Restore indexes (MySQL-legacy names for consistency with pre-1.1 state)
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    CREATE INDEX idx_19758_activated_by ON tenant_features (activated_by);
    CREATE INDEX idx_19758_idx_feature_id ON tenant_features (feature_id);
    CREATE INDEX idx_19758_idx_is_active ON tenant_features (is_active);
    CREATE INDEX idx_19758_idx_tenant_id ON tenant_features (tenant_id);
  `);

  // ═══════════════════════════════════════════════════
  // Restore trigger function + triggers
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    CREATE FUNCTION on_update_current_timestamp_tenant_features()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER on_update_current_timestamp
      BEFORE UPDATE ON tenant_features FOR EACH ROW
      EXECUTE FUNCTION on_update_current_timestamp_tenant_features();
    CREATE TRIGGER update_tenant_features_updated_at
      BEFORE UPDATE ON tenant_features FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);

  // ═══════════════════════════════════════════════════
  // Drop tenant_addons (new table)
  // ═══════════════════════════════════════════════════
  pgm.sql(`DROP TABLE tenant_addons CASCADE`);

  // ═══════════════════════════════════════════════════
  // Drop new ENUM, restore old ENUM
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    DROP TYPE tenant_addon_status;
    CREATE TYPE tenant_addons_status AS ENUM ('active', 'cancelled');
  `);
}
