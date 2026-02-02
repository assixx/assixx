/**
 * Migration: KVP Categories Custom (Overlay-Pattern)
 * Date: 2026-02-02
 *
 * Tenant-specific category overrides (rename defaults) and custom categories.
 * Two modes in one table:
 *   - Override (category_id IS NOT NULL): Rename a global default for this tenant
 *   - New Category (category_id IS NULL): Tenant-specific custom category
 *
 * @see docs/plans/KVP-CATEGORIES-CUSTOM-PLAN.md
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Tenant-specific category overrides + custom categories
    CREATE TABLE IF NOT EXISTS kvp_categories_custom (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES kvp_categories(id) ON DELETE CASCADE,
        custom_name VARCHAR(50) NOT NULL,
        description TEXT,
        color VARCHAR(20),
        icon VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- Override: max 1 per (tenant, global_category) combination
        CONSTRAINT uq_override UNIQUE (tenant_id, category_id),

        -- New category: requires own color + icon (overrides inherit from global)
        CONSTRAINT chk_custom_has_visuals CHECK (
            category_id IS NOT NULL
            OR (color IS NOT NULL AND icon IS NOT NULL)
        )
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_kvp_categories_custom_tenant
      ON kvp_categories_custom(tenant_id);

    CREATE INDEX IF NOT EXISTS idx_kvp_categories_custom_category
      ON kvp_categories_custom(category_id);

    -- RLS (PFLICHT for tenant-isolated tables)
    ALTER TABLE kvp_categories_custom ENABLE ROW LEVEL SECURITY;
    ALTER TABLE kvp_categories_custom FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON kvp_categories_custom
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- GRANTs for app_user (PFLICHT)
    GRANT SELECT, INSERT, UPDATE, DELETE ON kvp_categories_custom TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE kvp_categories_custom_id_seq TO app_user;

    COMMENT ON TABLE kvp_categories_custom IS 'Tenant-specific KVP category overrides and custom categories (Overlay-Pattern)';
    COMMENT ON COLUMN kvp_categories_custom.category_id IS 'NULL = new custom category, NOT NULL = override of global default';
    COMMENT ON COLUMN kvp_categories_custom.custom_name IS 'Display name (override or custom category name)';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS kvp_categories_custom CASCADE;`);
}
