/**
 * Migration: Replace UNIQUE constraint with partial unique index on shift_times
 *
 * Purpose: `uq_shift_times_tenant_key (tenant_id, shift_key)` is a full UNIQUE
 * constraint. `shift_times` has `is_active` (soft-delete). A soft-deleted row
 * still occupies its `shift_key` slot, so re-creating the same key after a
 * soft-delete raises 23505. Same bug class as inventory_items — this migration
 * applies the established partial-unique pattern.
 *
 * Consistent with:
 *  - 20260406123459751_inventory-partial-unique-prefix (lists/fields/values)
 *  - 20260423082820259_inventory-items-partial-unique-code
 *
 * WARNING: down() is blocked if two rows with the same (tenant_id, shift_key)
 * exist across active + soft-deleted — exactly the state the partial index
 * permits. The pre-check RAISEs EXCEPTION per DATABASE-MIGRATION-GUIDE
 * "FAIL LOUD".
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE shift_times
      DROP CONSTRAINT uq_shift_times_tenant_key;

    CREATE UNIQUE INDEX idx_shift_times_unique_key
      ON shift_times(tenant_id, shift_key)
      WHERE is_active != 4;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DO $$
    DECLARE
      _dup_count integer;
    BEGIN
      SELECT COUNT(*) INTO _dup_count FROM (
        SELECT tenant_id, shift_key
        FROM shift_times
        GROUP BY tenant_id, shift_key
        HAVING COUNT(*) > 1
      ) d;
      IF _dup_count > 0 THEN
        RAISE EXCEPTION
          'Cannot restore UNIQUE(tenant_id, shift_key): % duplicate pairs exist across soft-deleted + active rows. Rollback blocked.',
          _dup_count;
      END IF;
    END $$;

    DROP INDEX IF EXISTS idx_shift_times_unique_key;

    ALTER TABLE shift_times
      ADD CONSTRAINT uq_shift_times_tenant_key
      UNIQUE(tenant_id, shift_key);
  `);
}
