/**
 * Migration: Add approval_read_status table
 *
 * Purpose: Per-user read tracking for approvals (ADR-031 ReadTrackingService pattern).
 * Enables "Neu" badge on unread approval items — identical pattern to work_order_read_status.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE approval_read_status (
        id SERIAL PRIMARY KEY,
        approval_id INTEGER NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX idx_approval_read_status_unique
        ON approval_read_status(approval_id, user_id, tenant_id);

    CREATE INDEX idx_approval_read_status_user_tenant
        ON approval_read_status(user_id, tenant_id);

    ALTER TABLE approval_read_status ENABLE ROW LEVEL SECURITY;
    ALTER TABLE approval_read_status FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON approval_read_status
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    GRANT SELECT, INSERT, UPDATE, DELETE ON approval_read_status TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE approval_read_status_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS approval_read_status CASCADE;`);
}
