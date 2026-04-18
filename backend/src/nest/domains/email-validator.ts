/**
 * Central email / domain validator (three-layer, synchronous, offline).
 *
 * Used by:
 *   - signup (§2.8 + D31): validates `SignupDto.email` AND `SignupDto.adminEmail`
 *     before `tenants` INSERT — both get the same gate.
 *   - add-domain (§2.5): validates the bare domain before `tenant_domains` INSERT.
 *   - OAuth signup (§2.8b): validates the Azure AD email before auto-verifying
 *     the tenant's domain.
 *
 * Three layers, evaluated in strict order (first rejection wins):
 *   1. Shape gate — exactly one `@`, non-empty local + domain parts.
 *   2. `mailchecker@^6` — disposable / burner providers (burner.email,
 *     mailinator, 10minutemail, …). Upstream-maintained, MIT.
 *   3. Committed freemail Set (`./data/freemail-domains.json`,
 *     Kikobeats/free-email-domains, MIT) — free/personal providers (Gmail,
 *     Outlook, GMX, Web.de, T-Online, Freenet, Yahoo, iCloud, AOL, Mail.ru,
 *     Proton, Tutanota, ~4780 more).
 *
 * No MX / SMTP / DNS in this module — DNS TXT verification later is the actual
 * proof-of-ownership and a stronger check. MX at signup adds latency + fail-risk
 * for no real security gain (§0.2.5 #6).
 *
 * @see docs/infrastructure/adr/ADR-049-tenant-domain-verification.md (Layer 1: Signup Hardening)
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §2.3
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §0.2.5 #6 + #12
 * @see scripts/sync-freemail-list.ts — monthly upstream diff (never auto-commits)
 */
import mailchecker from 'mailchecker';

// WHY: Committed upstream-pinned freemail list (Kikobeats/free-email-domains,
// HubSpot-based) — see ADR-048 (pending) + §0.2.5 #12. No npm wrapper, diffs
// reviewable in Git, MIT-clean, monthly sync via scripts/sync-freemail-list.ts.
// `with { type: 'json' }` is REQUIRED at runtime because backend is pure ESM
// (backend/package.json "type": "module") — Node 24 rejects JSON imports
// without the attribute (ERR_IMPORT_ASSERTION_TYPE_MISSING).
import freemailRaw from './data/freemail-domains.json' with { type: 'json' };

export type EmailValidationFailure = 'INVALID_FORMAT' | 'DISPOSABLE_EMAIL' | 'FREE_EMAIL_PROVIDER';

export interface EmailValidationResult {
  readonly valid: boolean;
  readonly failure?: EmailValidationFailure;
}

// Frozen Set — O(1) lookup, no runtime mutation (static build-time data).
// Lower-casing at construction so callers don't need to normalize inputs twice.
const FREEMAIL_DOMAINS: ReadonlySet<string> = new Set(
  (freemailRaw as readonly string[]).map((d: string) => d.toLowerCase()),
);

/**
 * Strict business-email validation for signup + add-domain flows.
 *
 * Three layers, evaluated in order:
 *   1. Basic format gate: must contain exactly one '@' with non-empty local + domain parts.
 *   2. `mailchecker` — blocks disposable / burner providers (incl. custom-domain burners
 *      like burner.email, mail-temp.io that aren't on freemail lists).
 *   3. Committed freemail Set-lookup — blocks free/personal email providers (Gmail, Outlook,
 *      GMX, Web.de, T-Online, Freenet, Yahoo, iCloud, AOL, Mail.ru, Proton, Tutanota,
 *      ~4780 more based on Kikobeats/free-email-domains).
 *
 * No MX / SMTP / DNS at signup time — DNS TXT verification later is the actual
 * proof-of-ownership and a stronger check. MX at signup adds latency + fail-risk
 * for no real security gain (see §0.2.5 #6).
 */
export function validateBusinessEmail(email: string): EmailValidationResult {
  // Layer 1 — basic shape (no regex-theater, just the essentials).
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@') || at === email.length - 1) {
    return { valid: false, failure: 'INVALID_FORMAT' };
  }

  // Layer 2 — disposable / burner providers (covers list entries with custom-looking
  // domain names that wouldn't appear in the freemail list).
  if (!mailchecker.isValid(email)) {
    return { valid: false, failure: 'DISPOSABLE_EMAIL' };
  }

  // Layer 3 — freemail providers (Gmail, Outlook, GMX, Web.de, T-Online, …).
  const domain = email.slice(at + 1).toLowerCase();
  if (FREEMAIL_DOMAINS.has(domain)) {
    return { valid: false, failure: 'FREE_EMAIL_PROVIDER' };
  }

  return { valid: true };
}

export function extractDomain(email: string): string {
  const parts = email.toLowerCase().split('@');
  if (parts.length !== 2 || parts[1] === undefined || parts[1] === '') {
    throw new Error('Cannot extract domain from malformed email');
  }
  return parts[1];
}

/**
 * Exposed for the add-domain flow: given a bare domain (not an email),
 * reject if it's a known freemail provider. A verified tenant cannot add
 * `gmail.com` as a second domain (§0.2.5 #4).
 */
export function isFreemailDomain(domain: string): boolean {
  return FREEMAIL_DOMAINS.has(domain.toLowerCase());
}

/**
 * Business-domain validator for the add-domain flow (§0.2.5 #15, Q7, v0.3.0 G6).
 *
 * Wraps the same primitives as `validateBusinessEmail()` behind a bare-domain
 * signature. The caller passes a domain, not an email — that is the only
 * API-surface benefit over reusing `validateBusinessEmail()` directly.
 *
 * Implementation detail (hidden from callers): `mailchecker` has no domain-only
 * public API, so the disposable check is performed via `mailchecker.isValid(
 * 'x@' + domain)`. The `x@` synthesis is encapsulated here under a single
 * point of test — not repeated in every call site.
 *
 * Returns the same failure-shape as `validateBusinessEmail` so controllers can
 * map both paths through a single error-code table.
 *
 *   - `INVALID_FORMAT` for malformed domains (empty, multiple dots only, leading `.`, …).
 *     Uses a strict RFC-1035 label regex.
 *   - `DISPOSABLE_EMAIL` if `mailchecker.isValid('x@' + domain)` rejects it.
 *   - `FREE_EMAIL_PROVIDER` if the domain is on the committed freemail Set.
 */
export function validateBusinessDomain(domain: string): EmailValidationResult {
  const normalized = domain.trim().toLowerCase();

  // RFC-1035-ish label validation: 1+ labels, each 1-63 chars, LDH only, no leading/trailing hyphen.
  const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  if (normalized === '' || normalized.length > 253) {
    return { valid: false, failure: 'INVALID_FORMAT' };
  }
  const labels = normalized.split('.');
  if (labels.length < 2 || !labels.every((label: string) => LABEL.test(label))) {
    return { valid: false, failure: 'INVALID_FORMAT' };
  }

  // Disposable / burner check — probe via a throwaway local-part (mailchecker is email-only).
  if (!mailchecker.isValid(`x@${normalized}`)) {
    return { valid: false, failure: 'DISPOSABLE_EMAIL' };
  }

  // Freemail check — same Set as the email validator.
  if (FREEMAIL_DOMAINS.has(normalized)) {
    return { valid: false, failure: 'FREE_EMAIL_PROVIDER' };
  }

  return { valid: true };
}
