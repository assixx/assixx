/**
 * Migration: Rename test tenant `apitest`/`apitest.de` → `assixx`/`assixx.com`
 *
 * Purpose:
 *   `apitest.de` is a real third-party domain. The previous test-tenant setup
 *   used `admin@apitest.de` / `info@apitest.de` etc. as login + signup +
 *   password-reset addresses. Any outbound mail (password-reset, notifications,
 *   audit-trail mailers) would land in the catch-all of the foreign domain
 *   owner — a real data-leak risk for any dev/staging environment that ever
 *   wires up an SMTP relay. `assixx.com` is project-owned, so this fixes the
 *   risk at the data layer.
 *
 * What it does (in tenant id=1, where subdomain='apitest'):
 *   1. Cleans the only two RESTRICT-FK child tables that had test-leftover
 *      rows (user_addon_permissions: 50 rows, password_reset_tokens: 2 rows).
 *   2. Hard-deletes the 259 test-leftover users (perm-api-test-*, trigger-lead-*,
 *      pos-test-*, etc. with timestamps from accumulated test-runs). Keeps id=1
 *      (admin/root) and id=5 (employee) — the seeded baseline pair.
 *   3. Renames id=1 user `admin@apitest.de` → `info@assixx.com` (per request:
 *      info@ instead of admin@ because info@ is the canonical project mailbox).
 *   4. Renames id=5 user `employee@apitest.de` → `employee@assixx.com`.
 *   5. Renames the tenant: subdomain, email, billing_email, company_name.
 *   6. Renames the verified primary domain in `tenant_domains` from
 *      `apitest.de` → `assixx.com`.
 *
 * Why not DELETE FROM tenants WHERE id=1 + recreate via signup API?
 *   `users.tenant_id` is RESTRICT (`fk_users_tenant`) and 30 other tables
 *   hold RESTRICT FKs into `users`. A clean cascade-drop would require
 *   ordering ~30 child-table DELETEs explicitly. Renaming is simpler and
 *   keeps the FK graph intact (no audit/permission history loss).
 *
 * Idempotency:
 *   The whole DO-block is gated on `EXISTS subdomain='apitest'`. On any DB
 *   without the apitest tenant (production, fresh installs, already-migrated
 *   dev DBs) this is a no-op.
 *
 * WARNING: One-way data migration. Rollback does NOT restore the deleted
 * test-leftover users or the original `apitest`/`apitest.de` strings. A
 * `pg_dump` backup is taken before running; restore via `pg_restore` if
 * needed.
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    DO $$
    DECLARE
      _tenant_id CONSTANT INTEGER := 1;
      _victim_count INTEGER;
      _renamed INTEGER;
    BEGIN
      -- Idempotency gate: only run if the apitest tenant still exists
      IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = _tenant_id AND subdomain = 'apitest') THEN
        RAISE NOTICE 'Tenant id=1 is not on subdomain=apitest — migration is a no-op (already migrated or fresh DB)';
        RETURN;
      END IF;

      -- 1. Clean the two RESTRICT-FK child tables that had test-leftover rows.
      --    Identified empirically (2026-04-26) — the other 28 RESTRICT-FK
      --    tables had 0 rows referencing victim users.
      DELETE FROM user_addon_permissions
      WHERE assigned_by IN (
        SELECT id FROM users
        WHERE tenant_id = _tenant_id AND email LIKE '%@apitest.de' AND id NOT IN (1, 5)
      );

      DELETE FROM password_reset_tokens
      WHERE user_id IN (
        SELECT id FROM users
        WHERE tenant_id = _tenant_id AND email LIKE '%@apitest.de' AND id NOT IN (1, 5)
      );

      -- 2. Drop the 259 test-leftover users.
      DELETE FROM users
      WHERE tenant_id = _tenant_id AND email LIKE '%@apitest.de' AND id NOT IN (1, 5);
      GET DIAGNOSTICS _victim_count = ROW_COUNT;
      RAISE NOTICE 'Deleted % test-leftover users', _victim_count;

      -- 3. Rename admin (id=1, role=root) → info@assixx.com.
      --    NOT FOUND here is a real bug: the seed admin must exist.
      UPDATE users
      SET email = 'info@assixx.com', updated_at = NOW()
      WHERE id = 1 AND tenant_id = _tenant_id AND email = 'admin@apitest.de';
      GET DIAGNOSTICS _renamed = ROW_COUNT;
      IF _renamed <> 1 THEN
        RAISE EXCEPTION 'Expected to rename exactly 1 admin user (id=1, admin@apitest.de) but updated % rows — DB state unexpected', _renamed;
      END IF;

      -- 4. Rename employee (id=5) → employee@assixx.com.
      --    NOT FOUND here is OK — the employee row may not exist on every DB
      --    (it's created on demand by ensureTestEmployee in chat tests).
      UPDATE users
      SET email = 'employee@assixx.com', updated_at = NOW()
      WHERE id = 5 AND tenant_id = _tenant_id AND email = 'employee@apitest.de';

      -- 5. Rename the tenant itself.
      UPDATE tenants
      SET subdomain = 'assixx',
          email = 'info@assixx.com',
          billing_email = 'info@assixx.com',
          company_name = 'Assixx Test GmbH',
          updated_at = NOW()
      WHERE id = _tenant_id AND subdomain = 'apitest';
      GET DIAGNOSTICS _renamed = ROW_COUNT;
      IF _renamed <> 1 THEN
        RAISE EXCEPTION 'Expected to rename exactly 1 tenant (id=1, subdomain=apitest) but updated % rows', _renamed;
      END IF;

      -- 6a. Free the assixx.com domain slot at the testfirma tenant (id=8).
      --     A historical test-fixture left assixx.com as a verified-secondary
      --     domain on Testfirma. The unique index
      --     idx_tenant_domains_domain_verified (domain) WHERE status=verified AND is_active=1
      --     would block step 6b otherwise. Per user direction (2026-04-26): rename
      --     that row to the tenants own canonical domain testfirma.de (kept
      --     verified, kept secondary). Idempotent — no-op when already renamed.
      UPDATE tenant_domains
      SET domain = 'testfirma.de', updated_at = NOW()
      WHERE tenant_id = 8 AND domain = 'assixx.com' AND is_active = 1;

      -- 6b. Rename the apitest tenant's verified primary domain.
      UPDATE tenant_domains
      SET domain = 'assixx.com', updated_at = NOW()
      WHERE tenant_id = _tenant_id AND domain = 'apitest.de' AND is_primary = true;

      RAISE NOTICE 'Migration complete: tenant id=1 renamed apitest → assixx, % test-leftover users deleted', _victim_count;
    END $$;
  `);
}

export function down(): void {
  throw new Error(
    'Cannot reverse data migration: 259 test-leftover users were hard-deleted, ' +
      'and tenant id=1 string fields (subdomain, email, billing_email, company_name) ' +
      'and tenant_domains.domain were overwritten. Restore from the pre-migration ' +
      'pg_dump backup (database/backups/pre-rename-apitest-to-assixx_*.dump) if needed.',
  );
}
