/**
 * Email-Change Service — atomic two-code 2FA-verified UPDATE of `users.email`.
 *
 * STATUS: FEAT_2FA_EMAIL_MASTERPLAN Phase 2 §2.12 (v0.6.0, DD-32 / R15).
 *
 * WHY this exists as a dedicated service (vs. extending `UserProfileService`):
 *   `UserProfileService.updateProfile` is a plain field-map of self-editable
 *   profile attributes (firstName/lastName/phone/address/emergencyContact/
 *   employeeNumber). `email` is intentionally absent from that map — email is
 *   a hard identifier (login key, 2FA destination, audit subject) and changing
 *   it is a security event with its own state machine: two challenges issued
 *   in parallel, both Redis-side TTL-bound, both must verify atomically before
 *   the UPDATE commits, anti-persistence DEL on any failure, suspicious-
 *   activity mail on the old address. Folding this into `UserProfileService`
 *   would inflate that file past its responsibility line and the
 *   `max-classes-per-file: 1` rule forces a controller split anyway.
 *
 * THREAT MODEL (R15): without this gate a session-hijacker (XSS, stolen
 * cookie, open laptop, insider) can pivot any session into a permanent
 * account takeover by changing the registered mail to one they control —
 * every future 2FA code then goes to the attacker.
 *
 * MITIGATION (DD-32): two-code verify, atomic. Attacker needs simultaneous
 * read access to BOTH the current AND the prospective mailbox within one
 * 10-min challenge window — the bar moves from "one stolen session" to
 * "controls two unrelated mailboxes plus one stolen session", which
 * collapses the practical threat to insider + own-mailbox-ready scenarios
 * (still dangerous, but materially smaller).
 *
 * SELF-HEAL: a typo in the new address means no code arrives there → verify
 * fails with side='new' → no UPDATE → the user's old mailbox keeps working.
 * This is the inverse of the legacy "blind UPDATE" failure mode.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.12, DD-32, R15, §A8)
 * @see ADR-005 Authentication Strategy.
 * @see ADR-019 Multi-Tenant RLS Isolation — `tenantTransaction`/`queryAsTenant` rules.
 * @see ADR-054 (drafted in Phase 6): Mandatory Email-Based 2FA.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';

import { MailerService } from '../common/services/mailer.service.js';
import { getErrorMessage } from '../common/utils/error.utils.js';
import { DatabaseService } from '../database/database.service.js';
import { TwoFactorAuthService } from '../two-factor-auth/two-factor-auth.service.js';
import type {
  ChallengePurpose,
  TwoFactorChallenge,
} from '../two-factor-auth/two-factor-auth.types.js';
import { TwoFactorCodeService } from '../two-factor-auth/two-factor-code.service.js';

/** Single-purpose audit-row inputs (mirrors TwoFactorAuthService.AuditEntry). */
interface AuditEntry {
  tenantId: number;
  userId: number;
  userName: string;
  action: 'create' | 'update';
  resourceType: '2fa-challenge' | 'user-email';
  resourceId: number;
  status: 'success' | 'failure';
  changes: Record<string, unknown>;
}

/** Public response of `requestChange` — both challenges share TTL semantics. */
export interface EmailChangeRequestResult {
  oldChallenge: TwoFactorChallenge;
  newChallenge: TwoFactorChallenge;
}

/**
 * Audit shape passed to `verifyChallengePreCommit` for each side. The wrong-
 * code audit row at the 2FA layer is `(update, user-email, failure, {
 * side: 'old'|'new', reason: 'wrong-code', attempt: N })` per §A8.
 */
const OLD_SIDE_AUDIT = {
  action: 'update' as const,
  resourceType: 'user-email' as const,
  changesExtra: { side: 'old' as const },
};
const NEW_SIDE_AUDIT = {
  action: 'update' as const,
  resourceType: 'user-email' as const,
  changesExtra: { side: 'new' as const },
};

const OLD_PURPOSES: readonly ChallengePurpose[] = ['email-change-old'];
const NEW_PURPOSES: readonly ChallengePurpose[] = ['email-change-new'];

@Injectable()
export class EmailChangeService {
  private readonly logger = new Logger(EmailChangeService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly twoFactorAuth: TwoFactorAuthService,
    private readonly twoFactorCodes: TwoFactorCodeService,
    private readonly mailer: MailerService,
  ) {}

