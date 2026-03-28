/**
 * Migration: Addon System — Rename Tables (Step 1.1)
 * Date: 2026-03-11
 *
 * Migrates from Plan-Tier model (ADR-032) to Addon-based model (ADR-033).
 * Handles: table drops, features→addons rename, column changes,
 * trigger/index cleanup, deprecated ENUM removal.
 *
 * WARNING: Lossy rollback. down() recreates table structures but does NOT restore:
 * - plans data (3 seed rows) — re-run seeds
 * - plan_features data (60 seed rows) — re-run seeds
 * - tenant_plans data (2 rows) — LOST
 * - tenants.current_plan / current_plan_id values — LOST
 * - features.category values — LOST (column dropped)
 *
 * @see docs/infrastructure/adr/ADR-033-addon-based-saas-model.md
 * @see docs/FEAT_ADDON_SYSTEM_MASTERPLAN.md (Phase 1, Step 1.1)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // ═══════════════════════════════════════════════════
  // PRE-CHECKS — FAIL LOUD if unexpected state
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'features'
      ) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: features table does not exist';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plans'
      ) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: plans table does not exist';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plan_features'
      ) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: plan_features table does not exist';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenant_plans'
      ) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: tenant_plans table does not exist';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenant_addons'
      ) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: old tenant_addons table does not exist';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'tenants_ibfk_1' AND table_name = 'tenants'
      ) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: tenants_ibfk_1 FK does not exist';
      END IF;

      IF (SELECT COUNT(*) FROM tenant_addons) > 0 THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: old tenant_addons has data (expected 0 rows)';
      END IF;
    END $$
  `);

  // ═══════════════════════════════════════════════════
  // STEP 1: Remove tenants → plans dependency
  // Must happen BEFORE plans DROP (FK tenants_ibfk_1)
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    ALTER TABLE tenants DROP CONSTRAINT tenants_ibfk_1;
    ALTER TABLE tenants DROP COLUMN current_plan;
    ALTER TABLE tenants DROP COLUMN current_plan_id;
  `);

  // ═══════════════════════════════════════════════════
  // STEP 2: Drop old tenant_addons (deprecated capacity table, 0 rows)
  // ═══════════════════════════════════════════════════
  pgm.sql(`DROP TABLE tenant_addons CASCADE`);

  // ═══════════════════════════════════════════════════
  // STEP 3: Drop plan_features (60 seed rows — re-seedable)
  // ═══════════════════════════════════════════════════
  pgm.sql(`DROP TABLE plan_features CASCADE`);

  // ═══════════════════════════════════════════════════
  // STEP 4: Drop tenant_plans (2 rows — LOSSY)
  // ═══════════════════════════════════════════════════
  pgm.sql(`DROP TABLE tenant_plans CASCADE`);

  // ═══════════════════════════════════════════════════
  // STEP 5: Drop plans (3 seed rows — re-seedable)
  // ═══════════════════════════════════════════════════
  pgm.sql(`DROP TABLE plans CASCADE`);

  // ═══════════════════════════════════════════════════
  // STEP 6: Rename features → addons + sequence
  // FK references from feature_usage_logs, tenant_features
  // update automatically (PG tracks by OID)
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    ALTER TABLE features RENAME TO addons;
    ALTER SEQUENCE features_id_seq RENAME TO addons_id_seq;
  `);

  // ═══════════════════════════════════════════════════
  // STEP 7: Modify addons — add/rename/drop columns
  // idx_19243_idx_category is auto-dropped with the column
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    ALTER TABLE addons ADD COLUMN is_core BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE addons ADD COLUMN trial_days INTEGER DEFAULT 30;
    ALTER TABLE addons RENAME COLUMN base_price TO price_monthly;
    ALTER TABLE addons DROP COLUMN category;
  `);

  // ═══════════════════════════════════════════════════
  // STEP 8: Set core flags and prices
  // 8 core addons (always active, no price)
  // 12 purchasable addons (€10/month, 30-day trial)
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    UPDATE addons SET is_core = true
    WHERE code IN (
      'dashboard', 'calendar', 'blackboard', 'settings',
      'notifications', 'employees', 'departments', 'teams'
    );

    UPDATE addons SET price_monthly = 10.00, trial_days = 30
    WHERE is_core = false;

    UPDATE addons SET price_monthly = NULL, trial_days = NULL
    WHERE is_core = true;
  `);

  // ═══════════════════════════════════════════════════
  // STEP 9: Rename triggers + function on addons
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    ALTER TRIGGER prevent_features_delete ON addons
      RENAME TO prevent_addons_delete;
    ALTER TRIGGER update_features_updated_at ON addons
      RENAME TO update_addons_updated_at;
    ALTER FUNCTION on_update_current_timestamp_features()
      RENAME TO on_update_current_timestamp_addons;
  `);

  // ═══════════════════════════════════════════════════
  // STEP 10: Drop orphaned trigger functions
  // Tables are gone but functions survive DROP TABLE
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    DROP FUNCTION on_update_current_timestamp_plans();
    DROP FUNCTION on_update_current_timestamp_tenant_plans();
    DROP FUNCTION on_update_current_timestamp_tenant_addons();
  `);

  // ═══════════════════════════════════════════════════
  // STEP 11: Clean up MySQL-legacy index names on addons
  // idx_19243_idx_category already gone (auto-dropped with column)
  // idx_19243_primary: real constraint (PK) → RENAME CONSTRAINT
  // idx_19243_code: index-only (no pg_constraint entry) → ALTER INDEX
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    DROP INDEX idx_19243_idx_code;
    ALTER TABLE addons RENAME CONSTRAINT idx_19243_primary TO addons_pkey;
    ALTER INDEX idx_19243_code RENAME TO addons_code_key;
    ALTER INDEX idx_19243_idx_is_active RENAME TO idx_addons_is_active;
  `);

  // ═══════════════════════════════════════════════════
  // STEP 12: Drop deprecated ENUMs (5 of 6)
  // tenant_addons_status dropped in Step 1.2
  // (old ENUM conflicts with new tenant_addon_status)
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    DROP TYPE features_category;
    DROP TYPE tenants_current_plan;
    DROP TYPE tenant_plans_status;
    DROP TYPE tenant_plans_billing_cycle;
    DROP TYPE tenant_addons_addon_type;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // ═══════════════════════════════════════════════════
  // RESTORE ENUMs (needed by tables below)
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    CREATE TYPE features_category AS ENUM ('basic', 'core', 'premium', 'enterprise');
    CREATE TYPE tenants_current_plan AS ENUM ('basic', 'premium', 'enterprise');
    CREATE TYPE tenant_plans_status AS ENUM ('active', 'trial', 'cancelled', 'expired');
    CREATE TYPE tenant_plans_billing_cycle AS ENUM ('monthly', 'yearly');
    CREATE TYPE tenant_addons_addon_type AS ENUM ('employees', 'admins', 'storage_gb');
  `);

  // ═══════════════════════════════════════════════════
  // REVERSE index renames on addons
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    ALTER INDEX idx_addons_is_active RENAME TO idx_19243_idx_is_active;
    ALTER INDEX addons_code_key RENAME TO idx_19243_code;
    ALTER TABLE addons RENAME CONSTRAINT addons_pkey TO idx_19243_primary;
    CREATE INDEX idx_19243_idx_code ON addons (code);
  `);

  // ═══════════════════════════════════════════════════
  // RESTORE orphaned trigger functions
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    CREATE FUNCTION on_update_current_timestamp_plans()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    CREATE FUNCTION on_update_current_timestamp_tenant_plans()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    CREATE FUNCTION on_update_current_timestamp_tenant_addons()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;
  `);

  // ═══════════════════════════════════════════════════
  // REVERSE trigger + function renames on addons
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    ALTER FUNCTION on_update_current_timestamp_addons()
      RENAME TO on_update_current_timestamp_features;
    ALTER TRIGGER update_addons_updated_at ON addons
      RENAME TO update_features_updated_at;
    ALTER TRIGGER prevent_addons_delete ON addons
      RENAME TO prevent_features_delete;
  `);

  // ═══════════════════════════════════════════════════
  // REVERSE column changes on addons
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    ALTER TABLE addons
      ADD COLUMN category features_category DEFAULT 'basic'::features_category;
    ALTER TABLE addons RENAME COLUMN price_monthly TO base_price;
    ALTER TABLE addons DROP COLUMN trial_days;
    ALTER TABLE addons DROP COLUMN is_core;
    CREATE INDEX idx_19243_idx_category ON addons (category);
  `);

  // ═══════════════════════════════════════════════════
  // RENAME addons → features + sequence
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    ALTER SEQUENCE addons_id_seq RENAME TO features_id_seq;
    ALTER TABLE addons RENAME TO features;
  `);

  // ═══════════════════════════════════════════════════
  // RECREATE plans (EMPTY — re-run seeds to populate)
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    CREATE TABLE plans (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      base_price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
      max_employees INTEGER,
      max_admins INTEGER,
      max_storage_gb INTEGER DEFAULT 100,
      is_active SMALLINT DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TRIGGER on_update_current_timestamp
      BEFORE UPDATE ON plans FOR EACH ROW
      EXECUTE FUNCTION on_update_current_timestamp_plans();
    CREATE TRIGGER prevent_plans_delete
      BEFORE DELETE ON plans FOR EACH ROW
      EXECUTE FUNCTION prevent_delete_protected_table();
    CREATE TRIGGER update_plans_updated_at
      BEFORE UPDATE ON plans FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    GRANT SELECT ON plans TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE plans_id_seq TO app_user;
  `);

  // ═══════════════════════════════════════════════════
  // RECREATE plan_features (EMPTY — re-run seeds)
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    CREATE TABLE plan_features (
      id SERIAL PRIMARY KEY,
      plan_id INTEGER NOT NULL
        REFERENCES plans(id) ON UPDATE RESTRICT ON DELETE CASCADE,
      feature_id INTEGER NOT NULL
        REFERENCES features(id) ON UPDATE RESTRICT ON DELETE CASCADE,
      is_included BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(plan_id, feature_id)
    );

    CREATE TRIGGER prevent_plan_features_delete
      BEFORE DELETE ON plan_features FOR EACH ROW
      EXECUTE FUNCTION prevent_delete_protected_table();

    GRANT SELECT ON plan_features TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE plan_features_id_seq TO app_user;
  `);

  // ═══════════════════════════════════════════════════
  // RECREATE tenant_plans (EMPTY — LOSSY, data cannot be restored)
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    CREATE TABLE tenant_plans (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL
        REFERENCES tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE,
      plan_id INTEGER NOT NULL
        REFERENCES plans(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
      status tenant_plans_status DEFAULT 'active'::tenant_plans_status,
      started_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      custom_price NUMERIC(10,2),
      billing_cycle tenant_plans_billing_cycle
        DEFAULT 'monthly'::tenant_plans_billing_cycle,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE tenant_plans ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tenant_plans FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation ON tenant_plans
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INTEGER
      );

    CREATE TRIGGER on_update_current_timestamp
      BEFORE UPDATE ON tenant_plans FOR EACH ROW
      EXECUTE FUNCTION on_update_current_timestamp_tenant_plans();
    CREATE TRIGGER update_tenant_plans_updated_at
      BEFORE UPDATE ON tenant_plans FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_plans TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tenant_plans_id_seq TO app_user;
  `);

  // ═══════════════════════════════════════════════════
  // RECREATE old tenant_addons (deprecated capacity table, EMPTY)
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    CREATE TABLE tenant_addons (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL
        REFERENCES tenants(id) ON UPDATE RESTRICT ON DELETE CASCADE,
      addon_type tenant_addons_addon_type NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      unit_price NUMERIC(10,2) NOT NULL,
      total_price NUMERIC(10,2),
      status tenant_addons_status DEFAULT 'active'::tenant_addons_status,
      started_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tenant_id, addon_type)
    );

    ALTER TABLE tenant_addons ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tenant_addons FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation ON tenant_addons
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INTEGER
      );

    CREATE TRIGGER on_update_current_timestamp
      BEFORE UPDATE ON tenant_addons FOR EACH ROW
      EXECUTE FUNCTION on_update_current_timestamp_tenant_addons();
    CREATE TRIGGER update_tenant_addons_updated_at
      BEFORE UPDATE ON tenant_addons FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_addons TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tenant_addons_id_seq TO app_user;
  `);

  // ═══════════════════════════════════════════════════
  // RESTORE tenants columns + FK to plans
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    ALTER TABLE tenants
      ADD COLUMN current_plan tenants_current_plan
        DEFAULT 'basic'::tenants_current_plan;
    ALTER TABLE tenants
      ADD COLUMN current_plan_id INTEGER;
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_ibfk_1
        FOREIGN KEY (current_plan_id)
        REFERENCES plans(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
    CREATE INDEX idx_19684_idx_current_plan ON tenants (current_plan_id);
  `);
}
