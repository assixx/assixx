/**
 * Unit tests for build2faSuspiciousActivityTemplate.
 *
 * Scope: pure-function template builder. Locks down the DD-13/DD-20
 * invariants (generic subject, no internal IDs / codes / tokens leaked
 * into the body, plain-text fallback always present) AND the §2.9b
 * redesign invariants (Klarna-style action-oriented advisory, dark-mode
 * shell with cid:assixx-logo).
 *
 * @see docs/FEAT_2FA_EMAIL_MASTERPLAN.md (Phase 2 §2.9 + §2.9b, DD-20)
 */
import { describe, expect, it } from 'vitest';

import { build2faSuspiciousActivityTemplate } from './2fa-suspicious-activity.template.js';

describe('build2faSuspiciousActivityTemplate', () => {
  it('uses a generic subject (DD-13 — no leak of "2FA"/"lockout" in mail-list view)', () => {
    const result = build2faSuspiciousActivityTemplate();

    expect(result.subject).toBe('Sicherheitshinweis zu Ihrem Assixx-Konto');
    expect(result.subject.toLowerCase()).not.toContain('2fa');
    expect(result.subject.toLowerCase()).not.toContain('lockout');
    expect(result.subject.toLowerCase()).not.toContain('sperre');
  });

  it('mentions the 15-minute lockout duration in HTML and text', () => {
    const result = build2faSuspiciousActivityTemplate();

    expect(result.html).toContain('15 Minuten');
    expect(result.text).toContain('15 Minuten');
  });

  it('includes both "you did this?" and "you did not?" advisories', () => {
    const result = build2faSuspiciousActivityTemplate();

    expect(result.text).toContain('Sie waren das selbst?');
    expect(result.text).toContain('Sie waren das nicht?');
    expect(result.html).toContain('Sie waren das selbst?');
    expect(result.html).toContain('Sie waren das nicht?');
  });

  // §2.9b — Klarna-style action-oriented advisory replaces the §2.9
  // passive "Diese Maßnahme schützt …" closing.
  it('contains action-oriented "Sperren Sie Ihr Konto" + "informieren Sie Ihre IT-Abteilung" (§2.9b)', () => {
    const result = build2faSuspiciousActivityTemplate();

    expect(result.html).toContain('Sperren Sie Ihr Konto');
    expect(result.text).toContain('Sperren Sie Ihr Konto');
    expect(result.html).toContain('IT-Abteilung');
    expect(result.text).toContain('IT-Abteilung');
  });

  it('always returns a non-empty plain-text fallback without HTML tags', () => {
    const result = build2faSuspiciousActivityTemplate();

    expect(result.text.length).toBeGreaterThan(0);
    expect(result.text).not.toMatch(/<\/?[a-z][^>]*>/i);
  });

  it('does not embed external HTTP(S) image URLs (no tracking pixels)', () => {
    const result = build2faSuspiciousActivityTemplate();

    expect(result.html).not.toMatch(/<img[^>]+src=["']https?:/i);
  });

  it('does not contain script tags', () => {
    const result = build2faSuspiciousActivityTemplate();

    expect(result.html).not.toMatch(/<script\b/i);
  });

  // §2.9b: dark-mode shell mirrors password-reset.html — logo via CID.
  it('references the branding logo via cid:assixx-logo (§2.9b)', () => {
    const result = build2faSuspiciousActivityTemplate();

    expect(result.html).toContain('src="cid:assixx-logo"');
  });

  it('returns deterministic output across invocations (pure function)', () => {
    const a = build2faSuspiciousActivityTemplate();
    const b = build2faSuspiciousActivityTemplate();

    expect(a).toEqual(b);
  });
});
