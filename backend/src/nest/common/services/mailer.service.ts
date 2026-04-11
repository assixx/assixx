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

const PASSWORD_RESET_EXPIRY_MINUTES = 60;

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
