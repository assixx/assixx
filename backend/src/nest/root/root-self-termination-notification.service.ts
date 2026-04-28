/**
 * Root Self-Termination Notification Service — Step 2.7 + Phase 8 of
 * FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md.
 *
 * Owns notification fan-out for the 3 user-facing self-termination
 * lifecycle events:
 *   - Requested → peer roots (requester excluded)
 *   - Approved  → requester + peer roots (approver excluded — they
 *                 performed the action)
 *   - Rejected  → requester only (with reason + 24h cooldown timestamp)
 *
 * Each method does THREE things, in order:
 *   1. Synchronous typed `eventBus.emit*()` — immediate SSE delivery to
 *      connected clients (ADR-003)
 *   2. Persistent `INSERT INTO notifications` rows for sidebar badge
 *      counts and unread tracking (ADR-004)
 *   3. Branded email send via the legacy `email-service.ts` transport
 *      (best-effort — failure logged + swallowed; persistent row is the
 *      compliance-trail source of truth).
 *
 * Email transport calls `emailService.loadBrandedTemplate()` +
 * `emailService.sendEmail()` directly, NOT through `MailerService`.
 * Rationale: the MailerService DI wrapper became a cross-domain god
 * object (auth, feedback, root, …). Per the same logic that put SSE +
 * persistent INSERT here (Spec Deviation D7 — co-locate per-domain
 * fan-out with the producer), the email send for this domain belongs
 * here too. See `docs/REFACTOR_MAILER_SERVICE_GOD_OBJECT.md`.
 *
 * Public methods are wrapped in a top-level try/catch that NEVER throws
 * — notification is secondary to the business operation. The producer
 * (`RootSelfTerminationService`) calls these methods AFTER the business
 * `tenantTransaction` commits, with `void` (fire-and-forget) so HTTP
 * latency is unaffected by the fan-out.
 *
 * § Spec Deviation D7 (masterplan §2.7):
 * The masterplan literal-text says "modify `notifications.service.ts`
 * — handlers fan out to all OTHER active roots in tenant". The actual
 * implementation lives in this domain-specific service co-located with
 * the producer, following the established repo convention:
 *   - `vacation/vacation-notification.service.ts`
 *   - `work-orders/work-orders-notification.service.ts`
 *   - `tpm/tpm-notification.service.ts`
 * `notifications.service.ts` is intentionally domain-agnostic (CRUD
 * only) — concentrating per-domain handler logic there would create a
 * god object that knows about every feature. This deviation is a "where
 * the handlers live" clarification, NOT a behavioral change vs. §2.7.
 *
 * Recipient resolution uses `tenantQuery` / `tenantQueryOne` (RLS-
 * filtered via CLS context). The producer always calls from inside an
 * authenticated HTTP request handler, so cross-tenant leakage is
 * structurally impossible (ADR-019).
 *
 * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §2.7
 * @see docs/infrastructure/adr/ADR-003-notification-system.md (SSE)
 * @see docs/infrastructure/adr/ADR-004-persistent-notification-counts.md
 * @see backend/src/nest/vacation/vacation-notification.service.ts (gold-standard sibling)
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { Injectable, Logger } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import emailService from '../../utils/email-service.js';
import { eventBus } from '../../utils/event-bus.js';
import { getErrorMessage } from '../common/utils/error.utils.js';
import { DatabaseService } from '../database/database.service.js';

/**
 * 24h cooldown after rejection (mirrors `RootSelfTerminationService.COOLDOWN_MS`
 * — duplicated rather than imported to avoid producer→notification cyclic dep).
 * Single source of truth for the value lives in the masterplan §0.2 R3 / R7.
 */
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Persistent-row notification `type` discriminator (free-form VARCHAR(50)). */
const NOTIFICATION_TYPE = 'root_self_termination';

/**
 * Fallback when `APP_URL` is unset — every send method reads it lazily so a
 * deploy-time env-var swap never requires a rebuild. Mirrors the same
 * constant in `MailerService` (kept duplicated rather than exported to
 * avoid cross-domain imports — KISS, ~5 LOC duplication).
 */
