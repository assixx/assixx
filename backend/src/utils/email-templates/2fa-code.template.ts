/**
 * 2FA Code Email Template — German HTML + plain-text fallback.
 *
 * STATUS: FEAT_2FA_EMAIL_MASTERPLAN Phase 2 §2.9 (initial) + §2.9b (this file's
 * current shape, 2026-04-29 redesign).
 *
 * WHY a TypeScript builder (vs. an HTML file in `backend/templates/email/`):
 *   The 2FA code is a security-critical, code-driven payload — the template
 *   needs typed inputs (`code: string`, `purpose: TwoFactorCodeTemplatePurpose`,
 *   `ttlMinutes: number`), per-purpose copy variation, AND per-character code
 *   splitting into 6 individual `<td>` cells (§2.9b). The legacy
 *   `loadTemplate()` helper in `email-service.ts` accepts only `string`
 *   replacements and routes through HTML-entity escaping — neither matches the
 *   per-char box rendering the redesign requires.
 *
 * VISUAL IDENTITY (§2.9b, 2026-04-29):
 *   The dark-mode shell mirrors `backend/templates/email/password-reset.html`
 *   1:1 — black background (#000000), 600 px container with 12 px radius,
 *   `cid:assixx-logo` 140×68 at top, slate text palette (#f1f5f9 / #cbd5e1
 *   / #94a3b8), MSO/Outlook fallbacks via `[data-ogsc]`. Caller MUST attach
 *   the branding logo (see `email-service.send2faCode` — it pulls
 *   `getBrandingLogoAttachment()` so the `cid:` reference resolves).
 *
 * CODE RENDERING (§2.9b):
 *   The 6-character code is split into 6 separate `<td>` cells side-by-side,
 *   one char per cell. Each cell is a dark card with a thin border, monospace
 *   28 px, big-and-readable for shop-floor screens (DD-1 confusable-character
 *   mitigation context). The plain-text fallback keeps the unbroken `${code}`
 *   so clipboard copy works on text-only clients.
 *
 * CONTENT (§2.9b — Klarna-style action-oriented German):
 *   - Per-purpose intro from `buildIntro()` (login / signup / email-change-old
 *     / email-change-new) — unchanged from §2.9.
 *   - "Verwenden Sie diesen Code …" / "Geben Sie diesen Code niemandem weiter."
 *   - Action-oriented "Sie haben keinen Code angefordert? → sperren Sie Ihr
 *     Konto, informieren Sie Ihre IT-Abteilung." — replaces the §2.9 closing
 *     line "Falls Sie diese E-Mail nicht erwartet haben, ignorieren Sie sie
 *     bitte. Ihr Konto bleibt sicher, solange Sie den Code niemandem
 *     weitergeben." (judged passive / unhelpful in 2026-04-29 review).
 *
 * DESIGN DECISIONS encoded here:
 *   - DD-13: Generic subject — code never appears in subject, mail-list
 *     previews, or lock-screen banners. Body-only. Same string for every
 *     purpose (login / signup / email-change-*).
 *   - DD-13: Sender = `noreply@<assixx-domain>` from `SMTP_FROM`. Set by
 *     `email-service.sendEmail()` at send time, NOT here.
 *   - DD-1 / DD-12: Code is 6 chars from Crockford-Base32 subset
 *     (A-HJKMNP-Z2-9). No special characters that need HTML escaping.
 *   - "Geben Sie diesen Code niemandem weiter" — phishing-mitigation copy.
 *   - No tracking pixels (logo is a CID attachment, not a remote URL).
 *   - No external CSS/images (everything inline; logo via `cid:`), no JS.
 *   - Plain-text fallback ALWAYS present (DD-13 mail-client compat).
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.9 + §2.9b)
 * @see backend/templates/email/password-reset.html (visual reference)
 * @see ADR-054 (drafted in Phase 6): Mandatory Email-Based 2FA.
 */

