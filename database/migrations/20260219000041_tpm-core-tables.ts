/**
 * Migration: TPM Core Tables (Phase 1, Step 1.1)
 * Date: 2026-02-19
 *
 * Creates 4 ENUM types and 2 tables for Total Productive Maintenance:
 *
 * ENUMs:
 *   - tpm_interval_type: daily, weekly, monthly, quarterly, semi_annual, annual, long_runner, custom
 *   - tpm_card_status: green, red, yellow, overdue
 *   - tpm_card_role: operator, maintenance
 *   - tpm_approval_status: none, pending, approved, rejected
 *
 * Tables:
 *   1. tpm_maintenance_plans  — one plan per machine (basis weekday + repeat interval)
 *   2. tpm_time_estimates     — SOLL time per plan per interval (staff, prep, exec, followup)
 *
 * Every table follows ADR-019 (RLS), uses SERIAL PK + UUID (UUIDv7), and has
 * GRANT to app_user. updated_at trigger via existing update_updated_at_column().
 *
 * References: FEAT_TPM_MASTERPLAN.md (Phase 1, Step 1.1)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- Step 1: Create ENUM types for TPM
    -- ==========================================================================

    CREATE TYPE tpm_interval_type AS ENUM (
      'daily', 'weekly', 'monthly', 'quarterly',
      'semi_annual', 'annual', 'long_runner', 'custom'
    );

    CREATE TYPE tpm_card_status AS ENUM (
      'green', 'red', 'yellow', 'overdue'
    );

    CREATE TYPE tpm_card_role AS ENUM (
      'operator', 'maintenance'
    );

    CREATE TYPE tpm_approval_status AS ENUM (
      'none', 'pending', 'approved', 'rejected'
    );

    -- ==========================================================================
    -- Step 2: Create tpm_maintenance_plans — one plan per machine
    -- ==========================================================================

    CREATE TABLE tpm_maintenance_plans (
      id                    SERIAL PRIMARY KEY,
      uuid                  CHAR(36) NOT NULL,
      tenant_id             INTEGER NOT NULL,
      machine_id            INTEGER NOT NULL,
      name                  VARCHAR(255) NOT NULL,
      base_weekday          INTEGER NOT NULL,
      base_repeat_every     INTEGER NOT NULL DEFAULT 1,
      base_time             TIME,
      shift_plan_required   BOOLEAN NOT NULL DEFAULT true,
      notes                 TEXT,
      created_by            INTEGER NOT NULL,
      is_active             INTEGER NOT NULL DEFAULT 1,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT fk_tpm_plans_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_tpm_plans_machine
        FOREIGN KEY (machine_id)
        REFERENCES machines(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_tpm_plans_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE RESTRICT
        ON DELETE SET NULL,

      CONSTRAINT chk_tpm_plans_weekday
        CHECK (base_weekday >= 0 AND base_weekday <= 6),

      CONSTRAINT chk_tpm_plans_repeat
        CHECK (base_repeat_every >= 1 AND base_repeat_every <= 4)
    );

    -- Partial unique: one active plan per machine per tenant
    CREATE UNIQUE INDEX uq_tpm_plans_tenant_machine
      ON tpm_maintenance_plans(tenant_id, machine_id)
      WHERE is_active = 1;

    CREATE INDEX idx_tpm_plans_tenant    ON tpm_maintenance_plans(tenant_id);
    CREATE INDEX idx_tpm_plans_machine   ON tpm_maintenance_plans(machine_id);
    CREATE INDEX idx_tpm_plans_uuid      ON tpm_maintenance_plans(uuid);
    CREATE INDEX idx_tpm_plans_active    ON tpm_maintenance_plans(tenant_id)
      WHERE is_active = 1;

    -- RLS (ADR-019)
    ALTER TABLE tpm_maintenance_plans ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tpm_maintenance_plans FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tpm_maintenance_plans
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- updated_at trigger (function already exists from baseline)
    CREATE TRIGGER update_tpm_maintenance_plans_updated_at
      BEFORE UPDATE ON tpm_maintenance_plans
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON tpm_maintenance_plans TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tpm_maintenance_plans_id_seq TO app_user;

    -- ==========================================================================
    -- Step 3: Create tpm_time_estimates — SOLL time per plan per interval
    -- ==========================================================================

    CREATE TABLE tpm_time_estimates (
      id                    SERIAL PRIMARY KEY,
      uuid                  CHAR(36) NOT NULL,
      tenant_id             INTEGER NOT NULL,
      plan_id               INTEGER NOT NULL,
      interval_type         tpm_interval_type NOT NULL,
      staff_count           INTEGER NOT NULL DEFAULT 1,
      preparation_minutes   INTEGER NOT NULL DEFAULT 0,
      execution_minutes     INTEGER NOT NULL DEFAULT 0,
      followup_minutes      INTEGER NOT NULL DEFAULT 0,
      is_active             INTEGER NOT NULL DEFAULT 1,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT fk_tpm_estimates_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT fk_tpm_estimates_plan
        FOREIGN KEY (plan_id)
        REFERENCES tpm_maintenance_plans(id)
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

      CONSTRAINT chk_tpm_estimates_staff
        CHECK (staff_count >= 1),

      CONSTRAINT chk_tpm_estimates_prep
        CHECK (preparation_minutes >= 0),

      CONSTRAINT chk_tpm_estimates_exec
        CHECK (execution_minutes >= 0),

      CONSTRAINT chk_tpm_estimates_followup
        CHECK (followup_minutes >= 0)
    );

    -- Partial unique: one active estimate per plan per interval type
    CREATE UNIQUE INDEX uq_tpm_estimates_plan_interval
      ON tpm_time_estimates(plan_id, interval_type)
      WHERE is_active = 1;

    CREATE INDEX idx_tpm_estimates_tenant  ON tpm_time_estimates(tenant_id);
    CREATE INDEX idx_tpm_estimates_plan    ON tpm_time_estimates(plan_id);
    CREATE INDEX idx_tpm_estimates_uuid    ON tpm_time_estimates(uuid);

    -- RLS (ADR-019)
    ALTER TABLE tpm_time_estimates ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tpm_time_estimates FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tpm_time_estimates
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- updated_at trigger
    CREATE TRIGGER update_tpm_time_estimates_updated_at
      BEFORE UPDATE ON tpm_time_estimates
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON tpm_time_estimates TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE tpm_time_estimates_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Drop tables FIRST (they depend on ENUMs), then ENUMs
    DROP TABLE IF EXISTS tpm_time_estimates CASCADE;
    DROP TABLE IF EXISTS tpm_maintenance_plans CASCADE;

    -- Drop ENUMs (safe — no other tables reference them yet in this migration)
    DROP TYPE IF EXISTS tpm_approval_status;
    DROP TYPE IF EXISTS tpm_card_role;
    DROP TYPE IF EXISTS tpm_card_status;
    DROP TYPE IF EXISTS tpm_interval_type;
  `);
}
