/**
 * Migration: Add halls table
 *
 * Purpose: Physical production halls assigned to areas (many-to-one: hall → area).
 * Used by manage-halls admin page for hall management.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE halls (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL,
        is_active SMALLINT NOT NULL DEFAULT 1,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        uuid CHAR(36) NOT NULL,
        uuid_created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX idx_halls_tenant ON halls(tenant_id);
    CREATE INDEX idx_halls_area ON halls(area_id);
    CREATE INDEX idx_halls_is_active ON halls(is_active);
    CREATE UNIQUE INDEX idx_halls_uuid ON halls(uuid);

    CREATE TRIGGER update_halls_updated_at
        BEFORE UPDATE ON halls
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

    ALTER TABLE halls ENABLE ROW LEVEL SECURITY;
    ALTER TABLE halls FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON halls
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    GRANT SELECT, INSERT, UPDATE, DELETE ON halls TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE halls_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS halls CASCADE;`);
}
