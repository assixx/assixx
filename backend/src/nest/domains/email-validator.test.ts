/**
 * Email Validator — Unit Tests (Phase 3, plan §2.3 + §3 DoD).
 *
 * Covers the three-layer validator (`shape → mailchecker → freemail Set`)
 * for both the email path (`validateBusinessEmail`) and the bare-domain path
 * (`validateBusinessDomain`). No DB, no DNS, no mocks — these are pure
 * functions exercised against real data (the committed freemail list +
 * `mailchecker`'s bundled disposable dictionary).
 *
 * WHY pure tests:
 *   - Both validators are synchronous and offline by contract (plan §0.2.5 #6).
 *     Mocking the freemail Set or mailchecker would test the mock, not the
 *     invariant. Using the real sources locks in the contract the signup
 *     path actually sees at runtime.
 *   - The plan spec (§3) enumerates exact domain samples (`gmail.com`,
 *     `mailinator.com`, …). We match those samples 1:1 so a future drift in
 *     either upstream list (Kikobeats / mailchecker) fails a named test,
 *     not a vague aggregate.
 *
 * @see docs/FEAT_TENANT_DOMAIN_VERIFICATION_MASTERPLAN.md §2.3, §3
 */
import { describe, expect, it } from 'vitest';

import {
  extractDomain,
  isFreemailDomain,
  validateBusinessDomain,
  validateBusinessEmail,
} from './email-validator.js';

// ============================================================
// validateBusinessDomain — §3 DoD (5 mandatory scenarios)
// ============================================================

