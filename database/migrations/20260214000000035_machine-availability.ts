/**
 * Migration: Machine Availability Table
 * Date: 2026-02-14
 *
 * Creates the machine_availability table for tracking machine status over
 * date ranges (planned maintenance windows, repair periods, etc.).
 * Mirrors the user_availability pattern for consistency.
 *
 * Changes:
 *   1. CREATE TYPE machine_availability_status (6 values)
 *   2. CREATE TABLE machine_availability
 *   3. CREATE indexes (idx_ma_*)
 *   4. ENABLE RLS + CREATE POLICY tenant_isolation
 *   5. CREATE trigger for updated_at
 *   6. GRANT permissions to app_user
 *
 * References: user_availability table pattern (migration 20260212000030)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- Step 1: Create ENUM type for machine availability statuses
    -- ==========================================================================

    CREATE TYPE machine_availability_status AS ENUM (
      'operational',
      'maintenance',
      'repair',
      'standby',
      'cleaning',
      'other'
    );

    -- ==========================================================================
    -- Step 2: Create machine_availability table
    -- ==========================================================================

    CREATE TABLE machine_availability (
      id            SERIAL PRIMARY KEY,
      asset_id    INTEGER NOT NULL,
      tenant_id     INTEGER NOT NULL,
      status        machine_availability_status NOT NULL DEFAULT 'operational',
      start_date    DATE NOT NULL,
      end_date      DATE NOT NULL,
      reason        VARCHAR(255),
      notes         TEXT,
      created_by    INTEGER,
      created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

      CONSTRAINT fk_ma_machine
        FOREIGN KEY (asset_id)
        REFERENCES machines(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_ma_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_ma_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL,

      CONSTRAINT chk_ma_dates
        CHECK (end_date >= start_date)
    );

    -- ==========================================================================
    -- Step 3: Create indexes
    -- ==========================================================================

    CREATE INDEX idx_ma_machine    ON machine_availability(asset_id);
    CREATE INDEX idx_ma_tenant     ON machine_availability(tenant_id);
    CREATE INDEX idx_ma_dates      ON machine_availability(start_date, end_date);
    CREATE INDEX idx_ma_status     ON machine_availability(status);
    CREATE INDEX idx_ma_created_by ON machine_availability(created_by);

    -- ==========================================================================
    -- Step 4: Enable RLS + create tenant isolation policy
    -- ==========================================================================

    ALTER TABLE machine_availability ENABLE ROW LEVEL SECURITY;
    ALTER TABLE machine_availability FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON machine_availability
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- ==========================================================================
    -- Step 5: Create trigger for updated_at
    -- ==========================================================================

    CREATE TRIGGER update_machine_availability_updated_at
      BEFORE UPDATE ON machine_availability
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- ==========================================================================
    -- Step 6: Grant permissions to app_user
    -- ==========================================================================

    GRANT SELECT, INSERT, UPDATE, DELETE ON machine_availability TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE machine_availability_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS machine_availability CASCADE;
    DROP TYPE IF EXISTS machine_availability_status;
  `);
}