/**
 * Purposes the 2FA-code template renders intro copy for.
 *
 * Mirrors `ChallengePurpose` in `two-factor-auth.types.ts` — kept as a literal
 * union here to keep this file backend-agnostic (no NestJS dependency drag).
 * The four strings stay in sync via the exhaustive `buildIntro` switch below;
 * adding a purpose to the union without a switch case is a TS compile error.
 */
export type TwoFactorCodeTemplatePurpose =
  | 'login'
  | 'signup'
  | 'email-change-old'
  | 'email-change-new';

/** Inputs for the 2FA code template builder. */
export interface TwoFactorCodeTemplateInput {
  /** 6-char Crockford-Base32 code (CODE_ALPHABET, DD-1). */
  code: string;
  /** Which flow the code authorises. */
  purpose: TwoFactorCodeTemplatePurpose;
  /** TTL in minutes (typically `CODE_TTL_SEC / 60` = 10). DD-2. */
  ttlMinutes: number;
}

/** Materialised template ready for `email-service.sendEmail()`. */
export interface TwoFactorCodeTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Per-purpose intro text. Centralised so the German wording stays consistent
 * between HTML and plain-text variants — divergence here produced support
 * tickets in past incidents (different wording made users suspect phishing).
 *
 * The exhaustive switch is intentional: `noFallthroughCasesInSwitch` + the
 * literal-union parameter means adding a purpose to `ChallengePurpose`
 * without adding a case here is a TS compile error (defense against drift
 * when future plan revisions add purposes).
 *
 * For email-change purposes the intro deliberately does NOT name the new or
 * old address — DD-13 generic-leak rule extends here: if a stranger reads the
 * mail-list preview of a stolen mailbox, they should learn nothing beyond
 * "Assixx requested a code". The body still names "alte" / "neue" Adresse,
 * but the lead line stays neutral.
 */
function buildIntro(purpose: TwoFactorCodeTemplatePurpose): { greeting: string; lead: string } {
  switch (purpose) {
    case 'signup':
      return {
        greeting: 'Willkommen bei Assixx!',
        lead: 'Bitte bestätigen Sie Ihre E-Mail-Adresse, um die Registrierung abzuschließen.',
      };
    case 'email-change-old':
      return {
        greeting: 'Hallo,',
        lead: 'Sie haben eine Änderung Ihrer Anmelde-E-Mail-Adresse beantragt. Bitte bestätigen Sie die Anfrage mit dem folgenden Code an Ihrer aktuellen Adresse.',
      };
    case 'email-change-new':
      return {
        greeting: 'Hallo,',
        lead: 'Diese Adresse wurde als neue Anmelde-E-Mail-Adresse für Ihr Assixx-Konto angegeben. Bitte bestätigen Sie die Anfrage mit dem folgenden Code.',
      };
    case 'login':
      return {
        greeting: 'Hallo,',
        lead: 'Sie haben sich gerade bei Assixx angemeldet. Geben Sie zur Bestätigung den folgenden Code in der Anmeldemaske ein.',
      };
  }
}

/**
 * Render the 6-character code as 6 separate `<td>` cells side-by-side.
 *
 * One character per cell. Each cell is a dark glass-card with a thin border,
 * monospace 28 px, padding for finger-size touch targets if the user wants to
 * select-and-copy on mobile. Code chars contain only A-Z2-9 (Crockford-Base32
 * subset) so HTML escaping is unnecessary — but we still emit them as plain
 * text content of the `<td>`, never as an attribute, so the no-escape choice
 * is structurally safe.
 *
 * The outer `<table>` is `role="presentation"` so screen readers don't
 * announce "table with 6 columns". The cells use small horizontal gaps via
 * border-collapse + per-cell padding (mail-client compatible — `gap` is not).
 */
