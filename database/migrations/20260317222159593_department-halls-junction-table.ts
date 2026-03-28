/**
 * Migration: Department-Halls Junction Table
 *
 * Purpose: Enable N:M assignment of departments to halls.
 * Currently departments inherit all halls from their area, but a department
 * may only physically exist in specific halls within that area.
 * This junction table allows explicit per-department hall assignments.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Pre-check: department_halls must NOT exist
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'department_halls') THEN
        RAISE EXCEPTION 'Table department_halls already exists';
      END IF;
    END $$;

    CREATE TABLE department_halls (
      id            SERIAL PRIMARY KEY,
      tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      hall_id       INTEGER NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
      assigned_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, department_id, hall_id)
    );

    -- Indexes for common query patterns
    CREATE INDEX idx_department_halls_tenant ON department_halls(tenant_id);
    CREATE INDEX idx_department_halls_department ON department_halls(department_id);
    CREATE INDEX idx_department_halls_hall ON department_halls(hall_id);

    -- RLS: tenant isolation (standard policy template)
    ALTER TABLE department_halls ENABLE ROW LEVEL SECURITY;
    ALTER TABLE department_halls FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON department_halls
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- Grant permissions to app_user
    GRANT SELECT, INSERT, UPDATE, DELETE ON department_halls TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE department_halls_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS department_halls CASCADE;`);
}
