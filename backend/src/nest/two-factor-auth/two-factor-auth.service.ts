/**
 * Two-Factor Authentication — Orchestration Service.
 *
 * STATUS: Phase 2 Step 2.3 (FEAT_2FA_EMAIL_MASTERPLAN v0.6.0).
 *
 * Layer position: orchestrator that composes the lower-level primitives —
 *   - `TwoFactorCodeService` (Step 2.2) — crypto + Redis I/O
 *   - `MailerService` (legacy email-service wrapper) — SMTP transport
 *   - `DatabaseService` — audit_trail writes (no user-table writes here;
 *     callers like AuthService / SignupService update `users` after a
 *     successful verify per the §2.3 caller-responsibility list).
 *
 * Public surface (4 methods, see masterplan §2.3 method table):
 *   - issueChallenge(userId, tenantId, email, purpose) → TwoFactorChallenge
 *   - verifyChallenge(token, code)                      → user-info on success
 *   - resendChallenge(token)                            → fresh TwoFactorChallenge
 *   - clearLockoutForUser(userId, byUserId)             → 204 (admin op)
 *
 * Cross-cutting contracts encoded here:
 *   - DD-1 / DD-12: 6-char code from `CODE_ALPHABET` via `crypto.randomInt`
 *     (rejection-sampled internally → uniform distribution, no modulo bias).
 *   - DD-3: code is hashed (sha256) before persistence — plaintext never
 *     leaves the in-memory issue path, never lands in Redis or audit logs.
 *   - DD-5 / DD-6: `attemptCount` per challenge capped at MAX_ATTEMPTS;
 *     overflow triggers a 15-min user lockout + suspicious-activity mail.
 *   - DD-9: resend extends challenge TTL + resets `attemptCount` to 0; per-
 *     user fail-streak is intentionally NOT reset (see TwoFactorCodeService).
 *   - DD-13: generic mail subject — handled inside the template builder.
 *   - DD-14: SMTP failure → throw `ServiceUnavailableException`. Login: pure
 *     503; signup: caller cleans up `users + tenants` rows (anti subdomain-
 *     squatting). This service is purpose-agnostic — it does not know about
 *     user/tenant rows; the caller (SignupService) handles cleanup.
 *   - DD-20: suspicious-activity mail to user only — NEVER admins (would
 *     create user-enumeration side-channel). Sent fire-and-forget so an SMTP
 *     glitch on the paper-trail mail doesn't mask the lockout response.
 *   - DD-21: per-challenge resend cap (MAX_RESENDS_PER_CHALLENGE = 3) →
 *     `ConflictException` (HTTP 429 via Nest `ConflictException` mapping is
 *     wrong — we use `HttpException(429)` directly).
 *   - R10: timing-safe verify path even on user-not-found (dummy hash compare).
 *   - §A8 audit tuples: every state transition writes an audit_trail row via
 *     a private fire-and-forget helper (mirrors the pattern used by
 *     `audit-trail.service.ts:631 createEntry`).
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.3, §A8)
 * @see ADR-054 (drafted in Phase 6): Mandatory Email-Based 2FA.
 * @see ADR-009 Central Audit Logging — `audit_trail` schema & semantics.
 * @see ADR-019 Multi-Tenant RLS Isolation — `queryAsTenant` vs `tenantQuery`.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomInt, timingSafeEqual } from 'node:crypto';

import { MailerService } from '../common/services/mailer.service.js';
import { getErrorMessage } from '../common/utils/error.utils.js';
import { DatabaseService } from '../database/database.service.js';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  CODE_TTL_SEC,
  MAX_ATTEMPTS,
  MAX_RESENDS_PER_CHALLENGE,
  RESEND_COOLDOWN_SEC,
} from './two-factor-auth.constants.js';
import type {
  ChallengePurpose,
  ChallengeRecord,
  LoginChallengePurpose,
  TwoFactorChallenge,
} from './two-factor-auth.types.js';
import { TwoFactorCodeService } from './two-factor-code.service.js';

/** TTL in minutes for the email body — matches CODE_TTL_SEC (DD-2 = 10 min). */
const CODE_TTL_MINUTES = Math.floor(CODE_TTL_SEC / 60);

/**
 * Audit row inputs — narrow projection of `audit_trail` columns we need
 * from a service layer (no HTTP request/response context, those come from
 * the audit interceptor at the controller level).
 */