function renderCode(code: string): string {
  // §2.9b v4 (2026-04-29): the boxed rendering (v3) was reverted on user
  // feedback — the code is now displayed as plain bold monospace text, no
  // boxes, no borders, just centered. Copy-clean by construction (single
  // text node), still letter-spacing-readable for shop-floor screens.
  //
  // Centering: handled by the parent `<td align="center"; text-align: center>`
  // — this helper just produces the styled inner element.
  //
  // Color: light slate (`#f1f5f9`) matches the H1 in the same card.
  // Letter-spacing: 8px so the 6 chars are clearly distinguishable but copy
  // still yields the unbroken string (CSS letter-spacing doesn't insert
  // characters into the text, only visual gaps).
  return `<span class="code-text" style="display: inline-block; font-family: 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace; font-size: 24px; font-weight: 800; letter-spacing: 8px; color: #f1f5f9; mso-line-height-rule: exactly;">${code}</span>`;
}

/**
 * Build the HTML body for the 2FA code mail.
 *
 * Extracted from `build2faCodeTemplate` so that function stays under the
 * 60-line cap (`max-lines-per-function`). Pure string assembly — no I/O,
 * no side effects, cyclomatic complexity = 1 (single template literal).
 *
 * The 60-line `max-lines-per-function` cap exists to bound control-flow
 * complexity (Power-of-Ten Rule 4). A declarative HTML literal of ~100
 * lines has zero branches and zero loops — splitting it into
 * `renderHead` / `renderCard` / `renderFooter` sub-functions purely to
 * satisfy the line-count rule scatters a single layout across multiple
 * functions and degrades readability. This is the documented exception.
 */
