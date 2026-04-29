/**
 * 2FA Suspicious-Activity Email Template — German HTML + plain-text fallback.
 *
 * STATUS: FEAT_2FA_EMAIL_MASTERPLAN Phase 2 §2.9 (v0.6.0).
 *
 * WHEN this is sent: a user account has accumulated `MAX_ATTEMPTS` (5) wrong
 * 2FA codes on a single challenge, triggering a 15-min lockout (DD-5/DD-6).
 * The email is the user-facing paper-trail of that event.
 *
 * DD-20 — RECIPIENT POLICY: user only.
 *
 *   The locked-out account holder is the sole recipient. We deliberately do
 *   NOT cc tenant admins because that would create a side-channel for user
 *   enumeration ("did the admin get an email about user X?" → confirms X is
 *   a tenant member). V2 may add opt-in tenant-admin notification.
 *
 * DD-13 — Sender = `noreply@assixx.de` from `SMTP_FROM` (set at send time).
 *
 * DESIGN DECISIONS encoded here:
 *   - Subject is generic ("Sicherheitshinweis zu Ihrem Assixx-Konto") — does
 *     not leak that this is a 2FA event in mail-list previews.
 *   - Body explains: lockout duration, what to do (wait, contact IT), and
 *     the "you didn't do this?" advisory.
 *   - No code, no challenge token, no internal IDs in the body.
 *   - No tracking pixels, no JavaScript, no external assets.
 *   - Plain-text fallback always present.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.9, DD-20)
 * @see ADR-054 (drafted in Phase 6): Mandatory Email-Based 2FA.
 */

/** Materialised template ready for `email-service.sendEmail()`. */
export interface TwoFactorSuspiciousActivityTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Build the suspicious-activity payload for the locked-out user.
 *
 * No inputs needed — the lockout duration is documented as a fixed 15 min
 * (DD-6, `LOCKOUT_SEC = 900`); embedding the exact remaining time would
 * create a stale display the moment the user opens the mail.
 */
export function build2faSuspiciousActivityTemplate(): TwoFactorSuspiciousActivityTemplate {
  // Subject deliberately neutral — no "2FA", no "lockout", no account
  // identifier. Matches the same DD-13 anti-leak logic used for the code mail.
  const subject = 'Sicherheitshinweis zu Ihrem Assixx-Konto';

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f5f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff;border-radius:8px;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:32px 40px 16px 40px;">
              <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#b91c1c;">Sicherheitshinweis</h1>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#374151;">An Ihrem Assixx-Konto wurden mehrere fehlerhafte Bestätigungscodes hintereinander eingegeben. Aus Sicherheitsgründen haben wir Ihr Konto vorübergehend für <strong>15 Minuten</strong> gesperrt.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 16px 40px;">
              <h2 style="margin:0 0 8px 0;font-size:16px;font-weight:600;color:#111827;">Was Sie tun sollten</h2>
              <ul style="margin:0;padding:0 0 0 20px;font-size:14px;line-height:1.6;color:#374151;">
                <li><strong>Sie waren das selbst?</strong> Warten Sie 15 Minuten und melden Sie sich erneut an. Achten Sie auf den Code in der zuletzt erhaltenen E-Mail.</li>
                <li><strong>Sie waren das nicht?</strong> Möglicherweise versucht jemand, sich an Ihrem Konto anzumelden. Informieren Sie umgehend Ihre IT-Abteilung. Ändern Sie nach Ablauf der Sperre Ihr Passwort.</li>
              </ul>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 24px 40px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">Während der Sperre können auch korrekte Codes nicht angenommen werden. Diese Maßnahme schützt Ihr Konto vor automatischen Angriffen.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 32px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">Diese Nachricht wurde automatisch versandt. Bitte antworten Sie nicht direkt auf diese E-Mail.</p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0 0;font-size:12px;color:#9ca3af;">Assixx — Multi-Tenant SaaS für Industrieunternehmen</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Sicherheitshinweis

An Ihrem Assixx-Konto wurden mehrere fehlerhafte Bestätigungscodes hintereinander eingegeben. Aus Sicherheitsgründen haben wir Ihr Konto vorübergehend für 15 Minuten gesperrt.

Was Sie tun sollten:
  - Sie waren das selbst? Warten Sie 15 Minuten und melden Sie sich erneut an. Achten Sie auf den Code in der zuletzt erhaltenen E-Mail.
  - Sie waren das nicht? Möglicherweise versucht jemand, sich an Ihrem Konto anzumelden. Informieren Sie umgehend Ihre IT-Abteilung. Ändern Sie nach Ablauf der Sperre Ihr Passwort.

Während der Sperre können auch korrekte Codes nicht angenommen werden. Diese Maßnahme schützt Ihr Konto vor automatischen Angriffen.

Diese Nachricht wurde automatisch versandt. Bitte antworten Sie nicht direkt auf diese E-Mail.

—
Assixx — Multi-Tenant SaaS für Industrieunternehmen`;

  return { subject, html, text };
}
