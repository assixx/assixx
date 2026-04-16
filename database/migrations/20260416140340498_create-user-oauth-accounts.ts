/**
 * Migration: Create user_oauth_accounts + oauth_provider ENUM
 *
 * Purpose:
 *   Persistent link between an Assixx user and a third-party identity-provider account.
 *   V1 supports Microsoft (Azure AD v2.0 OIDC, /organizations/ endpoint = work/school accounts only).
 *   See docs/FEAT_MICROSOFT_OAUTH_MASTERPLAN.md (Phase 1) and the upcoming ADR-046.
 *
 * Architectural notes:
 *   - Multi-tenant table: tenant_id REFERENCES tenants(id), strict RLS per ADR-019.
 *   - Triple-user GRANTs: app_user (post-auth, RLS) + sys_user (pre-auth lookup, BYPASSRLS).
 *   - PK uses uuidv7() (PG18 native) per UUIDv7-everywhere policy
 *     (cleanup migration 20260416135731342 prerequisite).
 *   - is_active follows the project-wide convention (0/1/3/4) — see @assixx/shared/constants IS_ACTIVE.
 *
 * Unique constraints:
 *   - (provider, provider_user_id): one Microsoft account → at most one Assixx user across all tenants
 *     (R3 mitigation: prevents duplicate sign-up via OAuth).
 *   - (user_id, provider): one Assixx user → at most one Microsoft link
 *     (V1 explicitly excludes multi-provider-per-user; ADR-046 documents this).
 *
 * Token storage policy:
 *   We store IDENTITY information (sub, email, display name, MS tenant id) only.
 *   We do NOT store OAuth access_token or refresh_token — V1 has no Microsoft Graph integration.
 *   Adding token storage in the future requires a separate migration + ADR (data-protection scope).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Provider ENUM (V1: microsoft only; future providers via ALTER TYPE ADD VALUE).
    CREATE TYPE oauth_provider AS ENUM ('microsoft');

    CREATE TABLE user_oauth_accounts (
        id                  UUID PRIMARY KEY DEFAULT uuidv7(),
        tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider            oauth_provider NOT NULL,
        -- provider_user_id: stable, opaque identifier from the provider (Microsoft "sub" claim).
        -- Microsoft sub claims are up to ~128 chars; TEXT avoids artificial limits.
        provider_user_id    TEXT NOT NULL,
        -- email + display_name: snapshot at link/login time. NOT a source of truth — the provider can change them.
        email               TEXT NOT NULL,
        email_verified      BOOLEAN NOT NULL,
        display_name        TEXT,
        -- microsoft_tenant_id: Microsoft "tid" claim — for audit ("which Azure tenant authenticated?").
        -- Nullable to keep the column generic when V2 adds non-Microsoft providers.
        microsoft_tenant_id TEXT,
        linked_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at       TIMESTAMPTZ,
        is_active           SMALLINT NOT NULL DEFAULT 1,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        -- One Microsoft account → at most one Assixx user across all tenants (R3 mitigation).
        CONSTRAINT user_oauth_accounts_provider_sub_uq UNIQUE (provider, provider_user_id),
        -- One Assixx user → at most one Microsoft link (V1 single-provider-per-user, see ADR-046).
        CONSTRAINT user_oauth_accounts_user_provider_uq UNIQUE (user_id, provider)
    );

    -- Partial index for the hot login lookup path: active links per (tenant, user).
    -- Inactive links (is_active != 1) are filtered out at index level.
    CREATE INDEX idx_user_oauth_accounts_active_lookup
        ON user_oauth_accounts (tenant_id, user_id)
        WHERE is_active = 1;

    -- Multi-tenant isolation (ADR-019 strict mode: no NULL bypass clause).
    ALTER TABLE user_oauth_accounts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_oauth_accounts FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON user_oauth_accounts
        FOR ALL
        USING (
            tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- Triple-User Model GRANTs (ADR-019):
    --   app_user: post-auth queries inside HTTP request (CLS sets app.tenant_id).
    --   sys_user: pre-auth lookup by (provider, provider_user_id) — tenant unknown until match.
    GRANT SELECT, INSERT, UPDATE, DELETE ON user_oauth_accounts TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON user_oauth_accounts TO sys_user;
    -- No SEQUENCE GRANT needed — UUID PK has no associated sequence.
  `);
}

export function down(pgm: MigrationBuilder): void {
  // Order matters: DROP TABLE first (it depends on the ENUM), then DROP TYPE.
  pgm.sql(`
    DROP TABLE IF EXISTS user_oauth_accounts CASCADE;
    DROP TYPE IF EXISTS oauth_provider;
  `);
}
