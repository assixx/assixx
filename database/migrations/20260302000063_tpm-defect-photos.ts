/**
 * Migration: Create tpm_defect_photos table
 * Date: 2026-03-02
 *
 * Stores photo attachments per defect entry. Each defect can have
 * 0..5 photos (service-enforced). Immutable once uploaded.
 *
 * Design decisions:
 *   - No `is_active` column (CASCADE-Delete with defect)
 *   - No `updated_at` column (photos are immutable once uploaded)
 *   - Same pattern as tpm_card_execution_photos (migration 043)
 *
 * Dependencies:
 *   - tpm_execution_defects (migration 061)
 *   - tenants table (baseline)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE tpm_defect_photos (
      id                    SERIAL PRIMARY KEY,
      uuid                  CHAR(36) NOT NULL,
      tenant_id             INTEGER NOT NULL,
      defect_id             INTEGER NOT NULL,
      file_path             VARCHAR(500) NOT NULL,
      file_name             VARCHAR(255) NOT NULL,
      file_size             INTEGER NOT NULL,
      mime_type             VARCHAR(100) NOT NULL,
      sort_order            INTEGER NOT NULL DEFAULT 0,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT uq_tpm_defect_photo_uuid UNIQUE (uuid),

      CONSTRAINT fk_tpm_defect_photos_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_tpm_defect_photos_defect
        FOREIGN KEY (defect_id)
        REFERENCES tpm_execution_defects(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT chk_tpm_defect_photos_file_size
        CHECK (file_size > 0 AND file_size <= 5242880)
    );

    -- Indexes
    CREATE INDEX idx_tpm_defect_photos_defect
      ON tpm_defect_photos(defect_id);

    CREATE INDEX idx_tpm_defect_photos_tenant
      ON tpm_defect_photos(tenant_id);

    CREATE INDEX idx_tpm_defect_photos_uuid
      ON tpm_defect_photos(uuid);

    -- RLS (ADR-019)
    ALTER TABLE tpm_defect_photos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tpm_defect_photos FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tpm_defect_photos
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- No updated_at trigger (photos are immutable)

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON tpm_defect_photos TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tpm_defect_photos_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS tpm_defect_photos CASCADE;`);
}
