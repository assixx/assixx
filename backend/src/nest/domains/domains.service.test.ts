/**
 * DomainsService — Unit Tests (Phase 3, plan §2.5 + §3 DoD).
 *
 * Exercises all five public methods (`listForTenant`, `addDomain`,
 * `triggerVerify`, `removeDomain`, `setPrimary`) against a DB-mocked
 * `tenantTransaction` plus a verification-service stub.
 *
 * WHY mock `DatabaseService` + `DomainVerificationService` here, not the
 * DB driver:
 *   - `tenantTransaction(cb)` is the single seam the service uses for
 *     RLS-bound writes (ADR-019 §6b). Replacing it with a passthrough that
 *     invokes the callback against a `mockClient.query` spy lets us assert
 *     the exact SQL shape and parameter order the production code emits —
 *     without a running Postgres.
 *   - Real `DatabaseError` instances are required for the service's
 *     `err instanceof DatabaseError && err.constraint === …` discriminator
 *     (non-instance errors fall through and bubble as 500). Tests
 *     instantiate `DatabaseError` directly and tag `code` + `constraint`.
 *
 * Not exercised here (pushed to integration — Phase 4):
 *   - True concurrent 23505 race between two parallel verify paths
 *     (§4 "OAuth concurrent-race" checkbox) — mock cannot simulate PG's
 *     transaction serialization.
 *   - Losing the only verified domain unlocks user-creation — requires
 *     the signup→verify→remove→signup flow across modules (§4 graceful
 *     degradation checkbox).
 *
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §2.5, §3 DoD
 * @see docs/infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md §6b
 */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DatabaseError } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { DomainVerificationService } from './domain-verification.service.js';
import { DomainsService } from './domains.service.js';
import type { TenantDomainRow } from './domains.types.js';

// ============================================================
// Helpers — fixture row + constructed PG DatabaseError
// ============================================================

