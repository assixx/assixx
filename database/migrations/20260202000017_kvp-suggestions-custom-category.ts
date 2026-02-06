/**
 * Migration: KVP Suggestions Custom Category Reference
 * Date: 2026-02-02
 *
 * Adds custom_category_id column to kvp_suggestions for referencing
 * tenant-specific categories from kvp_categories_custom.
 *
 * Semantics:
 *   category_id SET, custom_category_id NULL → Global category
 *   category_id NULL, custom_category_id SET → Tenant custom category
 *   Both NULL → Legacy row without category (allowed, category_id was already nullable)
 *
 * No FK constraint (consistent with existing category_id which also has no FK).
 * Referential integrity enforced at application level.
 *
 * @see docs/plans/KVP-CATEGORIES-CUSTOM-PLAN.md
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- New column: reference to tenant-specific custom categories
    ALTER TABLE kvp_suggestions
      ADD COLUMN custom_category_id INTEGER;

    -- Partial index for lookups (only rows with custom categories)
    CREATE INDEX IF NOT EXISTS idx_kvp_suggestions_custom_category
      ON kvp_suggestions(custom_category_id)
      WHERE custom_category_id IS NOT NULL;

    COMMENT ON COLUMN kvp_suggestions.custom_category_id IS 'Reference to kvp_categories_custom.id for tenant-specific categories (NULL = uses global category_id)';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_kvp_suggestions_custom_category;
    ALTER TABLE kvp_suggestions DROP COLUMN IF EXISTS custom_category_id;
  `);
}
