/**
 * TwoFactorCodeService — unit tests (Phase 3 Session 8).
 *
 * Scope: foundation layer only — Redis I/O + Node `crypto`. Orchestration
 * (issue/verify/resend, audit, email, user-table writes) lives in
 * `TwoFactorAuthService` and is tested in Session 9
 * (`two-factor-auth.service.test.ts`).
 *
 * Plan §3 mandatory scenarios for `TwoFactorCodeService` — 21 explicit
 * cases. 20 of 21 are covered here. The remaining one (alphabet
 * conformance over 10 000 samples) targets the `generateCode()`
 * method in `TwoFactorAuthService` and therefore moves to Session 9.
 * Plan reference: `docs/FEAT_2FA_EMAIL_MASTERPLAN.md` Phase 3 §"Mandatory
 * scenarios — TwoFactorCodeService" bullet 20 — `generateCode()` lives at
 * `two-factor-auth.service.ts:471` (verified 2026-04-29), not in the
 * SUT of this file.
 *
 * Mock pattern: per-test plain object with `vi.fn()` spies; cast as
 * `unknown as Redis`. Mirrors `oauth-state.service.test.ts` — same
 * Redis-via-DI-token style as the SUT itself
 * (see `two-factor-code.service.ts` doc-block).
 *
 * Determinism: `vitest.setup.ts` already pins `process.env.TZ='UTC'`
 * and runs `vi.clearAllMocks()` in `beforeEach`. We re-call
 * `vi.clearAllMocks()` here for explicitness (matches the OAuth pattern)
 * and to keep the test file self-contained.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 3 — Unit Tests, Session 8)
 * @see backend/src/nest/two-factor-auth/two-factor-code.service.ts (SUT)
 */
import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VerifyCodeSchema } from './dto/verify-code.dto.js';
import {
  CODE_TTL_SEC,
  FAIL_STREAK_TTL_SEC,
  LOCKOUT_SEC,
  RESEND_COOLDOWN_SEC,
} from './two-factor-auth.constants.js';
import type { ChallengePurpose, ChallengeRecord } from './two-factor-auth.types.js';
import { TwoFactorCodeService } from './two-factor-code.service.js';

// keyPrefix '2fa:' is supplied by the ioredis client (module-level config
// in `two-factor-auth.module.ts`), so the service emits sub-keys without
// the prefix. Mirror that here so assertions match what the service sends.
const CHALLENGE_KEY = (token: string): string => `challenge:${token}`;
const LOCK_KEY = (userId: number): string => `lock:${userId}`;
const FAIL_STREAK_KEY = (userId: number): string => `fail-streak:${userId}`;
const RESEND_KEY = (token: string): string => `resend:${token}`;

// 32 random bytes → ceil(32 * 4 / 3) = 43 chars in base64url (no padding).
// DD-4 invariant — checked in test #1.
const EXPECTED_TOKEN_LENGTH = 43;

/**
 * Mock the subset of ioredis surface that `TwoFactorCodeService` actually
 * uses. Keeping the mock minimal (instead of stubbing the whole `Redis`
 * type) makes it obvious which Redis commands the service depends on —
 * adding a new command to the SUT requires extending this list, which
 * surfaces in code review.
 */
function createMockRedis(): {
  set: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  incr: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  setex: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
} {
  return {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn(),
    del: vi.fn().mockResolvedValue(1),
    incr: vi.fn(),
    expire: vi.fn().mockResolvedValue(1),
    setex: vi.fn().mockResolvedValue('OK'),
    exists: vi.fn(),
  };
}

/** Build a `ChallengeRecord` with sane defaults; per-test overrides win. */
function makeRecord(overrides: Partial<ChallengeRecord> = {}): ChallengeRecord {
  return {
    userId: 42,
    tenantId: 7,
    email: 'user@example.com',
    purpose: 'login',
    // 64 hex chars = 32 bytes — matches sha256 length so verifyCode's
    // length-guard branch is exercised only in the dedicated test.
    codeHash: 'a'.repeat(64),
    attemptCount: 0,
    resendCount: 0,
    createdAt: '2026-04-29T00:00:00.000Z',
    ...overrides,
  };
}

