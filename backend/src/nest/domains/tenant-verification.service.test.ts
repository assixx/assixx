/**
 * TenantVerificationService — Unit Tests (Phase 3, plan §2.6 + §3 DoD).
 *
 * This service is the single gate at the top of every user-creation service
 * method (plan Step 2.9) — any leak here re-enables the CVE-class hole the
 * whole feature is designed to close. The tests lock two invariants:
 *
 *   1. Happy-path / sad-path semantics of `isVerified` + `assertVerified`.
 *   2. **CRITICAL regression guard (v0.3.4 D22 / v0.3.2 D16):** `isVerified`
 *      MUST read through `db.queryAsTenant()`, NEVER `db.query()`. The
 *      latter runs against the `app_user` pool without setting
 *      `app.tenant_id`; under ADR-019 strict RLS that yields zero rows,
 *      which flips `isVerified` to a permanent `false` and deadlocks the
 *      entire user-creation flow for every tenant. The spy-based test in
 *      `it('uses queryAsTenant…')` is the canary — if it breaks, somebody
 *      introduced that exact bug. The failure message names the regression
 *      so future readers find the changelog entry without archaeology.
 *
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §2.6, §3 DoD
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md §6b
 */
import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { TenantVerificationService } from './tenant-verification.service.js';

// ============================================================
// Setup — both query methods mocked so we can assert call routing
// ============================================================

interface MockDb {
  queryAsTenant: ReturnType<typeof vi.fn>;
  // `query` MUST be present on the mock so the spy can register a "not
  // called" assertion — without this field, `expect(mockDb.query).not.
  // toHaveBeenCalled()` would error with "is not a function" and the
  // regression guard would be useless.
  query: ReturnType<typeof vi.fn>;
}

function setup(): { service: TenantVerificationService; mockDb: MockDb } {
  const mockDb: MockDb = {
    queryAsTenant: vi.fn(),
    query: vi.fn(),
  };
  const service = new TenantVerificationService(mockDb as unknown as DatabaseService);
  return { service, mockDb };
}

// ============================================================
// isVerified / assertVerified — happy + sad path
// ============================================================

describe('TenantVerificationService.isVerified', () => {
  let service: TenantVerificationService;
  let mockDb: MockDb;

  beforeEach(() => {
    const s = setup();
    service = s.service;
    mockDb = s.mockDb;
  });

  it('returns true when at least one domain row is status=verified', async () => {
    mockDb.queryAsTenant.mockResolvedValueOnce([{ exists: true }]);

    expect(await service.isVerified(42)).toBe(true);
  });

  it('returns false when no verified row exists (fresh tenant, all pending)', async () => {
    mockDb.queryAsTenant.mockResolvedValueOnce([{ exists: false }]);

    expect(await service.isVerified(42)).toBe(false);
  });

  it('returns false when the EXISTS subquery returns an empty rowset', async () => {
    // Defensive guard: if the SELECT EXISTS ever came back empty (shouldn't
    // happen — EXISTS always returns one row), treat it as "not verified"
    // rather than throw. Mirrors the `rows[0]?.exists === true` check in
    // the service.
    mockDb.queryAsTenant.mockResolvedValueOnce([]);

    expect(await service.isVerified(42)).toBe(false);
  });
});

describe('TenantVerificationService.assertVerified', () => {
  let service: TenantVerificationService;
  let mockDb: MockDb;

  beforeEach(() => {
    const s = setup();
    service = s.service;
    mockDb = s.mockDb;
  });

  it('resolves silently when a verified domain exists', async () => {
    mockDb.queryAsTenant.mockResolvedValueOnce([{ exists: true }]);

    await expect(service.assertVerified(42)).resolves.toBeUndefined();
  });

  it('throws ForbiddenException(TENANT_NOT_VERIFIED) when the tenant has no verified domain', async () => {
    mockDb.queryAsTenant.mockResolvedValueOnce([{ exists: false }]);

    // `catch` then assert — `rejects.toMatchObject` does not see the thrown
    // response shape in some NestJS builds, so we snapshot the payload
    // directly. This matters: the code `TENANT_NOT_VERIFIED` is the exact
    // discriminator the frontend switches on to render the "verify your
    // domain" banner (Phase 5). A typo here breaks that UX silently.
    const err = await service.assertVerified(42).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err).toMatchObject({ response: { code: 'TENANT_NOT_VERIFIED' } });
  });
});