const DEFAULT_APP_URL = 'http://localhost:5173';

/**
 * Generic placeholder for the `result.error` field when the underlying
 * Nodemailer call resolved with `success=false` but no error message.
 */
const UNKNOWN_ERROR = 'unknown error';

interface UserNameRow {
  id: number;
  first_name: string | null;
  last_name: string | null;
}

/**
 * Full per-user details — id + email + names — needed for the email fan-out
 * (Phase 8). Persisted-notification path only needs the id; the email path
 * needs email + name so the branded `notification.html` template can address
 * the recipient personally. Single SELECT instead of one-per-recipient
 * round-trip keeps the request → fan-out latency unchanged from Session 6.
 */
interface UserDetailsRow {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

@Injectable()
export class RootSelfTerminationNotificationService {
  private readonly logger = new Logger(RootSelfTerminationNotificationService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Notify peer roots that a new self-termination request was created.
   * Recipients: every active root in the tenant EXCEPT the requester.
   * Priority `high` because peer roots have a 7-day TTL to act.
   */
  async notifyRequested(params: {
    tenantId: number;
    requesterId: number;
    requestId: string;
    expiresAt: string; // ISO 8601
  }): Promise<void> {
    try {
      const requesterName = await this.resolveUserName(params.requesterId);
      const peers = await this.findPeerRoots(params.tenantId, [params.requesterId]);

      eventBus.emitRootSelfTerminationRequested(
        params.tenantId,
        { id: params.requestId, requesterId: params.requesterId, requesterName },
        params.expiresAt,
      );

      const message = `${requesterName} möchte sein/ihr Root-Konto löschen. Genehmigung erforderlich.`;
      for (const peer of peers) {
        await this.insertPersistentNotification({
          tenantId: params.tenantId,
          recipientId: peer.id,
          title: 'Root-Konto-Löschung beantragt',
          message,
          priority: 'high',
          createdBy: params.requesterId,
          requestId: params.requestId,
          actionUrl: '/manage-approvals',
          actionLabel: 'Antrag prüfen',
        });
        // Phase 8: best-effort email — failure logged + swallowed inside
        // sendRequestedEmail; persistent notification + sidebar badge are
        // the source of truth for the compliance trail.
        await this.sendRequestedEmail(
          { email: peer.email, firstName: peer.first_name, lastName: peer.last_name },
          requesterName,
          params.expiresAt,
        );
      }
    } catch (error: unknown) {
      this.logger.error(`notifyRequested fan-out failed: ${String(error)}`);
    }
  }

  /**
   * Notify the just-terminated requester + active peer roots that the
   * self-termination was approved + executed. Approver is excluded
   * (they performed the action themselves and have implicit context).
   * The requester row already has `is_active=4` by this point — the
   * persistent INSERT still happens for compliance trail (FK on
   * `notifications.recipient_id` does not exist, so no constraint
   * violation).
   */
  async notifyApproved(params: {
    tenantId: number;
    requesterId: number;
    requestId: string;
    approverId: number;
    comment: string | null;
  }): Promise<void> {
    try {
      const requesterDetails = await this.resolveUserDetails(params.requesterId);
      const approverDetails = await this.resolveUserDetails(params.approverId);
      const requesterName = this.formatName(requesterDetails, params.requesterId);
      const approverName = this.formatName(approverDetails, params.approverId);
      // Active peers excluding both approver and requester (the latter
      // is is_active=4 by now anyway — but explicit filter is defensive).
      const peers = await this.findPeerRoots(params.tenantId, [
        params.approverId,
        params.requesterId,
      ]);

      eventBus.emitRootSelfTerminationApproved(
        params.tenantId,
        { id: params.requestId, requesterId: params.requesterId, requesterName },
        params.approverId,
        approverName,
        params.comment,
      );

      const message = `Konto von ${requesterName} wurde gelöscht (genehmigt von ${approverName}).`;
      // Build full recipient list incl. requester (their row is is_active=4
      // by now, but the persistent INSERT + email still go out for the
      // compliance paper-trail). `requesterDetails` may be null if the row
      // got hard-deleted between the approve TX and now — defensive guard.
      const fanout: UserDetailsRow[] = [...peers];
      if (requesterDetails !== null) fanout.unshift(requesterDetails);

      for (const recipient of fanout) {
        await this.insertPersistentNotification({
          tenantId: params.tenantId,
          recipientId: recipient.id,
          title: 'Root-Konto-Löschung genehmigt',
          message,
          priority: 'normal',
          createdBy: params.approverId,
          requestId: params.requestId,
          actionUrl: '/manage-approvals',
          actionLabel: 'Details ansehen',
        });
        // Phase 8: best-effort email per recipient.
        await this.sendApprovedEmail(
          {
            email: recipient.email,
            firstName: recipient.first_name,
            lastName: recipient.last_name,
          },
          requesterName,
          approverName,
          params.comment,
        );
      }
    } catch (error: unknown) {
      this.logger.error(`notifyApproved fan-out failed: ${String(error)}`);
    }
  }

  /**
   * Notify the requester that their request was rejected. Single
   * recipient — the rejector already has the context, peer roots are
   * not involved in this notification per §2.7. Body includes the
   * rejection reason + cooldown end (24h after `rejectedAt`) so the
   * requester knows when re-request becomes eligible.
   */
  async notifyRejected(params: {
    tenantId: number;
    requesterId: number;
    requestId: string;
    approverId: number;
    rejectionReason: string;
    rejectedAt: Date;
  }): Promise<void> {
    try {
      const requesterDetails = await this.resolveUserDetails(params.requesterId);
      const requesterName = this.formatName(requesterDetails, params.requesterId);
      const approverName = await this.resolveUserName(params.approverId);
      const cooldownEndsAt = new Date(params.rejectedAt.getTime() + COOLDOWN_MS).toISOString();

      eventBus.emitRootSelfTerminationRejected(
        params.tenantId,
        { id: params.requestId, requesterId: params.requesterId, requesterName },
        params.approverId,
        approverName,
        params.rejectionReason,
        cooldownEndsAt,
      );

      await this.insertPersistentNotification({
        tenantId: params.tenantId,
        recipientId: params.requesterId,
        title: 'Root-Konto-Löschung abgelehnt',
        message: `Antrag wurde abgelehnt. Grund: ${params.rejectionReason}. Erneuter Antrag in 24h möglich.`,
        priority: 'normal',
        createdBy: params.approverId,
        requestId: params.requestId,
        actionUrl: '/root-profile',
        actionLabel: 'Profil ansehen',
      });

      // Phase 8: best-effort email to the requester (single recipient
      // per §2.7 — peer roots already have the in-app card decision).
      if (requesterDetails !== null) {
        await this.sendRejectedEmail(
          {
            email: requesterDetails.email,
            firstName: requesterDetails.first_name,
            lastName: requesterDetails.last_name,
          },
          approverName,
          params.rejectionReason,
          cooldownEndsAt,
        );
      }
    } catch (error: unknown) {
      this.logger.error(`notifyRejected fan-out failed: ${String(error)}`);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────

  /**
   * Resolve a user's display name to "First Last", falling back to
   * "Benutzer #<id>" when the row is missing (e.g., already hard-deleted)
   * or when both name parts are null/empty. Defensive — notifications
   * must work for soft-deleted (is_active=4) users for the compliance
   * trail.
   */
  private async resolveUserName(userId: number): Promise<string> {
    const row = await this.db.tenantQueryOne<UserNameRow>(
      `SELECT id, first_name, last_name FROM users WHERE id = $1`,
      [userId],
    );
    if (row === null) return `Benutzer #${userId}`;
    const first = row.first_name?.trim() ?? '';
    const last = row.last_name?.trim() ?? '';
    const full = `${first} ${last}`.trim();
    return full === '' ? `Benutzer #${userId}` : full;
  }

  /**
   * Return all active root users in the tenant excluding the given IDs.
   * RLS filters by tenant via the CLS-set `app.tenant_id` GUC; the
   * `tenant_id = $1` predicate is defensive (matches the RLS filter).
   * The IN-clause is built from a small, caller-controlled integer list
   * (≤2 entries today) — no SQL injection surface.
   *
   * Phase 8: also returns `email` + names so the email fan-out path
   * doesn't need a second SELECT round-trip per recipient.
   */
  private async findPeerRoots(
    tenantId: number,
    excludeIds: readonly number[],
  ): Promise<UserDetailsRow[]> {
    if (excludeIds.length === 0) {
      return await this.db.tenantQuery<UserDetailsRow>(
        `SELECT id, email, first_name, last_name FROM users
         WHERE tenant_id = $1 AND role = 'root' AND is_active = $2`,
        [tenantId, IS_ACTIVE.ACTIVE],
      );
    }
    const placeholders = excludeIds.map((_: number, i: number) => `$${i + 3}`).join(', ');
    return await this.db.tenantQuery<UserDetailsRow>(
      `SELECT id, email, first_name, last_name FROM users
       WHERE tenant_id = $1 AND role = 'root' AND is_active = $2
         AND id NOT IN (${placeholders})`,
      [tenantId, IS_ACTIVE.ACTIVE, ...excludeIds],
    );
  }

  /**
   * Resolve a single user to full details (email + names). Returns null
   * when the row is missing — used for the requester in approve/reject
   * paths, where the user may already be `is_active=4` but the email
   * column is still populated. Defensive: if the row vanished entirely
   * (hard delete, unusual), the email path is skipped — persistent INSERT
   * still happens since notifications has no FK on recipient_id.
   */
  private async resolveUserDetails(userId: number): Promise<UserDetailsRow | null> {
    return await this.db.tenantQueryOne<UserDetailsRow>(
      `SELECT id, email, first_name, last_name FROM users WHERE id = $1`,
      [userId],
    );
  }

  /**
   * Format a `UserDetailsRow` to "First Last", falling back to
   * "Benutzer #<id>" when the row is null or both name parts are
   * empty/null. Same fallback semantics as `resolveUserName()` so the
   * two paths produce identical strings for the same user.
   */
  private formatName(details: UserDetailsRow | null, userId: number): string {
    if (details === null) return `Benutzer #${userId}`;
    const first = details.first_name?.trim() ?? '';
    const last = details.last_name?.trim() ?? '';
    const full = `${first} ${last}`.trim();
    return full === '' ? `Benutzer #${userId}` : full;
  }

  /**
   * Persistent INSERT for the `notifications` table (ADR-004 sidebar
   * counts + read tracking). Errors logged but never thrown — the
   * top-level try/catch in each public method is the actual safety net,
   * but this inner catch makes the per-row failure mode explicit so a
   * single bad recipient does not abort the whole fan-out loop.
   */
  private async insertPersistentNotification(params: {
    tenantId: number;
    recipientId: number;
    title: string;
    message: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    createdBy: number;
    requestId: string;
    actionUrl: string;
    actionLabel: string;
  }): Promise<void> {
    try {
      const notificationUuid = uuidv7();
      await this.db.tenantQuery(
        `INSERT INTO notifications (
          tenant_id, type, title, message, priority,
          recipient_type, recipient_id, action_url, action_label,
          metadata, created_by, uuid, uuid_created_at
        ) VALUES ($1, $2, $3, $4, $5, 'user', $6, $7, $8, $9, $10, $11, NOW())`,
        [
          params.tenantId,
          NOTIFICATION_TYPE,
          params.title,
          params.message,
          params.priority,
          params.recipientId,
          params.actionUrl,
          params.actionLabel,
          JSON.stringify({ requestId: params.requestId }),
          params.createdBy,
          notificationUuid,
        ],
      );
    } catch (error: unknown) {
      this.logger.error(
        `Failed to insert root_self_termination notification (recipient=${params.recipientId}): ${String(error)}`,
      );
    }
  }

  // ── Email fan-out (was MailerService — moved here per refactor doc) ──

  /**
   * Send a "Root-Konto-Löschung beantragt" email to a peer root.
   *
   * Fired during the Requested fan-out for every peer root in the tenant.
   * Failure is logged + swallowed — the persistent `notifications` row +
   * sidebar badge are the compliance-trail source of truth, the email is
   * best-effort. Logic + wording are byte-identical to the previous
   * `MailerService.sendRootSelfTerminationRequested()` (refactor only).
   *
   * @see docs/REFACTOR_MAILER_SERVICE_GOD_OBJECT.md
   * @see docs/FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md §2.7 + Phase 8
   */
  private async sendRequestedEmail(
    recipient: { email: string; firstName: string | null; lastName: string | null },
    requesterName: string,
    expiresAt: string, // ISO 8601
  ): Promise<void> {
    try {
      const appUrl = process.env['APP_URL'] ?? DEFAULT_APP_URL;
      const userName = this.buildEmailRecipientName(recipient);
      const expiresAtFormatted = new Date(expiresAt).toLocaleString('de-DE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const subject = 'Root-Konto-Löschung beantragt — Genehmigung erforderlich';
      const message = [
        `${requesterName} hat die Löschung des eigenen Root-Kontos beantragt.`,
        `Bitte prüfen und entscheiden Sie bis zum ${expiresAtFormatted}.`,
        ``,
        `Antrag prüfen: ${appUrl}/manage-approvals`,
      ].join('\n');

      const branded = await emailService.loadBrandedTemplate('notification', {
        subject,
        userName,
        message,
        unsubscribeUrl: appUrl,
      });

      const result = await emailService.sendEmail({
        to: recipient.email,
        subject: `${subject} — Assixx`,
        html: branded.html,
        attachments: branded.attachments,
        text: this.buildSelfTerminationRequestedText(
          userName,
          requesterName,
          expiresAtFormatted,
          appUrl,
        ),
      });

      if (!result.success) {
        this.logger.error(
          `Root self-termination REQUESTED email failed for ${recipient.email}: ${result.error ?? UNKNOWN_ERROR}`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send root self-termination REQUESTED email to ${recipient.email}: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Send a "Root-Konto-Löschung genehmigt" email.
   *
   * Recipient is each fan-out target (requester + active peer roots minus
   * the approver). The requester row is `is_active=4` by this point but
   * the email column is still populated — paper-trail benefits from the
   * email even though the user can no longer log in.
   */
  private async sendApprovedEmail(
    recipient: { email: string; firstName: string | null; lastName: string | null },
    requesterName: string,
    approverName: string,
    comment: string | null,
  ): Promise<void> {
    try {
      const appUrl = process.env['APP_URL'] ?? DEFAULT_APP_URL;
      const userName = this.buildEmailRecipientName(recipient);
      const subject = 'Root-Konto-Löschung genehmigt';
      const commentLine =
        comment !== null && comment.trim() !== '' ? `\nKommentar: ${comment}` : '';
      const message = [
        `Das Root-Konto von ${requesterName} wurde gelöscht.`,
        `Genehmigt von: ${approverName}.${commentLine}`,
        ``,
        `Details ansehen: ${appUrl}/manage-approvals`,
      ].join('\n');

      const branded = await emailService.loadBrandedTemplate('notification', {
        subject,
        userName,
        message,
        unsubscribeUrl: appUrl,
      });

      const result = await emailService.sendEmail({
        to: recipient.email,
        subject: `${subject} — Assixx`,
        html: branded.html,
        attachments: branded.attachments,
        text: this.buildSelfTerminationApprovedText(
          userName,
          requesterName,
          approverName,
          comment,
          appUrl,
        ),
      });

      if (!result.success) {
        this.logger.error(
          `Root self-termination APPROVED email failed for ${recipient.email}: ${result.error ?? UNKNOWN_ERROR}`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send root self-termination APPROVED email to ${recipient.email}: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Send a "Root-Konto-Löschung abgelehnt" email to the requester.
   *
   * Recipient is the requester only — peer roots already saw the request
   * decision via the in-app peer-approval card. Body includes the
   * rejection reason + cooldown end (24h after rejection per §0.2 R7) so
   * the requester knows when they can re-request.
   */
  private async sendRejectedEmail(
    recipient: { email: string; firstName: string | null; lastName: string | null },
    approverName: string,
    rejectionReason: string,
    cooldownEndsAt: string, // ISO 8601
  ): Promise<void> {
    try {
      const appUrl = process.env['APP_URL'] ?? DEFAULT_APP_URL;
      const userName = this.buildEmailRecipientName(recipient);
      const cooldownEndsAtFormatted = new Date(cooldownEndsAt).toLocaleString('de-DE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const subject = 'Root-Konto-Löschung abgelehnt';
      const message = [
        `Ihr Antrag auf Löschung des eigenen Root-Kontos wurde abgelehnt von ${approverName}.`,
        `Grund: ${rejectionReason}`,
        ``,
        `Ein erneuter Antrag ist ab dem ${cooldownEndsAtFormatted} möglich (24 Stunden Cooldown).`,
        ``,
        `Profil ansehen: ${appUrl}/root-profile`,
      ].join('\n');

      const branded = await emailService.loadBrandedTemplate('notification', {
        subject,
        userName,
        message,
        unsubscribeUrl: appUrl,
      });

      const result = await emailService.sendEmail({
        to: recipient.email,
        subject: `${subject} — Assixx`,
        html: branded.html,
        attachments: branded.attachments,
        text: this.buildSelfTerminationRejectedText(
          userName,
          approverName,
          rejectionReason,
          cooldownEndsAtFormatted,
          appUrl,
        ),
      });

      if (!result.success) {
        this.logger.error(
          `Root self-termination REJECTED email failed for ${recipient.email}: ${result.error ?? UNKNOWN_ERROR}`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send root self-termination REJECTED email to ${recipient.email}: ${getErrorMessage(error)}`,
      );
    }
  }

  private buildSelfTerminationRequestedText(
    userName: string,
    requesterName: string,
    expiresAtFormatted: string,
    appUrl: string,
  ): string {
    return [
      `Hallo ${userName},`,
      '',
      `${requesterName} hat die Löschung des eigenen Root-Kontos beantragt.`,
      `Bitte prüfen und entscheiden Sie bis zum ${expiresAtFormatted}.`,
      '',
      `Antrag prüfen: ${appUrl}/manage-approvals`,
      '',
      'Falls Sie nicht reagieren, läuft der Antrag nach 7 Tagen automatisch ab.',
    ].join('\n');
  }

  private buildSelfTerminationApprovedText(
    userName: string,
    requesterName: string,
    approverName: string,
    comment: string | null,
    appUrl: string,
  ): string {
    const lines = [
      `Hallo ${userName},`,
      '',
      `Das Root-Konto von ${requesterName} wurde gelöscht.`,
      `Genehmigt von: ${approverName}.`,
    ];
    if (comment !== null && comment.trim() !== '') {
      lines.push(`Kommentar: ${comment}`);
    }
    lines.push('', `Details ansehen: ${appUrl}/manage-approvals`);
    return lines.join('\n');
  }

  private buildSelfTerminationRejectedText(
    userName: string,
    approverName: string,
    rejectionReason: string,
    cooldownEndsAtFormatted: string,
    appUrl: string,
  ): string {
    return [
      `Hallo ${userName},`,
      '',
      `Ihr Antrag auf Löschung des eigenen Root-Kontos wurde abgelehnt von ${approverName}.`,
      `Grund: ${rejectionReason}`,
      '',
      `Ein erneuter Antrag ist ab dem ${cooldownEndsAtFormatted} möglich (24 Stunden Cooldown).`,
      '',
      `Profil ansehen: ${appUrl}/root-profile`,
    ].join('\n');
  }

  /**
   * Build the salutation name for an email body. Mirrors the helper that
   * lived in `MailerService.buildUserName()` — falls back to the email
   * address when both name parts are null/empty (KISS — better than
   * "Benutzer #<id>" inside an email greeting).
   */
  private buildEmailRecipientName(recipient: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  }): string {
    const parts = [recipient.firstName, recipient.lastName].filter(
      (part: string | null): part is string => part !== null && part !== '',
    );
    const fullName = parts.join(' ');
    return fullName !== '' ? fullName : recipient.email;
  }
}
