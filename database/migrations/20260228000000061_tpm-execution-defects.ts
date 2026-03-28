/**
 * Migration: Create tpm_execution_defects table
 * Date: 2026-02-28
 *
 * Stores structured defect entries per execution. Each execution can have
 * 0..N defects, each with a title (Mängelbezeichnung) and optional
 * description (weitere Informationen). Ordered by position_number.
 *
 * Enables the "Mängelliste" feature: when "Ohne Beanstandung" is unchecked,
 * the user documents individual defects instead of free-text documentation.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE tpm_execution_defects (
        id SERIAL PRIMARY KEY,
        uuid CHAR(36) NOT NULL,
        tenant_id INTEGER NOT NULL,
        execution_id INTEGER NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        position_number INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT uq_tpm_defect_uuid UNIQUE (uuid),
        CONSTRAINT fk_tpm_defect_tenant
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
            ON UPDATE RESTRICT ON DELETE CASCADE,
        CONSTRAINT fk_tpm_defect_execution
            FOREIGN KEY (execution_id) REFERENCES tpm_card_executions(id)
            ON UPDATE RESTRICT ON DELETE CASCADE,
        CONSTRAINT chk_tpm_defect_position
            CHECK (position_number > 0)
    );

    -- Indexes
    CREATE INDEX idx_tpm_defects_tenant
        ON tpm_execution_defects(tenant_id);

    CREATE INDEX idx_tpm_defects_execution
        ON tpm_execution_defects(execution_id);

    CREATE INDEX idx_tpm_defects_uuid
        ON tpm_execution_defects(uuid);

    -- RLS (mandatory for tenant-isolated tables)
    ALTER TABLE tpm_execution_defects ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tpm_execution_defects FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tpm_execution_defects
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- GRANTs for app_user (mandatory)
    GRANT SELECT, INSERT, UPDATE, DELETE ON tpm_execution_defects TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tpm_execution_defects_id_seq TO app_user;

    -- updated_at trigger
    CREATE TRIGGER update_tpm_execution_defects_updated_at
        BEFORE UPDATE ON tpm_execution_defects
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS tpm_execution_defects CASCADE;`);
}
