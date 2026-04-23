/**
 * Migration: Replace UNIQUE constraint with partial unique index on inventory_items
 *
 * Purpose: The UNIQUE(tenant_id, code) constraint blocks soft-deleted items
 * (is_active=4) from freeing their code for reuse. After afterAll() soft-deletes
 * an item (e.g. ATK-001), a new list that starts over at next_number=1 cannot
 * insert ATK-001 again — causing 500 "duplicate key" on create and cascading
 * failures in all downstream tests (photos, update, delete, permissions, audit).
 *
 * Mirrors the pattern already applied by 20260406123459751_inventory-partial-unique-prefix
 * to the 3 sibling tables (inventory_lists.code_prefix,
 * inventory_custom_fields.field_name, inventory_custom_values (tenant,item,field)).
 * inventory_items was missed by that migration — this migration closes the gap.
 *
 * WARNING: Rolling down may fail if, after this migration runs, two rows with the
 * same (tenant_id, code) exist where one is soft-deleted and the other is active
 * — exactly the state the partial index permits. The down() adds a defensive
 * RAISE EXCEPTION pre-check to fail loud instead of silently losing data.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE inventory_items
      DROP CONSTRAINT inventory_items_tenant_id_code_key;

    CREATE UNIQUE INDEX idx_inventory_items_unique_code
      ON inventory_items(tenant_id, code)
      WHERE is_active != 4;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Fail loud if restoring the full UNIQUE would lose data — e.g. a soft-deleted
  // row sharing (tenant_id, code) with an active row. Guide §"Required Patterns"
  // (FAIL LOUD) — matches Migration 028 pattern.
  pgm.sql(`
    DO $$
    DECLARE
      _dup_count integer;
    BEGIN
      SELECT COUNT(*) INTO _dup_count FROM (
        SELECT tenant_id, code
        FROM inventory_items
        GROUP BY tenant_id, code
        HAVING COUNT(*) > 1
      ) d;
      IF _dup_count > 0 THEN
        RAISE EXCEPTION
          'Cannot restore UNIQUE(tenant_id, code): % duplicate (tenant_id, code) pairs exist across soft-deleted + active rows. Rollback blocked.',
          _dup_count;
      END IF;
    END $$;

    DROP INDEX IF EXISTS idx_inventory_items_unique_code;

    ALTER TABLE inventory_items
      ADD CONSTRAINT inventory_items_tenant_id_code_key
      UNIQUE(tenant_id, code);
  `);
}
