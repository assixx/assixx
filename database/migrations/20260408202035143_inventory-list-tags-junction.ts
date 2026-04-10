/**
 * Migration: Inventory List-Tags Junction Table
 *
 * Purpose: N:M link between inventory_lists and inventory_tags. Composite
 * PRIMARY KEY (list_id, tag_id) prevents duplicate associations. Both
 * sides cascade-delete: removing a list or a tag cleans the junction.
 *
 * Part 2 of 4 (V1.1 Tag System).
 *
 * tenant_id is denormalized into the junction so the RLS policy can
 * enforce isolation without joining back to either parent. This matches
 * the strict-mode pattern from ADR-019.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE inventory_list_tags (
        list_id UUID NOT NULL REFERENCES inventory_lists(id) ON DELETE CASCADE,
        tag_id UUID NOT NULL REFERENCES inventory_tags(id) ON DELETE CASCADE,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (list_id, tag_id)
    );

    -- Reverse lookup: "which lists have this tag?" (for filter + usage count)
    CREATE INDEX idx_inventory_list_tags_tag
        ON inventory_list_tags (tag_id);

    -- Tenant scope index (RLS planner hint)
    CREATE INDEX idx_inventory_list_tags_tenant
        ON inventory_list_tags (tenant_id);

    -- RLS — strict mode (ADR-019)
    ALTER TABLE inventory_list_tags ENABLE ROW LEVEL SECURITY;
    ALTER TABLE inventory_list_tags FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON inventory_list_tags
        FOR ALL
        USING (
            tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- Triple-User Model GRANTs
    GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_list_tags TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_list_tags TO sys_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS inventory_list_tags CASCADE;`);
}