  /**
   * Step 1: issue TWO challenges — one to the user's current address, one to
   * the prospective new address. Both are full TwoFactorAuthService
   * challenges (same TTL/lockout/fail-streak protections as login codes).
   *
   * Pre-checks (all inside one read-then-issue path; no transaction needed
   * because no writes hit the `users` table):
   *   - newEmail !== currentEmail (case-insensitive — `EmailSchema` already
   *     lower-cases at the DTO layer; defensive comparison still here).
   *   - newEmail not already in use within the same tenant — soft-check
   *     before issuing the second challenge so we don't spam an attacker's
   *     mailbox confirming "yes, this email exists in the system" (DD-20-
   *     adjacent reasoning).
   *
   * On SMTP failure for EITHER mail, a `ServiceUnavailableException` is
   * thrown by `issueChallenge`. We do NOT do anti-persistence DEL on the
   * other side here — at this point only ONE challenge has been issued (we
   * issue old → then new) so there's no "other side" to clean up. The 10-min
   * Redis TTL handles the orphan if the user closes the tab.
   */
  async requestChange(
    userId: number,
    tenantId: number,
    currentEmail: string,
    newEmail: string,
  ): Promise<EmailChangeRequestResult> {
    if (newEmail === currentEmail) {
      throw new BadRequestException(
        'Die neue E-Mail-Adresse entspricht der aktuellen — keine Änderung notwendig.',
      );
    }

    const existing = await this.db.queryAsTenant<{ id: number }>(
      'SELECT id FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1',
      [newEmail, tenantId],
      tenantId,
    );
    if (existing.length > 0) {
      // Same generic shape used by `users.service.ts` for admin-edits — caller
      // sees the conflict-vs-bad-request distinction the same way.
      throw new ConflictException('Diese E-Mail-Adresse ist bereits vergeben.');
    }

    // Old-side challenge first — if SMTP for the user's current mailbox is
    // broken we want to fail loud BEFORE potentially mailing an attacker's
    // address with a code (anti subdomain-squatting-adjacent reasoning).
    const oldChallenge = await this.twoFactorAuth.issueChallenge(
      userId,
      tenantId,
      currentEmail,
      'email-change-old',
    );
    const newChallenge = await this.twoFactorAuth.issueChallenge(
      userId,
      tenantId,
      newEmail,
      'email-change-new',
    );

    return { oldChallenge, newChallenge };
  }

  /**
   * Step 2: atomic two-code commit. ALL three of these run inside ONE
   * `tenantTransaction()`:
   *
   *   1. `verifyChallengePreCommit` for OLD side — confirms ownership of the
   *      current mailbox (defense against in-session takeover).
   *   2. `verifyChallengePreCommit` for NEW side — confirms the prospective
   *      address is real and reachable by the user.
   *   3. `UPDATE users SET email = $newEmail` + audit row.
   *
   * On any verify failure: we catch, DEL both challenges (anti-persistence —
   * an attacker who happens to crack one code cannot retry while keeping the
   * other alive), fire-and-forget a suspicious-activity mail to the OLD
   * address (DD-20-style notification), audit `(update, user-email, failure,
   * { side })`, and re-throw a generic 401. The `tenantTransaction` rolls
   * back automatically because the throw escapes the callback.
   *
   * On success: consume both challenges (single-use), audit `(update,
   * user-email, success, { oldEmail, newEmail })`. The `users.email` UPDATE
   * is the only `users`-table write — no permission/role re-evaluation, no
   * session invalidation in V1 (the user's existing access token is still
   * valid; this is intentional — a user changing their own email mid-session
   * is the happy path, not a takeover signal).
   */
  async verifyChange(
    userId: number,
    tenantId: number,
    currentEmail: string,
    oldToken: string,
    codeOld: string,
    newToken: string,
    codeNew: string,
  ): Promise<{ oldEmail: string; newEmail: string }> {
    // Verify old-side first. If this throws, the helper has already audited
    // `(update, user-email, failure, { side: 'old' })` AND DEL'd the old
    // challenge (the lockout-trigger path consumes too). We still need to DEL
    // the new-side challenge for anti-persistence — see catch block.
    let oldRecord;
    try {
      oldRecord = await this.twoFactorAuth.verifyChallengePreCommit(
        oldToken,
        codeOld,
        OLD_PURPOSES,
        OLD_SIDE_AUDIT,
      );
    } catch (error: unknown) {
      await this.cleanupOnFailure(newToken, oldToken, currentEmail, 'old', error);
      throw error;
    }

    let newRecord;
    try {
      newRecord = await this.twoFactorAuth.verifyChallengePreCommit(
        newToken,
        codeNew,
        NEW_PURPOSES,
        NEW_SIDE_AUDIT,
      );
    } catch (error: unknown) {
      await this.cleanupOnFailure(oldToken, newToken, currentEmail, 'new', error);
      throw error;
    }

    // Sanity guard — `verifyChallengePreCommit` already validates purpose +
    // ownership (userId/tenantId match), but the pair MUST agree. If they
    // don't, we have a programming error somewhere upstream (mixed cookies?)
    // — fail loud, do NOT commit.
    if (oldRecord.userId !== newRecord.userId || oldRecord.tenantId !== newRecord.tenantId) {
      // Anti-persistence + audit failure as well-formed authentication failure.
      await this.twoFactorCodes.consumeChallenge(oldToken);
      await this.twoFactorCodes.consumeChallenge(newToken);
      this.fireAudit({
        tenantId,
        userId,
        userName: currentEmail,
        action: 'update',
        resourceType: 'user-email',
        resourceId: userId,
        status: 'failure',
        changes: { reason: 'token-pair-mismatch' },
      });
      throw new UnauthorizedException('Ungültige oder abgelaufene Codes.');
    }

    const newEmail = newRecord.email;

    // Atomic commit — UPDATE + audit row inside one transaction. RLS-protected
    // (`tenantTransaction` injects `app.tenant_id` per ADR-019) so even a
    // misdirected userId cannot cross-tenant overwrite.
    await this.db.tenantTransaction(async (client: PoolClient) => {
      await this.commitEmailChange(client, userId, tenantId, currentEmail, newEmail);
    });

    // Consume challenges only AFTER the UPDATE commits — if the transaction
    // rolls back (FK / constraint), the challenges remain valid for a retry
    // within the TTL window. (In practice no constraint can fail here:
    // uniqueness was checked at request-time, RLS is satisfied by tenantId.)
    await this.twoFactorCodes.consumeChallenge(oldToken);
    await this.twoFactorCodes.consumeChallenge(newToken);

    return { oldEmail: currentEmail, newEmail };
  }

