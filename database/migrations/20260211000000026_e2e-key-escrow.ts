/**
 * Migration: E2E Key Escrow Table
 * Date: 2026-02-11
 *
 * Creates the `e2e_key_escrow` table for zero-knowledge private key recovery.
 *
 * The encrypted_blob contains the user's X25519 private key encrypted with
 * a wrapping key derived from their login password via Argon2id.
 * The server NEVER has access to the plaintext private key.
 *
 * One row per user — re-encryption (password change) updates in place.
 *
 * References: ADR-022 (E2E Key Escrow)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- E2E Key Escrow — zero-knowledge encrypted private key backup
    -- ==========================================================================

    CREATE TABLE IF NOT EXISTS e2e_key_escrow (
        id              UUID PRIMARY KEY,                -- UUIDv7 (application-generated)
        tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        encrypted_blob  TEXT NOT NULL,                    -- base64, XChaCha20-encrypted private key
        argon2_salt     TEXT NOT NULL,                    -- base64, 32 bytes random
        xchacha_nonce   TEXT NOT NULL,                    -- base64, 24 bytes random
        argon2_params   JSONB NOT NULL DEFAULT '{"memory":65536,"iterations":3,"parallelism":1}',
        blob_version    INTEGER NOT NULL DEFAULT 1,       -- increments on re-encryption
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_active       INTEGER NOT NULL DEFAULT 1        -- 0=inactive, 1=active, 4=deleted
    );

    -- One active escrow per user per tenant
    CREATE UNIQUE INDEX IF NOT EXISTS idx_e2e_key_escrow_active
        ON e2e_key_escrow(tenant_id, user_id) WHERE is_active = 1;

    -- Lookup indexes
    CREATE INDEX IF NOT EXISTS idx_e2e_key_escrow_tenant
        ON e2e_key_escrow(tenant_id);

    CREATE INDEX IF NOT EXISTS idx_e2e_key_escrow_user
        ON e2e_key_escrow(tenant_id, user_id);

    -- ==========================================================================
    -- RLS (ADR-019 pattern — MANDATORY for tenant-isolated tables)
    -- ==========================================================================

    ALTER TABLE e2e_key_escrow ENABLE ROW LEVEL SECURITY;
    ALTER TABLE e2e_key_escrow FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON e2e_key_escrow
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- ==========================================================================
    -- Permissions for app_user (MANDATORY — without this, backend gets 403)
    -- No sequence grant needed: PK is UUID, not SERIAL
    -- ==========================================================================

    GRANT SELECT, INSERT, UPDATE, DELETE ON e2e_key_escrow TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`DROP TABLE IF EXISTS e2e_key_escrow CASCADE;`);
}
