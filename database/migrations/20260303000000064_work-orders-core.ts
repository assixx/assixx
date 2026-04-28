/**
 * Migration: Work Orders — Feature Flag, ENUMs, Core Tables
 * Date: 2026-03-03
 *
 * Creates the cross-module work-order system:
 * - Feature flag in features table (category: premium)
 * - 3 ENUMs: work_order_status, work_order_priority, work_order_source_type
 * - work_orders table (core entity)
 * - work_order_assignees table (M:N junction with users)
 *
 * Both tables have full RLS tenant isolation (ADR-019),
 * GRANTs for app_user, and appropriate indexes.
 *
 * Dependencies:
 *   - tenants (baseline)
 *   - users (baseline)
 *   - features (baseline)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- Step 1: Feature Flag
    -- ==========================================================================

    INSERT INTO features (code, name, description, category, base_price, is_active, sort_order)
    VALUES (
      'work_orders',
      'Arbeitsaufträge',
      'Modulübergreifendes Arbeitsauftrag-System für Mängelbeseitigung und Aufgabenverwaltung',
      'premium',
      0,
      1,
      55
    )
    ON CONFLICT (code) DO NOTHING;

    -- ==========================================================================
    -- Step 2: ENUMs
    -- ==========================================================================

    CREATE TYPE work_order_status AS ENUM (
      'open',
      'in_progress',
      'completed',
      'verified'
    );

    CREATE TYPE work_order_priority AS ENUM (
      'low',
      'medium',
      'high'
    );

    CREATE TYPE work_order_source_type AS ENUM (
      'tpm_defect',
      'manual'
    );

    -- ==========================================================================
    -- Step 3: work_orders (core entity)
    -- ==========================================================================

    CREATE TABLE work_orders (
      id SERIAL PRIMARY KEY,
      uuid CHAR(36) UNIQUE NOT NULL,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      status work_order_status NOT NULL DEFAULT 'open',
      priority work_order_priority NOT NULL DEFAULT 'medium',
      source_type work_order_source_type NOT NULL DEFAULT 'manual',
      source_uuid CHAR(36),
      due_date DATE,
      created_by INTEGER NOT NULL REFERENCES users(id),
      completed_at TIMESTAMPTZ,
      verified_at TIMESTAMPTZ,
      verified_by INTEGER REFERENCES users(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Indexes
    CREATE INDEX idx_work_orders_tenant
      ON work_orders(tenant_id) WHERE is_active = 1;

    CREATE INDEX idx_work_orders_status
      ON work_orders(tenant_id, status) WHERE is_active = 1;

    CREATE INDEX idx_work_orders_priority
      ON work_orders(tenant_id, priority) WHERE is_active = 1;

    CREATE INDEX idx_work_orders_created_by
      ON work_orders(created_by) WHERE is_active = 1;

    CREATE INDEX idx_work_orders_source
      ON work_orders(source_type, source_uuid)
      WHERE source_uuid IS NOT NULL AND is_active = 1;

    CREATE INDEX idx_work_orders_due_date
      ON work_orders(tenant_id, due_date)
      WHERE due_date IS NOT NULL AND is_active = 1;

    -- RLS (ADR-019)
    ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE work_orders FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON work_orders
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON work_orders TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE work_orders_id_seq TO app_user;

    -- updated_at trigger
    CREATE TRIGGER update_work_orders_updated_at
      BEFORE UPDATE ON work_orders
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- ==========================================================================
    -- Step 4: work_order_assignees (M:N junction: work_orders <-> users)
    -- ==========================================================================

    CREATE TABLE work_order_assignees (
      id SERIAL PRIMARY KEY,
      uuid CHAR(36) UNIQUE NOT NULL,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      assigned_by INTEGER NOT NULL REFERENCES users(id),
      UNIQUE(work_order_id, user_id)
    );

    -- Indexes
    CREATE INDEX idx_work_order_assignees_tenant
      ON work_order_assignees(tenant_id);

    CREATE INDEX idx_work_order_assignees_work_order
      ON work_order_assignees(work_order_id);

    CREATE INDEX idx_work_order_assignees_user
      ON work_order_assignees(user_id);

    -- RLS (ADR-019)
    ALTER TABLE work_order_assignees ENABLE ROW LEVEL SECURITY;
    ALTER TABLE work_order_assignees FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON work_order_assignees
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON work_order_assignees TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE work_order_assignees_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Drop tables (reverse creation order)
    DROP TABLE IF EXISTS work_order_assignees CASCADE;
    DROP TABLE IF EXISTS work_orders CASCADE;

    -- Drop ENUMs (after dependent tables are gone)
    DROP TYPE IF EXISTS work_order_source_type;
    DROP TYPE IF EXISTS work_order_priority;
    DROP TYPE IF EXISTS work_order_status;

    -- Remove feature flag
    DELETE FROM features WHERE code = 'work_orders';
  `);
}
