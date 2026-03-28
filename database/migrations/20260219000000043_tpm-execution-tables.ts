/**
 * Migration: TPM Execution Tables (Phase 1, Step 1.3a)
 * Date: 2026-02-19
 *
 * Creates 2 tables for TPM card execution tracking:
 *
 * Tables:
 *   1. tpm_card_executions       — execution log per card (who, when, approval status)
 *   2. tpm_card_execution_photos — immutable photo attachments per execution (max 5, service-enforced)
 *
 * Note on tpm_card_execution_photos:
 *   - No `is_active` column (CASCADE-Delete with execution)
 *   - No `updated_at` column (photos are immutable once uploaded)
 *   - See FEAT_TPM_MASTERPLAN.md "Checklist-Ausnahmen" table
 *
 * Dependencies:
 *   - tpm_cards (from Step 1.2)
 *   - tpm_approval_status ENUM (from Step 1.1)
 *   - users, tenants tables (baseline)
 *
 * Every table follows ADR-019 (RLS) and has GRANT to app_user.
 *
 * References: FEAT_TPM_MASTERPLAN.md (Phase 1, Step 1.3)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- Step 1: Create tpm_card_executions — execution log per card
    -- ==========================================================================

    CREATE TABLE tpm_card_executions (
      id                    SERIAL PRIMARY KEY,
      uuid                  CHAR(36) NOT NULL,
      tenant_id             INTEGER NOT NULL,
      card_id               INTEGER NOT NULL,
      executed_by           INTEGER NOT NULL,
      execution_date        DATE NOT NULL,
      documentation         TEXT,
      approval_status       tpm_approval_status NOT NULL DEFAULT 'none',
      approved_by           INTEGER,
      approved_at           TIMESTAMPTZ,
      approval_note         TEXT,
      custom_data           JSONB NOT NULL DEFAULT '{}',
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT fk_tpm_executions_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_tpm_executions_card
        FOREIGN KEY (card_id)
        REFERENCES tpm_cards(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_tpm_executions_executed_by
        FOREIGN KEY (executed_by)
        REFERENCES users(id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL,

      CONSTRAINT fk_tpm_executions_approved_by
        FOREIGN KEY (approved_by)
        REFERENCES users(id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL
    );

    -- Primary query pattern: "show all executions for card X, newest first"
    CREATE INDEX idx_tpm_executions_card_date
      ON tpm_card_executions(tenant_id, card_id, execution_date DESC);

    CREATE INDEX idx_tpm_executions_tenant
      ON tpm_card_executions(tenant_id);

    CREATE INDEX idx_tpm_executions_uuid
      ON tpm_card_executions(uuid);

    -- For approval queue: "show all pending approvals for tenant"
    CREATE INDEX idx_tpm_executions_approval
      ON tpm_card_executions(tenant_id, approval_status)
      WHERE approval_status = 'pending';

    -- RLS (ADR-019)
    ALTER TABLE tpm_card_executions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tpm_card_executions FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tpm_card_executions
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- updated_at trigger
    CREATE TRIGGER update_tpm_card_executions_updated_at
      BEFORE UPDATE ON tpm_card_executions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON tpm_card_executions TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tpm_card_executions_id_seq TO app_user;

    -- ==========================================================================
    -- Step 2: Create tpm_card_execution_photos — immutable photo attachments
    -- ==========================================================================
    -- Note: No is_active (CASCADE-Delete), no updated_at (immutable)

    CREATE TABLE tpm_card_execution_photos (
      id                    SERIAL PRIMARY KEY,
      uuid                  CHAR(36) NOT NULL,
      tenant_id             INTEGER NOT NULL,
      execution_id          INTEGER NOT NULL,
      file_path             VARCHAR(500) NOT NULL,
      file_name             VARCHAR(255) NOT NULL,
      file_size             INTEGER NOT NULL,
      mime_type             VARCHAR(100) NOT NULL,
      sort_order            INTEGER NOT NULL DEFAULT 0,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT fk_tpm_photos_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_tpm_photos_execution
        FOREIGN KEY (execution_id)
        REFERENCES tpm_card_executions(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT chk_tpm_photos_file_size
        CHECK (file_size > 0 AND file_size <= 5242880)
    );

    CREATE INDEX idx_tpm_photos_execution
      ON tpm_card_execution_photos(execution_id);

    CREATE INDEX idx_tpm_photos_tenant
      ON tpm_card_execution_photos(tenant_id);

    CREATE INDEX idx_tpm_photos_uuid
      ON tpm_card_execution_photos(uuid);

    -- RLS (ADR-019)
    ALTER TABLE tpm_card_execution_photos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tpm_card_execution_photos FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tpm_card_execution_photos
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- No updated_at trigger (photos are immutable)

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON tpm_card_execution_photos TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tpm_card_execution_photos_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Drop in reverse dependency order
    DROP TABLE IF EXISTS tpm_card_execution_photos CASCADE;
    DROP TABLE IF EXISTS tpm_card_executions CASCADE;
  `);
}
