/**
 * Migration: TPM Locations
 * Date: 2026-02-25
 *
 * Creates tpm_locations table for structured location descriptions per TPM plan.
 * Each location has a position number (1-200), title, description, and optional photo.
 *
 * Replaces the free-text location_description field on cards with
 * structured, reusable location references that include photo documentation.
 *
 * References: brainstorming-TPM.md (Örtlichkeit → Foto-Referenz)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- tpm_locations — structured location descriptions per plan
    -- ==========================================================================

    CREATE TABLE tpm_locations (
      id                    SERIAL PRIMARY KEY,
      uuid                  CHAR(36) NOT NULL,
      tenant_id             INTEGER NOT NULL,
      plan_id               INTEGER NOT NULL,
      position_number       INTEGER NOT NULL,
      title                 VARCHAR(255) NOT NULL,
      description           TEXT,
      photo_path            VARCHAR(500),
      photo_file_name       VARCHAR(255),
      photo_file_size       INTEGER,
      photo_mime_type       VARCHAR(100),
      is_active             INTEGER NOT NULL DEFAULT 1,
      created_by            INTEGER NOT NULL,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT fk_tpm_locations_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_tpm_locations_plan
        FOREIGN KEY (plan_id)
        REFERENCES tpm_maintenance_plans(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_tpm_locations_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

      CONSTRAINT chk_tpm_locations_position_range
        CHECK (position_number >= 1 AND position_number <= 200),

      CONSTRAINT chk_tpm_locations_is_active
        CHECK (is_active IN (0, 1, 3, 4))
    );

    -- Indexes
    CREATE UNIQUE INDEX idx_tpm_locations_uuid
      ON tpm_locations (uuid);

    CREATE INDEX idx_tpm_locations_tenant
      ON tpm_locations (tenant_id);

    CREATE INDEX idx_tpm_locations_plan
      ON tpm_locations (plan_id);

    -- Partial unique: one position number per plan (active only)
    CREATE UNIQUE INDEX idx_tpm_locations_plan_position_unique
      ON tpm_locations (tenant_id, plan_id, position_number)
      WHERE is_active = 1;

    -- RLS (ADR-019)
    ALTER TABLE tpm_locations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tpm_locations FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tpm_locations
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- GRANTs for app_user
    GRANT SELECT, INSERT, UPDATE, DELETE ON tpm_locations TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tpm_locations_id_seq TO app_user;

    -- updated_at trigger (reuse existing function)
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON tpm_locations
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS tpm_locations CASCADE;`);
}