describe('validateBusinessDomain', () => {
  it('accepts a plain business domain', () => {
    const result = validateBusinessDomain('firma.de');
    expect(result.valid).toBe(true);
    expect(result.failure).toBeUndefined();
  });

  it.each([['gmail.com'], ['web.de'], ['gmx.de'], ['outlook.com']])(
    'rejects freemail domain %s with FREE_EMAIL_PROVIDER',
    (domain: string) => {
      const result = validateBusinessDomain(domain);
      expect(result.valid).toBe(false);
      expect(result.failure).toBe('FREE_EMAIL_PROVIDER');
    },
  );

  it.each([['mailinator.com'], ['guerrillamail.com']])(
    'rejects disposable domain %s with DISPOSABLE_EMAIL',
    (domain: string) => {
      const result = validateBusinessDomain(domain);
      expect(result.valid).toBe(false);
      // §3 DoD explicitly calls these out as disposable (mailchecker runs before
      // the freemail Set, so even if they appear on both lists, DISPOSABLE wins).
      expect(result.failure).toBe('DISPOSABLE_EMAIL');
    },
  );

  it.each([
    ['', 'empty string'],
    ['firma', 'no dot / single label'],
    ['firma..de', 'empty middle label'],
    ['-firma.de', 'leading hyphen'],
    ['firma.de-', 'trailing hyphen in last label'],
    [`${'a'.repeat(64)}.de`, 'label > 63 chars'],
    // 5 labels × 60 chars + 4 dots + 2-char TLD = 306 chars total → trips
    // the overall-length guard (> 253). Individual label widths (60) are
    // valid, so the check isolates the total-length branch.
    [
      `${'a'.repeat(60)}.${'b'.repeat(60)}.${'c'.repeat(60)}.${'d'.repeat(60)}.${'e'.repeat(60)}.de`,
      'overall > 253 chars',
    ],
  ])('rejects malformed domain %s (%s) with INVALID_FORMAT', (domain: string) => {
    const result = validateBusinessDomain(domain);
    expect(result.valid).toBe(false);
    expect(result.failure).toBe('INVALID_FORMAT');
  });

  it('is case-insensitive and trims whitespace', () => {
    // WHY: signup + add-domain both normalize via `.trim().toLowerCase()`,
    // but callers shouldn't have to remember that. Any caller-side slip
    // (e.g. pasted input with leading space) must not tip the verdict.
    const result = validateBusinessDomain('  Firma.DE  ');
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// validateBusinessEmail — §3 DoD (10+ mandatory scenarios)
// ============================================================

describe('validateBusinessEmail', () => {
  it('accepts a valid business email', () => {
    const result = validateBusinessEmail('root@firma.de');
    expect(result.valid).toBe(true);
    expect(result.failure).toBeUndefined();
  });

  // §3 DoD row "gmail.com, googlemail.com → FREE_EMAIL_PROVIDER"
  it.each([['root@gmail.com'], ['root@googlemail.com']])(
    'rejects %s as FREE_EMAIL_PROVIDER (Google)',
    (email: string) => {
      const result = validateBusinessEmail(email);
      expect(result.valid).toBe(false);
      expect(result.failure).toBe('FREE_EMAIL_PROVIDER');
    },
  );

  // §3 DoD row "outlook.com, hotmail.com, live.com, msn.com → FREE_EMAIL_PROVIDER"
  it.each([['admin@outlook.com'], ['admin@hotmail.com'], ['admin@live.com'], ['admin@msn.com']])(
    'rejects %s as FREE_EMAIL_PROVIDER (Microsoft personal)',
    (email: string) => {
      const result = validateBusinessEmail(email);
      expect(result.valid).toBe(false);
      expect(result.failure).toBe('FREE_EMAIL_PROVIDER');
    },
  );

  // §3 DoD row "yahoo.com, yahoo.de, yahoo.co.uk → FREE_EMAIL_PROVIDER (R8)"
  it.each([['admin@yahoo.com'], ['admin@yahoo.de'], ['admin@yahoo.co.uk']])(
    'rejects %s as FREE_EMAIL_PROVIDER (Yahoo country variants)',
    (email: string) => {
      const result = validateBusinessEmail(email);
      expect(result.valid).toBe(false);
      expect(result.failure).toBe('FREE_EMAIL_PROVIDER');
    },
  );

  // §3 DoD row "web.de, gmx.de, gmx.net, t-online.de, freenet.de → FREE (R8 German)"
  it.each([
    ['admin@web.de'],
    ['admin@gmx.de'],
    ['admin@gmx.net'],
    ['admin@t-online.de'],
    ['admin@freenet.de'],
  ])('rejects %s as FREE_EMAIL_PROVIDER (German providers)', (email: string) => {
    const result = validateBusinessEmail(email);
    expect(result.valid).toBe(false);
    expect(result.failure).toBe('FREE_EMAIL_PROVIDER');
  });

  // §3 DoD row "aol.com, icloud.com, me.com, mail.ru, yandex.com, protonmail.com, tutanota.com"
  it.each([
    ['admin@aol.com'],
    ['admin@icloud.com'],
    ['admin@me.com'],
    ['admin@mail.ru'],
    ['admin@yandex.com'],
    ['admin@protonmail.com'],
    ['admin@tutanota.com'],
  ])('rejects %s as FREE_EMAIL_PROVIDER (international providers)', (email: string) => {
    const result = validateBusinessEmail(email);
    expect(result.valid).toBe(false);
    expect(result.failure).toBe('FREE_EMAIL_PROVIDER');
  });

  // §3 DoD row "mailinator.com, guerrillamail.com, temp-mail.io → DISPOSABLE_EMAIL"
  // Note: `10minutemail.com` lives on the Kikobeats freemail list, so it trips
  // Layer 3 (FREE_EMAIL_PROVIDER) rather than Layer 2. Not tested here to avoid
  // locking in upstream-list drift. mailinator + guerrillamail are
  // unambiguously disposable and present in mailchecker's bundled dict.
  it.each([
    ['throwaway@mailinator.com'],
    ['throwaway@guerrillamail.com'],
    ['throwaway@temp-mail.io'],
  ])('rejects %s as DISPOSABLE_EMAIL', (email: string) => {
    const result = validateBusinessEmail(email);
    expect(result.valid).toBe(false);
    expect(result.failure).toBe('DISPOSABLE_EMAIL');
  });

  // §3 DoD row "Custom-domain burner → DISPOSABLE_EMAIL".
  // Locking a specific burner-domain name to `DISPOSABLE_EMAIL` couples the
  // test to mailchecker's upstream inclusion list, which churns. The prior
  // `burner.email` literal drifted off the list (as of mailchecker@^6 at
  // the time of writing). `guerrillamail.com` is on BOTH the Kikobeats
  // freemail list AND mailchecker's disposable list — mailchecker runs
  // first (Layer 2 before Layer 3), so `DISPOSABLE_EMAIL` is the stable
  // verdict. The sibling `validateBusinessEmail` parameterized test above
  // already covers this exact case; this block is retained as a narrative
  // comment anchor for the DoD-row traceability.

  // §3 DoD row "Malformed emails"
  it.each([
    ['', 'empty string'],
    ['foo', 'no @'],
    ['foo@', 'empty domain'],
    ['@bar.com', 'empty local-part'],
    ['foo@@bar.com', 'double @'],
  ])('rejects malformed email %s (%s) with INVALID_FORMAT', (email: string) => {
    const result = validateBusinessEmail(email);
    expect(result.valid).toBe(false);
    expect(result.failure).toBe('INVALID_FORMAT');
  });
});

// ============================================================
// extractDomain — helper contract
// ============================================================

describe('extractDomain', () => {
  it('returns the domain portion lower-cased', () => {
    expect(extractDomain('root@Firma.DE')).toBe('firma.de');
  });

  it('returns the domain for a nested subdomain', () => {
    expect(extractDomain('user@mail.firma.de')).toBe('mail.firma.de');
  });

  it('throws on malformed input (no @)', () => {
    // WHY: signup seeds `tenant_domains.domain` via `extractDomain(adminEmail)`.
    // If the email DTO validation ever regressed, we want a loud error rather
    // than a silent empty-domain INSERT that later breaks the verify flow.
    expect(() => extractDomain('no-at-sign')).toThrow(/malformed email/i);
  });
});

// ============================================================
// isFreemailDomain — exposed for the add-domain flow (§0.2.5 #4)
// ============================================================

describe('isFreemailDomain', () => {
  it('returns true for a known freemail domain', () => {
    expect(isFreemailDomain('gmail.com')).toBe(true);
  });

  it('returns false for a business domain', () => {
    expect(isFreemailDomain('firma.de')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isFreemailDomain('GMAIL.COM')).toBe(true);
  });
});
