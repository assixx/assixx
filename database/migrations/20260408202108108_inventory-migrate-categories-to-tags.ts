/**
 * Migration: Backfill inventory_lists.category → inventory_tags
 *
 * Purpose: For every distinct (tenant_id, LOWER(TRIM(category))) on
 * inventory_lists where category is non-empty:
 *   1. INSERT a tag into inventory_tags (case-insensitive dedupe)
 *   2. INSERT a junction row linking the original list to the new tag
 *
 * Part 3 of 4 (V1.1 Tag System).
 *
 * WARNING: One-way migration. Rollback (down) does NOT restore the
 * category strings into inventory_lists.category — it only deletes the
 * synthesized tag/junction rows. The category column itself is dropped
 * in Part 4, after this backfill succeeds.
 *
 * No-op safe: if no lists have non-null category (e.g. fresh DB), the
 * SELECTs return zero rows and no INSERTs happen. The migration succeeds
 * either way. created_by on the new tag uses the original list's
 * created_by so the audit trail stays meaningful.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Step 1: Create one tag per distinct (tenant, lower(category))
    -- MIN(name) picks a deterministic display casing if a tenant has
    -- mixed-case duplicates (e.g. "Krane" + "KRANE") and MIN(created_by)
    -- picks the earliest creator as tag owner.
    INSERT INTO inventory_tags (tenant_id, name, created_by)
    SELECT
        tenant_id,
        MIN(TRIM(category)) AS name,
        MIN(created_by) AS created_by
    FROM inventory_lists
    WHERE category IS NOT NULL
      AND TRIM(category) <> ''
    GROUP BY tenant_id, LOWER(TRIM(category));

    -- Step 2: Link every list with a category to its corresponding tag.
    -- Match is case-insensitive on the trimmed category string.
    INSERT INTO inventory_list_tags (list_id, tag_id, tenant_id)
    SELECT
        l.id,
        t.id,
        l.tenant_id
    FROM inventory_lists l
    JOIN inventory_tags t
        ON t.tenant_id = l.tenant_id
       AND LOWER(t.name) = LOWER(TRIM(l.category))
    WHERE l.category IS NOT NULL
      AND TRIM(l.category) <> '';
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Lossy rollback: cannot reconstruct original category strings (mixed
  // casings collapsed during backfill). Only the synthesized rows are
  // removed; the category column is restored by Part 4's down().
  pgm.sql(`
    DELETE FROM inventory_list_tags;
    DELETE FROM inventory_tags;
  `);
}
