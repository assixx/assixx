/**
 * Migration: User Feature Permissions
 * Date: 2026-02-07
 *
 * Per-user, per-feature/module permission control (canRead, canWrite, canDelete).
 * Decentralized Registry Pattern — feature modules own their permission definitions.
 * Single DB table, RLS-protected, UPSERT-ready via unique constraint.
 *
 * @see docs/USER-PERMISSIONS-PLAN.md
 * @see docs/infrastructure/adr/ADR-020-per-user-feature-permissions.md
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Per-user feature permission control
    CREATE TABLE IF NOT EXISTS user_feature_permissions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        feature_code VARCHAR(50) NOT NULL,
        module_code VARCHAR(50) NOT NULL,
        can_read BOOLEAN NOT NULL DEFAULT FALSE,
        can_write BOOLEAN NOT NULL DEFAULT FALSE,
        can_delete BOOLEAN NOT NULL DEFAULT FALSE,
        assigned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_user_feature_module UNIQUE (tenant_id, user_id, feature_code, module_code)
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_ufp_user_tenant
      ON user_feature_permissions(tenant_id, user_id);

    -- RLS (PFLICHT per ADR-019)
    ALTER TABLE user_feature_permissions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_feature_permissions FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON user_feature_permissions
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- GRANTs for app_user (PFLICHT per ADR-019)
    GRANT SELECT, INSERT, UPDATE, DELETE ON user_feature_permissions TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE user_feature_permissions_id_seq TO app_user;

    COMMENT ON TABLE user_feature_permissions IS 'Per-user, per-feature/module permission control (canRead, canWrite, canDelete)';
    COMMENT ON COLUMN user_feature_permissions.feature_code IS 'Must match features.code (e.g. blackboard, calendar)';
    COMMENT ON COLUMN user_feature_permissions.module_code IS 'Sub-module within feature (e.g. blackboard-posts, blackboard-comments)';
    COMMENT ON COLUMN user_feature_permissions.assigned_by IS 'Admin user who granted/revoked this permission';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS user_feature_permissions CASCADE;`);
}