function makeRow(overrides: Partial<TenantDomainRow> = {}): TenantDomainRow {
  const now = new Date('2026-04-18T00:00:00Z');
  return {
    id: '01960000-0000-7000-8000-000000000001',
    tenant_id: 42,
    domain: 'firma.de',
    status: 'pending',
    verification_token: 'a'.repeat(64),
    verified_at: null,
    is_primary: false,
    is_active: 1,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

/**
 * Build a genuine `pg.DatabaseError` instance — NOT `Object.assign(new Error,
 * {code})`. The service's `isUniqueViolation()` gate uses `err instanceof
 * DatabaseError`; an Error-with-code duck-type would bypass the catch and
 * bubble as a 500, silently hiding a regression of the 409 mapping.
 */
function makeUniqueViolation(constraint: string): DatabaseError {
  const err = new DatabaseError('duplicate key value violates unique constraint', 0, 'error');
  err.code = '23505';
  err.constraint = constraint;
  return err;
}

// ============================================================
// Setup — service + mocks, reset per test
// ============================================================

interface MockClient {
  query: ReturnType<typeof vi.fn>;
}

interface MockDb {
  tenantTransaction: ReturnType<typeof vi.fn>;
  // systemQueryOne covers the cross-tenant pre-check inside addDomain()
  // (post-v1 "Option A" hardening, 2026-04-20). Default resolves to `null`
  // (= no conflicting row) so existing tests don't need to re-wire it.
  systemQueryOne: ReturnType<typeof vi.fn>;
}

interface MockVerification {
  generateToken: ReturnType<typeof vi.fn>;
  verify: ReturnType<typeof vi.fn>;
  txtHostFor: ReturnType<typeof vi.fn>;
  txtValueFor: ReturnType<typeof vi.fn>;
}

function setup(): {
  service: DomainsService;
  mockDb: MockDb;
  mockClient: MockClient;
  mockVerification: MockVerification;
} {
  const mockClient: MockClient = { query: vi.fn() };
  const mockDb: MockDb = {
    tenantTransaction: vi
      .fn()
      .mockImplementation(async (cb: (c: MockClient) => Promise<unknown>) => cb(mockClient)),
    // Default: "no other tenant has this verified" — keeps pre-existing
    // addDomain tests green without extra wiring. Tests that exercise the
    // cross-tenant-claim path override with `.mockResolvedValueOnce({id: …})`.
    systemQueryOne: vi.fn().mockResolvedValue(null),
  };
  const mockVerification: MockVerification = {
    generateToken: vi.fn().mockReturnValue('b'.repeat(64)),
    verify: vi.fn(),
    txtHostFor: vi.fn().mockImplementation((d: string) => `_assixx-verify.${d}`),
    txtValueFor: vi.fn().mockImplementation((t: string) => `assixx-verify=${t}`),
  };
  const service = new DomainsService(
    mockDb as unknown as DatabaseService,
    mockVerification as unknown as DomainVerificationService,
  );
  return { service, mockDb, mockClient, mockVerification };
}

// ============================================================
// listForTenant
// ============================================================

describe('DomainsService.listForTenant', () => {
  it('returns the tenant rows mapped to the API shape', async () => {
    const { service, mockClient } = setup();
    mockClient.query.mockResolvedValueOnce({
      rows: [makeRow({ domain: 'firma.de', is_primary: true })],
    });

    const result = await service.listForTenant(42);

    expect(result).toHaveLength(1);
    expect(result[0]?.domain).toBe('firma.de');
    expect(result[0]?.isPrimary).toBe(true);
    // `verificationInstructions` is surfaced only on add-response (§0.2.5 #10).
    // Omitted entirely on list responses so `exactOptionalPropertyTypes: true`
    // sees no `undefined`-valued key leaking through JSON.stringify.
    expect(result[0]).not.toHaveProperty('verificationInstructions');
  });

  it('returns an empty array when the tenant has no active domains', async () => {
    const { service, mockClient } = setup();
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    expect(await service.listForTenant(42)).toEqual([]);
  });
});

// ============================================================
// addDomain — §3 DoD mandatory scenarios
// ============================================================

describe('DomainsService.addDomain', () => {
  it('inserts a pending row, generates a token, returns TXT instructions', async () => {
    const { service, mockClient, mockVerification } = setup();
    const row = makeRow({ domain: 'firma.de', verification_token: 'b'.repeat(64) });
    mockClient.query.mockResolvedValueOnce({ rows: [row] });

    const result = await service.addDomain(42, 'firma.de');

    expect(mockVerification.generateToken).toHaveBeenCalledTimes(1);
    expect(result.domain).toBe('firma.de');
    expect(result.status).toBe('pending');
    // TXT instructions are the whole reason for this endpoint — must be on the
    // add-response (§0.2.5 #10). The exact prefix/hostname contract is locked
    // in via the generateToken + txtHostFor / txtValueFor mocks.
    expect(result.verificationInstructions).toEqual({
      txtHost: '_assixx-verify.firma.de',
      txtValue: `assixx-verify=${'b'.repeat(64)}`,
    });
  });

  it('normalizes the input before the INSERT (trim + lowercase)', async () => {
    const { service, mockClient } = setup();
    mockClient.query.mockResolvedValueOnce({ rows: [makeRow({ domain: 'firma.de' })] });

    await service.addDomain(42, '  Firma.DE  ');

    // The second positional param is the `domain` column value. Caller may
    // send untrimmed / mixed-case input; persisted value MUST be normalized
    // so later freemail Set-lookups (same lowercase key) work.
    const call = mockClient.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(call[1][1]).toBe('firma.de');
  });

  it('rejects a freemail domain with BadRequestException(FREE_EMAIL_PROVIDER)', async () => {
    const { service, mockClient, mockVerification } = setup();

    await expect(service.addDomain(42, 'gmail.com')).rejects.toThrow(BadRequestException);
    // Fail-fast before touching DB or spinning a token.
    expect(mockVerification.generateToken).not.toHaveBeenCalled();
    expect(mockClient.query).not.toHaveBeenCalled();
  });

  it('rejects a malformed domain with BadRequestException', async () => {
    const { service } = setup();
    await expect(service.addDomain(42, 'not a domain')).rejects.toThrow(BadRequestException);
  });

  it('maps 23505 on the per-tenant-domain constraint to 409 DOMAIN_ALREADY_ADDED', async () => {
    const { service, mockClient } = setup();
    mockClient.query.mockRejectedValueOnce(
      makeUniqueViolation('tenant_domains_tenant_domain_unique'),
    );

    // Single call, dual assertion — verify both the type (ConflictException
    // = 409, not generic 500) AND the discriminator code the frontend
    // switches on. `rejects.toMatchObject` + the `.response` wrapper mirrors
    // how NestJS serializes the error payload.
    const err = await service.addDomain(42, 'firma.de').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err).toMatchObject({ response: { code: 'DOMAIN_ALREADY_ADDED' } });
  });

  it('re-throws 23505 on an unknown constraint (not ours — bubble as 500)', async () => {
    const { service, mockClient } = setup();
    mockClient.query.mockRejectedValueOnce(makeUniqueViolation('some_other_constraint'));

    // Must NOT be mapped to ConflictException — surfacing a mis-named
    // constraint as "already added" would hide a real schema bug.
    await expect(service.addDomain(42, 'firma.de')).rejects.not.toBeInstanceOf(ConflictException);
  });

  // ========================================================================
  // Cross-tenant pre-check (post-v1 "Option A" hardening, 2026-04-20).
  //
  // Before this change, Tenant B could add a pending row for a domain that
  // Tenant A had already verified — the row sat in Tenant B's UI unable to
  // ever verify (B doesn't control A's DNS). The pre-check uses systemQuery
  // (BYPASSRLS per ADR-019 §6b) to surface the conflict at add-time instead
  // of at verify-time.
  // ========================================================================

  it('rejects with 409 DOMAIN_ALREADY_CLAIMED when another tenant has the domain verified', async () => {
    const { service, mockDb, mockClient, mockVerification } = setup();
    // Simulate the cross-tenant verified row surfaced via systemQuery.
    // Real existing-tenant id is irrelevant — the pre-check only cares that
    // ANY row exists; the `id` payload is opaque to the caller.
    mockDb.systemQueryOne.mockResolvedValueOnce({ id: 'other-tenant-row-id' });

    const err = await service.addDomain(42, 'firma.de').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err).toMatchObject({ response: { code: 'DOMAIN_ALREADY_CLAIMED' } });
    // Fail-fast before spinning a token or touching the transaction — saves
    // crypto work AND avoids emitting a stale INSERT on rollback.
    expect(mockVerification.generateToken).not.toHaveBeenCalled();
    expect(mockClient.query).not.toHaveBeenCalled();
  });

  it('allows the add when another tenant only has the domain in pending (no squatting-DoS)', async () => {
    // Pending-pending coexistence is explicitly allowed — only verified
    // cross-tenant rows block. Rationale: "pending = I want to try", verify
    // is the real claim. The pre-check SQL (`WHERE status='verified'`)
    // returns null even if a cross-tenant pending exists.
    const { service, mockClient } = setup();
    mockClient.query.mockResolvedValueOnce({
      rows: [makeRow({ tenant_id: 42, domain: 'firma.de' })],
    });

    const result = await service.addDomain(42, 'firma.de');
    expect(result.status).toBe('pending');
    // INSERT ran (1 query), and no 409 was surfaced upstream.
    expect(mockClient.query).toHaveBeenCalledTimes(1);
  });

  it('queries the system pool with correct params (cross-tenant scope, normalized domain)', async () => {
    // Lock the pre-check's SQL shape: status='verified', is_active=1,
    // tenant_id <> $N. A regression that accidentally drops the <>-predicate
    // would collapse the error space (DOMAIN_ALREADY_ADDED would mask as
    // DOMAIN_ALREADY_CLAIMED for same-tenant re-adds) and breaks the
    // existing "soft-delete + re-add round-trip" contract.
    const { service, mockDb, mockClient } = setup();
    mockClient.query.mockResolvedValueOnce({ rows: [makeRow()] });

    await service.addDomain(42, '  FIRMA.de ');

    expect(mockDb.systemQueryOne).toHaveBeenCalledTimes(1);
    const [sql, params] = mockDb.systemQueryOne.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("status = 'verified'");
    expect(sql).toContain('is_active = 1');
    expect(sql).toContain('tenant_id <> $2');
    // Normalization happens before the pre-check so the SELECT sees the
    // same lowercase value the INSERT would persist.
    expect(params).toEqual(['firma.de', 42]);
  });
});