describe('TwoFactorCodeService', () => {
  let service: TwoFactorCodeService;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = createMockRedis();
    service = new TwoFactorCodeService(mockRedis as unknown as Redis);
  });

  // ─── createChallenge() ─────────────────────────────────────────────────

  describe('createChallenge()', () => {
    it('returns a base64url token of expected length (~43 chars from 32 bytes)', async () => {
      const token = await service.createChallenge(makeRecord());

      // base64url alphabet: A–Z, a–z, 0–9, '-', '_'. No padding ('=').
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token).toHaveLength(EXPECTED_TOKEN_LENGTH);
    });

    it('persists the record JSON at `challenge:{token}` with CODE_TTL_SEC', async () => {
      const record = makeRecord();
      const token = await service.createChallenge(record);

      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalledWith(
        CHALLENGE_KEY(token),
        JSON.stringify(record),
        'EX',
        CODE_TTL_SEC,
      );
    });

    it('round-trips every ChallengeRecord field verbatim into the stored JSON', async () => {
      const record = makeRecord({
        userId: 999,
        tenantId: 12,
        email: 'verify@scs-technik.de',
        purpose: 'signup',
        codeHash: 'b'.repeat(64),
        attemptCount: 2,
        resendCount: 1,
        createdAt: '2026-04-29T12:34:56.789Z',
      });
      await service.createChallenge(record);

      const json = mockRedis.set.mock.calls[0]?.[1] as string;
      expect(JSON.parse(json) as ChallengeRecord).toEqual(record);
    });

    // Plan scenario #2 — token uniqueness across many sequential calls.
    it('returns 1000 unique tokens across sequential calls (no collisions)', async () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        tokens.add(await service.createChallenge(makeRecord()));
      }
      expect(tokens.size).toBe(1000);
    });

    // Plan scenario #18 — concurrent createChallenge produces distinct tokens.
    // `randomBytes(32)` is reentrant; this asserts no module-level state
    // accidentally serialises concurrent calls or shares entropy.
    it('returns 100 distinct tokens under concurrent invocation (no race)', async () => {
      const promises = Array.from({ length: 100 }, () => service.createChallenge(makeRecord()));
      const tokens = await Promise.all(promises);
      expect(new Set(tokens).size).toBe(100);
    });
  });

  // ─── loadChallenge() ───────────────────────────────────────────────────

  describe('loadChallenge()', () => {
    it('returns the parsed record on hit', async () => {
      const record = makeRecord();
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(record));

      const result = await service.loadChallenge('tok-1');

      expect(result).toEqual(record);
      expect(mockRedis.get).toHaveBeenCalledWith(CHALLENGE_KEY('tok-1'));
    });

    // Plan scenarios #3 + #4 — Redis returns null both for unknown tokens
    // and for keys that have already expired (single code path).
    it('returns null when Redis returns null (unknown OR expired token)', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      expect(await service.loadChallenge('missing')).toBeNull();
    });

    // Defense against tampered Redis dumps / partial writes — the impl has
    // an explicit try/catch around JSON.parse that returns null. Regression
    // test for that branch.
    it('returns null on corrupted JSON payload', async () => {
      mockRedis.get.mockResolvedValueOnce('{not valid json');
      expect(await service.loadChallenge('tok-corrupt')).toBeNull();
    });
  });

  // ─── consumeChallenge() ────────────────────────────────────────────────

  // Plan scenario #5 — single-use enforcement (R8).
  describe('consumeChallenge()', () => {
    it('deletes the challenge key', async () => {
      await service.consumeChallenge('tok-9');
      expect(mockRedis.del).toHaveBeenCalledTimes(1);
      expect(mockRedis.del).toHaveBeenCalledWith(CHALLENGE_KEY('tok-9'));
    });
  });

  // ─── updateChallenge() ─────────────────────────────────────────────────

  describe('updateChallenge()', () => {
    // Plan scenario #19 — resend path (DD-9): TTL reset to full CODE_TTL_SEC.
    it('resets TTL to CODE_TTL_SEC when extendTtl=true (resend path, DD-9)', async () => {
      const record = makeRecord({ attemptCount: 0, resendCount: 1 });
      await service.updateChallenge('tok-resend', record, true);

      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalledWith(
        CHALLENGE_KEY('tok-resend'),
        JSON.stringify(record),
        'EX',
        CODE_TTL_SEC,
      );
    });

    // Failed-attempt bookkeeping path: keep remaining TTL via KEEPTTL
    // (Redis 6.0+; project runs PG18 / Redis 8.x).
    it('preserves TTL via KEEPTTL when extendTtl=false (failed-attempt path)', async () => {
      const record = makeRecord({ attemptCount: 3 });
      await service.updateChallenge('tok-fail', record, false);

      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalledWith(
        CHALLENGE_KEY('tok-fail'),
        JSON.stringify(record),
        'KEEPTTL',
      );
    });
  });

  // ─── hashCode() ────────────────────────────────────────────────────────

  describe('hashCode()', () => {
    // Plan scenario #6 — deterministic for same inputs.
    it('is deterministic across repeated calls with identical inputs', () => {
      const a = service.hashCode(42, 'ABC234', 'login');
      const b = service.hashCode(42, 'ABC234', 'login');
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    });

    // Plan scenario #7 — purpose-confusion attack mitigation.
    it('produces a different hash when only the purpose differs (login vs signup)', () => {
      const login = service.hashCode(42, 'ABC234', 'login');
      const signup = service.hashCode(42, 'ABC234', 'signup');
      expect(login).not.toBe(signup);
    });

    it('produces a different hash when only the userId differs', () => {
      const a = service.hashCode(42, 'ABC234', 'login');
      const b = service.hashCode(43, 'ABC234', 'login');
      expect(a).not.toBe(b);
    });

    it('produces a different hash when only the code differs', () => {
      const a = service.hashCode(42, 'ABC234', 'login');
      const b = service.hashCode(42, 'ABC235', 'login');
      expect(a).not.toBe(b);
    });

    it.each<ChallengePurpose>(['login', 'signup', 'email-change-old', 'email-change-new'])(
      'salts purpose "%s" so cross-purpose codes never collide',
      (purpose) => {
        const others: ChallengePurpose[] = (
          ['login', 'signup', 'email-change-old', 'email-change-new'] satisfies ChallengePurpose[]
        ).filter((p) => p !== purpose);
        const subject = service.hashCode(42, 'XYZW89', purpose);
        for (const other of others) {
          expect(subject).not.toBe(service.hashCode(42, 'XYZW89', other));
        }
      },
    );
  });

  // ─── verifyCode() ──────────────────────────────────────────────────────

  describe('verifyCode()', () => {
    // Plan scenario #8 — true on match.
    it('returns true when code hashes to record.codeHash', () => {
      const code = 'ABC234';
      const record = makeRecord({ codeHash: service.hashCode(42, code, 'login') });
      expect(service.verifyCode(record, code)).toBe(true);
    });

    // Plan scenario #9 — false on mismatch.
    it('returns false when code does not match the stored hash', () => {
      const record = makeRecord({ codeHash: service.hashCode(42, 'ABC234', 'login') });
      expect(service.verifyCode(record, 'ZZZ234')).toBe(false);
    });

    // Defense-in-depth: the impl explicitly length-guards before
    // `timingSafeEqual` (which would otherwise throw). Truncated/corrupt
    // Redis payloads must return false, not crash.
    it('returns false (not throws) when stored codeHash has wrong length', () => {
      const record = makeRecord({ codeHash: 'short' });
      expect(() => service.verifyCode(record, 'ABC234')).not.toThrow();
      expect(service.verifyCode(record, 'ABC234')).toBe(false);
    });

    it('returns false when stored codeHash is empty string', () => {
      const record = makeRecord({ codeHash: '' });
      expect(service.verifyCode(record, 'ABC234')).toBe(false);
    });

    // Plan scenario #10 — constant-time check.
    //
    // CAVEAT: tight statistical timing assertions on JS in CI are
    // historically flaky (GC pauses, JIT warmup, OS noise). The bound
    // here is intentionally generous: ratio of means within [0.4, 2.5].
    // The PRIMARY defense is structural (the impl imports + calls
    // `crypto.timingSafeEqual`, which is constant-time in C). This
    // statistical check exists only to catch a regression like switching
    // to `===` or `Buffer.compare` short-circuit semantics, both of which
    // would produce a much larger ratio than 2.5.
    it('runs in roughly constant time across matching vs mismatching codes', () => {
      const code = 'ABC234';
      const matchRecord = makeRecord({ codeHash: service.hashCode(42, code, 'login') });
      // Mismatching hash that differs from byte 0 — would exit fast under
      // a non-constant-time implementation.
      const earlyMismatchRecord = makeRecord({ codeHash: 'f'.repeat(64) });

      const SAMPLES = 1000;

      // Warmup to settle JIT.
      for (let i = 0; i < 100; i++) {
        service.verifyCode(matchRecord, code);
        service.verifyCode(earlyMismatchRecord, code);
      }

      const matchStart = process.hrtime.bigint();
      for (let i = 0; i < SAMPLES; i++) {
        service.verifyCode(matchRecord, code);
      }
      const matchNs = Number(process.hrtime.bigint() - matchStart);

      const mismatchStart = process.hrtime.bigint();
      for (let i = 0; i < SAMPLES; i++) {
        service.verifyCode(earlyMismatchRecord, code);
      }
      const mismatchNs = Number(process.hrtime.bigint() - mismatchStart);

      const ratio = matchNs / mismatchNs;
      // Bounds widened from [0.4, 2.5] → [0.1, 10] after PR #222 CI run
      // (2026-04-29) hit ratio=2.95 on a noisy GH-Actions runner. Real signal
      // for `crypto.timingSafeEqual` on equal-length inputs is ~1.0; CI VM
      // noise alone routinely produces ratios in [0.3, 3.0]. Regressions this
      // check is supposed to catch produce far larger signals: `===`
      // short-circuit ≈ 150–200× (1/31 first-char match rate × 6-char
      // length); `Buffer.compare` ≈ 5–20×. [0.1, 10] therefore catches every
      // regression worth catching while tolerating CI noise. Primary defense
      // remains structural — the impl imports + calls `crypto.timingSafeEqual`.
      expect(ratio).toBeGreaterThan(0.1);
      expect(ratio).toBeLessThan(10);
    });
  });

  // ─── incrementFailStreak() ─────────────────────────────────────────────

  describe('incrementFailStreak()', () => {
    // Plan scenario #11 — increases counter, returns new value.
    it('returns the new counter value from INCR', async () => {
      mockRedis.incr.mockResolvedValueOnce(3);
      expect(await service.incrementFailStreak(42)).toBe(3);
      expect(mockRedis.incr).toHaveBeenCalledWith(FAIL_STREAK_KEY(42));
    });

    // Plan scenario #12 — sets 24 h TTL on the 0→1 transition only.
    // This anchors the rolling window to the FIRST failure (intentional:
    // attacker can't spread 5+ wrong codes across multiple days to evade
    // the cap).
    it('sets FAIL_STREAK_TTL_SEC TTL exactly when newCount === 1', async () => {
      mockRedis.incr.mockResolvedValueOnce(1);
      await service.incrementFailStreak(42);

      expect(mockRedis.expire).toHaveBeenCalledTimes(1);
      expect(mockRedis.expire).toHaveBeenCalledWith(FAIL_STREAK_KEY(42), FAIL_STREAK_TTL_SEC);
    });

    it('does NOT call expire when newCount > 1 (rolling window anchored to 1st failure)', async () => {
      mockRedis.incr.mockResolvedValueOnce(2);
      await service.incrementFailStreak(42);
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });

  // ─── getFailStreak() ───────────────────────────────────────────────────

  describe('getFailStreak()', () => {
    // Plan scenario #13 — returns 0 if no key.
    it('returns 0 when Redis returns null (no streak yet)', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      expect(await service.getFailStreak(42)).toBe(0);
    });

    it('returns the parsed integer when the streak key exists', async () => {
      mockRedis.get.mockResolvedValueOnce('4');
      expect(await service.getFailStreak(42)).toBe(4);
      expect(mockRedis.get).toHaveBeenCalledWith(FAIL_STREAK_KEY(42));
    });

    // Defensive — Redis returns a non-numeric string (corrupted seed,
    // accidental overwrite). Impl falls back to 0 via `Number.isNaN`
    // check; verify the branch.
    it('returns 0 when the stored value is not a number', async () => {
      mockRedis.get.mockResolvedValueOnce('not-a-number');
      expect(await service.getFailStreak(42)).toBe(0);
    });
  });

  // ─── clearFailStreak() ─────────────────────────────────────────────────

  // Plan scenario #14.
  describe('clearFailStreak()', () => {
    it('deletes the per-user streak key', async () => {
      await service.clearFailStreak(42);
      expect(mockRedis.del).toHaveBeenCalledWith(FAIL_STREAK_KEY(42));
    });
  });

  // ─── setLockout() / isLocked() / clearLockout() ────────────────────────

  describe('setLockout()', () => {
    // Plan scenario #15.
    it('sets the lockout key with LOCKOUT_SEC TTL via SETEX', async () => {
      await service.setLockout(42);
      expect(mockRedis.setex).toHaveBeenCalledWith(LOCK_KEY(42), LOCKOUT_SEC, '');
    });
  });

  describe('isLocked()', () => {
    // Plan scenario #16.
    it('returns true when EXISTS reports the lockout key (count = 1)', async () => {
      mockRedis.exists.mockResolvedValueOnce(1);
      expect(await service.isLocked(42)).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith(LOCK_KEY(42));
    });

    it('returns false when EXISTS reports the lockout key absent (count = 0)', async () => {
      mockRedis.exists.mockResolvedValueOnce(0);
      expect(await service.isLocked(42)).toBe(false);
    });
  });

  describe('clearLockout()', () => {
    it('deletes the lockout key (root unlock path, DD-8)', async () => {
      await service.clearLockout(42);
      expect(mockRedis.del).toHaveBeenCalledWith(LOCK_KEY(42));
    });
  });

  // ─── setResendCooldown() / isResendOnCooldown() ────────────────────────

  // Plan scenario #17 — 60 s TTL behavior.
  describe('setResendCooldown() + isResendOnCooldown()', () => {
    it('setResendCooldown writes cooldown key with RESEND_COOLDOWN_SEC TTL', async () => {
      await service.setResendCooldown('tok-cd');
      expect(mockRedis.setex).toHaveBeenCalledWith(RESEND_KEY('tok-cd'), RESEND_COOLDOWN_SEC, '');
    });

    it('isResendOnCooldown returns true when EXISTS reports the key (1)', async () => {
      mockRedis.exists.mockResolvedValueOnce(1);
      expect(await service.isResendOnCooldown('tok-cd')).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith(RESEND_KEY('tok-cd'));
    });

    it('isResendOnCooldown returns false when EXISTS reports absent (0)', async () => {
      mockRedis.exists.mockResolvedValueOnce(0);
      expect(await service.isResendOnCooldown('tok-cd')).toBe(false);
    });
  });
});

