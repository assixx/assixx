/**
 * Migration: Create `tenant_domains` table + `tenant_domain_status` ENUM
 *
 * Purpose: Core schema for Tenant Domain Verification feature (ADR-048 pending,
 * see FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §1.1, v0.4.0).
 *
 * Why this table exists:
 *   - Prove the root user controls a real company domain before the tenant can
 *     create additional users (admin/employee/second-root).
 *   - DNS TXT-record challenge (`_assixx-verify.<domain>` = `assixx-verify=<token>`)
 *     flips `status` from `pending` to `verified`.
 *   - `assertVerified(tenantId)` gate (§2.6 TenantVerificationService) reads from
 *     this table — a tenant with ZERO `status='verified' AND is_active=1` rows
 *     cannot create users.
 *
 * Design notes:
 *   - UUID PK via `uuidv7()` (PG 18.3 native, see §0.2.5 #13 — not `uuid_generate_v7`).
 *   - 1:N tenant → domains from day 1 (§0.2.5 paragraph on "Multi-domain support").
 *   - Partial UNIQUE `one_primary_per_tenant` — at most one `is_primary=true` row
 *     per tenant among active rows.
 *   - Partial UNIQUE `domain_verified` — a verified domain belongs to EXACTLY ONE
 *     tenant globally (v0.3.2 D17 promotion: UNIQUE, not plain INDEX). OAuth-signup
 *     seeder (§2.8b) catches `23505` and maps to `ConflictException('DOMAIN_ALREADY_CLAIMED')`.
 *   - RLS strict mode (ADR-019): `NULLIF(current_setting('app.tenant_id', true), '')::integer`
 *     returns 0 rows when context not set. Cross-tenant management uses `sys_user` (BYPASSRLS).
 *   - Triple-user GRANTs: `app_user` (RLS) + `sys_user` (BYPASSRLS). No sequence grants needed
 *     (UUID PK, no SERIAL).
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ENUM for domain status (pending → verified happy-path; failed / expired reserved
    -- for V2 re-verification or admin-soft-revocation paths).
    CREATE TYPE tenant_domain_status AS ENUM ('pending', 'verified', 'failed', 'expired');

    CREATE TABLE tenant_domains (
      id UUID PRIMARY KEY DEFAULT uuidv7(),
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      domain VARCHAR(253) NOT NULL,
      status tenant_domain_status NOT NULL DEFAULT 'pending',
      verification_token VARCHAR(64) NOT NULL,
      verified_at TIMESTAMPTZ NULL,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT tenant_domains_tenant_domain_unique UNIQUE (tenant_id, domain)
    );

    -- Only one primary domain per tenant (partial unique index scoped to active rows).
    CREATE UNIQUE INDEX tenant_domains_one_primary_per_tenant
      ON tenant_domains (tenant_id)
      WHERE is_primary = true AND is_active = 1;

    -- Standard tenant-lookup index (feature-read path: isVerified() + listForTenant()).
    CREATE INDEX idx_tenant_domains_tenant
      ON tenant_domains (tenant_id)
      WHERE is_active = 1;

    -- Global uniqueness on verified domains — DB-enforced (v0.3.2 D17).
    -- Pending/failed/expired/soft-deleted rows are intentionally excluded so (a) two
    -- tenants can concurrently add the same domain as 'pending' (only the one who
    -- proves DNS wins), and (b) soft-deleted rows (is_active = 4) don't block re-adding.
    -- §2.5 service catches 23505 on the verify-flip UPDATE and maps to
    -- ConflictException({ code: 'DOMAIN_ALREADY_CLAIMED' }).
    CREATE UNIQUE INDEX idx_tenant_domains_domain_verified
      ON tenant_domains (domain)
      WHERE status = 'verified' AND is_active = 1;

    -- RLS — standard Assixx strict policy (ADR-019).
    -- NULLIF('', '') → NULL → tenant_id = NULL never matches → 0 rows fail-closed.
    ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;
    ALTER TABLE tenant_domains FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON tenant_domains
      FOR ALL
      USING (
        tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
      );

    -- Triple-user-model GRANTs (ADR-019 §1 + §8).
    -- app_user: RLS-enforced reads/writes from authenticated HTTP handlers.
    -- sys_user: BYPASSRLS for signup bootstraps (§2.8 / §2.8b seed rows before
    --          CLS tenantId is set) and cross-tenant admin paths.
    -- UUID PK → no sequence GRANTs needed.
    GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_domains TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_domains TO sys_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  // WARNING: lossy rollback (one-way migration in practice).
  // DROP TABLE ... CASCADE removes RLS policies + indexes automatically.
  // DROP TYPE removes the ENUM; any rehydration would require the table first.
  // If a future migration ADDs ENUM values, this down() stays valid — the ENUM
  // is dropped wholesale.
  pgm.sql(`
    DROP TABLE IF EXISTS tenant_domains CASCADE;
    DROP TYPE IF EXISTS tenant_domain_status;
  `);
}
