/**
 * Migration: Approvals — Core Addon for Freigabe-System
 * Date: 2026-03-17
 *
 * Creates the approval/Freigabe system (Core Addon, always active):
 * - Addon entry in addons table (is_core=true)
 * - 2 ENUMs: approval_status, approval_approver_type
 * - approval_configs table (who CAN approve what, per addon per tenant)
 * - approvals table (actual approval requests with source tracking)
 *
 * Both tables have full RLS tenant isolation (ADR-019),
 * GRANTs for app_user, and appropriate indexes.
 *
 * Design decisions:
 * - Pro-Entity: each approval can have a different assigned_to (optional override)
 * - Multiple masters: multiple rows in approval_configs per addon
 * - Simple lifecycle: pending → approved/rejected (no revision rounds)
 * - approval_configs supports dynamic resolution via approver_type
 *   (user, team_lead, area_lead, department_lead) — resolved at runtime
 * - addon_code tracks source addon (kvp, vacation, blackboard, etc.)
 * - source_entity_type + source_uuid enable granular source tracking
 *
 * Dependencies:
 *   - tenants (baseline)
 *   - users (baseline)
 *   - addons (ADR-033)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- Step 1: Addon Entry (Core — always active, no subscription needed)
    -- ==========================================================================

    INSERT INTO addons (code, name, description, price_monthly, is_active, requires_setup, icon, sort_order, is_core, trial_days)
    VALUES (
      'approvals',
      'Freigaben',
      'Zentrales Freigabe-System — Genehmigungsworkflow für KVP, Urlaub, Kalender und weitere Module',
      NULL,
      1,
      false,
      'fa-check-double',
      10,
      true,
      NULL
    )
    ON CONFLICT (code) DO NOTHING;

    -- ==========================================================================
    -- Step 2: ENUMs
    -- ==========================================================================

    CREATE TYPE approval_status AS ENUM (
      'pending',
      'approved',
      'rejected'
    );

    CREATE TYPE approval_approver_type AS ENUM (
      'user',
      'team_lead',
      'area_lead',
      'department_lead'
    );

    -- ==========================================================================
    -- Step 3: approval_configs (who CAN approve what)
    -- ==========================================================================
    -- Multiple rows per addon = multiple masters.
    -- approver_type determines resolution:
    --   'user'            → approver_user_id is the specific user
    --   'team_lead'       → resolved at runtime from team's lead_id
    --   'area_lead'       → resolved at runtime from area's lead_id
    --   'department_lead' → resolved at runtime from department's lead_id
    -- role_label is an optional display name (e.g. "TPM Schrittmacher")

    CREATE TABLE approval_configs (
      id SERIAL PRIMARY KEY,
      uuid CHAR(36) UNIQUE NOT NULL,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      addon_code VARCHAR(50) NOT NULL,
      approver_type approval_approver_type NOT NULL DEFAULT 'user',
      approver_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role_label VARCHAR(100),
      is_active SMALLINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Indexes
    CREATE UNIQUE INDEX idx_approval_configs_unique
      ON approval_configs(tenant_id, addon_code, approver_type, COALESCE(approver_user_id, 0))
      WHERE is_active = 1;

    CREATE INDEX idx_approval_configs_tenant
      ON approval_configs(tenant_id) WHERE is_active = 1;

    CREATE INDEX idx_approval_configs_addon
      ON approval_configs(tenant_id, addon_code) WHERE is_active = 1;

    -- RLS (ADR-019)
    ALTER TABLE approval_configs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE approval_configs FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON approval_configs
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON approval_configs TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE approval_configs_id_seq TO app_user;

    -- updated_at trigger
    CREATE TRIGGER update_approval_configs_updated_at
      BEFORE UPDATE ON approval_configs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- ==========================================================================
    -- Step 4: approvals (actual approval requests)
    -- ==========================================================================
    -- addon_code: which addon this came from (kvp, vacation, blackboard, etc.)
    -- source_entity_type: granular type (kvp_suggestion, vacation_request, etc.)
    -- source_uuid: reference to source entity (polymorphic, no FK)
    -- assigned_to: optional per-entity override (NULL = all config masters see it)
    -- decided_by: who actually approved/rejected

    CREATE TABLE approvals (
      id SERIAL PRIMARY KEY,
      uuid CHAR(36) UNIQUE NOT NULL,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      addon_code VARCHAR(50) NOT NULL,
      source_entity_type VARCHAR(100) NOT NULL,
      source_uuid CHAR(36) NOT NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      requested_by INTEGER NOT NULL REFERENCES users(id),
      assigned_to INTEGER REFERENCES users(id),
      status approval_status NOT NULL DEFAULT 'pending',
      priority VARCHAR(10) NOT NULL DEFAULT 'medium',
      decided_by INTEGER REFERENCES users(id),
      decided_at TIMESTAMPTZ,
      decision_note TEXT,
      is_active SMALLINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Indexes
    CREATE INDEX idx_approvals_tenant
      ON approvals(tenant_id) WHERE is_active = 1;

    CREATE INDEX idx_approvals_status
      ON approvals(tenant_id, status) WHERE is_active = 1;

    CREATE INDEX idx_approvals_addon
      ON approvals(tenant_id, addon_code) WHERE is_active = 1;

    CREATE INDEX idx_approvals_requested_by
      ON approvals(requested_by) WHERE is_active = 1;

    CREATE INDEX idx_approvals_assigned_to
      ON approvals(assigned_to)
      WHERE assigned_to IS NOT NULL AND is_active = 1;

    CREATE INDEX idx_approvals_source
      ON approvals(source_uuid) WHERE is_active = 1;

    CREATE INDEX idx_approvals_addon_entity
      ON approvals(tenant_id, addon_code, source_entity_type) WHERE is_active = 1;

    -- RLS (ADR-019)
    ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
    ALTER TABLE approvals FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON approvals
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON approvals TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE approvals_id_seq TO app_user;

    -- updated_at trigger
    CREATE TRIGGER update_approvals_updated_at
      BEFORE UPDATE ON approvals
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Drop tables (reverse creation order)
    DROP TABLE IF EXISTS approvals CASCADE;
    DROP TABLE IF EXISTS approval_configs CASCADE;

    -- Drop ENUMs (after dependent tables are gone)
    DROP TYPE IF EXISTS approval_approver_type;
    DROP TYPE IF EXISTS approval_status;

    -- Remove addon entry
    DELETE FROM addons WHERE code = 'approvals';
  `);
}
