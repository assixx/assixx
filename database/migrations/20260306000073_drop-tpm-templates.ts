/**
 * Migration: Drop TPM Card Templates
 * Date: 2026-03-06
 *
 * Removes the tpm_card_templates table and the template_id FK from tpm_cards.
 * The template feature is being removed from the TPM module entirely.
 *
 * WARNING: One-way migration. Rollback recreates the table structure
 * but does NOT restore template data.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Step 1: Drop FK constraint from tpm_cards → tpm_card_templates
    ALTER TABLE tpm_cards DROP CONSTRAINT IF EXISTS fk_tpm_cards_template;

    -- Step 2: Drop template_id column from tpm_cards
    ALTER TABLE tpm_cards DROP COLUMN IF EXISTS template_id;

    -- Step 3: Drop tpm_card_templates table (CASCADE drops indexes, RLS, triggers, grants)
    DROP TABLE IF EXISTS tpm_card_templates CASCADE;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Recreate tpm_card_templates (data is lost)
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

    ALTER TABLE tpm_card_templates ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tpm_card_templates FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tpm_card_templates
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    CREATE TRIGGER update_tpm_card_templates_updated_at
      BEFORE UPDATE ON tpm_card_templates
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    GRANT SELECT, INSERT, UPDATE, DELETE ON tpm_card_templates TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tpm_card_templates_id_seq TO app_user;

    -- Re-add template_id column to tpm_cards
    ALTER TABLE tpm_cards ADD COLUMN template_id INTEGER;

    ALTER TABLE tpm_cards ADD CONSTRAINT fk_tpm_cards_template
      FOREIGN KEY (template_id)
      REFERENCES tpm_card_templates(id)
      ON UPDATE RESTRICT
      ON DELETE SET NULL;
  `);
}