// ============================================================
// triggerVerify — DNS match / miss / race
// ============================================================

describe('DomainsService.triggerVerify', () => {
  it('flips status to verified and stamps verified_at on DNS match', async () => {
    const { service, mockClient, mockVerification } = setup();
    const pendingRow = makeRow({ status: 'pending' });
    const verifiedRow = makeRow({ status: 'verified', verified_at: new Date() });
    // findOneActive SELECT
    mockClient.query.mockResolvedValueOnce({ rows: [pendingRow] });
    mockVerification.verify.mockResolvedValueOnce(true);
    // flipToVerified UPDATE … RETURNING *
    mockClient.query.mockResolvedValueOnce({ rows: [verifiedRow] });

    const result = await service.triggerVerify(42, pendingRow.id);

    expect(result.status).toBe('verified');
    expect(result.verifiedAt).not.toBeNull();
  });

  it('leaves status as pending when DNS does not match (V1: no flip to failed)', async () => {
    const { service, mockClient, mockVerification } = setup();
    const pendingRow = makeRow({ status: 'pending' });
    mockClient.query.mockResolvedValueOnce({ rows: [pendingRow] });
    mockVerification.verify.mockResolvedValueOnce(false);

    const result = await service.triggerVerify(42, pendingRow.id);

    expect(result.status).toBe('pending');
    // Exactly ONE SELECT fired — the flipToVerified UPDATE must NOT run.
    expect(mockClient.query).toHaveBeenCalledTimes(1);
  });

  it('is idempotent on already-verified rows — no DNS re-roll', async () => {
    const { service, mockClient, mockVerification } = setup();
    const verifiedRow = makeRow({ status: 'verified', verified_at: new Date() });
    mockClient.query.mockResolvedValueOnce({ rows: [verifiedRow] });

    await service.triggerVerify(42, verifiedRow.id);

    // Early-return BEFORE calling into DNS — skipping a spurious 23505 race
    // with another tenant's in-flight verify (plan §2.5).
    expect(mockVerification.verify).not.toHaveBeenCalled();
  });

  it('persists the same verification_token across 3 verify() calls (§3 token-persistence)', async () => {
    // v0.3.4 D22 / §0.2.5 #10: the token is an immutable claim proof. A
    // `verify()` call MUST NOT mutate `verification_token`. Guards against
    // a future refactor accidentally slipping `UPDATE … SET verification_
    // token = $newToken` into the verify path.
    const { service, mockClient, mockVerification } = setup();
    const row = makeRow({ status: 'pending' });
    const verifiedRow = { ...row, status: 'verified' as const, verified_at: new Date() };
    mockVerification.verify.mockResolvedValue(true);

    // 3× (findOneActive SELECT + flipToVerified UPDATE).
    for (let i = 0; i < 3; i += 1) {
      mockClient.query.mockResolvedValueOnce({ rows: [row] }); // SELECT
      mockClient.query.mockResolvedValueOnce({ rows: [verifiedRow] }); // UPDATE
      await service.triggerVerify(42, row.id);
    }

    // Every call received the same row snapshot to `verify()` — same token.
    const tokens = new Set(
      mockVerification.verify.mock.calls.map((c) => (c[0] as TenantDomainRow).verification_token),
    );
    expect(tokens.size).toBe(1);
    expect(Array.from(tokens)[0]).toBe(row.verification_token);
  });

  it('maps 23505 on idx_tenant_domains_domain_verified to 409 DOMAIN_ALREADY_CLAIMED', async () => {
    // Race path (v0.3.2 D17): another tenant's verify landed while ours was
    // in flight. Partial UNIQUE INDEX on `(domain) WHERE status='verified'`
    // fires on the UPDATE; enclosing transaction rolls back cleanly.
    const { service, mockClient, mockVerification } = setup();
    const row = makeRow({ status: 'pending' });
    mockClient.query.mockResolvedValueOnce({ rows: [row] });
    mockVerification.verify.mockResolvedValueOnce(true);
    mockClient.query.mockRejectedValueOnce(
      makeUniqueViolation('idx_tenant_domains_domain_verified'),
    );

    await expect(service.triggerVerify(42, row.id)).rejects.toMatchObject({
      response: { code: 'DOMAIN_ALREADY_CLAIMED' },
    });
  });

  it('throws NotFoundException when the row does not belong to the tenant', async () => {
    const { service, mockClient } = setup();
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    await expect(service.triggerVerify(99, 'nope')).rejects.toThrow(NotFoundException);
  });
});

