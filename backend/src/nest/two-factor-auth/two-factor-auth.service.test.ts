/**
 * TwoFactorAuthService — unit tests (Phase 3 Session 9 / sub-pass 9a).
 *
 * Scope: orchestration layer. Composes `TwoFactorCodeService` (Redis I/O),
 * `MailerService` (SMTP), `DatabaseService` (audit + user-table). Each
 * dependency is mocked; this file does NOT touch Redis, SMTP, or PG.
 *
 * Plan coverage — `docs/FEAT_2FA_EMAIL_MASTERPLAN.md` Phase 3 §"Mandatory
 * scenarios — TwoFactorAuthService" (19 scenarios) + the deferred alphabet-
 * conformance check from Session 8 (§"Mandatory scenarios — TwoFactorCode-
 * Service" bullet #20 — `generateCode()` lives here, not on the code service).
 *
 * Mock pattern: per-dep plain object with `vi.fn()` spies, cast as
 * `unknown as <Type>`. Mirrors `oauth-state.service.test.ts` and the
 * Session-8 fabric in `two-factor-code.service.test.ts`.
 *
 * Audit assertions go through a small helper (`auditCallsFor`) that filters
 * `db.queryAsTenant` calls to those whose SQL targets `audit_trail` — the
 * service uses the same `queryAsTenant` channel for both audit INSERTs and
 * the `markVerified` user-table UPDATE, so a structural filter is needed.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 3 — Unit Tests, Session 9)
 * @see backend/src/nest/two-factor-auth/two-factor-auth.service.ts (SUT)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MailerService } from '../common/services/mailer.service.js';
import type { DatabaseService } from '../database/database.service.js';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  CODE_TTL_SEC,
  MAX_ATTEMPTS,
  MAX_RESENDS_PER_CHALLENGE,
  RESEND_COOLDOWN_SEC,
} from './two-factor-auth.constants.js';
import { TwoFactorAuthService } from './two-factor-auth.service.js';
import type { ChallengePurpose, ChallengeRecord } from './two-factor-auth.types.js';
import type { TwoFactorCodeService } from './two-factor-code.service.js';

const FIXED_CODE_HASH = 'a'.repeat(64);
const FIXED_TOKEN = 'MOCK_CHALLENGE_TOKEN_BASE64URL_43chars_____';

// ─── Mock factories ─────────────────────────────────────────────────────

/**
 * Mock `TwoFactorCodeService` — every method the orchestrator can call.
 * Default behaviour matches the "happy path" (no lockout, no cooldown,
 * verifyCode false unless overridden per-test).
 */
function createMockCodes(): {
  createChallenge: ReturnType<typeof vi.fn>;
  loadChallenge: ReturnType<typeof vi.fn>;
  consumeChallenge: ReturnType<typeof vi.fn>;
  updateChallenge: ReturnType<typeof vi.fn>;
  hashCode: ReturnType<typeof vi.fn>;
  verifyCode: ReturnType<typeof vi.fn>;
  incrementFailStreak: ReturnType<typeof vi.fn>;
  getFailStreak: ReturnType<typeof vi.fn>;
  clearFailStreak: ReturnType<typeof vi.fn>;
  setLockout: ReturnType<typeof vi.fn>;
  isLocked: ReturnType<typeof vi.fn>;
  clearLockout: ReturnType<typeof vi.fn>;
  setResendCooldown: ReturnType<typeof vi.fn>;
  isResendOnCooldown: ReturnType<typeof vi.fn>;
} {
  return {
    createChallenge: vi.fn().mockResolvedValue(FIXED_TOKEN),
    loadChallenge: vi.fn().mockResolvedValue(null),
    consumeChallenge: vi.fn().mockResolvedValue(undefined),
    updateChallenge: vi.fn().mockResolvedValue(undefined),
    hashCode: vi.fn().mockReturnValue(FIXED_CODE_HASH),
    verifyCode: vi.fn().mockReturnValue(false),
    incrementFailStreak: vi.fn().mockResolvedValue(1),
    getFailStreak: vi.fn().mockResolvedValue(0),
    clearFailStreak: vi.fn().mockResolvedValue(undefined),
    setLockout: vi.fn().mockResolvedValue(undefined),
    isLocked: vi.fn().mockResolvedValue(false),
    clearLockout: vi.fn().mockResolvedValue(undefined),
    setResendCooldown: vi.fn().mockResolvedValue(undefined),
    isResendOnCooldown: vi.fn().mockResolvedValue(false),
  };
}

