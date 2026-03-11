/**
 * Migration: Addon System — Tracking Renames + tenant_storage (Step 1.3)
 * Date: 2026-03-11
 *
 * Renames tracking/permission tables from "feature" to "addon":
 *   - feature_usage_logs → addon_usage_logs (+ column feature_id → addon_id)
 *   - feature_visits → addon_visits (+ column feature → addon)
 *   - user_feature_permissions → user_addon_permissions (+ column feature_code → addon_code)
 *
 * Creates tenant_storage (placeholder for future storage enforcement).
 *
 * Cleans up MySQL-legacy index names (idx_19255_*) and renames
 * constraints/indexes to match new table names.
 *
 * @see docs/infrastructure/adr/ADR-033-addon-based-saas-model.md
 * @see docs/FEAT_ADDON_SYSTEM_MASTERPLAN.md (Phase 1, Step 1.3)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // ═══════════════════════════════════════════════════
  // PRE-CHECKS — FAIL LOUD if unexpected state
  // ═══════════════════════════════════════════════════
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feature_usage_logs'
      ) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: feature_usage_logs does not exist';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'feature_visits'
      ) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: feature_visits does not exist';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_feature_permissions'
      ) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: user_feature_permissions does not exist';
      END IF;

      IF EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenant_storage'
      ) THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: tenant_storage already exists';
      END IF;
    END $$
  `);

  // ═══════════════════════════════════════════════════════
  // TABLE 1: feature_usage_logs → addon_usage_logs
  // ═══════════════════════════════════════════════════════

  // 1a. Rename table + sequence + column
  pgm.sql(`
    ALTER TABLE feature_usage_logs RENAME TO addon_usage_logs;
    ALTER SEQUENCE feature_usage_logs_id_seq RENAME TO addon_usage_logs_id_seq;
    ALTER TABLE addon_usage_logs RENAME COLUMN feature_id TO addon_id;
  `);

  // 1b. Clean up MySQL-legacy indexes
  // idx_19255_primary = constraint (PK), rest = index-only
  pgm.sql(`
    ALTER TABLE addon_usage_logs RENAME CONSTRAINT idx_19255_primary TO addon_usage_logs_pkey;
    ALTER INDEX idx_19255_idx_created_at RENAME TO idx_addon_usage_logs_created_at;
    ALTER INDEX idx_19255_idx_feature_id RENAME TO idx_addon_usage_logs_addon_id;
    ALTER INDEX idx_19255_idx_tenant_id RENAME TO idx_addon_usage_logs_tenant_id;
    ALTER INDEX idx_19255_idx_user_id RENAME TO idx_addon_usage_logs_user_id;
  `);

  // 1c. Rename FK constraints (MySQL-legacy _ibfk_ names)
  pgm.sql(`
    ALTER TABLE addon_usage_logs RENAME CONSTRAINT feature_usage_logs_ibfk_1
      TO addon_usage_logs_tenant_id_fkey;
    ALTER TABLE addon_usage_logs RENAME CONSTRAINT feature_usage_logs_ibfk_2
      TO addon_usage_logs_addon_id_fkey;
    ALTER TABLE addon_usage_logs RENAME CONSTRAINT feature_usage_logs_ibfk_3
      TO addon_usage_logs_user_id_fkey;
  `);

  // 1d. Re-create RLS policy with new name
  pgm.sql(`
    DROP POLICY tenant_isolation ON addon_usage_logs;
    CREATE POLICY tenant_isolation ON addon_usage_logs
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INTEGER
      );
  `);

  // ═══════════════════════════════════════════════════════
  // TABLE 2: feature_visits → addon_visits
  // ═══════════════════════════════════════════════════════

  // 2a. Rename table + sequence + column
  pgm.sql(`
    ALTER TABLE feature_visits RENAME TO addon_visits;
    ALTER SEQUENCE feature_visits_id_seq RENAME TO addon_visits_id_seq;
    ALTER TABLE addon_visits RENAME COLUMN feature TO addon;
  `);

  // 2b. Rename PK constraint + indexes
  // feature_visits_pkey = constraint (PK)
  // unique_user_feature_tenant = constraint (UNIQUE)
  // rest = index-only
  pgm.sql(`
    ALTER TABLE addon_visits RENAME CONSTRAINT feature_visits_pkey TO addon_visits_pkey;
    ALTER TABLE addon_visits RENAME CONSTRAINT unique_user_feature_tenant TO unique_user_addon_tenant;
    ALTER INDEX idx_feature_visits_feature RENAME TO idx_addon_visits_addon;
    ALTER INDEX idx_feature_visits_lookup RENAME TO idx_addon_visits_lookup;
    ALTER INDEX idx_feature_visits_tenant RENAME TO idx_addon_visits_tenant;
    ALTER INDEX idx_feature_visits_user RENAME TO idx_addon_visits_user;
  `);

  // 2c. Rename FK constraints
  pgm.sql(`
    ALTER TABLE addon_visits RENAME CONSTRAINT feature_visits_tenant_id_fkey
      TO addon_visits_tenant_id_fkey;
    ALTER TABLE addon_visits RENAME CONSTRAINT feature_visits_user_id_fkey
      TO addon_visits_user_id_fkey;
  `);

  // 2d. Replace trigger + function
  pgm.sql(`
    DROP TRIGGER trigger_feature_visits_updated_at ON addon_visits;
    DROP FUNCTION update_feature_visits_updated_at();

    CREATE FUNCTION update_addon_visits_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trigger_addon_visits_updated_at
      BEFORE UPDATE ON addon_visits FOR EACH ROW
      EXECUTE FUNCTION update_addon_visits_updated_at();
  `);

  // 2e. Re-create RLS policy
  pgm.sql(`
    DROP POLICY tenant_isolation ON addon_visits;
    CREATE POLICY tenant_isolation ON addon_visits
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INTEGER
      );
  `);

  // ═══════════════════════════════════════════════════════
  // TABLE 3: user_feature_permissions → user_addon_permissions
  // ═══════════════════════════════════════════════════════

  // 3a. Rename table + sequence + column
  pgm.sql(`
    ALTER TABLE user_feature_permissions RENAME TO user_addon_permissions;
    ALTER SEQUENCE user_feature_permissions_id_seq RENAME TO user_addon_permissions_id_seq;
    ALTER TABLE user_addon_permissions RENAME COLUMN feature_code TO addon_code;
  `);

  // 3b. Rename PK constraint + UNIQUE constraint + index
  // user_feature_permissions_pkey = constraint (PK)
  // uq_user_feature_module = constraint (UNIQUE)
  // idx_ufp_user_tenant = index-only
  pgm.sql(`
    ALTER TABLE user_addon_permissions RENAME CONSTRAINT user_feature_permissions_pkey
      TO user_addon_permissions_pkey;
    ALTER TABLE user_addon_permissions RENAME CONSTRAINT uq_user_feature_module
      TO uq_user_addon_module;
    ALTER INDEX idx_ufp_user_tenant RENAME TO idx_uap_user_tenant;
  `);

  // 3c. Rename FK constraints
  pgm.sql(`
    ALTER TABLE user_addon_permissions RENAME CONSTRAINT user_feature_permissions_assigned_by_fkey
      TO user_addon_permissions_assigned_by_fkey;
    ALTER TABLE user_addon_permissions RENAME CONSTRAINT user_feature_permissions_tenant_id_fkey
      TO user_addon_permissions_tenant_id_fkey;
    ALTER TABLE user_addon_permissions RENAME CONSTRAINT user_feature_permissions_user_id_fkey
      TO user_addon_permissions_user_id_fkey;
  `);

  // 3d. Re-create RLS policy
  pgm.sql(`
    DROP POLICY tenant_isolation ON user_addon_permissions;
    CREATE POLICY tenant_isolation ON user_addon_permissions
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INTEGER
      );
  `);

  // ═══════════════════════════════════════════════════════
  // TABLE 4: CREATE tenant_storage (placeholder for future enforcement)
  // ═══════════════════════════════════════════════════════
  pgm.sql(`
    CREATE TABLE tenant_storage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id INTEGER NOT NULL
        REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
      storage_limit_gb INTEGER NOT NULL DEFAULT 100,
      storage_used_gb NUMERIC(10,2) NOT NULL DEFAULT 0,
      is_active SMALLINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // 4a. RLS + GRANT
  pgm.sql(`
    ALTER TABLE tenant_storage ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tenant_storage FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_storage_isolation ON tenant_storage
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INTEGER
      );

    GRANT SELECT, INSERT, UPDATE ON tenant_storage TO app_user;
  `);

  // 4b. Trigger
  pgm.sql(`
    CREATE TRIGGER update_tenant_storage_updated_at
      BEFORE UPDATE ON tenant_storage FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()
  `);

  // 4c. Seed default 100GB for each existing tenant
  pgm.sql(`
    INSERT INTO tenant_storage (tenant_id, storage_limit_gb)
    SELECT id, 100 FROM tenants
  `);

  // ═══════════════════════════════════════════════════════
  // POST-CHECK
  // ═══════════════════════════════════════════════════════
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'addon_usage_logs') THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: addon_usage_logs does not exist';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'addon_visits') THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: addon_visits does not exist';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_addon_permissions') THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: user_addon_permissions does not exist';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tenant_storage') THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: tenant_storage does not exist';
      END IF;
      IF (SELECT COUNT(*) FROM tenant_storage) <> (SELECT COUNT(*) FROM tenants) THEN
        RAISE EXCEPTION 'POST-CHECK FAILED: tenant_storage row count does not match tenants';
      END IF;
    END $$
  `);
}

export function down(pgm: MigrationBuilder): void {
  // ═══════════════════════════════════════════════════════
  // DROP tenant_storage
  // ═══════════════════════════════════════════════════════
  pgm.sql(`DROP TABLE tenant_storage CASCADE`);

  // ═══════════════════════════════════════════════════════
  // REVERSE TABLE 3: user_addon_permissions → user_feature_permissions
  // ═══════════════════════════════════════════════════════
  pgm.sql(`
    DROP POLICY tenant_isolation ON user_addon_permissions;
    CREATE POLICY tenant_isolation ON user_addon_permissions
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INTEGER
      );
  `);

  pgm.sql(`
    ALTER TABLE user_addon_permissions RENAME CONSTRAINT user_addon_permissions_user_id_fkey
      TO user_feature_permissions_user_id_fkey;
    ALTER TABLE user_addon_permissions RENAME CONSTRAINT user_addon_permissions_tenant_id_fkey
      TO user_feature_permissions_tenant_id_fkey;
    ALTER TABLE user_addon_permissions RENAME CONSTRAINT user_addon_permissions_assigned_by_fkey
      TO user_feature_permissions_assigned_by_fkey;
  `);

  pgm.sql(`
    ALTER INDEX idx_uap_user_tenant RENAME TO idx_ufp_user_tenant;
    ALTER TABLE user_addon_permissions RENAME CONSTRAINT uq_user_addon_module
      TO uq_user_feature_module;
    ALTER TABLE user_addon_permissions RENAME CONSTRAINT user_addon_permissions_pkey
      TO user_feature_permissions_pkey;
  `);

  pgm.sql(`
    ALTER TABLE user_addon_permissions RENAME COLUMN addon_code TO feature_code;
    ALTER SEQUENCE user_addon_permissions_id_seq RENAME TO user_feature_permissions_id_seq;
    ALTER TABLE user_addon_permissions RENAME TO user_feature_permissions;
  `);

  // ═══════════════════════════════════════════════════════
  // REVERSE TABLE 2: addon_visits → feature_visits
  // ═══════════════════════════════════════════════════════
  pgm.sql(`
    DROP POLICY tenant_isolation ON addon_visits;
    CREATE POLICY tenant_isolation ON addon_visits
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INTEGER
      );
  `);

  pgm.sql(`
    DROP TRIGGER trigger_addon_visits_updated_at ON addon_visits;
    DROP FUNCTION update_addon_visits_updated_at();

    CREATE FUNCTION update_feature_visits_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trigger_feature_visits_updated_at
      BEFORE UPDATE ON addon_visits FOR EACH ROW
      EXECUTE FUNCTION update_feature_visits_updated_at();
  `);

  pgm.sql(`
    ALTER TABLE addon_visits RENAME CONSTRAINT addon_visits_user_id_fkey
      TO feature_visits_user_id_fkey;
    ALTER TABLE addon_visits RENAME CONSTRAINT addon_visits_tenant_id_fkey
      TO feature_visits_tenant_id_fkey;
  `);

  pgm.sql(`
    ALTER INDEX idx_addon_visits_user RENAME TO idx_feature_visits_user;
    ALTER INDEX idx_addon_visits_tenant RENAME TO idx_feature_visits_tenant;
    ALTER INDEX idx_addon_visits_lookup RENAME TO idx_feature_visits_lookup;
    ALTER INDEX idx_addon_visits_addon RENAME TO idx_feature_visits_feature;
    ALTER TABLE addon_visits RENAME CONSTRAINT unique_user_addon_tenant
      TO unique_user_feature_tenant;
    ALTER TABLE addon_visits RENAME CONSTRAINT addon_visits_pkey TO feature_visits_pkey;
  `);

  pgm.sql(`
    ALTER TABLE addon_visits RENAME COLUMN addon TO feature;
    ALTER SEQUENCE addon_visits_id_seq RENAME TO feature_visits_id_seq;
    ALTER TABLE addon_visits RENAME TO feature_visits;
  `);

  // ═══════════════════════════════════════════════════════
  // REVERSE TABLE 1: addon_usage_logs → feature_usage_logs
  // ═══════════════════════════════════════════════════════
  pgm.sql(`
    DROP POLICY tenant_isolation ON addon_usage_logs;
    CREATE POLICY tenant_isolation ON addon_usage_logs
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INTEGER
      );
  `);

  pgm.sql(`
    ALTER TABLE addon_usage_logs RENAME CONSTRAINT addon_usage_logs_user_id_fkey
      TO feature_usage_logs_ibfk_3;
    ALTER TABLE addon_usage_logs RENAME CONSTRAINT addon_usage_logs_addon_id_fkey
      TO feature_usage_logs_ibfk_2;
    ALTER TABLE addon_usage_logs RENAME CONSTRAINT addon_usage_logs_tenant_id_fkey
      TO feature_usage_logs_ibfk_1;
  `);

  pgm.sql(`
    ALTER INDEX idx_addon_usage_logs_user_id RENAME TO idx_19255_idx_user_id;
    ALTER INDEX idx_addon_usage_logs_tenant_id RENAME TO idx_19255_idx_tenant_id;
    ALTER INDEX idx_addon_usage_logs_addon_id RENAME TO idx_19255_idx_feature_id;
    ALTER INDEX idx_addon_usage_logs_created_at RENAME TO idx_19255_idx_created_at;
    ALTER TABLE addon_usage_logs RENAME CONSTRAINT addon_usage_logs_pkey TO idx_19255_primary;
  `);

  pgm.sql(`
    ALTER TABLE addon_usage_logs RENAME COLUMN addon_id TO feature_id;
    ALTER SEQUENCE addon_usage_logs_id_seq RENAME TO feature_usage_logs_id_seq;
    ALTER TABLE addon_usage_logs RENAME TO feature_usage_logs;
  `);
}