// ============================================================
// setPrimary — two-statement transaction
// ============================================================

describe('DomainsService.setPrimary', () => {
  it('clears the existing primary then sets the target primary', async () => {
    const { service, mockClient } = setup();
    // clear-primary UPDATE + set-primary UPDATE
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    await service.setPrimary(42, 'new-primary-id');

    expect(mockClient.query).toHaveBeenCalledTimes(2);
    const clearCall = mockClient.query.mock.calls[0] as unknown as [string];
    const setCall = mockClient.query.mock.calls[1] as unknown as [string];
    expect(clearCall[0]).toContain('is_primary = false');
    expect(setCall[0]).toContain('is_primary = true');
  });

  it('throws NotFoundException if the target row is absent', async () => {
    const { service, mockClient } = setup();
    mockClient.query.mockResolvedValueOnce({ rowCount: 0 });
    mockClient.query.mockResolvedValueOnce({ rowCount: 0 });

    await expect(service.setPrimary(42, 'ghost')).rejects.toThrow(NotFoundException);
  });
});

// ============================================================
// removeDomain — soft-delete
// ============================================================

describe('DomainsService.removeDomain', () => {
  it('soft-deletes by flipping is_active = 4 (DELETED)', async () => {
    const { service, mockClient } = setup();
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

    await service.removeDomain(42, 'row-id');

    const call = mockClient.query.mock.calls[0] as unknown as [string, unknown[]];
    // IS_ACTIVE.DELETED === 4 (ADR @assixx/shared/constants) — asserting the
    // literal here keeps the test brittle-on-purpose: any change in the
    // constant surfaces immediately rather than hiding in a reference.
    expect(call[0]).toContain('is_active = 4');
    expect(call[1]).toEqual(['row-id', 42]);
  });

  it('throws NotFoundException when the row was never active', async () => {
    const { service, mockClient } = setup();
    mockClient.query.mockResolvedValueOnce({ rowCount: 0 });

    await expect(service.removeDomain(42, 'ghost')).rejects.toThrow(NotFoundException);
  });

  it('allows a re-add after soft-delete (round-trip through the service)', async () => {
    // §3 DoD "Soft-delete + re-add round-trip" — guards against the partial
    // UNIQUE INDEX accidentally rejecting legitimate re-claims. The service
    // layer relies on the schema's `WHERE is_active = ${IS_ACTIVE.ACTIVE}`
    // index predicate to allow this; here we mock the INSERT as succeeding
    // and assert the service does NOT short-circuit with a pre-insert check.
    const { service, mockClient, mockVerification } = setup();
    // 1) add → INSERT RETURNING *
    mockClient.query.mockResolvedValueOnce({ rows: [makeRow({ domain: 'firma.de' })] });
    await service.addDomain(42, 'firma.de');
    // 2) remove → UPDATE rowCount 1
    mockClient.query.mockResolvedValueOnce({ rowCount: 1 });
    await service.removeDomain(42, 'row-id');
    // 3) re-add → INSERT RETURNING *, with a FRESH token (generateToken
    // called twice in total — once per add).
    mockVerification.generateToken.mockReturnValueOnce('c'.repeat(64));
    mockClient.query.mockResolvedValueOnce({
      rows: [makeRow({ domain: 'firma.de', verification_token: 'c'.repeat(64) })],
    });
    const readd = await service.addDomain(42, 'firma.de');

    expect(readd.status).toBe('pending');
    expect(readd.verificationInstructions?.txtValue).toBe(`assixx-verify=${'c'.repeat(64)}`);
    expect(mockVerification.generateToken).toHaveBeenCalledTimes(2);
  });
});

// ============================================================
// IDN / non-ASCII domains — §3 DoD D24
// ============================================================

describe('DomainsService — IDN handling (§3 D24)', () => {
  it('rejects non-ASCII input with INVALID_FORMAT (caller must pre-puncode IDNs)', async () => {
    // Current validator regex is RFC-1035 LDH-only — `ü` is rejected upfront.
    // Known gap: §3 D24 envisions storing either Unicode or Punycode
    // consistently. V1 ships as "caller normalizes" — the frontend / future
    // ADR-048 will puncode `müller.de` → `xn--mller-kva.de` before POSTing.
    // This test pins the current behaviour so a silent spec drift surfaces.
    const { service, mockClient } = setup();

    await expect(service.addDomain(42, 'müller.de')).rejects.toThrow(BadRequestException);
    expect(mockClient.query).not.toHaveBeenCalled();
  });

  it('accepts a caller-supplied Punycode domain (ASCII after trim/lower)', async () => {
    const { service, mockClient } = setup();
    mockClient.query.mockResolvedValueOnce({
      rows: [makeRow({ domain: 'xn--mller-kva.de' })],
    });

    const result = await service.addDomain(42, 'xn--mller-kva.de');
    expect(result.domain).toBe('xn--mller-kva.de');
  });
});