// eslint-disable-next-line max-lines-per-function -- declarative HTML literal, complexity=1 (see comment above)
function renderCodeMailHtml(args: {
  subject: string;
  greeting: string;
  lead: string;
  codeHtml: string;
  ttlMinutes: number;
}): string {
  const { subject, greeting, lead, codeHtml, ttlMinutes } = args;
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
    [data-ogsc] .code-cell { background-color: #0b1220 !important; color: #f1f5f9 !important; }
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
              <img src="cid:assixx-logo" width="140" height="68" alt="Assixx" style="display: block; width: 140px; height: 68px; max-width: 140px" />
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td>
              <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background-color: #000000; border-radius: 12px">
                <tr>
                  <td class="px-32 py-32" style="padding: 36px 36px 32px 36px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                    <h1 class="text-primary" style="margin: 0 0 24px 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 22px; font-weight: 700; line-height: 1.3; color: #f1f5f9; text-align: center; mso-line-height-rule: exactly;">Ihr 6-stelliger Bestätigungscode</h1>
                    <!-- Greeting + Lead form ONE reading block: same color
                         (#cbd5e1 / text-body), same line-height (1.6), and a
                         tight 4px gap between them so they read as a single
                         paragraph. The 24px above (under H1) and 28px below
                         (above the code) anchor the block visually. -->
                    <p class="text-body" style="margin: 0 0 4px 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #cbd5e1; text-align: left; mso-line-height-rule: exactly;">${greeting}</p>
                    <p class="text-body" style="margin: 0 0 28px 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #cbd5e1; mso-line-height-rule: exactly;">${lead}</p>
                    <!-- Plain bold monospace token, centered (§2.9b v4 —
                         user feedback 2026-04-29: boxes felt heavy, the
                         token alone reads cleaner. Letter-spacing-only
                         visual gap, copy-clean by construction (single
                         text node). -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="margin: 0 auto 24px auto">
                      <tr>
                        <td align="center" style="padding: 0; text-align: center;">${codeHtml}</td>
                      </tr>
                    </table>
                    <p class="text-body" style="margin: 0 0 12px 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #cbd5e1; mso-line-height-rule: exactly;">Verwenden Sie diesen Code, um den Vorgang in Assixx abzuschließen.</p>
                    <p class="text-body" style="margin: 0 0 12px 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #cbd5e1; mso-line-height-rule: exactly;"><strong style="color: #f1f5f9">Geben Sie diesen Code niemandem weiter.</strong> Mitarbeitende von Assixx werden Sie niemals telefonisch, per SMS oder E-Mail nach Ihrem Code fragen.</p>
                    <p class="text-muted" style="margin: 0 0 24px 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #94a3b8; mso-line-height-rule: exactly;">Der Code ist <strong style="color: #cbd5e1">${ttlMinutes} Minuten</strong> gültig.</p>
                    <!-- Section divider + action-oriented closing block -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="border-top: 1px solid #1f2937; padding: 18px 0 0 0">
                          <p class="text-muted" style="margin: 0 0 12px 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.6; color: #94a3b8; mso-line-height-rule: exactly;">Betrüger geben sich möglicherweise als Assixx aus. Geben Sie niemals Ihre Anmeldedaten oder Codes weiter.</p>
                          <p class="text-muted" style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; line-height: 1.6; color: #94a3b8; mso-line-height-rule: exactly;"><strong style="color: #cbd5e1">Sie haben keinen Code angefordert?</strong> Falls Sie vermuten, dass jemand anderes diesen Code angefordert hat, sperren Sie Ihr Konto umgehend und informieren Sie Ihre IT-Abteilung.</p>
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
 * Build the plain-text fallback body for the 2FA code mail.
 *
 * Extracted alongside `renderCodeMailHtml` so `build2faCodeTemplate` stays
 * under the 60-line cap. The unbroken `${code}` is preserved so a
 * clipboard-copy on text-only clients yields a typeable string.
 */
function renderCodeMailText(args: {
  greeting: string;
  lead: string;
  code: string;
  ttlMinutes: number;
}): string {
  const { greeting, lead, code, ttlMinutes } = args;
  return `Ihr 6-stelliger Bestätigungscode

${greeting}

${lead}

Ihr Code: ${code}

Verwenden Sie diesen Code, um den Vorgang in Assixx abzuschließen.

Geben Sie diesen Code niemandem weiter. Mitarbeitende von Assixx werden Sie niemals telefonisch, per SMS oder E-Mail nach Ihrem Code fragen.

Der Code ist ${ttlMinutes} Minuten gültig.

—

Betrüger geben sich möglicherweise als Assixx aus. Geben Sie niemals Ihre Anmeldedaten oder Codes weiter.

Sie haben keinen Code angefordert? Falls Sie vermuten, dass jemand anderes diesen Code angefordert hat, sperren Sie Ihr Konto umgehend und informieren Sie Ihre IT-Abteilung.

—
© 2026 Assixx — Enterprise-Plattform für Industrieunternehmen
Dies ist eine automatisierte Nachricht. Bitte antworten Sie nicht auf diese E-Mail.`;
}

/**
 * Build the 2FA code email payload.
 *
 * Returned `subject` is intentionally generic per DD-13 — neither the code nor
 * the purpose appears in the subject line. Caller (`email-service.send2faCode`)
 * forwards subject/html/text to `sendEmail()` AND attaches the branding logo
 * via `getBrandingLogoAttachment()` so `cid:assixx-logo` resolves.
 */
export function build2faCodeTemplate(input: TwoFactorCodeTemplateInput): TwoFactorCodeTemplate {
  const { code, purpose, ttlMinutes } = input;
  const { greeting, lead } = buildIntro(purpose);

  // Subject: DD-13 generic — no code, no purpose differentiation. Same string
  // for every purpose so a mail-list view leaks nothing.
  const subject = 'Ihr Bestätigungscode für Assixx';

  const codeHtml = renderCode(code);
  const html = renderCodeMailHtml({ subject, greeting, lead, codeHtml, ttlMinutes });
  const text = renderCodeMailText({ greeting, lead, code, ttlMinutes });

  return { subject, html, text };
}