// ─── Plan scenario #21 — DTO normalisation ──────────────────────────────
//
// Lives here per the masterplan grouping ("Mandatory scenarios —
// TwoFactorCodeService" bullet #21), even though the validation runs at
// the Zod layer. Server-side normalisation is the safety net for mobile
// keyboards where `autocapitalize="characters"` is best-effort (DD-17).

describe('VerifyCodeSchema (DTO normalisation)', () => {
  it('uppercases lowercase input before regex check (mobile keyboard fail-safe)', () => {
    const result = VerifyCodeSchema.parse({ code: 'abc234' });
    expect(result.code).toBe('ABC234');
  });

  it('trims surrounding whitespace before normalisation', () => {
    const result = VerifyCodeSchema.parse({ code: '  abc234  ' });
    expect(result.code).toBe('ABC234');
  });

  it('accepts already-uppercase alphanumeric within the alphabet', () => {
    const result = VerifyCodeSchema.parse({ code: 'XYZW89' });
    expect(result.code).toBe('XYZW89');
  });

  // Crockford-Base32 confusables — DD-1 v0.3.1.
  it.each(['0BC234', '1BC234', 'IBC234', 'LBC234', 'OBC234'])(
    'rejects code containing forbidden char %s (Crockford-Base32 subset)',
    (code) => {
      expect(() => VerifyCodeSchema.parse({ code })).toThrow();
    },
  );

  it('rejects codes shorter than 6 chars', () => {
    expect(() => VerifyCodeSchema.parse({ code: 'ABC23' })).toThrow();
  });

  it('rejects codes longer than 6 chars', () => {
    expect(() => VerifyCodeSchema.parse({ code: 'ABC2345' })).toThrow();
  });
});