function createMockMailer(): {
  sendTwoFactorCode: ReturnType<typeof vi.fn>;
  sendTwoFactorSuspiciousActivity: ReturnType<typeof vi.fn>;
} {
  return {
    sendTwoFactorCode: vi.fn().mockResolvedValue(undefined),
    sendTwoFactorSuspiciousActivity: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockDb(): { queryAsTenant: ReturnType<typeof vi.fn> } {
  return { queryAsTenant: vi.fn().mockResolvedValue([]) };
}

/** Build a `ChallengeRecord` with sane defaults; per-test overrides win. */
function makeRecord(overrides: Partial<ChallengeRecord> = {}): ChallengeRecord {
  return {
    userId: 42,
    tenantId: 7,
    email: 'user@example.com',
    purpose: 'login',
    codeHash: FIXED_CODE_HASH,
    attemptCount: 0,
    resendCount: 0,
    createdAt: '2026-04-29T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Filter `db.queryAsTenant` mock calls down to those that target the
 * `audit_trail` table, returning a normalised projection.
 *
 * The SUT routes BOTH audit INSERTs and the `markVerified` user-table UPDATE
 * through the same `queryAsTenant` channel (intentional — see SUT doc-block:
 * verify-flow controller is `@Public()`, so CLS may not yet hold a tenantId,
 * which forces the explicit-tenantId variant for both writes). A SQL prefix
 * filter is therefore required to isolate audit assertions.
 */
function auditCallsFor(mockDb: { queryAsTenant: ReturnType<typeof vi.fn> }): Array<{
  tenantId: number;
  userId: number;
  action: string;
  resourceType: string;
  status: string;
  changes: Record<string, unknown>;
}> {
  return mockDb.queryAsTenant.mock.calls
    .filter((call: unknown[]) => {
      const sql = call[0];
      return typeof sql === 'string' && sql.includes('INSERT INTO audit_trail');
    })
    .map((call: unknown[]) => {
      const params = call[1] as unknown[];
      return {
        tenantId: params[0] as number,
        userId: params[1] as number,
        action: params[4] as string,
        resourceType: params[5] as string,
        status: params[11] as string,
        changes: JSON.parse(params[8] as string) as Record<string, unknown>,
      };
    });
}

// ─── Suite ──────────────────────────────────────────────────────────────

describe('TwoFactorAuthService', () => {
  let service: TwoFactorAuthService;
  let mockCodes: ReturnType<typeof createMockCodes>;
  let mockMailer: ReturnType<typeof createMockMailer>;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCodes = createMockCodes();
    mockMailer = createMockMailer();
    mockDb = createMockDb();
    service = new TwoFactorAuthService(
      mockCodes as unknown as TwoFactorCodeService,
      mockMailer as unknown as MailerService,
      mockDb as unknown as DatabaseService,
    );
  });

  // ─── issueChallenge() ──────────────────────────────────────────────────

  describe('issueChallenge()', () => {
    // Plan scenario — calls send2faCode with correct args.
    it('sends a 2FA email with (email, generated code, purpose, 10 min TTL)', async () => {
      await service.issueChallenge(42, 7, 'user@example.com', 'login');

      expect(mockMailer.sendTwoFactorCode).toHaveBeenCalledTimes(1);
      const [to, code, purpose, ttl] = mockMailer.sendTwoFactorCode.mock.calls[0] ?? [];
      expect(to).toBe('user@example.com');
      // CODE_TTL_SEC = 600 → 10 min in the email body (DD-2).
      expect(ttl).toBe(10);
      expect(purpose).toBe('login');
      // Code is generated server-side, must conform to CODE_ALPHABET (DD-1).
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    });

    it('persists a challenge with codeHash + attemptCount=0 + resendCount=0', async () => {
      await service.issueChallenge(42, 7, 'user@example.com', 'login');

      expect(mockCodes.hashCode).toHaveBeenCalledTimes(1);
      const persistedRecord = mockCodes.createChallenge.mock.calls[0]?.[0] as ChallengeRecord;
      expect(persistedRecord).toEqual(
        expect.objectContaining({
          userId: 42,
          tenantId: 7,
          email: 'user@example.com',
          purpose: 'login',
          codeHash: FIXED_CODE_HASH,
          attemptCount: 0,
          resendCount: 0,
        }),
      );
    });

    // Plan scenario — rejects if user is locked → ForbiddenException.
    it('rejects with ForbiddenException when user is locked, never issues mail or code', async () => {
      mockCodes.isLocked.mockResolvedValueOnce(true);

      await expect(
        service.issueChallenge(42, 7, 'user@example.com', 'login'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(mockCodes.createChallenge).not.toHaveBeenCalled();
      expect(mockMailer.sendTwoFactorCode).not.toHaveBeenCalled();
      expect(auditCallsFor(mockDb)).toHaveLength(0);
    });

    // Plan scenario — audit entry: `(create, 2fa-challenge, success, {purpose})`.
    it('emits a (create, 2fa-challenge, success) audit row with the purpose payload', async () => {
      await service.issueChallenge(42, 7, 'user@example.com', 'signup');

      const audits = auditCallsFor(mockDb);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toEqual(
        expect.objectContaining({
          tenantId: 7,
          userId: 42,
          action: 'create',
          resourceType: '2fa-challenge',
          status: 'success',
          changes: { purpose: 'signup' },
        }),
      );
    });

    // R8 / DD-14 — SMTP failure must roll back the Redis challenge so an
    // attacker cannot brute-force a code that was never delivered.
    it('rolls back the challenge and throws 503 on SMTP failure (no audit)', async () => {
      mockMailer.sendTwoFactorCode.mockRejectedValueOnce(new Error('SMTP down'));

      await expect(
        service.issueChallenge(42, 7, 'user@example.com', 'login'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      // createChallenge ran, then consumeChallenge rolled it back — exact same
      // token so the rollback hits the right Redis key.
      expect(mockCodes.consumeChallenge).toHaveBeenCalledTimes(1);
      expect(mockCodes.consumeChallenge).toHaveBeenCalledWith(FIXED_TOKEN);
      // No issuance audit when SMTP failed (audit rule: success-only on the
      // happy path; the SMTP-side error is logged separately by Mailer).
      expect(auditCallsFor(mockDb)).toHaveLength(0);
    });

    // Public-shape contract — `expiresAt` and `resendAvailableAt` are
    // computed from the issuance moment, `resendsRemaining` starts at the cap.
    it('returns a TwoFactorChallenge view with full TTL window and 3 resends remaining', async () => {
      const before = Date.now();
      const challenge = await service.issueChallenge(42, 7, 'user@example.com', 'login');
      const after = Date.now();

      expect(challenge.challengeToken).toBe(FIXED_TOKEN);
      expect(challenge.resendsRemaining).toBe(MAX_RESENDS_PER_CHALLENGE);

      const expiresMs = Date.parse(challenge.expiresAt);
      const resendMs = Date.parse(challenge.resendAvailableAt);
      // Allow a generous wall-clock window — expiresAt = issuedAt + 600 s.
      expect(expiresMs - before).toBeGreaterThanOrEqual(CODE_TTL_SEC * 1000 - 1000);
      expect(expiresMs - after).toBeLessThanOrEqual(CODE_TTL_SEC * 1000 + 1000);
      expect(resendMs - before).toBeGreaterThanOrEqual(RESEND_COOLDOWN_SEC * 1000 - 1000);
      expect(resendMs - after).toBeLessThanOrEqual(RESEND_COOLDOWN_SEC * 1000 + 1000);
    });
  });

  // ─── verifyChallenge() ─────────────────────────────────────────────────

  describe('verifyChallenge()', () => {
    // Plan scenario — unknown token → 401.
    it('rejects an unknown token with UnauthorizedException', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(null);

      await expect(service.verifyChallenge('bogus-token', 'ABC234')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      // No verify side effects on unknown-token path.
      expect(mockCodes.verifyCode).not.toHaveBeenCalled();
      expect(mockCodes.consumeChallenge).not.toHaveBeenCalled();
      expect(mockCodes.incrementFailStreak).not.toHaveBeenCalled();
    });

    // Plan scenario — expired token → 401 (loadChallenge returns null after
    // Redis TTL expiry; same code path as unknown-token).
    it('rejects an expired token (loadChallenge returns null) with UnauthorizedException', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(null);
      await expect(service.verifyChallenge('expired-token', 'ABC234')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    // Plan scenario — wrong code → 401 + failstreak++ + audit failure.
    it('rejects a wrong code, increments failstreak, emits (login, auth, failure) audit', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(makeRecord({ attemptCount: 0 }));
      mockCodes.verifyCode.mockReturnValueOnce(false);

      await expect(service.verifyChallenge(FIXED_TOKEN, 'WRONG1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(mockCodes.incrementFailStreak).toHaveBeenCalledWith(42);
      // attemptCount is bumped to 1 — KEEPTTL preserves the original 10 min window.
      expect(mockCodes.updateChallenge).toHaveBeenCalledWith(
        FIXED_TOKEN,
        expect.objectContaining({ attemptCount: 1 }),
        false,
      );
      const audits = auditCallsFor(mockDb);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        action: 'login',
        resourceType: 'auth',
        status: 'failure',
        changes: { reason: 'wrong-code', attempt: 1 },
      });
    });

    // Plan scenario — 5 wrong codes → lockout + suspicious mail + audit `(update, 2fa-lockout)`.
    it('triggers lockout, suspicious-activity mail and (update, 2fa-lockout) audit on the MAX_ATTEMPTS-th wrong code', async () => {
      // attemptCount=4 means this 5th attempt hits the cap.
      mockCodes.loadChallenge.mockResolvedValueOnce(makeRecord({ attemptCount: MAX_ATTEMPTS - 1 }));
      mockCodes.verifyCode.mockReturnValueOnce(false);

      await expect(service.verifyChallenge(FIXED_TOKEN, 'WRONG1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(mockCodes.setLockout).toHaveBeenCalledWith(42);
      expect(mockCodes.consumeChallenge).toHaveBeenCalledWith(FIXED_TOKEN);
      expect(mockMailer.sendTwoFactorSuspiciousActivity).toHaveBeenCalledWith('user@example.com');

      const audits = auditCallsFor(mockDb);
      const lockoutAudit = audits.find((a) => a.resourceType === '2fa-lockout');
      expect(lockoutAudit).toMatchObject({
        action: 'update',
        status: 'success',
        changes: { reason: 'max-attempts' },
      });
    });

    // Plan scenario — verifyChallenge consumes token on success (single-use).
    it('consumes the challenge token and clears failstreak on a correct code', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(makeRecord());
      mockCodes.verifyCode.mockReturnValueOnce(true);

      const result = await service.verifyChallenge(FIXED_TOKEN, 'ABC234');

      expect(result).toEqual({
        userId: 42,
        tenantId: 7,
        email: 'user@example.com',
        purpose: 'login',
      });
      expect(mockCodes.consumeChallenge).toHaveBeenCalledWith(FIXED_TOKEN);
      expect(mockCodes.clearFailStreak).toHaveBeenCalledWith(42);
      // Success audit — `(login, auth, success, {method:'2fa-email', purpose:'login'})`.
      const audits = auditCallsFor(mockDb);
      expect(audits).toEqual([
        expect.objectContaining({
          action: 'login',
          resourceType: 'auth',
          status: 'success',
          changes: expect.objectContaining({ method: '2fa-email', purpose: 'login' }),
        }),
      ]);
    });

    // Already-locked user → ForbiddenException, even with a valid code on a
    // valid challenge. Lockout precedes verifyCode.
    it('rejects with ForbiddenException when the user is already locked', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(makeRecord());
      mockCodes.isLocked.mockResolvedValueOnce(true);

      await expect(service.verifyChallenge(FIXED_TOKEN, 'ABC234')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(mockCodes.verifyCode).not.toHaveBeenCalled();
      expect(mockCodes.consumeChallenge).not.toHaveBeenCalled();
    });

    // Step 2.12 / DD-32 / R15 — cross-purpose token redemption is rejected
    // with the SAME generic 401 used for unknown tokens (R10 timing-safe
    // shape). Defense-in-depth: a stolen email-change-old token must NOT
    // authenticate at /auth/2fa/verify.
    it.each<ChallengePurpose>(['email-change-old', 'email-change-new'])(
      'rejects a "%s" token at the login/signup verify path with UnauthorizedException',
      async (purpose) => {
        mockCodes.loadChallenge.mockResolvedValueOnce(makeRecord({ purpose }));

        await expect(service.verifyChallenge(FIXED_TOKEN, 'ABC234')).rejects.toBeInstanceOf(
          UnauthorizedException,
        );
        expect(mockCodes.verifyCode).not.toHaveBeenCalled();
        expect(mockCodes.consumeChallenge).not.toHaveBeenCalled();
      },
    );

    // R8 — second use of an already-consumed token returns null from
    // loadChallenge (the consumption DEL'd the key), which is the same
    // path as the unknown-token case.
    it('returns the unknown-token path when a consumed token is replayed', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(makeRecord());
      mockCodes.verifyCode.mockReturnValueOnce(true);
      await service.verifyChallenge(FIXED_TOKEN, 'ABC234');

      // Replay: Redis returns null because consumeChallenge DEL'd the key.
      mockCodes.loadChallenge.mockResolvedValueOnce(null);
      await expect(service.verifyChallenge(FIXED_TOKEN, 'ABC234')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  // ─── verifyChallengePreCommit() ────────────────────────────────────────

  describe('verifyChallengePreCommit() (Step 2.12 / DD-32 — email-change two-code)', () => {
    // The pre-commit variant returns the live record WITHOUT consuming or
    // emitting the success audit — caller (EmailChangeService) commits both
    // verifies atomically and consumes inside its own transaction.
    it('returns the live ChallengeRecord on success without consuming or emitting success audit', async () => {
      const record = makeRecord({ purpose: 'email-change-old' });
      mockCodes.loadChallenge.mockResolvedValueOnce(record);
      mockCodes.verifyCode.mockReturnValueOnce(true);

      const result = await service.verifyChallengePreCommit(FIXED_TOKEN, 'ABC234', [
        'email-change-old',
      ]);

      expect(result).toEqual(record);
      expect(mockCodes.consumeChallenge).not.toHaveBeenCalled();
      expect(mockCodes.clearFailStreak).not.toHaveBeenCalled();
      expect(auditCallsFor(mockDb)).toHaveLength(0);
    });

    // The optional `wrongCodeAudit` lets email-change emit `(update,
    // user-email, failure, {side, reason, attempt})` per §A8.
    it('emits the email-change-shaped failure audit when a wrong code is supplied', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(
        makeRecord({ purpose: 'email-change-old', attemptCount: 0 }),
      );
      mockCodes.verifyCode.mockReturnValueOnce(false);

      await expect(
        service.verifyChallengePreCommit(FIXED_TOKEN, 'WRONG1', ['email-change-old'], {
          action: 'update',
          resourceType: 'user-email',
          changesExtra: { side: 'old' },
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      const audits = auditCallsFor(mockDb);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        action: 'update',
        resourceType: 'user-email',
        status: 'failure',
        changes: { side: 'old', reason: 'wrong-code', attempt: 1 },
      });
    });

    // A login token MUST NOT pass when the caller declared `expectedPurposes
    // = ['email-change-old']` — symmetry of the cross-purpose guard.
    it('rejects a "login" token at the email-change pre-commit path', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(makeRecord({ purpose: 'login' }));

      await expect(
        service.verifyChallengePreCommit(FIXED_TOKEN, 'ABC234', ['email-change-old']),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mockCodes.verifyCode).not.toHaveBeenCalled();
    });
  });

  // ─── markVerified() ────────────────────────────────────────────────────

  describe('markVerified()', () => {
    // Plan scenario — login: COALESCE(tfa_enrolled_at, NOW()) preserves a
    // prior enrollment timestamp; first 2FA on a legacy account writes it.
    it('login purpose runs the COALESCE(tfa_enrolled_at, NOW()) UPDATE keyed by [userId, tenantId]', async () => {
      await service.markVerified(42, 7, 'login');

      const userTableCalls = mockDb.queryAsTenant.mock.calls.filter(
        (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('UPDATE users'),
      );
      expect(userTableCalls).toHaveLength(1);
      const [sql, params, tenantArg] = userTableCalls[0] ?? [];
      expect(sql).toContain('last_2fa_verified_at = NOW()');
      expect(sql).toContain('COALESCE(tfa_enrolled_at, NOW())');
      // Login UPDATE never sets is_active.
      expect(sql).not.toContain('is_active = $1');
      expect(params).toEqual([42, 7]);
      // Explicit tenantId variant — verify endpoint is @Public(), CLS may not hold tenantId.
      expect(tenantArg).toBe(7);
    });

    // Plan scenario — signup: flips is_active to ACTIVE AND stamps both
    // timestamps unconditionally (signup IS the enrollment moment).
    it('signup purpose flips is_active=ACTIVE and stamps both timestamps unconditionally', async () => {
      await service.markVerified(99, 12, 'signup');

      const userTableCalls = mockDb.queryAsTenant.mock.calls.filter(
        (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('UPDATE users'),
      );
      expect(userTableCalls).toHaveLength(1);
      const [sql, params, tenantArg] = userTableCalls[0] ?? [];
      expect(sql).toContain('is_active = $1');
      expect(sql).toContain('tfa_enrolled_at = NOW()');
      expect(sql).toContain('last_2fa_verified_at = NOW()');
      // Signup never uses COALESCE — both timestamps overwritten by definition.
      expect(sql).not.toContain('COALESCE');
      expect(params).toEqual([IS_ACTIVE.ACTIVE, 99, 12]);
      expect(tenantArg).toBe(12);
    });

    // Belt-and-braces — the two SQL strings must be mutually exclusive in
    // shape so no future refactor accidentally collapses them.
    it('login and signup paths run structurally distinct SQL (no shape collision)', async () => {
      await service.markVerified(42, 7, 'login');
      await service.markVerified(42, 7, 'signup');
      const sqls = mockDb.queryAsTenant.mock.calls
        .filter((c: unknown[]) => typeof c[0] === 'string' && c[0].includes('UPDATE users'))
        .map((c: unknown[]) => c[0] as string);
      expect(sqls).toHaveLength(2);
      const [loginSql, signupSql] = sqls;
      expect(loginSql).toContain('COALESCE(tfa_enrolled_at, NOW())');
      expect(signupSql).not.toContain('COALESCE');
      expect(signupSql).toContain('is_active = $1');
      expect(loginSql).not.toContain('is_active = $1');
    });
  });

  // ─── resendChallenge() ─────────────────────────────────────────────────

  describe('resendChallenge()', () => {
    // Plan scenario — DD-9 60 s cooldown.
    it('rejects with HTTP 429 when within the 60 s cooldown window', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(makeRecord({ resendCount: 0 }));
      mockCodes.isResendOnCooldown.mockResolvedValueOnce(true);

      const error = await service.resendChallenge(FIXED_TOKEN).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(mockMailer.sendTwoFactorCode).not.toHaveBeenCalled();
    });

    // Plan scenario — DD-21 hard cap on resends per challenge.
    it('rejects with HTTP 429 once MAX_RESENDS_PER_CHALLENGE is reached', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(
        makeRecord({ resendCount: MAX_RESENDS_PER_CHALLENGE }),
      );

      const error = await service.resendChallenge(FIXED_TOKEN).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      // Cooldown MUST be checked AFTER the cap so spam-trap rejection fires
      // before any cooldown timing-leak.
      expect(mockCodes.isResendOnCooldown).not.toHaveBeenCalled();
    });

    // Plan scenario — DD-9 TTL extension on resend.
    it('extends the challenge TTL via updateChallenge(extendTtl=true) on a successful resend', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(makeRecord({ resendCount: 0 }));

      await service.resendChallenge(FIXED_TOKEN);

      expect(mockCodes.updateChallenge).toHaveBeenCalledTimes(1);
      const [, , extendTtl] = mockCodes.updateChallenge.mock.calls[0] ?? [];
      expect(extendTtl).toBe(true);
    });

    // Plan scenario — resetting per-challenge attemptCount (DD-9) but NOT
    // the per-user fail-streak (explicit DD-9 carve-out).
    it('resets attemptCount=0, increments resendCount, leaves failStreak untouched', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(
        makeRecord({ attemptCount: 3, resendCount: 1 }),
      );

      await service.resendChallenge(FIXED_TOKEN);

      const [, persisted] = mockCodes.updateChallenge.mock.calls[0] ?? [];
      expect(persisted).toEqual(expect.objectContaining({ attemptCount: 0, resendCount: 2 }));
      // Per-user fail streak is the brute-force detector that survives
      // resends — DD-9 is explicit on this, never call clearFailStreak here.
      expect(mockCodes.clearFailStreak).not.toHaveBeenCalled();
    });

    // Plan scenario — issues a fresh code (different hash from the previous).
    it('generates a fresh code and persists a new hash distinct from the previous one', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(
        makeRecord({ codeHash: 'old-hash-' + 'a'.repeat(54) }),
      );
      mockCodes.hashCode.mockReturnValueOnce('b'.repeat(64));

      await service.resendChallenge(FIXED_TOKEN);

      const [, persisted] = mockCodes.updateChallenge.mock.calls[0] ?? [];
      expect((persisted as ChallengeRecord).codeHash).toBe('b'.repeat(64));
    });

    // DD-9 — resend audit row carries the `kind: 'resend'` discriminator
    // so audit consumers can distinguish initial issuance from resend.
    it('emits a (create, 2fa-challenge, success, {kind:resend}) audit row', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(
        makeRecord({ purpose: 'login', resendCount: 0 }),
      );

      await service.resendChallenge(FIXED_TOKEN);

      const audits = auditCallsFor(mockDb);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        action: 'create',
        resourceType: '2fa-challenge',
        status: 'success',
        changes: { purpose: 'login', kind: 'resend' },
      });
    });

    it('rejects with UnauthorizedException when the challenge token is unknown or expired', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(null);
      await expect(service.resendChallenge('unknown-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    // Public-shape — resendsRemaining decrements per resend.
    it('returns a view with resendsRemaining = MAX − new resendCount', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(makeRecord({ resendCount: 1 }));

      const view = await service.resendChallenge(FIXED_TOKEN);

      expect(view.resendsRemaining).toBe(MAX_RESENDS_PER_CHALLENGE - 2);
    });

    // SMTP failure on resend — service throws 503 but does NOT roll back
    // the overwritten challenge record (the original code is gone, restoring
    // it is impossible). Documented in SUT comment.
    it('throws ServiceUnavailableException on SMTP failure during resend', async () => {
      mockCodes.loadChallenge.mockResolvedValueOnce(makeRecord({ resendCount: 0 }));
      mockMailer.sendTwoFactorCode.mockRejectedValueOnce(new Error('SMTP timeout'));

      await expect(service.resendChallenge(FIXED_TOKEN)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });

  // ─── clearLockoutForUser() ─────────────────────────────────────────────

  describe('clearLockoutForUser()', () => {
    // Plan scenario — Two-Root rule: caller==target → ForbiddenException.
    it('rejects with ForbiddenException when the caller targets themselves (Two-Root rule)', async () => {
      await expect(service.clearLockoutForUser(42, 42, 7)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(mockCodes.clearLockout).not.toHaveBeenCalled();
      expect(auditCallsFor(mockDb)).toHaveLength(0);
    });

    // Plan scenario — happy path: clears lockout + failstreak + audit `(delete, 2fa-lockout)`.
    it('clears lockout + failstreak and emits a (delete, 2fa-lockout, success) audit row', async () => {
      await service.clearLockoutForUser(42, 99, 7);

      expect(mockCodes.clearLockout).toHaveBeenCalledWith(42);
      expect(mockCodes.clearFailStreak).toHaveBeenCalledWith(42);

      const audits = auditCallsFor(mockDb);
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        action: 'delete',
        resourceType: '2fa-lockout',
        status: 'success',
        // userId on the audit row is the ROOT performing the clear,
        // resource_id (not surfaced via auditCallsFor) is the target user.
        userId: 99,
        tenantId: 7,
        changes: { clearedBy: 99, target: 42 },
      });
    });
  });

  // ─── generateCode() — alphabet conformance (deferred from Session 8) ────

  describe('generateCode() — alphabet conformance', () => {
    // Plan §3 mandatory scenario #20 — over 10 000 samples every char is in
    // CODE_ALPHABET, no confusables 0/1/I/L/O escape (DD-1 v0.3.1).
    // Method is private on the SUT — bound reference via `unknown` cast,
    // same convention used in `two-factor-code.service.test.ts` for the
    // Redis mock cast.
    it('produces only alphabet chars (A-HJKMNP-Z2-9) over 10 000 samples', () => {
      const generateCode = (service as unknown as { generateCode(): string }).generateCode.bind(
        service,
      );
      const REGEX = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);
      const FORBIDDEN = /[01ILO]/;

      for (let i = 0; i < 10_000; i++) {
        const code = generateCode();
        expect(code).toMatch(REGEX);
        expect(code).not.toMatch(FORBIDDEN);
      }
    });

    it('produces codes of exactly CODE_LENGTH characters', () => {
      const generateCode = (service as unknown as { generateCode(): string }).generateCode.bind(
        service,
      );
      for (let i = 0; i < 100; i++) {
        expect(generateCode()).toHaveLength(CODE_LENGTH);
      }
    });
  });
});
