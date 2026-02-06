/**
 * Migration: Feature Visits Tracking
 * Date: 2026-01-21 (original) / 2026-01-27 (wrapped)
 *
 * Tracks user's last visit per feature for badge reset.
 * Supports: calendar, kvp, surveys (extensible).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS feature_visits (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        feature VARCHAR(50) NOT NULL,
        last_visited_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_user_feature_tenant UNIQUE(user_id, feature, tenant_id)
    );

    CREATE INDEX IF NOT EXISTS idx_feature_visits_user ON feature_visits(user_id);
    CREATE INDEX IF NOT EXISTS idx_feature_visits_tenant ON feature_visits(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_feature_visits_feature ON feature_visits(feature);
    CREATE INDEX IF NOT EXISTS idx_feature_visits_lookup ON feature_visits(tenant_id, user_id, feature);

    ALTER TABLE feature_visits ENABLE ROW LEVEL SECURITY;
    ALTER TABLE feature_visits FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON feature_visits
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    GRANT SELECT, INSERT, UPDATE, DELETE ON feature_visits TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE feature_visits_id_seq TO app_user;

    CREATE OR REPLACE FUNCTION update_feature_visits_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_feature_visits_updated_at ON feature_visits;
    CREATE TRIGGER trigger_feature_visits_updated_at
        BEFORE UPDATE ON feature_visits
        FOR EACH ROW
        EXECUTE FUNCTION update_feature_visits_updated_at();
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trigger_feature_visits_updated_at ON feature_visits;
    DROP FUNCTION IF EXISTS update_feature_visits_updated_at();
    DROP TABLE IF EXISTS feature_visits CASCADE;
  `);
}
