/**
 * Migration: TPM Card Tables (Phase 1, Step 1.2)
 * Date: 2026-02-19
 *
 * Creates 2 tables for TPM card management:
 *
 * Tables:
 *   1. tpm_card_templates  — reusable card templates with optional custom fields (JSONB)
 *   2. tpm_cards           — actual maintenance cards on the Kamishibai board
 *
 * Dependencies:
 *   - tpm_maintenance_plans (from Step 1.1)
 *   - tpm_interval_type, tpm_card_status, tpm_card_role ENUMs (from Step 1.1)
 *   - machines, users, tenants tables (baseline)
 *
 * Every table follows ADR-019 (RLS), uses SERIAL PK + UUID (UUIDv7), and has
 * GRANT to app_user. updated_at trigger via existing update_updated_at_column().
 *
 * References: FEAT_TPM_MASTERPLAN.md (Phase 1, Step 1.2)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- Step 1: Create tpm_card_templates — reusable card templates
    -- ==========================================================================

    CREATE TABLE tpm_card_templates (
      id                    SERIAL PRIMARY KEY,
      uuid                  CHAR(36) NOT NULL,
      tenant_id             INTEGER NOT NULL,
      name                  VARCHAR(255) NOT NULL,
      description           TEXT,
      default_fields        JSONB NOT NULL DEFAULT '{}',
      is_default            BOOLEAN NOT NULL DEFAULT false,
      is_active             INTEGER NOT NULL DEFAULT 1,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT fk_tpm_templates_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE
    );

    CREATE INDEX idx_tpm_templates_tenant  ON tpm_card_templates(tenant_id);
    CREATE INDEX idx_tpm_templates_uuid    ON tpm_card_templates(uuid);
    CREATE INDEX idx_tpm_templates_active  ON tpm_card_templates(tenant_id)
      WHERE is_active = 1;

    -- RLS (ADR-019)
    ALTER TABLE tpm_card_templates ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tpm_card_templates FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tpm_card_templates
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- updated_at trigger (function already exists from baseline)
    CREATE TRIGGER update_tpm_card_templates_updated_at
      BEFORE UPDATE ON tpm_card_templates
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON tpm_card_templates TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tpm_card_templates_id_seq TO app_user;

    -- ==========================================================================
    -- Step 2: Create tpm_cards — actual maintenance cards on the board
    -- ==========================================================================

    CREATE TABLE tpm_cards (
      id                    SERIAL PRIMARY KEY,
      uuid                  CHAR(36) NOT NULL,
      tenant_id             INTEGER NOT NULL,
      plan_id               INTEGER NOT NULL,
      asset_id            INTEGER NOT NULL,
      template_id           INTEGER,
      card_code             VARCHAR(10) NOT NULL,
      card_role             tpm_card_role NOT NULL,
      interval_type         tpm_interval_type NOT NULL,
      interval_order        INTEGER NOT NULL,
      title                 VARCHAR(255) NOT NULL,
      description           TEXT,
      location_description  TEXT,
      location_photo_url    VARCHAR(500),
      requires_approval     BOOLEAN NOT NULL DEFAULT false,
      status                tpm_card_status NOT NULL DEFAULT 'green',
      current_due_date      DATE,
      last_completed_at     TIMESTAMPTZ,
      last_completed_by     INTEGER,
      sort_order            INTEGER NOT NULL DEFAULT 0,
      custom_fields         JSONB NOT NULL DEFAULT '{}',
      custom_interval_days  INTEGER,
      is_active             INTEGER NOT NULL DEFAULT 1,
      created_by            INTEGER NOT NULL,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT fk_tpm_cards_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_tpm_cards_plan
        FOREIGN KEY (plan_id)
        REFERENCES tpm_maintenance_plans(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_tpm_cards_machine
        FOREIGN KEY (asset_id)
        REFERENCES machines(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_tpm_cards_template
        FOREIGN KEY (template_id)
        REFERENCES tpm_card_templates(id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL,

      CONSTRAINT fk_tpm_cards_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL,

      CONSTRAINT fk_tpm_cards_completed_by
        FOREIGN KEY (last_completed_by)
        REFERENCES users(id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL,

      CONSTRAINT chk_tpm_cards_interval_order
        CHECK (interval_order >= 1 AND interval_order <= 8),

      CONSTRAINT chk_tpm_cards_custom_interval
        CHECK (interval_type = 'custom' OR custom_interval_days IS NULL)
    );

    -- Composite indexes for board queries
    CREATE INDEX idx_tpm_cards_tenant_plan
      ON tpm_cards(tenant_id, plan_id);

    CREATE INDEX idx_tpm_cards_tenant_machine_status
      ON tpm_cards(tenant_id, asset_id, status);

    CREATE INDEX idx_tpm_cards_interval_order
      ON tpm_cards(interval_order);

    CREATE INDEX idx_tpm_cards_due_date
      ON tpm_cards(current_due_date);

    CREATE INDEX idx_tpm_cards_uuid
      ON tpm_cards(uuid);

    CREATE INDEX idx_tpm_cards_active
      ON tpm_cards(tenant_id)
      WHERE is_active = 1;

    -- RLS (ADR-019)
    ALTER TABLE tpm_cards ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tpm_cards FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tpm_cards
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- updated_at trigger
    CREATE TRIGGER update_tpm_cards_updated_at
      BEFORE UPDATE ON tpm_cards
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON tpm_cards TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tpm_cards_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Drop tables in reverse order (tpm_cards depends on tpm_card_templates)
    DROP TABLE IF EXISTS tpm_cards CASCADE;
    DROP TABLE IF EXISTS tpm_card_templates CASCADE;
  `);
}
