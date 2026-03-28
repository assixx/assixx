/**
 * Migration: Work Order Read Status Tracking
 * Date: 2026-03-08
 *
 * Adds per-user read tracking for work orders ("Neu" badge).
 * Pattern: document_read_status (idempotent UPSERT via unique constraint).
 *
 * RLS policy follows ADR-019 NULLIF pattern.
 * GRANTs for app_user follow HOW-TO-INTEGRATE-FEATURE 1.2.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE work_order_read_status (
      id            SERIAL PRIMARY KEY,
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      read_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Unique constraint for UPSERT (ON CONFLICT)
    CREATE UNIQUE INDEX idx_wo_read_status_unique
      ON work_order_read_status (work_order_id, user_id, tenant_id);

    -- Performance index for LEFT JOIN in list queries
    CREATE INDEX idx_wo_read_status_user_tenant
      ON work_order_read_status (user_id, tenant_id);

    -- RLS (ADR-019: Multi-Tenant Isolation — NULLIF pattern mandatory)
    ALTER TABLE work_order_read_status ENABLE ROW LEVEL SECURITY;
    ALTER TABLE work_order_read_status FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON work_order_read_status
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- GRANTs for app_user (RLS-enforced backend connection)
    GRANT SELECT, INSERT, UPDATE, DELETE ON work_order_read_status TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE work_order_read_status_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS work_order_read_status CASCADE;`);
}
