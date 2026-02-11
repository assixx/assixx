/**
 * Migration: E2E User Keys Table
 * Date: 2026-02-10
 *
 * Creates the `e2e_user_keys` table for storing X25519 public keys
 * used in end-to-end encrypted 1:1 messaging.
 *
 * Each user has exactly one active key per tenant (enforced by partial unique index).
 * Private keys never leave the client — only public keys are stored server-side.
 *
 * References: docs/plans/IMPLEMENT-E2E-ENCRYPTION.md (Phase 0)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- E2E User Keys — stores one X25519 public key per user per tenant
    -- ==========================================================================

    CREATE TABLE IF NOT EXISTS e2e_user_keys (
        id UUID PRIMARY KEY,                    -- UUIDv7 (application-generated)
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        public_key TEXT NOT NULL,                -- base64 X25519 public key (32 bytes)
        fingerprint VARCHAR(64) NOT NULL,        -- SHA-256 hex of public key
        key_version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_active INTEGER NOT NULL DEFAULT 1,    -- 0=inactive, 1=active, 4=deleted
        UNIQUE(tenant_id, user_id, key_version)
    );

    -- Enforce exactly ONE active key per user per tenant
    -- Prevents duplicate active keys even if key_version differs
    CREATE UNIQUE INDEX IF NOT EXISTS idx_e2e_user_keys_one_active
        ON e2e_user_keys(tenant_id, user_id) WHERE is_active = 1;

    -- Lookup indexes
    CREATE INDEX IF NOT EXISTS idx_e2e_user_keys_tenant
        ON e2e_user_keys(tenant_id);

    CREATE INDEX IF NOT EXISTS idx_e2e_user_keys_user
        ON e2e_user_keys(user_id);

    CREATE INDEX IF NOT EXISTS idx_e2e_user_keys_active
        ON e2e_user_keys(user_id, is_active) WHERE is_active = 1;

    -- ==========================================================================
    -- RLS (ADR-019 pattern — MANDATORY for tenant-isolated tables)
    -- ==========================================================================

    ALTER TABLE e2e_user_keys ENABLE ROW LEVEL SECURITY;
    ALTER TABLE e2e_user_keys FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON e2e_user_keys
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- ==========================================================================
    -- Permissions for app_user (MANDATORY — without this, backend gets 403)
    -- No sequence grant needed: PK is UUID, not SERIAL
    -- ==========================================================================

    GRANT SELECT, INSERT, UPDATE, DELETE ON e2e_user_keys TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS e2e_user_keys CASCADE;`);
}
