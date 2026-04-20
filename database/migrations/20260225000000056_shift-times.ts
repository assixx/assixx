/**
 * Migration: Shift Times (Schichtzeiten)
 * Date: 2026-02-25
 *
 * Creates shift_times table for tenant-configurable shift time definitions.
 * Each tenant can customize their own shift start/end times and labels.
 *
 * Default shift times (seeded for all existing tenants):
 *   - Frühschicht: 06:00 - 14:00
 *   - Spätschicht: 14:00 - 22:00
 *   - Nachtschicht: 22:00 - 06:00
 *
 * Root users manage these via /company-settings.
 * The service lazy-initializes defaults for new tenants.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- shift_times — tenant-configurable shift time definitions
    -- ==========================================================================

    CREATE TABLE shift_times (
      id              SERIAL PRIMARY KEY,
      tenant_id       INTEGER NOT NULL,
      shift_key       VARCHAR(20) NOT NULL,
      label           VARCHAR(100) NOT NULL,
      start_time      TIME NOT NULL,
      end_time        TIME NOT NULL,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      is_active       INTEGER NOT NULL DEFAULT 1,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT fk_shift_times_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT uq_shift_times_tenant_key
        UNIQUE (tenant_id, shift_key)
    );

    -- Indexes
    CREATE INDEX idx_shift_times_tenant
      ON shift_times (tenant_id);

    CREATE INDEX idx_shift_times_active
      ON shift_times (tenant_id, is_active);

    -- RLS (ADR-019)
    ALTER TABLE shift_times ENABLE ROW LEVEL SECURITY;
    ALTER TABLE shift_times FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON shift_times
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- GRANTs for app_user
    GRANT SELECT, INSERT, UPDATE, DELETE ON shift_times TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE shift_times_id_seq TO app_user;

    -- updated_at trigger
    CREATE FUNCTION on_update_current_timestamp_shift_times()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

    CREATE TRIGGER on_update_current_timestamp
      BEFORE UPDATE ON shift_times
      FOR EACH ROW
      EXECUTE FUNCTION on_update_current_timestamp_shift_times();

    -- ==========================================================================
    -- Seed defaults for ALL existing tenants
    -- ==========================================================================
    -- Seed defaults for existing tenants (new tenants get defaults via service lazy-init)
    INSERT INTO shift_times (tenant_id, shift_key, label, start_time, end_time, sort_order)
    SELECT
      t.id,
      v.shift_key,
      v.label,
      v.start_time::TIME,
      v.end_time::TIME,
      v.sort_order
    FROM tenants t
    CROSS JOIN (
      VALUES
        ('early',  'Frühschicht',  '06:00', '14:00', 1),
        ('late',   'Spätschicht',  '14:00', '22:00', 2),
        ('night',  'Nachtschicht', '22:00', '06:00', 3)
    ) AS v(shift_key, label, start_time, end_time, sort_order);
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS on_update_current_timestamp ON shift_times;
    DROP FUNCTION IF EXISTS on_update_current_timestamp_shift_times();
    DROP TABLE IF EXISTS shift_times CASCADE;
  `);
}
