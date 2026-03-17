/**
 * Migration: TPM Config Tables + Feature Flag (Phase 1, Step 1.3b)
 * Date: 2026-02-19
 *
 * Creates 2 config tables and inserts the TPM feature flag:
 *
 * Tables:
 *   1. tpm_escalation_config  — one config row per tenant (escalation timing, notifications)
 *   2. tpm_color_config       — custom color/label per status per tenant
 *
 * Feature Flag:
 *   - INSERT INTO features: code='tpm', category='enterprise'
 *
 * Note on config tables:
 *   - No `uuid` column (config tables, not API-exposed entities)
 *   - See FEAT_TPM_MASTERPLAN.md "Checklist-Ausnahmen" table
 *
 * Dependencies:
 *   - tenants table (baseline)
 *   - features table (baseline)
 *
 * Every table follows ADR-019 (RLS) and has GRANT to app_user.
 *
 * References: FEAT_TPM_MASTERPLAN.md (Phase 1, Step 1.3)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- Step 1: Create tpm_escalation_config — one config per tenant
    -- ==========================================================================
    -- Note: No uuid column (config table, not API-exposed entity)

    CREATE TABLE tpm_escalation_config (
      id                        SERIAL PRIMARY KEY,
      tenant_id                 INTEGER NOT NULL,
      escalation_after_hours    INTEGER NOT NULL DEFAULT 48,
      notify_team_lead          BOOLEAN NOT NULL DEFAULT true,
      notify_department_lead    BOOLEAN NOT NULL DEFAULT false,
      created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT fk_tpm_escalation_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT chk_tpm_escalation_hours
        CHECK (escalation_after_hours >= 1)
    );

    -- One config per tenant
    CREATE UNIQUE INDEX uq_tpm_escalation_tenant
      ON tpm_escalation_config(tenant_id);

    -- RLS (ADR-019)
    ALTER TABLE tpm_escalation_config ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tpm_escalation_config FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tpm_escalation_config
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- updated_at trigger
    CREATE TRIGGER update_tpm_escalation_config_updated_at
      BEFORE UPDATE ON tpm_escalation_config
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON tpm_escalation_config TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tpm_escalation_config_id_seq TO app_user;

    -- ==========================================================================
    -- Step 2: Create tpm_color_config — custom colors per status per tenant
    -- ==========================================================================
    -- Note: No uuid column (config table, not API-exposed entity)

    CREATE TABLE tpm_color_config (
      id                    SERIAL PRIMARY KEY,
      tenant_id             INTEGER NOT NULL,
      status_key            VARCHAR(20) NOT NULL,
      color_hex             VARCHAR(7) NOT NULL,
      label                 VARCHAR(50) NOT NULL,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT fk_tpm_color_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT chk_tpm_color_hex
        CHECK (color_hex ~ '^#[0-9a-fA-F]{6}$')
    );

    -- One color per status per tenant
    CREATE UNIQUE INDEX uq_tpm_color_tenant_status
      ON tpm_color_config(tenant_id, status_key);

    CREATE INDEX idx_tpm_color_tenant
      ON tpm_color_config(tenant_id);

    -- RLS (ADR-019)
    ALTER TABLE tpm_color_config ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tpm_color_config FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tpm_color_config
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- updated_at trigger
    CREATE TRIGGER update_tpm_color_config_updated_at
      BEFORE UPDATE ON tpm_color_config
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON tpm_color_config TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tpm_color_config_id_seq TO app_user;

    -- ==========================================================================
    -- Step 3: Feature Flag — TPM in features table
    -- ==========================================================================
    -- Note: category 'enterprise' (matches KVP as sibling Lean Management tool)
    -- Masterplan says 'lean_management' but ENUM only has: basic, core, premium, enterprise

    INSERT INTO features (code, name, description, category, base_price, is_active)
    VALUES (
      'tpm',
      'TPM / Wartung',
      'Total Productive Maintenance — Kamishibai Board, Wartungspläne, Intervall-Karten',
      'enterprise',
      0,
      1
    )
    ON CONFLICT (code) DO NOTHING;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Remove feature flag
    DELETE FROM features WHERE code = 'tpm';

    -- Drop config tables
    DROP TABLE IF EXISTS tpm_color_config CASCADE;
    DROP TABLE IF EXISTS tpm_escalation_config CASCADE;
  `);
}
