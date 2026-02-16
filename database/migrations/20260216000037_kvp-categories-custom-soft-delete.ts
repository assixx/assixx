/**
 * Migration: KVP Categories Custom - Soft Delete Support
 * Date: 2026-02-16
 *
 * Adds is_active column to kvp_categories_custom to enable soft-delete.
 * When a custom category is deleted, is_active is set to 4 (deleted)
 * instead of physically removing the row. This preserves category
 * metadata (name, color, icon) for existing KVP suggestions.
 *
 * is_active convention: 0=inactive, 1=active, 3=archive, 4=deleted
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Add soft-delete column (matches project-wide is_active convention)
    ALTER TABLE kvp_categories_custom
      ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1;

    -- Index for filtering active categories efficiently
    CREATE INDEX IF NOT EXISTS idx_kvp_categories_custom_is_active
      ON kvp_categories_custom(is_active)
      WHERE is_active = 1;

    COMMENT ON COLUMN kvp_categories_custom.is_active
      IS 'Status: 0=inactive, 1=active, 3=archive, 4=deleted (soft delete)';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_kvp_categories_custom_is_active;
    ALTER TABLE kvp_categories_custom DROP COLUMN IF EXISTS is_active;
  `);
}
