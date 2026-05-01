/**
 * EmailChangeService — unit tests (Phase 3 Session 9, Batch E).
 *
 * Scope: Step 2.12 (DD-32 / R15) two-code 2FA-verified email-change
 * orchestration. Covers:
 *   - `requestChange` pre-checks (same-email refusal, uniqueness collision)
 *   - dual-issue ordering (OLD side first → NEW side, fail-loud semantics)
 *   - `verifyChange` happy path (both pre-commit verifies → tenantTransaction
 *     wrapped UPDATE+audit → consume both challenges)
 *   - `verifyChange` failure paths: OLD-side wrong, NEW-side wrong,
 *     token-pair mismatch (programmer-error defensive guard)
 *   - anti-persistence DEL on any failure (the OTHER side's token is also
 *     consumed so an attacker can't keep one valid challenge alive)
 *   - DD-20-style suspicious-activity mail goes to the CURRENT address
 *   - challenges are NOT consumed when the commit transaction itself rolls
 *     back (preserves retry within the TTL window)
 *
 * Mock pattern: per-collaborator plain-object spies cast as
 * `unknown as <Collaborator>`. `db.queryAsTenant` mocks the uniqueness
 * pre-check + the audit fire-and-forget; `db.tenantTransaction` mocks the
 * commit transaction (calls back with a `mockClient` that records the
 * UPDATE + audit INSERT).
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.12, Phase 3 Session 9)
 * @see backend/src/nest/users/email-change.service.ts (SUT)
 */
import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MailerService } from '../common/services/mailer.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { TwoFactorAuthService } from '../two-factor-auth/two-factor-auth.service.js';
import type {
  ChallengePurpose,
  ChallengeRecord,
} from '../two-factor-auth/two-factor-auth.types.js';
import type { TwoFactorCodeService } from '../two-factor-auth/two-factor-code.service.js';
import { EmailChangeService } from './email-change.service.js';

// ─── Mock factories ───────────────────────────────────────────────────

function createMockTwoFactorAuth(): {
  issueChallenge: ReturnType<typeof vi.fn>;
  verifyChallengePreCommit: ReturnType<typeof vi.fn>;
} {
  return {
    issueChallenge: vi.fn(),
    verifyChallengePreCommit: vi.fn(),
  };
}

function createMockCodes(): {
  consumeChallenge: ReturnType<typeof vi.fn>;
} {
  return { consumeChallenge: vi.fn().mockResolvedValue(undefined) };
}

function createMockMailer(): {
  sendTwoFactorSuspiciousActivity: ReturnType<typeof vi.fn>;
} {
  return { sendTwoFactorSuspiciousActivity: vi.fn().mockResolvedValue(undefined) };
}

interface MockDb {
  queryAsTenant: ReturnType<typeof vi.fn>;
  tenantTransaction: ReturnType<typeof vi.fn>;
  /** Recorded `client.query` calls inside the commit transaction. */
  clientCalls: Array<{ sql: string; params: readonly unknown[] }>;
}

function createMockDb(): MockDb {
  const clientCalls: MockDb['clientCalls'] = [];
  const mockClient = {
    query: vi.fn(async (sql: string, params?: readonly unknown[]): Promise<{ rows: unknown[] }> => {
      clientCalls.push({ sql, params: params ?? [] });
      return { rows: [] };
    }),
  } as unknown as PoolClient;
  return {
    queryAsTenant: vi.fn().mockResolvedValue([]),
    tenantTransaction: vi.fn(async (cb: (c: PoolClient) => Promise<unknown>) => cb(mockClient)),
    clientCalls,
  };
}

function makeRecord(overrides: Partial<ChallengeRecord> = {}): ChallengeRecord {
  return {
    userId: 42,
    tenantId: 7,
    email: 'old@example.com',
    purpose: 'email-change-old',
    codeHash: 'a'.repeat(64),
    attemptCount: 0,
    resendCount: 0,
    createdAt: '2026-04-29T00:00:00.000Z',
    ...overrides,
  };
}

// ─── Suite ────────────────────────────────────────────────────────────

