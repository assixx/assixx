/**
 * Migration: Inventory core tables (ENUMs + inventory_lists + inventory_items)
 *
 * Purpose: Foundation for the Inventory addon — equipment tracking with
 * auto-generated codes, QR-ready UUIDs, and custom field support.
 * See docs/FEAT_INVENTORY_MASTERPLAN.md Phase 1, Step 1.1.
 *
 * Tables: inventory_lists, inventory_items
 * ENUMs: inventory_item_status, inventory_field_type
 * UUID convention: gen_random_uuid() in SQL, UUIDv7 generated app-side.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // -- ENUMs ----------------------------------------------------------
  pgm.sql(`
    CREATE TYPE inventory_item_status AS ENUM (
      'operational',
      'defective',
      'repair',
      'maintenance',
      'decommissioned',
      'removed',
      'stored'
    );

    CREATE TYPE inventory_field_type AS ENUM (
      'text',
      'number',
      'date',
      'boolean',
      'select'
    );
  `);

  // -- inventory_lists ------------------------------------------------
  pgm.sql(`
    CREATE TABLE inventory_lists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      code_prefix VARCHAR(10) NOT NULL,
      code_separator VARCHAR(3) NOT NULL DEFAULT '-',
      code_digits SMALLINT NOT NULL DEFAULT 3,
      next_number INTEGER NOT NULL DEFAULT 1,
      icon VARCHAR(50),
      is_active SMALLINT NOT NULL DEFAULT 1,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tenant_id, code_prefix)
    );

    -- RLS (Strict Mode — ADR-019: 0 rows without tenant context)
    ALTER TABLE inventory_lists ENABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_lists FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON inventory_lists
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- GRANTs (Triple-User Model: app_user + sys_user)
    GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_lists TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_lists TO sys_user;

    -- Indexes
    CREATE INDEX idx_inventory_lists_tenant
      ON inventory_lists(tenant_id) WHERE is_active = 1;

    -- Trigger
    CREATE TRIGGER update_inventory_lists_updated_at
      BEFORE UPDATE ON inventory_lists
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);

  // -- inventory_items ------------------------------------------------
  pgm.sql(`
    CREATE TABLE inventory_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      list_id UUID NOT NULL REFERENCES inventory_lists(id) ON DELETE CASCADE,
      code VARCHAR(20) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      status inventory_item_status NOT NULL DEFAULT 'operational',
      location VARCHAR(255),
      manufacturer VARCHAR(255),
      model VARCHAR(255),
      serial_number VARCHAR(255),
      year_of_manufacture SMALLINT,
      notes TEXT,
      responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      last_inspection_date DATE,
      next_inspection_date DATE,
      inspection_interval VARCHAR(20),
      is_active SMALLINT NOT NULL DEFAULT 1,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tenant_id, code)
    );

    -- RLS (Strict Mode — ADR-019: 0 rows without tenant context)
    ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_items FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON inventory_items
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- GRANTs (Triple-User Model: app_user + sys_user)
    GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_items TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_items TO sys_user;

    -- Indexes
    CREATE INDEX idx_inventory_items_tenant
      ON inventory_items(tenant_id) WHERE is_active = 1;
    CREATE INDEX idx_inventory_items_list
      ON inventory_items(list_id) WHERE is_active = 1;
    CREATE INDEX idx_inventory_items_status
      ON inventory_items(tenant_id, status) WHERE is_active = 1;

    -- Trigger
    CREATE TRIGGER update_inventory_items_updated_at
      BEFORE UPDATE ON inventory_items
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS inventory_items CASCADE;
    DROP TABLE IF EXISTS inventory_lists CASCADE;
    DROP TYPE IF EXISTS inventory_item_status CASCADE;
    DROP TYPE IF EXISTS inventory_field_type CASCADE;
  `);
}