interface AuditEntry {
  tenantId: number;
  userId: number;
  /** Used as `user_name` — falls back to email when we don't have firstName/lastName cached. */
  userName: string;
  action: string;
  resourceType: string;
  resourceId: number | null;
  status: 'success' | 'failure';
  changes: Record<string, unknown>;
}

/** Dummy 32-byte buffer for the R10 timing-safe equalization on user-not-found. */
const TIMING_SAFE_DUMMY = Buffer.alloc(32);

/**
 * Resolved user info returned by a successful `verifyChallenge` (login/signup
 * flow only). Email-change purposes never reach this code path — they go
 * through `verifyChallengePreCommit` (Step 2.12, DD-32) which returns the raw
 * `ChallengeRecord` for the email-change service to commit atomically.
 */
export interface VerifyResult {
  userId: number;
  tenantId: number;
  email: string;
  purpose: LoginChallengePurpose;
}

/**
 * Login/signup are the ONLY purposes accepted by `verifyChallenge`. Email-
 * change purposes are explicitly excluded — a stolen email-change-old token
 * fed into `/auth/2fa/verify` returns a generic 401, same shape as an
 * unknown-token failure (defense-in-depth, R10 timing-safe).
 */
const LOGIN_VERIFY_PURPOSES: readonly LoginChallengePurpose[] = ['login', 'signup'];

/**
 * Audit shape for the wrong-code branch of `runVerifyMitigations`. When set,
 * the helper emits exactly one row on a wrong-code attempt:
 *
 *   `(action, resourceType, failure, { ...changesExtra, reason: 'wrong-code', attempt: N })`
 *
 * The login/signup path passes `LOGIN_WRONG_CODE_AUDIT` (per §A8 row "verify
 * fail (wrong code)"); the email-change path (Step 2.12) passes
 * `{ action: 'update', resourceType: 'user-email', changesExtra: { side } }`
 * (per §A8 row "email-change verify fail"). Omit the param to suppress
 * audit emission — used by callers that consolidate auditing higher up.
 *
 * Lockout-trigger audit (`(update, 2fa-lockout, success)`) is NOT routed
 * through this — it is shape-identical for all flows and emitted unconditionally
 * when the per-challenge attempt cap is hit.
 */
interface WrongCodeAudit {
  action: 'login' | 'update';
  resourceType: 'auth' | 'user-email';
  changesExtra?: Record<string, unknown>;
}

const LOGIN_WRONG_CODE_AUDIT: WrongCodeAudit = {
  action: 'login',
  resourceType: 'auth',
  changesExtra: {},
};

@Injectable()
export class TwoFactorAuthService {
  private readonly logger = new Logger(TwoFactorAuthService.name);

