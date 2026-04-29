/**
 * 2FA Code Email Template — German HTML + plain-text fallback.
 *
 * STATUS: FEAT_2FA_EMAIL_MASTERPLAN Phase 2 §2.9 (v0.6.0).
 *
 * WHY a TypeScript builder (vs. an HTML file in `backend/templates/email/`):
 *   The 2FA code is a security-critical, code-driven payload — the template
 *   needs typed inputs (`code: string`, `purpose: 'login' | 'signup'`,
 *   `ttlMinutes: number`) and per-purpose copy variation. The legacy
 *   `loadTemplate()` helper in `email-service.ts` accepts only `string`
 *   replacements with no type-safety, and routes through HTML-entity escaping
 *   that is unnecessary for our 6-char Crockford-Base32 codes (which contain
 *   only A-Z and 2-9 by design — no special characters to escape).
 *
 * DESIGN DECISIONS encoded here:
 *   - DD-13: Generic subject — code never appears in subject, mail-list
 *     previews, or lock-screen banners. Body-only.
 *   - DD-13: Sender = `noreply@<assixx-domain>` from `SMTP_FROM`. Set by
 *     `email-service.sendEmail()` at send time, NOT here.
 *   - DD-1 / DD-12: Code is 6 chars from Crockford-Base32 subset
 *     (A-HJKMNP-Z2-9). Rendered as monospace, no separator (preserves iOS
 *     auto-fill heuristic per WHATWG `autocomplete=one-time-code`).
 *   - "Geben Sie diesen Code niemandem weiter" — phishing-mitigation copy.
 *   - No tracking pixels, no external CSS/images, no JavaScript.
 *   - Plain-text fallback ALWAYS present (DD-13 mail-client compat).
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.9)
 * @see ADR-054 (drafted in Phase 6): Mandatory Email-Based 2FA.
 */

/**
 * Purposes the 2FA-code template renders intro copy for.
 *
 * Mirrors `ChallengePurpose` in `two-factor-auth.types.ts` — kept as a literal
 * union here to keep this file backend-agnostic (no NestJS dependency drag).
 * The two strings stay in sync via the exhaustive `buildIntro` switch below;
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
        lead: 'Bitte bestätigen Sie Ihre E-Mail-Adresse, um die Registrierung abzuschließen. Geben Sie dazu den folgenden Code in der Anmeldemaske ein:',
      };
    case 'email-change-old':
      return {
        greeting: 'Hallo,',
        lead: 'Sie haben eine Änderung Ihrer Anmelde-E-Mail-Adresse beantragt. Bitte bestätigen Sie die Anfrage mit dem folgenden Code an Ihrer aktuellen Adresse:',
      };
    case 'email-change-new':
      return {
        greeting: 'Hallo,',
        lead: 'Diese Adresse wurde als neue Anmelde-E-Mail-Adresse für Ihr Assixx-Konto angegeben. Bitte bestätigen Sie die Anfrage mit dem folgenden Code:',
      };
    case 'login':
      return {
        greeting: 'Hallo,',
        lead: 'Sie haben sich gerade bei Assixx angemeldet. Geben Sie zur Bestätigung den folgenden Code in der Anmeldemaske ein:',
      };
  }
}

/**
 * Build the 2FA code email payload.
 *
 * Returned `subject` is intentionally generic per DD-13 — neither the code nor
 * the purpose appears in the subject line. Caller (`email-service.send2faCode`)
 * forwards subject/html/text to `sendEmail()` which handles transport.
 */
export function build2faCodeTemplate(input: TwoFactorCodeTemplateInput): TwoFactorCodeTemplate {
  const { code, purpose, ttlMinutes } = input;
  const { greeting, lead } = buildIntro(purpose);

  // Subject: DD-13 generic — no code, no purpose differentiation. Same string
  // for login + signup so a mail-list view leaks nothing.
  const subject = 'Ihr Bestätigungscode für Assixx';

  // Inline styles only — most mail clients (Outlook, Gmail webview) strip
  // <style> blocks. Monospace + letter-spacing makes the 6-char code easy
  // to read and type in factory environments with glare-prone screens
  // (DD-1 confusable-character mitigation context).
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
              <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:600;color:#111827;">${greeting}</h1>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#374151;">${lead}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 40px 16px 40px;">
              <div style="display:inline-block;padding:20px 32px;background-color:#f3f4f6;border:2px solid #d1d5db;border-radius:6px;font-family:'SF Mono',Menlo,Consolas,'Liberation Mono',monospace;font-size:32px;font-weight:600;letter-spacing:6px;color:#111827;">${code}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 8px 40px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#6b7280;">Der Code ist <strong>${ttlMinutes} Minuten</strong> gültig.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 24px 40px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#b91c1c;"><strong>Geben Sie diesen Code niemandem weiter.</strong> Mitarbeitende von Assixx werden Sie niemals nach Ihrem Bestätigungscode fragen.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 32px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">Falls Sie diese E-Mail nicht erwartet haben, ignorieren Sie sie bitte. Ihr Konto bleibt sicher, solange Sie den Code niemandem weitergeben.</p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0 0;font-size:12px;color:#9ca3af;">Assixx — Multi-Tenant SaaS für Industrieunternehmen</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Plain-text fallback — same content, no formatting. Some mail clients (and
  // most spam-filters) score senders that ship html-only emails as suspicious.
  const text = `${greeting}

${lead}

Ihr Bestätigungscode: ${code}

Der Code ist ${ttlMinutes} Minuten gültig.

Geben Sie diesen Code niemandem weiter. Mitarbeitende von Assixx werden Sie niemals nach Ihrem Bestätigungscode fragen.

Falls Sie diese E-Mail nicht erwartet haben, ignorieren Sie sie bitte. Ihr Konto bleibt sicher, solange Sie den Code niemandem weitergeben.

—
Assixx — Multi-Tenant SaaS für Industrieunternehmen`;

  return { subject, html, text };
}
