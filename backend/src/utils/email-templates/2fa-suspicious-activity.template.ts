/**
 * 2FA Suspicious-Activity Email Template — German HTML + plain-text fallback.
 *
 * STATUS: FEAT_2FA_EMAIL_MASTERPLAN Phase 2 §2.9 (initial) + §2.9b (this
 * file's current shape, 2026-04-29 redesign).
 *
 * WHEN this is sent: a user account has accumulated `MAX_ATTEMPTS` (5) wrong
 * 2FA codes on a single challenge, triggering a 15-min lockout (DD-5/DD-6).
 * The email is the user-facing paper-trail of that event.
 *
 * VISUAL IDENTITY (§2.9b, 2026-04-29):
 *   The dark-mode shell mirrors `backend/templates/email/password-reset.html`
 *   1:1 — black background (#000000), 600 px container with 12 px radius,
 *   `cid:assixx-logo` 140×68 at top, slate text palette, MSO/Outlook
 *   fallbacks. Caller MUST attach the branding logo (see
 *   `email-service.send2faSuspiciousActivity` — it pulls
 *   `getBrandingLogoAttachment()` so the `cid:` reference resolves).
 *
 * CONTENT (§2.9b — Klarna-style action-oriented German):
 *   Body restructured around two clear branches the recipient has to choose
 *   between: "Sie waren das selbst?" → wait + retry; "Sie waren das nicht?"
 *   → sperren Sie Ihr Konto, ändern Sie Ihr Passwort, informieren Sie Ihre
 *   IT-Abteilung. The §2.9 "Falls Sie diese …" passive closing is replaced
 *   by an explicit fraud-warning + action-list.
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
 *   - No tracking pixels (logo is a CID attachment), no JavaScript, no
 *     external assets.
 *   - Plain-text fallback always present.
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.9 + §2.9b, DD-20)
 * @see backend/templates/email/password-reset.html (visual reference)
 * @see ADR-054 (drafted in Phase 6): Mandatory Email-Based 2FA.
 */

/** Materialised template ready for `email-service.sendEmail()`. */
export interface TwoFactorSuspiciousActivityTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Build the HTML body for the suspicious-activity mail.
 *
 * Extracted so the public `build2faSuspiciousActivityTemplate` stays under
 * the 60-line cap (`max-lines-per-function`). Pure string assembly,
 * cyclomatic complexity = 1 (single template literal, no branches).
 *
 * The 60-line `max-lines-per-function` cap exists to bound control-flow
 * complexity (Power-of-Ten Rule 4). A declarative HTML literal of ~90 lines
 * has zero branches and zero loops — splitting it into sub-functions purely
 * to satisfy the line-count rule scatters a single layout and degrades
 * readability. This is the documented exception, mirrored from
 * `2fa-code.template.ts`.
 */
