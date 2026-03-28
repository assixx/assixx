/**
 * Migration: Team-Halls Junction Table
 *
 * Purpose: Enable N:M assignment of teams to halls.
 * A team physically operates in specific halls within its department's area.
 * Without explicit assignment, a team appears in all halls of its department.
 * With explicit assignments, the organigram filters teams per hall.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_halls') THEN
        RAISE EXCEPTION 'Table team_halls already exists';
      END IF;
    END $$;

    CREATE TABLE team_halls (
      id          SERIAL PRIMARY KEY,
      tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      team_id     INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      hall_id     INTEGER NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
      assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, team_id, hall_id)
    );

    CREATE INDEX idx_team_halls_tenant ON team_halls(tenant_id);
    CREATE INDEX idx_team_halls_team ON team_halls(team_id);
    CREATE INDEX idx_team_halls_hall ON team_halls(hall_id);

    ALTER TABLE team_halls ENABLE ROW LEVEL SECURITY;
    ALTER TABLE team_halls FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON team_halls
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    GRANT SELECT, INSERT, UPDATE, DELETE ON team_halls TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE team_halls_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS team_halls CASCADE;`);
}