  constructor(
    private readonly codes: TwoFactorCodeService,
    private readonly mailer: MailerService,
    private readonly db: DatabaseService,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Issue a fresh challenge: generates a code, persists the hash, sends mail
   * (awaited — DD-14), audits the issuance.
   *
   * Throws `ForbiddenException` if the user is currently lock-outed.
   * Throws `ServiceUnavailableException` if SMTP transport fails — caller
   * (AuthService for login, SignupService for signup) decides downstream
   * cleanup. The challenge record is rolled back on SMTP failure to avoid
   * a "code in Redis but user got nothing" zombie state.
   */
  async issueChallenge(
    userId: number,
    tenantId: number,
    email: string,
    purpose: ChallengePurpose,
  ): Promise<TwoFactorChallenge> {
    if (await this.codes.isLocked(userId)) {
      throw new ForbiddenException('Konto ist vorübergehend gesperrt.');
    }

    const code = this.generateCode();
    const codeHash = this.codes.hashCode(userId, code, purpose);
    const now = new Date();
    const record: ChallengeRecord = {
      userId,
      tenantId,
      email,
      purpose,
      codeHash,
      attemptCount: 0,
      resendCount: 0,
      createdAt: now.toISOString(),
    };

    const token = await this.codes.createChallenge(record);

    try {
      await this.mailer.sendTwoFactorCode(email, code, purpose, CODE_TTL_MINUTES);
    } catch (error: unknown) {
      // Roll back the challenge — leaving it in Redis would let an attacker
      // brute-force a code we never delivered. The SMTP-side audit is
      // separately captured by the Mailer's logger.
      await this.codes.consumeChallenge(token);
      this.logger.error(
        `2FA email send failed for userId=${userId} purpose=${purpose}: ${getErrorMessage(error)}`,
      );
      throw new ServiceUnavailableException('Der Code konnte nicht gesendet werden.');
    }

    this.fireAudit({
      tenantId,
      userId,
      userName: email,
      action: 'create',
      resourceType: '2fa-challenge',
      resourceId: userId,
      status: 'success',
      changes: { purpose },
    });

    return this.toChallengeView(token, now, /* resendsRemaining */ MAX_RESENDS_PER_CHALLENGE);
  }

  /**
   * Verify a submitted code against the live challenge record. On success:
   * consumes the challenge (single-use), clears the per-user fail-streak,
   * emits `(login, auth, success, {method:'2fa-email'})`, returns the
   * resolved user info so the caller can mint tokens / activate the user row.
   *
   * On failure: increments per-user fail-streak; on overflow → 15-min lockout
   * + suspicious-activity mail (DD-20, fire-and-forget). All paths emit
   * audit rows per §A8.
   *
   * Generic 401 / 403 messages — never tells the client whether the user
   * exists, the code expired, or the code was simply wrong (R10).
   */
  async verifyChallenge(token: string, code: string): Promise<VerifyResult> {
    const record = await this.runVerifyMitigations(
      token,
      code,
      LOGIN_VERIFY_PURPOSES,
      LOGIN_WRONG_CODE_AUDIT,
    );

    // Success path for the login/signup flow: consume + clear fail-streak +
    // emit `(login, auth, success, {method: '2fa-email'})` audit per §A8.
    await this.handleVerifySuccess(token, record);

    // `runVerifyMitigations` validated `record.purpose ∈ LOGIN_VERIFY_PURPOSES`
    // at runtime — narrow the type for the caller. The cast is sound because
    // the helper throws if the purpose does not match.
    return {
      userId: record.userId,
      tenantId: record.tenantId,
      email: record.email,
      purpose: record.purpose as LoginChallengePurpose,
    };
  }

  /**
   * Pre-commit verify variant for multi-step flows that must verify multiple
   * challenges atomically before applying any side effect (Step 2.12 / DD-32 /
   * R15: email-change two-code verify). Same security mitigations as
   * `verifyChallenge` (lockout, fail-streak, suspicious-activity mail on
   * lockout-trigger), but does NOT consume the challenge and does NOT emit
   * the success audit — the caller orchestrates a transaction-bounded commit
   * (UPDATE + audit + `consumeChallenge`) and is responsible for emitting the
   * per-flow failure audit (e.g. `(update, user-email, failure, {side})`)
   * inside its own catch block.
   *
   * `expectedPurposes` is required: the caller MUST narrow the accepted set
   * to the purpose(s) it issued (e.g. `['email-change-old']` for the old-
   * mailbox code). A token whose purpose is not in the set is rejected with
   * the same generic 401 used for unknown / expired tokens — defense-in-
   * depth against cross-purpose token redemption.
   *
   * `wrongCodeAudit` is OPTIONAL: when provided, the wrong-code branch emits
   * a `(action, resourceType, failure, {...changesExtra, reason: 'wrong-code',
   * attempt: N})` row before throwing. Email-change passes
   * `{ action: 'update', resourceType: 'user-email', changesExtra: { side } }`
   * per §A8 row "email-change verify fail". Lockout-trigger audit
   * (`(update, 2fa-lockout, success)`) fires unconditionally — same shape for
   * every flow.
   */
  async verifyChallengePreCommit(
    token: string,
    code: string,
    expectedPurposes: readonly ChallengePurpose[],
    wrongCodeAudit?: WrongCodeAudit,
  ): Promise<ChallengeRecord> {
    return await this.runVerifyMitigations(token, code, expectedPurposes, wrongCodeAudit);
  }

  /**
   * Mark the user row as 2FA-verified — single helper for the post-verify
   * state write. Splits two cases on `purpose` (DD-11 transparent enrollment
   * + signup activation):
   *
   *   - `'login'`: stamp `last_2fa_verified_at` to NOW and (if NULL) seed
   *     `tfa_enrolled_at` so the first successful 2FA on a legacy account
   *     becomes the enrollment timestamp without an explicit migration.
   *
   *   - `'signup'`: flip `is_active` from INACTIVE (set by Step 2.5) to
   *     ACTIVE, and stamp BOTH `tfa_enrolled_at` + `last_2fa_verified_at`
   *     to NOW (always — a signup is by definition the enrollment moment).
   *
   * Why this method lives here despite Step 2.3's "no user-table writes"
   * intent: the verify success path needs ONE post-verify write, and routing
   * it through `AuthService` would force `AuthService → TwoFactorAuthService`
   * + `TwoFactorAuthService → AuthService` cycles for both edges. Keeping
   * the single write inside this service is the smallest surface that
   * preserves the orchestration boundary documented in §2.3.
   *
   * RLS: `queryAsTenant(sql, params, tenantId)` (explicit tenant) — the verify
   * controller is `@Public()`, so CLS may not yet hold a `tenantId` (the
   * tenantId we use comes from the verified `ChallengeRecord` instead).
   *
   * @see masterplan §2.5 (signup post-condition), §2.7 caller contract,
   *      DD-11 (transparent enrollment), DD-15 (column semantics), §A8.
   */
  async markVerified(
    userId: number,
    tenantId: number,
    purpose: LoginChallengePurpose,
  ): Promise<void> {
    if (purpose === 'signup') {
      await this.db.queryAsTenant(
        `UPDATE users
         SET is_active = $1,
             tfa_enrolled_at = NOW(),
             last_2fa_verified_at = NOW(),
             updated_at = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [IS_ACTIVE.ACTIVE, userId, tenantId],
        tenantId,
      );
      return;
    }
    // login: COALESCE preserves an existing enrollment timestamp; only first
    // successful 2FA on a legacy (pre-cutover) account writes it for real.
    await this.db.queryAsTenant(
      `UPDATE users
       SET last_2fa_verified_at = NOW(),
           tfa_enrolled_at = COALESCE(tfa_enrolled_at, NOW()),
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
      tenantId,
    );
  }

  /**
   * Resend: generate a NEW code on the same challenge token, reset the
   * per-challenge attemptCount to 0, increment resendCount, extend TTL back
   * to full `CODE_TTL_SEC`. Audited as `(create, 2fa-challenge, success,
   * {kind:'resend'})`.
   *
   * Caps:
   *   - DD-21: max 3 resends per challenge → 429 ConflictException when hit.
   *   - DD-9 : 60-second cooldown between resends → 429 when on cooldown.
   *
   * Does NOT reset the per-user fail-streak (DD-9 is explicit on this).
   */
  async resendChallenge(token: string): Promise<TwoFactorChallenge> {
    const record = await this.codes.loadChallenge(token);
    if (record === null) {
      throw new UnauthorizedException('Ungültige oder abgelaufene Challenge.');
    }

    if (record.resendCount >= MAX_RESENDS_PER_CHALLENGE) {
      // Convey "session is spent, restart" via 429 (Too Many Requests). The
      // frontend is expected to redirect back to /login on this code.
      throw new HttpException(
        'Zu viele Code-Anforderungen. Bitte starten Sie den Login erneut.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (await this.codes.isResendOnCooldown(token)) {
      throw new HttpException(
        'Bitte warten Sie kurz, bevor Sie einen neuen Code anfordern.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const newCode = this.generateCode();
    const newHash = this.codes.hashCode(record.userId, newCode, record.purpose);
    const updated: ChallengeRecord = {
      ...record,
      codeHash: newHash,
      attemptCount: 0,
      resendCount: record.resendCount + 1,
    };
    await this.codes.updateChallenge(token, updated, /* extendTtl */ true);
    await this.codes.setResendCooldown(token);

    try {
      await this.mailer.sendTwoFactorCode(record.email, newCode, record.purpose, CODE_TTL_MINUTES);
    } catch (error: unknown) {
      // On resend failure we DO leave the previous-but-now-overwritten record
      // in place — the original code is gone (we just hashed over it) and
      // restoring it is impossible. Caller surfaces 503; user can retry.
      this.logger.error(
        `2FA resend email failed for userId=${record.userId}: ${getErrorMessage(error)}`,
      );
      throw new ServiceUnavailableException('Der Code konnte nicht gesendet werden.');
    }

    this.fireAudit({
      tenantId: record.tenantId,
      userId: record.userId,
      userName: record.email,
      action: 'create',
      resourceType: '2fa-challenge',
      resourceId: record.userId,
      status: 'success',
      changes: { purpose: record.purpose, kind: 'resend' },
    });

    const issuedAt = new Date();
    return this.toChallengeView(token, issuedAt, MAX_RESENDS_PER_CHALLENGE - updated.resendCount);
  }

  /**
   * Clear a 15-min lockout (DD-8). Called by the root-only
   * `POST /users/:id/2fa/clear-lockout` controller — Two-Root rule check
   * `byUserId !== userId` is enforced here (caller-role check is enforced
   * at the controller level via `@Roles('root')`).
   *
   * **NOT a 2FA bypass** — only resets the lockout key + fail-streak. The
   * user must still pass a fresh challenge on the next login attempt.
   */
  async clearLockoutForUser(userId: number, byUserId: number, tenantId: number): Promise<void> {
    if (userId === byUserId) {
      // Two-Root rule: a root cannot clear their OWN lockout (would defeat
      // the rate-limit). Caller must be a different root.
      throw new ForbiddenException(
        'Sperrungen können nicht von der gesperrten Person selbst aufgehoben werden.',
      );
    }

    await this.codes.clearLockout(userId);
    await this.codes.clearFailStreak(userId);

    this.fireAudit({
      tenantId,
      userId: byUserId,
      userName: `root-userId=${byUserId}`,
      action: 'delete',
      resourceType: '2fa-lockout',
      resourceId: userId,
      status: 'success',
      changes: { clearedBy: byUserId, target: userId },
    });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * 6-char Crockford-Base32-subset code (DD-1). `crypto.randomInt(0, 31)`
   * rejection-samples internally, so the resulting alphabet distribution is
   * uniform — no modulo bias.
   */
  private generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)] ?? '';
    }
    return code;
  }

  private async handleVerifySuccess(token: string, record: ChallengeRecord): Promise<void> {
    await this.codes.consumeChallenge(token);
    await this.codes.clearFailStreak(record.userId);
    this.fireAudit({
      tenantId: record.tenantId,
      userId: record.userId,
      userName: record.email,
      action: 'login',
      resourceType: 'auth',
      resourceId: record.userId,
      status: 'success',
      changes: { method: '2fa-email', purpose: record.purpose },
    });
  }

  /**
   * Common verify entry point. Both `verifyChallenge` (login/signup) and
   * `verifyChallengePreCommit` (email-change two-code, Step 2.12) route
   * through here so the security mitigations (lockout, fail-streak,
   * suspicious-activity mail, cross-purpose rejection) live in exactly one
   * place. Variation is parameterised:
   *
   *   - `expectedPurposes` narrows the accepted set; tokens issued for any
   *     other purpose are rejected with the same generic 401 used for
   *     unknown / expired tokens (R10 timing-safe).
   *   - `wrongCodeAudit` (optional) controls per-flow failure-row shape — see
   *     the `WrongCodeAudit` interface above.
   *
   * On success: returns the live `ChallengeRecord` WITHOUT consuming. Caller
   * is responsible for `consumeChallenge` + the per-flow success audit (this
   * keeps the email-change atomic-commit semantics clean — both codes verify
   * before either is consumed).
   */
  private async runVerifyMitigations(
    token: string,
    code: string,
    expectedPurposes: readonly ChallengePurpose[],
    wrongCodeAudit?: WrongCodeAudit,
  ): Promise<ChallengeRecord> {
    const record = await this.codes.loadChallenge(token);
    if (record === null) {
      // R10: dummy `timingSafeEqual` keeps the user-not-found path's response
      // duration in the same ballpark as the user-found path. The boolean
      // result is intentionally discarded via `void`.
      void timingSafeEqual(TIMING_SAFE_DUMMY, TIMING_SAFE_DUMMY);
      throw new UnauthorizedException('Ungültiger oder abgelaufener Code.');
    }

    // Defense-in-depth (Step 2.12 / DD-32): cross-purpose token redemption is
    // rejected with the same generic 401. Without this, a stolen email-change
    // token could be fed into `/auth/2fa/verify` and inadvertently authenticate.
    if (!expectedPurposes.includes(record.purpose)) {
      void timingSafeEqual(TIMING_SAFE_DUMMY, TIMING_SAFE_DUMMY);
      throw new UnauthorizedException('Ungültiger oder abgelaufener Code.');
    }

    if (await this.codes.isLocked(record.userId)) {
      throw new ForbiddenException('Konto ist vorübergehend gesperrt.');
    }

    if (this.codes.verifyCode(record, code)) {
      return record;
    }

    await this.applyWrongCodeMitigations(token, record, wrongCodeAudit);
    throw new UnauthorizedException('Ungültiger oder abgelaufener Code.');
  }

  /**
   * Wrong-code mitigations (extracted from the previous `handleVerifyFailure`).
   * Three things happen, in order:
   *   1. Per-challenge `attemptCount` is incremented (KEEPTTL — does NOT
   *      extend the original 10-min TTL).
   *   2. Per-user fail-streak is incremented (24 h rolling, anchored to
   *      first failure — see TwoFactorCodeService.incrementFailStreak).
   *   3. If `wrongCodeAudit` is provided, emit the per-flow failure row
   *      (`(action, resourceType, failure, {...changesExtra, reason: 'wrong-code',
   *      attempt: N})`).
   *   4. If the per-challenge cap is hit, set a 15-min lockout, audit it as
   *      `(update, 2fa-lockout, success)` (shape-identical for every flow),
   *      consume the challenge (terminal), and fire-and-forget the
   *      suspicious-activity mail (DD-20).
   */
  private async applyWrongCodeMitigations(
    token: string,
    record: ChallengeRecord,
    wrongCodeAudit?: WrongCodeAudit,
  ): Promise<void> {
    const newAttemptCount = record.attemptCount + 1;
    const updated: ChallengeRecord = { ...record, attemptCount: newAttemptCount };
    await this.codes.updateChallenge(token, updated, /* extendTtl */ false);
    await this.codes.incrementFailStreak(record.userId);

    if (wrongCodeAudit !== undefined) {
      this.fireAudit({
        tenantId: record.tenantId,
        userId: record.userId,
        userName: record.email,
        action: wrongCodeAudit.action,
        resourceType: wrongCodeAudit.resourceType,
        resourceId: record.userId,
        status: 'failure',
        changes: {
          ...wrongCodeAudit.changesExtra,
          reason: 'wrong-code',
          attempt: newAttemptCount,
        },
      });
    }

    if (newAttemptCount >= MAX_ATTEMPTS) {
      await this.codes.setLockout(record.userId);
      await this.codes.consumeChallenge(token);
      this.fireAudit({
        tenantId: record.tenantId,
        userId: record.userId,
        userName: record.email,
        action: 'update',
        resourceType: '2fa-lockout',
        resourceId: record.userId,
        status: 'success',
        changes: { reason: 'max-attempts' },
      });
      // Fire-and-forget: the paper-trail mail must NOT block the response.
      // MailerService internally swallows transport failures (DD-20 silent),
      // so this `void` only discards the resolved promise.
      void this.mailer.sendTwoFactorSuspiciousActivity(record.email);
    }
  }

  /**
   * Convert an internal challenge record to the public-facing view returned
   * to the controller. The token itself is included so the controller can
   * set the httpOnly cookie; the controller MUST strip it before responding
   * (R8 — token never in response body).
   */
  private toChallengeView(
    token: string,
    issuedAt: Date,
    resendsRemaining: number,
  ): TwoFactorChallenge {
    const expiresAt = new Date(issuedAt.getTime() + CODE_TTL_SEC * 1000);
    const resendAvailableAt = new Date(issuedAt.getTime() + RESEND_COOLDOWN_SEC * 1000);
    return {
      challengeToken: token,
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
      resendsRemaining,
    };
  }

  /**
   * Fire-and-forget audit row — never throws, never blocks the caller.
   * Mirrors the pattern in `audit-trail.service.ts:631 createEntry`.
   *
   * Uses `queryAsTenant` (explicit tenantId) instead of `tenantQuery` (CLS-
   * derived) because verify/resend run in `@Public()` controller paths
   * where CLS may not yet hold a tenantId — we always know the tenantId
   * from the challenge record or the caller's args, so explicit is safer.
   */
  private fireAudit(entry: AuditEntry): void {
    const sql = `INSERT INTO audit_trail (
        tenant_id, user_id, user_name, user_role,
        action, resource_type, resource_id, resource_name,
        changes, ip_address, user_agent, status, error_message, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`;
    const params = [
      entry.tenantId,
      entry.userId,
      entry.userName,
      null,
      entry.action,
      entry.resourceType,
      entry.resourceId,
      null,
      JSON.stringify(entry.changes),
      null,
      null,
      entry.status,
      null,
    ];

    void this.db.queryAsTenant(sql, params, entry.tenantId).catch((error: unknown) => {
      this.logger.warn(
        `Failed to write 2FA audit row (action=${entry.action} resource=${entry.resourceType}): ${getErrorMessage(error)}`,
      );
    });
  }
}
