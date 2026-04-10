/**
 * Migration: Drop inventory_lists.category Column
 *
 * Purpose: Remove the legacy single-string category column. All
 * categorisation now happens via the inventory_tags + inventory_list_tags
 * relation introduced in Parts 1-3 of the V1.1 Tag System.
 *
 * Part 4 of 4 (V1.1 Tag System).
 *
 * WARNING: One-way migration. Rollback re-adds the column as nullable
 * VARCHAR(100) but data is NOT restored — the original strings were
 * already collapsed in Part 3's backfill.
 *
 * Pre-condition: Part 3 (backfill) must have run successfully. The
 * pgmigrations order check enforces this.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE inventory_lists DROP COLUMN category;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Defensive IF NOT EXISTS — column is gone in up(), reinstating only
  // restores the schema shape. Original string data is unrecoverable.
  pgm.sql(`
    ALTER TABLE inventory_lists ADD COLUMN IF NOT EXISTS category VARCHAR(100);
  `);
}
