/**
 * Migration: KVP Read Confirmations
 * Date: 2026-01-23 (original) / 2026-01-27 (wrapped)
 *
 * Individual read tracking for KVP suggestions.
 * Pattern 2: Individual Decrement/Increment like blackboard.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS kvp_confirmations (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        suggestion_id INTEGER NOT NULL REFERENCES kvp_suggestions(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        confirmed_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_kvp_confirmation UNIQUE (tenant_id, suggestion_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_kvp_confirmations_tenant ON kvp_confirmations(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_kvp_confirmations_user ON kvp_confirmations(user_id);
    CREATE INDEX IF NOT EXISTS idx_kvp_confirmations_suggestion ON kvp_confirmations(suggestion_id);
    CREATE INDEX IF NOT EXISTS idx_kvp_confirmations_lookup ON kvp_confirmations(tenant_id, suggestion_id, user_id);

    ALTER TABLE kvp_confirmations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE kvp_confirmations FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON kvp_confirmations
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    GRANT SELECT, INSERT, UPDATE, DELETE ON kvp_confirmations TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE kvp_confirmations_id_seq TO app_user;

    COMMENT ON TABLE kvp_confirmations IS 'Tracks which users have marked KVP suggestions as read (Pattern 2: Individual read tracking like blackboard)';
    COMMENT ON COLUMN kvp_confirmations.confirmed_at IS 'Timestamp when user marked the suggestion as read';
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS kvp_confirmations CASCADE;`);
}
