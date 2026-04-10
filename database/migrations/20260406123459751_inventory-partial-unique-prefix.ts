/**
 * Migration: Replace UNIQUE constraint with partial unique index on inventory_lists
 *
 * Purpose: The UNIQUE(tenant_id, code_prefix) constraint blocks soft-deleted
 * lists (is_active=4) from freeing their prefix for reuse. A partial unique
 * index excludes deleted rows so prefixes can be recycled after soft-delete.
 *
 * Same fix applied to inventory_custom_fields UNIQUE(tenant_id, list_id, field_name).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // -- inventory_lists: drop constraint, create partial unique index ──
  pgm.sql(`
    ALTER TABLE inventory_lists
      DROP CONSTRAINT inventory_lists_tenant_id_code_prefix_key;

    CREATE UNIQUE INDEX idx_inventory_lists_unique_prefix
      ON inventory_lists(tenant_id, code_prefix)
      WHERE is_active != 4;
  `);

  // -- inventory_custom_fields: same pattern ──────────────────────────
  pgm.sql(`
    ALTER TABLE inventory_custom_fields
      DROP CONSTRAINT inventory_custom_fields_tenant_id_list_id_field_name_key;

    CREATE UNIQUE INDEX idx_inventory_custom_fields_unique_name
      ON inventory_custom_fields(tenant_id, list_id, field_name)
      WHERE is_active != 4;
  `);

  // -- inventory_custom_values: same pattern ─────────────────────────
  pgm.sql(`
    ALTER TABLE inventory_custom_values
      DROP CONSTRAINT inventory_custom_values_tenant_id_item_id_field_id_key;

    CREATE UNIQUE INDEX idx_inventory_custom_values_unique_field
      ON inventory_custom_values(tenant_id, item_id, field_id)
      WHERE is_active != 4;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Restore original UNIQUE constraints, drop partial indexes
  pgm.sql(`
    DROP INDEX IF EXISTS idx_inventory_lists_unique_prefix;
    ALTER TABLE inventory_lists
      ADD CONSTRAINT inventory_lists_tenant_id_code_prefix_key
      UNIQUE(tenant_id, code_prefix);

    DROP INDEX IF EXISTS idx_inventory_custom_fields_unique_name;
    ALTER TABLE inventory_custom_fields
      ADD CONSTRAINT inventory_custom_fields_tenant_id_list_id_field_name_key
      UNIQUE(tenant_id, list_id, field_name);

    DROP INDEX IF EXISTS idx_inventory_custom_values_unique_field;
    ALTER TABLE inventory_custom_values
      ADD CONSTRAINT inventory_custom_values_tenant_id_item_id_field_id_key
      UNIQUE(tenant_id, item_id, field_id);
  `);
}