// eslint-disable-next-line max-lines-per-function -- declarative HTML literal, complexity=1 (see comment above)
function renderSuspiciousActivityHtml(subject: string): string {
  return `<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark only">
  <title>${subject}</title>
  <!--[if mso]>
    <noscript>
      <xml>
        <o:OfficeDocumentSettings>
          <o:PixelsPerInch>96</o:PixelsPerInch>
          <o:AllowPNG />
        </o:OfficeDocumentSettings>
      </xml>
    </noscript>
  <![endif]-->
  <style>
    :root { color-scheme: dark only; supported-color-schemes: dark only; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a { color: #42a5f5; text-decoration: none; }
    [data-ogsc] body, [data-ogsc] .force-bg, [data-ogsc] .card { background-color: #000000 !important; }
    [data-ogsc] .text-primary { color: #f1f5f9 !important; }
    [data-ogsc] .text-body { color: #cbd5e1 !important; }
    [data-ogsc] .text-muted { color: #94a3b8 !important; }
    [data-ogsc] .text-danger { color: #f87171 !important; }
    /* Explicit font-family on every text element so clients that strip
       inheritance through nested tables (Gmail, Maildev iframe) still
       render the same stack as the password-reset reference. */
    body, table, td, p, h1, h2, h3 { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; max-width: 100% !important; }
      .px-32 { padding-right: 20px !important; padding-left: 20px !important; }
      .py-32 { padding-top: 24px !important; padding-bottom: 24px !important; }
      h1 { font-size: 20px !important; }
    }
  </style>
</head>
<body bgcolor="#000000" style="margin: 0; padding: 0; width: 100%; background-color: #000000">
  <table role="presentation" class="force-bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background-color: #000000; margin: 0; padding: 0">
    <tr>
      <td align="center" style="padding: 40px 16px">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="width: 600px; max-width: 600px; background-color: #000000">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 0 0 24px 0">
              <!-- max-width omitted (2026-04-30): width===max-width on the
                   same element is a no-op (caniemail css-max-width). The
                   HTML width="140" attr + CSS width: 140px already cap the
                   image; max-width: 140px just generated a Mailpit
                   "partial-support" warning with zero rendering effect. -->
              <img src="cid:assixx-logo" width="140" height="68" alt="Assixx" style="display: block; width: 140px; height: 68px" />
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td>
              <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background-color: #000000; border-radius: 12px">
                <tr>
                  <td class="px-32 py-32" style="padding: 36px 36px 32px 36px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                    <h1 class="text-danger" style="margin: 0 0 8px 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 22px; font-weight: 700; line-height: 1.3; color: #f87171; text-align: center; mso-line-height-rule: exactly;">Sicherheitshinweis</h1>
                    <p class="text-muted" style="margin: 0 0 28px 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.5; color: #94a3b8; text-align: center; mso-line-height-rule: exactly;">Ihr Konto wurde vorübergehend gesperrt.</p>

                    <p class="text-body" style="margin: 0 0 16px 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #cbd5e1; mso-line-height-rule: exactly;">An Ihrem Assixx-Konto wurden mehrere fehlerhafte Bestätigungscodes hintereinander eingegeben. Aus Sicherheitsgründen haben wir Ihr Konto vorübergehend für <strong style="color: #f1f5f9">15 Minuten</strong> gesperrt.</p>

                    <p class="text-muted" style="margin: 0 0 24px 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #94a3b8; mso-line-height-rule: exactly;">Während der Sperre können auch korrekte Codes nicht angenommen werden. Diese Maßnahme schützt Ihr Konto vor automatischen Angriffen.</p>

                    <!-- Two-branch advisory -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="border-top: 1px solid #1f2937; padding: 18px 0 8px 0">
                          <p class="text-body" style="margin: 0 0 8px 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #cbd5e1; mso-line-height-rule: exactly;"><strong style="color: #f1f5f9">Sie waren das selbst?</strong></p>
                          <p class="text-muted" style="margin: 0 0 18px 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #94a3b8; mso-line-height-rule: exactly;">Warten Sie 15 Minuten und melden Sie sich erneut an. Achten Sie auf den Code in der zuletzt erhaltenen E-Mail.</p>

                          <p class="text-body" style="margin: 0 0 8px 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #cbd5e1; mso-line-height-rule: exactly;"><strong style="color: #f1f5f9">Sie waren das nicht?</strong></p>
                          <p class="text-muted" style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #94a3b8; mso-line-height-rule: exactly;">M&ouml;glicherweise versucht jemand, sich an Ihrem Konto anzumelden. Sperren Sie Ihr Konto umgehend, &auml;ndern Sie nach Ablauf der Sperre Ihr Passwort und informieren Sie umgehend Ihre IT-Abteilung.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 16px 0 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
              <p class="text-muted" style="margin: 0 0 6px 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #64748b; mso-line-height-rule: exactly;">&copy; 2026 Assixx &mdash; Enterprise-Plattform f&uuml;r Industrieunternehmen</p>
              <p class="text-muted" style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 12px; line-height: 1.5; color: #64748b; mso-line-height-rule: exactly;">Dies ist eine automatisierte Nachricht. Bitte antworten Sie nicht auf diese E-Mail.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build the plain-text fallback for the suspicious-activity mail.
 * Extracted alongside `renderSuspiciousActivityHtml` so the public function
 * stays under the 60-line cap.
 */
function renderSuspiciousActivityText(): string {
  return `Sicherheitshinweis

Ihr Konto wurde vorübergehend gesperrt.

An Ihrem Assixx-Konto wurden mehrere fehlerhafte Bestätigungscodes hintereinander eingegeben. Aus Sicherheitsgründen haben wir Ihr Konto vorübergehend für 15 Minuten gesperrt.

Während der Sperre können auch korrekte Codes nicht angenommen werden. Diese Maßnahme schützt Ihr Konto vor automatischen Angriffen.

—

Sie waren das selbst?
Warten Sie 15 Minuten und melden Sie sich erneut an. Achten Sie auf den Code in der zuletzt erhaltenen E-Mail.

Sie waren das nicht?
Möglicherweise versucht jemand, sich an Ihrem Konto anzumelden. Sperren Sie Ihr Konto umgehend, ändern Sie nach Ablauf der Sperre Ihr Passwort und informieren Sie umgehend Ihre IT-Abteilung.

—
© 2026 Assixx — Enterprise-Plattform für Industrieunternehmen
Dies ist eine automatisierte Nachricht. Bitte antworten Sie nicht auf diese E-Mail.`;
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
  const html = renderSuspiciousActivityHtml(subject);
  const text = renderSuspiciousActivityText();
  return { subject, html, text };
}
