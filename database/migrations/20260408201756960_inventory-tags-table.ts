/**
 * Migration: Inventory Tags — Tag Catalog Table
 *
 * Purpose: Create the inventory_tags table for tenant-scoped, reusable
 * labels on inventory_lists. Replaces the single freetext `category`
 * column with a normalized N:M tag system. Each tag has a name and an
 * optional FontAwesome icon class.
 *
 * Part 1 of 4 (V1.1 Tag System):
 *   1. inventory_tags table        (this migration)
 *   2. inventory_list_tags         (junction)
 *   3. category → tags data backfill
 *   4. drop inventory_lists.category
 *
 * Uniqueness is case-insensitive per tenant via functional index on
 * LOWER(name) so "Krane" and "KRANE" cannot co-exist.
 *
 * Tags are HARD-deleted (no is_active column). Junction CASCADE handles
 * cleanup. Soft-delete makes no sense for label metadata — a "deleted but
 * still attached" tag would be ghost UI.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE inventory_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(50) NOT NULL,
        icon VARCHAR(50),
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Case-insensitive uniqueness per tenant: prevents "Krane" + "KRANE" duplicates
    CREATE UNIQUE INDEX idx_inventory_tags_tenant_name_lower
        ON inventory_tags (tenant_id, LOWER(name));

    -- Lookup index for filter dropdowns and autocomplete
    CREATE INDEX idx_inventory_tags_tenant
        ON inventory_tags (tenant_id);

    -- RLS — strict mode (ADR-019, no bypass clause)
    ALTER TABLE inventory_tags ENABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_tags FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON inventory_tags
        FOR ALL
        USING (
            tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- Triple-User Model GRANTs
    GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_tags TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_tags TO sys_user;

    -- updated_at trigger
    CREATE TRIGGER update_inventory_tags_updated_at
        BEFORE UPDATE ON inventory_tags
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS inventory_tags CASCADE;`);
}
