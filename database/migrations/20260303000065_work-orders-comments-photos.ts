/**
 * Migration: Work Orders — Comments + Photos Tables
 * Date: 2026-03-03
 *
 * Creates supporting tables for the Arbeitsauftrag-System:
 * - work_order_comments: Status-change history + user comments/documentation
 * - work_order_photos: Photo evidence of completed repairs (max 10 per order, 5 MB each)
 *
 * Both tables have full RLS tenant isolation (ADR-019),
 * GRANTs for app_user, and appropriate indexes.
 *
 * Dependencies:
 *   - work_orders (migration 064)
 *   - work_order_status ENUM (migration 064)
 *   - users (baseline)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- Step 1: work_order_comments (status history + user documentation)
    -- ==========================================================================

    CREATE TABLE work_order_comments (
      id SERIAL PRIMARY KEY,
      uuid CHAR(36) UNIQUE NOT NULL,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      is_status_change BOOLEAN NOT NULL DEFAULT false,
      old_status work_order_status,
      new_status work_order_status,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Indexes
    CREATE INDEX idx_work_order_comments_tenant
      ON work_order_comments(tenant_id) WHERE is_active = 1;

    CREATE INDEX idx_work_order_comments_work_order
      ON work_order_comments(work_order_id) WHERE is_active = 1;

    CREATE INDEX idx_work_order_comments_user
      ON work_order_comments(user_id) WHERE is_active = 1;

    CREATE INDEX idx_work_order_comments_status_change
      ON work_order_comments(work_order_id)
      WHERE is_status_change = true AND is_active = 1;

    -- RLS (ADR-019)
    ALTER TABLE work_order_comments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE work_order_comments FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON work_order_comments
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON work_order_comments TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE work_order_comments_id_seq TO app_user;

    -- updated_at trigger
    CREATE TRIGGER update_work_order_comments_updated_at
      BEFORE UPDATE ON work_order_comments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    -- ==========================================================================
    -- Step 2: work_order_photos (repair evidence, max 10 per order, 5 MB each)
    -- ==========================================================================

    CREATE TABLE work_order_photos (
      id SERIAL PRIMARY KEY,
      uuid CHAR(36) UNIQUE NOT NULL,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      file_path VARCHAR(500) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 5242880),
      mime_type VARCHAR(100) NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- No updated_at trigger (photos are immutable once uploaded)

    -- Indexes
    CREATE INDEX idx_work_order_photos_tenant
      ON work_order_photos(tenant_id);

    CREATE INDEX idx_work_order_photos_work_order
      ON work_order_photos(work_order_id);

    -- RLS (ADR-019)
    ALTER TABLE work_order_photos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE work_order_photos FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON work_order_photos
      FOR ALL
      USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- Permissions for app_user (MANDATORY!)
    GRANT SELECT, INSERT, UPDATE, DELETE ON work_order_photos TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE work_order_photos_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TABLE IF EXISTS work_order_photos CASCADE;
    DROP TABLE IF EXISTS work_order_comments CASCADE;
  `);
}
