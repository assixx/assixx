/**
 * Migration: Make tenant_domains (tenant_id, domain) uniqueness partial on
 * is_active = 1 — matches the soft-delete semantics already established
 * elsewhere on the table.
 *
 * Why (Plan 2 smoke-test finding, 2026-04-19): the original migration
 * `20260417223358319_create-tenant-domains.ts` shipped the per-tenant-domain
 * uniqueness as a PLAIN UNIQUE CONSTRAINT:
 *
 *     CONSTRAINT tenant_domains_tenant_domain_unique UNIQUE (tenant_id, domain)
 *
 * Three sibling indexes on the same table DO have `WHERE is_active = 1`
 * (idx_tenant_domains_tenant, tenant_domains_one_primary_per_tenant,
 * idx_tenant_domains_domain_verified) — this one was missed. Consequence:
 * a soft-deleted row (is_active = 4) keeps occupying the (tenant_id, domain)
 * uniqueness slot forever, so every re-add attempt fails with 23505 mapped
 * to `DOMAIN_ALREADY_ADDED`. That breaks the masterplan §2.5 "remove then
 * re-add with fresh token" contract. The §3 D22 soft-delete-round-trip unit
 * test only passed because the mock bypassed PostgreSQL's real constraint
 * enforcement — a live smoke-test surfaced the gap.
 *
 * Fix: drop the plain UNIQUE CONSTRAINT and recreate it as a partial UNIQUE
 * INDEX with the SAME name, filtered to active rows. Soft-deleted rows drop
 * out of the uniqueness universe, so re-add succeeds. Active duplicates
 * continue to fail the same way — the service-level 23505 discriminator
 * in `domains.service.ts:51` (CONSTRAINT_PER_TENANT_DOMAIN) still matches
 * because `err.constraint` reports the index name, which is preserved.
 *
 * Down note: reinstating the plain UNIQUE CONSTRAINT will FAIL LOUD with
 * 23505 if any (tenant_id, domain) pair now has both an active and a
 * soft-deleted row — the old constraint cannot hold such pairs. Resolving
 * that requires manual triage of which row to keep. Documented per
 * DATABASE-MIGRATION-GUIDE.md "lossy rollback" convention.
 *
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §2.5
 * @see docs/infrastructure/adr/ADR-049-tenant-domain-verification.md
 * @see backend/src/nest/domains/domains.service.ts:51 (constraint-name literal)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    ALTER TABLE tenant_domains
      DROP CONSTRAINT tenant_domains_tenant_domain_unique;

    -- Partial UNIQUE INDEX — same name as the dropped constraint so that
    -- PostgreSQL's 23505 err.constraint field continues to report
    -- "tenant_domains_tenant_domain_unique", keeping the service-level
    -- discriminator in domains.service.ts working unchanged.
    CREATE UNIQUE INDEX tenant_domains_tenant_domain_unique
      ON tenant_domains (tenant_id, domain)
      WHERE is_active = 1;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    DROP INDEX IF EXISTS tenant_domains_tenant_domain_unique;

    -- May fail with 23505 if active+soft-deleted rows coexist for the same
    -- (tenant_id, domain) pair — intentional per lossy-rollback convention.
    ALTER TABLE tenant_domains
      ADD CONSTRAINT tenant_domains_tenant_domain_unique
      UNIQUE (tenant_id, domain);
  `);
}