describe('EmailChangeService', () => {
  let service: EmailChangeService;
  let mockDb: MockDb;
  let twoFactorAuth: ReturnType<typeof createMockTwoFactorAuth>;
  let codes: ReturnType<typeof createMockCodes>;
  let mailer: ReturnType<typeof createMockMailer>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    twoFactorAuth = createMockTwoFactorAuth();
    codes = createMockCodes();
    mailer = createMockMailer();
    service = new EmailChangeService(
      mockDb as unknown as DatabaseService,
      twoFactorAuth as unknown as TwoFactorAuthService,
      codes as unknown as TwoFactorCodeService,
      mailer as unknown as MailerService,
    );
  });

  // ─── requestChange() ────────────────────────────────────────────────

  describe('requestChange()', () => {
    it('rejects same-email no-op with BadRequestException (no challenges issued)', async () => {
      await expect(
        service.requestChange(42, 7, 'same@example.com', 'same@example.com'),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Pre-check fires BEFORE the uniqueness query, so no DB hit either.
      expect(mockDb.queryAsTenant).not.toHaveBeenCalled();
      expect(twoFactorAuth.issueChallenge).not.toHaveBeenCalled();
    });

    // Uniqueness pre-check — soft-check before issuing the SECOND challenge so
    // we do not spam an attacker confirming "yes, this email exists" (DD-20-
    // adjacent reasoning). The DB UNIQUE constraint catches the race window.
    it('rejects with ConflictException when newEmail already exists in the tenant (no challenges issued)', async () => {
      mockDb.queryAsTenant.mockResolvedValueOnce([{ id: 99 }]); // existing row

      await expect(
        service.requestChange(42, 7, 'old@example.com', 'taken@example.com'),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(twoFactorAuth.issueChallenge).not.toHaveBeenCalled();
    });

    it('issues OLD-side challenge first, NEW-side second (fail-loud on broken current mailbox)', async () => {
      mockDb.queryAsTenant.mockResolvedValueOnce([]); // uniqueness pre-check passes
      twoFactorAuth.issueChallenge
        .mockResolvedValueOnce({
          challengeToken: 'old-token',
          expiresAt: '2026-04-29T12:10:00.000Z',
          resendAvailableAt: '2026-04-29T12:01:00.000Z',
          resendsRemaining: 3,
        })
        .mockResolvedValueOnce({
          challengeToken: 'new-token',
          expiresAt: '2026-04-29T12:10:00.000Z',
          resendAvailableAt: '2026-04-29T12:01:00.000Z',
          resendsRemaining: 3,
        });

      const result = await service.requestChange(42, 7, 'old@example.com', 'new@example.com');

      // Order matters — first call to OLD address (current mailbox), second
      // to NEW address. SMTP-failure on OLD must stop before mailing NEW.
      const calls = twoFactorAuth.issueChallenge.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0]?.[2]).toBe('old@example.com');
      expect(calls[0]?.[3]).toBe('email-change-old' satisfies ChallengePurpose);
      expect(calls[1]?.[2]).toBe('new@example.com');
      expect(calls[1]?.[3]).toBe('email-change-new' satisfies ChallengePurpose);

      // Public response carries both challenges with the public-shape view.
      expect(result.oldChallenge.challengeToken).toBe('old-token');
      expect(result.newChallenge.challengeToken).toBe('new-token');
    });

    it('does NOT issue NEW-side when OLD-side issuance fails (fail-loud, no mailbox spam)', async () => {
      mockDb.queryAsTenant.mockResolvedValueOnce([]);
      twoFactorAuth.issueChallenge.mockRejectedValueOnce(
        new ServiceUnavailableException('SMTP down on OLD address'),
      );

      await expect(
        service.requestChange(42, 7, 'old@example.com', 'new@example.com'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      // OLD failed → NEW must NOT be issued. Without this short-circuit a
      // broken current-mailbox would still mail the prospective address —
      // potentially an attacker's mailbox confirming "this account is in
      // the middle of an email change".
      expect(twoFactorAuth.issueChallenge).toHaveBeenCalledTimes(1);
      expect(twoFactorAuth.issueChallenge.mock.calls[0]?.[2]).toBe('old@example.com');
    });
  });

  // ─── verifyChange() ──────────────────────────────────────────────────

  describe('verifyChange()', () => {
    function armPreCommitMocks(): void {
      twoFactorAuth.verifyChallengePreCommit
        .mockResolvedValueOnce(makeRecord({ purpose: 'email-change-old' })) // OLD side
        .mockResolvedValueOnce(
          makeRecord({ purpose: 'email-change-new', email: 'new@example.com' }),
        ); // NEW side
    }

    it('on both-green: runs UPDATE + audit inside one tenantTransaction and consumes both challenges', async () => {
      armPreCommitMocks();

      const result = await service.verifyChange(
        42,
        7,
        'old@example.com',
        'old-token',
        'CODEOLD',
        'new-token',
        'CODENEW',
      );

      expect(result).toEqual({ oldEmail: 'old@example.com', newEmail: 'new@example.com' });

      // Atomic commit — exactly one tenantTransaction wraps both writes.
      expect(mockDb.tenantTransaction).toHaveBeenCalledTimes(1);
      const sqls = mockDb.clientCalls.map((c) => c.sql);
      expect(sqls).toHaveLength(2);
      expect(sqls[0]).toContain('UPDATE users SET email = $1');
      expect(sqls[1]).toContain('INSERT INTO audit_trail');

      // UPDATE params: [newEmail, userId, tenantId].
      const updateParams = mockDb.clientCalls[0]?.params ?? [];
      expect(updateParams).toEqual(['new@example.com', 42, 7]);

      // §A8 audit row: (update, user-email, success, { oldEmail, newEmail }).
      const auditParams = mockDb.clientCalls[1]?.params ?? [];
      expect(auditParams[4]).toBe('update');
      expect(auditParams[5]).toBe('user-email');
      expect(auditParams[11]).toBe('success');
      const changes = JSON.parse(auditParams[8] as string) as Record<string, unknown>;
      expect(changes).toEqual({
        oldEmail: 'old@example.com',
        newEmail: 'new@example.com',
      });

      // Both challenges consumed AFTER the commit (DEL inside Redis).
      expect(codes.consumeChallenge).toHaveBeenCalledTimes(2);
      expect(codes.consumeChallenge).toHaveBeenCalledWith('old-token');
      expect(codes.consumeChallenge).toHaveBeenCalledWith('new-token');
      // No suspicious-activity mail on the happy path.
      expect(mailer.sendTwoFactorSuspiciousActivity).not.toHaveBeenCalled();
    });

    // OLD-side wrong code → cleanup DELs BOTH challenges + suspicious mail to
    // CURRENT address (not new) — DD-20 anti-enumeration: legitimate user
    // learns "someone tried to change my email" without learning the
    // attempted new address.
    it('on OLD-side wrong code: anti-persistence DEL of both tokens + suspicious-activity mail to CURRENT address', async () => {
      const verifyError = new UnauthorizedException('Ungültiger oder abgelaufener Code.');
      twoFactorAuth.verifyChallengePreCommit.mockRejectedValueOnce(verifyError);

      await expect(
        service.verifyChange(
          42,
          7,
          'old@example.com',
          'old-token',
          'WRONG1',
          'new-token',
          'CODENEW',
        ),
      ).rejects.toBe(verifyError);

      // Cleanup DELs the NEW-side (other) token + the failed OLD-side token —
      // anti-persistence so an attacker who cracked one code cannot brute-
      // force the other against a still-valid challenge.
      expect(codes.consumeChallenge).toHaveBeenCalledTimes(2);
      expect(codes.consumeChallenge).toHaveBeenCalledWith('new-token');
      expect(codes.consumeChallenge).toHaveBeenCalledWith('old-token');

      // Suspicious-activity mail to the CURRENT address (not the prospective
      // new one — that would let an attacker probe the new mailbox).
      expect(mailer.sendTwoFactorSuspiciousActivity).toHaveBeenCalledTimes(1);
      expect(mailer.sendTwoFactorSuspiciousActivity).toHaveBeenCalledWith('old@example.com');

      // No commit transaction touched — UPDATE never ran.
      expect(mockDb.tenantTransaction).not.toHaveBeenCalled();
    });

    it('on NEW-side wrong code (after OLD passed): same anti-persistence DEL + suspicious-activity mail', async () => {
      const verifyError = new UnauthorizedException('Ungültiger oder abgelaufener Code.');
      twoFactorAuth.verifyChallengePreCommit
        .mockResolvedValueOnce(makeRecord({ purpose: 'email-change-old' }))
        .mockRejectedValueOnce(verifyError);

      await expect(
        service.verifyChange(
          42,
          7,
          'old@example.com',
          'old-token',
          'CODEOLD',
          'new-token',
          'WRONG1',
        ),
      ).rejects.toBe(verifyError);

      // OLD-side already consumed by lockout-path semantics? No — pre-commit
      // does NOT consume on success either. Cleanup must DEL BOTH tokens.
      expect(codes.consumeChallenge).toHaveBeenCalledTimes(2);
      expect(mailer.sendTwoFactorSuspiciousActivity).toHaveBeenCalledWith('old@example.com');
      expect(mockDb.tenantTransaction).not.toHaveBeenCalled();
    });

    // Defensive guard: the two records returned by `verifyChallengePreCommit`
    // MUST agree on (userId, tenantId). If they don't, we have a programmer
    // error somewhere upstream (mixed cookies, wrong DI scope) — fail loud
    // with a 401, audit `(update, user-email, failure, { token-pair-mismatch })`,
    // consume both tokens.
    it('on token-pair mismatch (different userId across sides): fails loud, consumes both, audits mismatch', async () => {
      twoFactorAuth.verifyChallengePreCommit
        .mockResolvedValueOnce(makeRecord({ userId: 42, tenantId: 7 }))
        .mockResolvedValueOnce(
          makeRecord({ userId: 999, tenantId: 7, purpose: 'email-change-new' }),
        );

      await expect(
        service.verifyChange(
          42,
          7,
          'old@example.com',
          'old-token',
          'CODEOLD',
          'new-token',
          'CODENEW',
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      // Both tokens consumed — there is no scenario where re-using mixed
      // tokens is safe.
      expect(codes.consumeChallenge).toHaveBeenCalledTimes(2);
      // No commit ran.
      expect(mockDb.tenantTransaction).not.toHaveBeenCalled();
      // The token-pair audit fires through the fire-and-forget queryAsTenant
      // path — assert via the queryAsTenant call log (skipping the uniqueness
      // pre-check which would have been called with `requestChange`, not here).
      const auditCalls = mockDb.queryAsTenant.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('audit_trail'),
      );
      expect(auditCalls).toHaveLength(1);
      const params = auditCalls[0]?.[1] as unknown[];
      const changes = JSON.parse(params[8] as string) as Record<string, unknown>;
      expect(changes).toEqual({ reason: 'token-pair-mismatch' });
      expect(params[11]).toBe('failure');
    });

    it('on token-pair mismatch (different tenantId across sides): same defensive failure', async () => {
      twoFactorAuth.verifyChallengePreCommit
        .mockResolvedValueOnce(makeRecord({ userId: 42, tenantId: 7 }))
        .mockResolvedValueOnce(
          makeRecord({ userId: 42, tenantId: 99, purpose: 'email-change-new' }),
        );

      await expect(
        service.verifyChange(
          42,
          7,
          'old@example.com',
          'old-token',
          'CODEOLD',
          'new-token',
          'CODENEW',
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(codes.consumeChallenge).toHaveBeenCalledTimes(2);
      expect(mockDb.tenantTransaction).not.toHaveBeenCalled();
    });

    // ADR-019 anchor: the commit MUST run inside `tenantTransaction` (CLS-
    // derived tenantId), not `queryAsTenant`. A regression that switches to
    // `queryAsTenant(sql, params, tenantId)` would still be RLS-correct, but
    // would skip the auto-CLS validation and could mask a missing tenantId
    // bug at higher layers. Pin the boundary contract here.
    it('uses tenantTransaction (CLS-context) for the commit, never queryAsTenant', async () => {
      armPreCommitMocks();

      await service.verifyChange(
        42,
        7,
        'old@example.com',
        'old-token',
        'CODEOLD',
        'new-token',
        'CODENEW',
      );

      // tenantTransaction is THE channel for the UPDATE+audit batch.
      expect(mockDb.tenantTransaction).toHaveBeenCalledTimes(1);
      // queryAsTenant carries no audit traffic on the happy path — the audit
      // row is written via `client.query` inside the tenantTransaction.
      const auditViaQueryAsTenant = mockDb.queryAsTenant.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('audit_trail'),
      );
      expect(auditViaQueryAsTenant).toHaveLength(0);
    });

    // The SUT comment promises: "Consume challenges only AFTER the UPDATE
    // commits — if the transaction rolls back (FK / constraint), the
    // challenges remain valid for a retry within the TTL window."
    it('does NOT consume challenges when the commit transaction throws (preserves retry within TTL)', async () => {
      armPreCommitMocks();
      mockDb.tenantTransaction.mockRejectedValueOnce(new Error('uniqueness race after pre-check'));

      await expect(
        service.verifyChange(
          42,
          7,
          'old@example.com',
          'old-token',
          'CODEOLD',
          'new-token',
          'CODENEW',
        ),
      ).rejects.toThrow();

      // Pre-commit verifies ran (both records returned), but neither token
      // was DEL'd — the user can retry the verify with the same codes inside
      // the 10-min TTL window (the verify is idempotent at the Redis layer
      // because pre-commit doesn't consume).
      expect(codes.consumeChallenge).not.toHaveBeenCalled();
    });
  });
});
