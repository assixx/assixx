/**
 * Mailer Service — NestJS DI wrapper around legacy email-service.ts
 *
 * Wraps the module-level Nodemailer service (`backend/src/utils/email-service.ts`)
 * so that domain services can inject it normally instead of resorting to
 * `await import(...)` workarounds. Template loading and HTML escaping live
 * exclusively in the legacy module — this wrapper never reimplements them.
 *
 * Failure handling: methods log errors and resolve normally. Callers like
 * `AuthService.forgotPassword` already return generic responses to prevent
 * email enumeration, so throwing here would leak information.
 *
 * Future email types (welcome, document notification, etc.) get their own
 * typed method on this service.
 */
import { Injectable, Logger } from '@nestjs/common';

import emailService from '../../../utils/email-service.js';
import { getErrorMessage } from '../utils/error.utils.js';

export interface PasswordResetRecipient {
  email: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Attachment shape for MailerService — abstracts the Nodemailer internal type
 * so feature modules don't need to depend on nodemailer directly.
 */
export interface MailerAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

/**
 * Context payload for a user-submitted bug report.
 * All fields are already validated/sanitised by the caller's Zod DTO.
 * `screenshots` is an array (0–3 images enforced by the controller).
 */
export interface BugReportPayload {
  title: string;
  categoryLabel: string;
  description: string;
  originUrl: string;
  userAgent: string | undefined;
  reporterEmail: string;
  reporterName: string;
  reporterUserId: number;
  reporterTenantId: number;
  reporterRole: string;
  screenshots: MailerAttachment[];
}

const PASSWORD_RESET_EXPIRY_MINUTES = 60;

/**
 * Recipient for user-submitted bug reports. Configurable via env so staging can
 * redirect away from production inbox without a code change. Default stays on
 * the production inbox per product decision (info@assixx.com).
 */
const BUG_REPORT_RECIPIENT = process.env['FEEDBACK_EMAIL_TO'] ?? 'info@assixx.com';

/**
 * HTML-entity escape for values interpolated into the bug-report template.
 * The legacy `email-service.ts` sanitiser strips dangerous tags/handlers but
 * does NOT escape plaintext, so a user-supplied title like `</td><script>`
 * would otherwise break the table layout. Scoped to this service to avoid
 * leaking duplicate escape helpers into the public API.
 */
const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/["&'<>]/g, (match: string): string => HTML_ESCAPES[match] ?? match);
}

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  /**
   * Send a branded password-reset email containing a reset link.
   *
   * Uses the legacy `loadBrandedTemplate` helper which both fills the
   * `password-reset.html` template AND attaches the Assixx logo as a
   * `cid:assixx-logo` inline image — a quiet bug in the previous inline
   * implementation, which referenced the CID without ever attaching the file.
   */
  async sendPasswordReset(
    recipient: PasswordResetRecipient,
    rawToken: string,
    expiresAt: Date,
  ): Promise<void> {
    try {
      const appUrl = process.env['APP_URL'] ?? 'http://localhost:5173';
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
      const userName = this.buildUserName(recipient);
      const expiresAtFormatted = expiresAt.toLocaleString('de-DE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      const branded = await emailService.loadBrandedTemplate('password-reset', {
        userName,
        resetUrl,
        expiresAt: expiresAtFormatted,
      });

      const result = await emailService.sendEmail({
        to: recipient.email,
        subject: 'Passwort zurücksetzen — Assixx',
        html: branded.html,
        attachments: branded.attachments,
        text: this.buildPasswordResetText(userName, resetUrl),
      });

      if (!result.success) {
        this.logger.error(
          `Password reset email send failed for ${recipient.email}: ${result.error ?? 'unknown error'}`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send password reset email to ${recipient.email}: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Forward a user-submitted bug report to the ops inbox.
   *
   * Throws on transport failure so the HTTP caller surfaces a real error to the
   * user — silent swallow would let bug reports disappear without the user
   * knowing (worse UX than password reset, where we hide existence on purpose).
   */
  async sendBugReport(payload: BugReportPayload): Promise<void> {
    const result = await emailService.sendEmail({
      to: BUG_REPORT_RECIPIENT,
      subject: `[Assixx Bug-Report] [${payload.categoryLabel}] ${payload.title}`,
      html: this.buildBugReportHtml(payload),
      text: this.buildBugReportText(payload),
      attachments: payload.screenshots,
    });

    if (!result.success) {
      const reason = result.error ?? 'unknown error';
      this.logger.error(
        `Bug report email send failed (user=${String(payload.reporterUserId)}): ${reason}`,
      );
      throw new Error(`Bug-Report konnte nicht gesendet werden: ${reason}`);
    }
  }

  private buildBugReportHtml(payload: BugReportPayload): string {
    // Every user-supplied value is HTML-escaped here because the branded
    // sanitiser in `email-service.ts` strips only dangerous tags/handlers —
    // it does NOT escape plaintext. A user-supplied title like
    // `</td><script>` would otherwise break the table layout.
    const rows = [
      ['Kategorie', payload.categoryLabel],
      ['Titel', payload.title],
      ['URL', payload.originUrl],
      ['Reporter', `${payload.reporterName} <${payload.reporterEmail}>`],
      ['User-ID', String(payload.reporterUserId)],
      ['Tenant-ID', String(payload.reporterTenantId)],
      ['Rolle', payload.reporterRole],
      ['User-Agent', payload.userAgent ?? '—'],
      ['Zeitpunkt', new Date().toISOString()],
    ]
      .map(
        ([label, value]: string[]): string =>
          `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;"><strong>${escapeHtml(label ?? '')}</strong></td><td style="padding:4px 0;">${escapeHtml(value ?? '')}</td></tr>`,
      )
      .join('');

    const screenshotsHint =
      payload.screenshots.length > 0 ?
        `<p style="margin-top:16px;color:#666;font-size:12px;">📎 ${String(payload.screenshots.length)} Screenshot${payload.screenshots.length === 1 ? '' : 's'} im Anhang.</p>`
      : '';

    return [
      '<html><body style="font-family:-apple-system,Segoe UI,sans-serif;font-size:14px;color:#222;">',
      '<h2 style="margin:0 0 12px;color:#1976d2;">🐛 Neuer Bug-Report</h2>',
      `<table style="border-collapse:collapse;margin-bottom:16px;">${rows}</table>`,
      '<h3 style="margin:16px 0 8px;">Beschreibung</h3>',
      `<pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:4px;font-family:inherit;">${escapeHtml(payload.description)}</pre>`,
      screenshotsHint,
      '</body></html>',
    ].join('');
  }

  private buildBugReportText(payload: BugReportPayload): string {
    return [
      'Neuer Bug-Report',
      '',
      `Kategorie:   ${payload.categoryLabel}`,
      `Titel:       ${payload.title}`,
      `URL:         ${payload.originUrl}`,
      `Reporter:    ${payload.reporterName} <${payload.reporterEmail}>`,
      `User-ID:     ${String(payload.reporterUserId)}`,
      `Tenant-ID:   ${String(payload.reporterTenantId)}`,
      `Rolle:       ${payload.reporterRole}`,
      `User-Agent:  ${payload.userAgent ?? '—'}`,
      `Zeitpunkt:   ${new Date().toISOString()}`,
      '',
      'Beschreibung:',
      payload.description,
    ].join('\n');
  }

  private buildUserName(recipient: PasswordResetRecipient): string {
    const parts = [recipient.firstName, recipient.lastName].filter(
      (part: string | null): part is string => part !== null && part !== '',
    );
    const fullName = parts.join(' ');
    return fullName !== '' ? fullName : recipient.email;
  }

  private buildPasswordResetText(userName: string, resetUrl: string): string {
    return [
      `Hallo ${userName},`,
      '',
      'Sie haben angefordert, Ihr Passwort zurückzusetzen.',
      '',
      `Klicken Sie auf folgenden Link (gültig für ${PASSWORD_RESET_EXPIRY_MINUTES} Minuten):`,
      resetUrl,
      '',
      'Falls Sie diese Anfrage nicht gestellt haben, ignorieren Sie diese E-Mail.',
      '',
      'Mit freundlichen Grüßen,',
      'Ihr Assixx-Team',
    ].join('\n');
  }
}
