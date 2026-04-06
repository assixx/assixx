/**
 * Migration: Inventory custom fields, custom values, and item photos
 *
 * Purpose: EAV pattern for per-list custom field definitions and per-item
 * values, plus photo attachments for inventory items.
 * See docs/FEAT_INVENTORY_MASTERPLAN.md Phase 1, Step 1.2.
 *
 * Tables: inventory_custom_fields, inventory_custom_values, inventory_item_photos
 * RLS: Strict mode (ADR-019) — no bypass clause.
 * GRANTs: app_user + sys_user (Triple-User Model).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // -- inventory_custom_fields ----------------------------------------
  pgm.sql(`
    CREATE TABLE inventory_custom_fields (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      list_id UUID NOT NULL REFERENCES inventory_lists(id) ON DELETE CASCADE,
      field_name VARCHAR(100) NOT NULL,
      field_type inventory_field_type NOT NULL DEFAULT 'text',
      field_options JSONB,
      field_unit VARCHAR(20),
      is_required BOOLEAN NOT NULL DEFAULT false,
      sort_order SMALLINT NOT NULL DEFAULT 0,
      is_active SMALLINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tenant_id, list_id, field_name)
    );

    -- RLS (Strict Mode — ADR-019)
    ALTER TABLE inventory_custom_fields ENABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_custom_fields FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON inventory_custom_fields
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- GRANTs (Triple-User Model)
    GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_custom_fields TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_custom_fields TO sys_user;

    -- Indexes
    CREATE INDEX idx_inventory_custom_fields_list
      ON inventory_custom_fields(list_id) WHERE is_active = 1;

    -- Trigger
    CREATE TRIGGER update_inventory_custom_fields_updated_at
      BEFORE UPDATE ON inventory_custom_fields
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);

  // -- inventory_custom_values ----------------------------------------
  pgm.sql(`
    CREATE TABLE inventory_custom_values (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      field_id UUID NOT NULL REFERENCES inventory_custom_fields(id) ON DELETE CASCADE,
      value_text TEXT,
      value_number NUMERIC,
      value_date DATE,
      value_boolean BOOLEAN,
      is_active SMALLINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tenant_id, item_id, field_id)
    );

    -- RLS (Strict Mode — ADR-019)
    ALTER TABLE inventory_custom_values ENABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_custom_values FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON inventory_custom_values
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- GRANTs (Triple-User Model)
    GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_custom_values TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_custom_values TO sys_user;

    -- Indexes
    CREATE INDEX idx_inventory_custom_values_item
      ON inventory_custom_values(item_id) WHERE is_active = 1;

    -- Trigger
    CREATE TRIGGER update_inventory_custom_values_updated_at
      BEFORE UPDATE ON inventory_custom_values
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);

  // -- inventory_item_photos ------------------------------------------
  pgm.sql(`
    CREATE TABLE inventory_item_photos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      caption VARCHAR(255),
      sort_order SMALLINT NOT NULL DEFAULT 0,
      is_active SMALLINT NOT NULL DEFAULT 1,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- RLS (Strict Mode — ADR-019)
    ALTER TABLE inventory_item_photos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_item_photos FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON inventory_item_photos
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- GRANTs (Triple-User Model)
    GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_item_photos TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_item_photos TO sys_user;

    -- Indexes
    CREATE INDEX idx_inventory_item_photos_item
      ON inventory_item_photos(item_id) WHERE is_active = 1;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS inventory_item_photos CASCADE;
    DROP TABLE IF EXISTS inventory_custom_values CASCADE;
    DROP TABLE IF EXISTS inventory_custom_fields CASCADE;
  `);
}
