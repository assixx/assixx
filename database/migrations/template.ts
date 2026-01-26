/**
 * Migration: [DESCRIPTION]
 * Date: [AUTO-GENERATED]
 * Author: [NAME]
 *
 * Purpose: [WHY this migration exists - not WHAT it does]
 *
 * =============================================================================
 * ASSIXX MIGRATION PATTERNS - Reference Template (NOT a real migration)
 * =============================================================================
 *
 * RLS Policy (MANDATORY for tenant-isolated tables):
 *   NULLIF(current_setting('app.tenant_id', true), '') IS NULL
 *   OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
 *
 * Permissions (MANDATORY for tables accessed by app_user):
 *   GRANT SELECT, INSERT, UPDATE, DELETE ON table_name TO app_user;
 *   GRANT USAGE, SELECT ON SEQUENCE table_name_id_seq TO app_user;
 *
 * is_active convention: 0=inactive, 1=active, 3=archive, 4=deleted
 * =============================================================================
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  // --- Example: Create a tenant-isolated table ---
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS example_table (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_example_table_tenant
    ON example_table(tenant_id);

    -- RLS (Row Level Security) - PFLICHT bei tenant-isolated tables
    ALTER TABLE example_table ENABLE ROW LEVEL SECURITY;
    ALTER TABLE example_table FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON example_table
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- Permissions for app_user
    GRANT SELECT, INSERT, UPDATE, DELETE ON example_table TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE example_table_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS example_table CASCADE;`);
}