// ============================================================
// CRITICAL REGRESSION GUARD — §3 DoD v0.3.4 D22 / v0.3.2 D16
// ============================================================

describe('TenantVerificationService — ADR-019 strict RLS guard', () => {
  it('uses db.queryAsTenant(sql, params, tenantId), NOT db.query(), under strict RLS', async () => {
    // ────────────────────────────────────────────────────────────────────
    // WHY THIS TEST EXISTS
    //
    // Before v0.3.2 a reviewer proposed `db.query()` here for "simplicity".
    // Under ADR-019 strict RLS, `db.query()` runs on the `app_user` pool
    // WITHOUT injecting `app.tenant_id` — every `tenant_domains` SELECT
    // returns zero rows (NULLIF('','')::int → NULL, tenant_id = NULL never
    // matches). Result: `isVerified()` returns false for EVERY tenant →
    // `assertVerified()` 403s every user-creation attempt → the whole
    // feature deadlocks.
    //
    // The fix (v0.3.2 D16) was to route through `db.queryAsTenant(sql,
    // params, tenantId)`, which opens a per-call transaction and sets
    // `app.tenant_id` from the explicit positional arg. This test locks
    // that choice in: if `isVerified` ever falls back to `db.query()`, the
    // spy-based assertion fails with the named regression hint so the next
    // engineer finds the changelog entry in <5 seconds.
    //
    // Failure message is intentionally verbose — it IS the documentation.
    // ────────────────────────────────────────────────────────────────────
    const { service, mockDb } = setup();
    mockDb.queryAsTenant.mockResolvedValueOnce([{ exists: true }]);

    await service.isVerified(1234);

    // --- Invariant 1: queryAsTenant is the chosen seam ---------------
    expect(
      mockDb.queryAsTenant,
      'isVerified must use queryAsTenant under ADR-019 strict RLS — see v0.3.2 changelog',
    ).toHaveBeenCalledTimes(1);

    // --- Invariant 2: tenantId is passed as the 3rd positional arg ---
    // (set_config target + defence-in-depth in the WHERE clause — see
    // database.service.ts:142 + ADR-019 §6b.)
    const args = mockDb.queryAsTenant.mock.calls[0] as unknown[];
    expect(args[1]).toEqual([1234]); // params positional
    expect(args[2]).toBe(1234); // tenantId positional

    // --- Invariant 3: db.query MUST NOT have been called ------------
    expect(
      mockDb.query,
      'isVerified must use queryAsTenant under ADR-019 strict RLS — see v0.3.2 changelog',
    ).not.toHaveBeenCalled();
  });

  it('the SQL shape only reads tenant_domains rows with is_active=ACTIVE and status=verified', async () => {
    // Locks the WHERE clause so a lazy refactor can't silently widen the
    // semantics (e.g., removing the `is_active` guard and surfacing
    // soft-deleted verified rows — which would break the "remove the
    // only verified domain → user-creation re-locks" contract).
    const { service, mockDb } = setup();
    mockDb.queryAsTenant.mockResolvedValueOnce([{ exists: false }]);

    await service.isVerified(1);

    const sql = (mockDb.queryAsTenant.mock.calls[0] as [string])[0];
    expect(sql).toContain('tenant_domains');
    expect(sql).toContain("status = 'verified'");
    // IS_ACTIVE.ACTIVE is template-interpolated from `@assixx/shared/
    // constants` at module load — grep for the literal `is_active = 1`
    // (per TYPESCRIPT-STANDARDS §7.4).
    expect(sql).toContain('is_active = 1');
    // Defence-in-depth: the explicit WHERE tenant_id = $1 is present on
    // top of the RLS policy (same value, so typo → 0 rows → fail-closed).
    expect(sql).toContain('WHERE tenant_id = $1');
  });
});