  /**
   * Atomic UPDATE + audit row inside a single tenantTransaction. Extracted
   * from `verifyChange` so the orchestrator stays under the 60-line per-
   * function ceiling. RLS-protected via `tenantTransaction` (ADR-019).
   */
  private async commitEmailChange(
    client: PoolClient,
    userId: number,
    tenantId: number,
    currentEmail: string,
    newEmail: string,
  ): Promise<void> {
    await client.query(
      `UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [newEmail, userId, tenantId],
    );
    await client.query(
      `INSERT INTO audit_trail (
        tenant_id, user_id, user_name, user_role,
        action, resource_type, resource_id, resource_name,
        changes, ip_address, user_agent, status, error_message, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
      [
        tenantId,
        userId,
        currentEmail,
        null,
        'update',
        'user-email',
        userId,
        null,
        JSON.stringify({ oldEmail: currentEmail, newEmail }),
        null,
        null,
        'success',
        null,
      ],
    );
  }

  /**
   * Anti-persistence cleanup on any verify failure. DEL the OTHER side's
   * challenge so an attacker cracking one code cannot retry while keeping
   * the still-valid one alive. Also send suspicious-activity mail to the
   * OLD address (DD-20-style) — the legitimate user learns "someone tried
   * to change my email" without learning the attempted new address (no
   * side-channel for enumeration).
   *
   * `otherSideToken` is the token to DEL (the side we never reached or the
   * side that failed wasn't yet consumed). The failed side may already be
   * DEL'd by the helper's lockout path — `consumeChallenge` is idempotent.
   *
   * Best-effort: the original verify error is what we re-throw; cleanup
   * failure is logged-and-swallowed so a Redis blip doesn't mask the
   * underlying authentication failure.
   */
  private async cleanupOnFailure(
    otherSideToken: string,
    failedSideToken: string,
    currentEmail: string,
    side: 'old' | 'new',
    originalError: unknown,
  ): Promise<void> {
    try {
      await this.twoFactorCodes.consumeChallenge(otherSideToken);
      // The failed side may have been consumed by the lockout path inside
      // applyWrongCodeMitigations — DEL is idempotent, so this is safe.
      await this.twoFactorCodes.consumeChallenge(failedSideToken);
    } catch (cleanupError: unknown) {
      this.logger.warn(
        `Email-change cleanup failed (side=${side}, original=${getErrorMessage(originalError)}): ${getErrorMessage(cleanupError)}`,
      );
    }
    // Suspicious-activity notification to the user's CURRENT address — the
    // mailbox the legitimate user definitely controls (defense against an
    // attacker who triggers a failed change attempt to phish the new mailbox).
    void this.mailer.sendTwoFactorSuspiciousActivity(currentEmail);
  }

  /**
   * Fire-and-forget audit emission — same shape as
   * `TwoFactorAuthService.fireAudit`. Used only for the rare token-pair-
   * mismatch defensive path; success/failure rows for the main flow live in
   * `verifyChange` (success: inside the tenantTransaction) and
   * `verifyChallengePreCommit` (failure: emitted by the 2FA layer).
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
        `Failed to write email-change audit row (action=${entry.action}): ${getErrorMessage(error)}`,
      );
    });
  }
}
