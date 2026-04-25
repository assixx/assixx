/**
 * DomainVerificationService — Unit Tests (Phase 3, plan §2.4 + §3 DoD).
 *
 * The service owns three primitives (`generateToken`, `txtHostFor`,
 * `txtValueFor`) plus one async `verify(row)` that wraps `dns/promises`
 * `Resolver.resolveTxt` with a hard 3 s `Promise.race` timeout and a
 * `finally { resolver.cancel() }` socket-release.
 *
 * WHY mock `node:dns/promises` at the module boundary:
 *   - The service instantiates `new Resolver(...)` per call. Replacing the
 *     whole class via `vi.mock` is cheaper (and more faithful) than
 *     monkey-patching a prototype method.
 *   - Every branch (match / miss / NXDOMAIN / SERVFAIL / timeout) can be
 *     exercised by returning a different pre-canned promise from the mocked
 *     `resolveTxt`.
 *   - `resolver.cancel()` must be called in the `finally` block for every
 *     path — the mock captures this via a spy, so the DoD's "assert cancel
 *     was called" is a direct call-count assertion.
 *
 * WHY fake timers for the timeout branch:
 *   - The service's timeout is 3000 ms. Waiting it out real-time would
 *     inflate the unit-project runtime and racing it with `setTimeout(0)`
 *     is flaky. `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync` lets
 *     the `Promise.race` resolve deterministically.
 *
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §2.4, §3 DoD
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §0.2 R2 (3 s timeout)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Import AFTER the mock so the service picks up the mocked Resolver.
import { DomainVerificationService } from './domain-verification.service.js';
import type { TenantDomainRow } from './domains.types.js';

// ============================================================
// Module mock — `node:dns/promises.Resolver`
// ============================================================

// Hoisted references so we can reprogram behaviour per test and still have
// the `vi.mock` factory see them (factory is hoisted above the `import`).
const mockResolveTxt = vi.hoisted(() => vi.fn());
const mockCancel = vi.hoisted(() => vi.fn());
const mockSetTimeout = vi.hoisted(() => vi.fn());

// WHY a class, not `vi.fn().mockImplementation(() => ({...}))`:
// The service calls `new Resolver({ timeout, tries })`. A plain `vi.fn()`
// factory returns an object but is NOT callable as a constructor (throws
// "is not a constructor"). A class binds each instance's methods to the
// shared hoisted spies, so per-test reprogramming via `mockResolveTxt
// .mockResolvedValueOnce(…)` still targets the correct spy.
vi.mock('node:dns/promises', () => ({
  Resolver: class {
    resolveTxt = mockResolveTxt;
    cancel = mockCancel;
    setTimeout = mockSetTimeout;
  },
}));

// ============================================================
// Fixtures
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
    is_primary: true,
    is_active: 1,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

// ============================================================
// Primitives — deterministic, no mocks needed
// ============================================================

describe('DomainVerificationService — primitives', () => {
  let service: DomainVerificationService;

  beforeEach(() => {
    service = new DomainVerificationService();
  });

  describe('generateToken', () => {
    it('produces 64 hex characters (32 random bytes, plan §1.1)', () => {
      const token = service.generateToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces distinct tokens across calls', () => {
      // Sanity check against a hypothetical deterministic RNG regression.
      // `crypto.randomBytes` is cryptographically strong, so colliding two
      // 32-byte tokens in a handful of calls is astronomically unlikely.
      const tokens = new Set<string>();
      for (let i = 0; i < 8; i += 1) {
        tokens.add(service.generateToken());
      }
      expect(tokens.size).toBe(8);
    });
  });

  describe('txtHostFor', () => {
    it('builds the subdomain pattern `_assixx-verify.<domain>` (§0.2.5 #9)', () => {
      expect(service.txtHostFor('firma.de')).toBe('_assixx-verify.firma.de');
    });
  });

  describe('txtValueFor', () => {
    it('builds the AWS-SES-style value `assixx-verify=<token>`', () => {
      expect(service.txtValueFor('deadbeef')).toBe('assixx-verify=deadbeef');
    });
  });
});

// ============================================================
// verify() — DNS-mocked branches
// ============================================================

describe('DomainVerificationService.verify — DNS branches', () => {
  let service: DomainVerificationService;
  const ROW = makeRow();
  const EXPECTED = `assixx-verify=${ROW.verification_token}`;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DomainVerificationService();
  });

  afterEach(() => {
    // Guarantee fake-timer teardown even when a test forgot to restore them.
    vi.useRealTimers();
  });

  it('returns true when a TXT record matches the expected value', async () => {
    mockResolveTxt.mockResolvedValueOnce([[EXPECTED]]);

    const result = await service.verify(ROW);

    expect(result).toBe(true);
    expect(mockResolveTxt).toHaveBeenCalledWith('_assixx-verify.firma.de');
  });

  it('returns true when the expected value sits alongside SPF/DKIM records', async () => {
    // Real zones publish multiple TXT records at the same host. The service
    // must .some()-match, not .every()-match.
    mockResolveTxt.mockResolvedValueOnce([
      ['v=spf1 include:_spf.google.com ~all'],
      ['v=DKIM1; k=rsa; p=MIIBIjANBgkqh…'],
      [EXPECTED],
    ]);

    expect(await service.verify(ROW)).toBe(true);
  });

  it('joins ≤255-byte chunks per record before comparing (RFC 7208 §3.3)', async () => {
    // A single TXT record can be split into multiple ≤255-byte strings by
    // DNS tooling. The service `.join('')`s each record's chunks before the
    // equality check — simulate that with a 2-chunk record whose
    // concatenation equals EXPECTED.
    const half = EXPECTED.slice(0, 20);
    const rest = EXPECTED.slice(20);
    mockResolveTxt.mockResolvedValueOnce([[half, rest]]);

    expect(await service.verify(ROW)).toBe(true);
  });

  it('returns false when TXT records exist but none match', async () => {
    mockResolveTxt.mockResolvedValueOnce([['assixx-verify=wrong-token-value']]);

    expect(await service.verify(ROW)).toBe(false);
  });

  it('returns false on NXDOMAIN (no TXT record present) — fail-closed', async () => {
    const err = Object.assign(new Error('queryTxt ENOTFOUND _assixx-verify.firma.de'), {
      code: 'ENOTFOUND',
    });
    mockResolveTxt.mockRejectedValueOnce(err);

    expect(await service.verify(ROW)).toBe(false);
  });

  it('returns false on SERVFAIL / generic DNS error — fail-closed', async () => {
    const err = Object.assign(new Error('queryTxt ESERVFAIL _assixx-verify.firma.de'), {
      code: 'ESERVFAIL',
    });
    mockResolveTxt.mockRejectedValueOnce(err);

    expect(await service.verify(ROW)).toBe(false);
  });

  it('returns false when DNS lookup exceeds DNS_TIMEOUT_MS (v0.3.0 S1, 3 s bound)', async () => {
    // `resolveTxt` returns a promise that never settles; the service's own
    // `Promise.race` must reject first via its 3000 ms setTimeout. Fake
    // timers make this deterministic.
    vi.useFakeTimers();
    mockResolveTxt.mockReturnValueOnce(new Promise(() => undefined)); // never-resolving

    const pending = service.verify(ROW);

    // Advance past the 3000 ms hard bound plus a small jitter margin.
    await vi.advanceTimersByTimeAsync(3001);

    expect(await pending).toBe(false);
  });

  it('calls resolver.cancel() in finally for every path (no leaked sockets)', async () => {
    mockResolveTxt.mockResolvedValueOnce([[EXPECTED]]); // success path
    await service.verify(ROW);
    expect(mockCancel).toHaveBeenCalledTimes(1);

    // Error path — cancel MUST still fire.
    mockCancel.mockClear();
    mockResolveTxt.mockRejectedValueOnce(new Error('boom'));
    await service.verify(ROW);
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });
});
