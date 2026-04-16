/**
 * Unit tests for OAuth pure helpers.
 *
 * ADR-018 Tier 1b (frontend-unit) — pure function, no component harness,
 * no DOM. Runs in the `frontend-unit` vitest project.
 *
 * @see ./oauth.ts
 */
import { describe, expect, it } from 'vitest';

import { mapOAuthErrorReason, splitDisplayName } from './oauth.js';

describe('mapOAuthErrorReason', () => {
  it('returns the German message for the duplicate-Microsoft-account slug (R3)', () => {
    expect(mapOAuthErrorReason('already_linked')).toBe(
      'Dieses Microsoft-Konto ist bereits mit einem Assixx-Tenant verknüpft.',
    );
  });

  it('returns the German message for generic callback failure', () => {
    expect(mapOAuthErrorReason('callback_failed')).toBe(
      'Die Microsoft-Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
    );
  });

  it('returns the German message for missing authorization code', () => {
    expect(mapOAuthErrorReason('missing_code')).toBe(
      'Die Microsoft-Anmeldung wurde abgebrochen. Bitte starten Sie erneut.',
    );
  });

  it('falls back to a generic German message for unknown slugs', () => {
    expect(mapOAuthErrorReason('any_new_microsoft_code_we_have_not_seen_yet')).toBe(
      'Die Microsoft-Anmeldung konnte nicht abgeschlossen werden.',
    );
  });

  it('falls back to generic for empty string (should never happen but be defensive)', () => {
    expect(mapOAuthErrorReason('')).toBe(
      'Die Microsoft-Anmeldung konnte nicht abgeschlossen werden.',
    );
  });

  it('NEVER echoes the raw slug back (no interpolation, no leak of provider strings)', () => {
    const raw = 'AADSTS50020: Personal Microsoft account used';
    const result = mapOAuthErrorReason(raw);
    expect(result).not.toContain('AADSTS');
    expect(result).not.toContain('50020');
  });
});

describe('splitDisplayName', () => {
  it('splits "Ada Lovelace" into first=Ada last=Lovelace', () => {
    expect(splitDisplayName('Ada Lovelace')).toEqual({ first: 'Ada', last: 'Lovelace' });
  });

  it('keeps a single-word displayName as first + empty last', () => {
    expect(splitDisplayName('Max')).toEqual({ first: 'Max', last: '' });
  });

  it('joins the tail for three-or-more-word names', () => {
    expect(splitDisplayName('Hans Peter Müller')).toEqual({
      first: 'Hans',
      last: 'Peter Müller',
    });
  });

  it('returns empty first/last for null', () => {
    expect(splitDisplayName(null)).toEqual({ first: '', last: '' });
  });

  it('returns empty first/last for undefined', () => {
    expect(splitDisplayName(undefined)).toEqual({ first: '', last: '' });
  });

  it('returns empty first/last for empty string', () => {
    expect(splitDisplayName('')).toEqual({ first: '', last: '' });
  });

  it('returns empty first/last for whitespace-only string', () => {
    expect(splitDisplayName('   ')).toEqual({ first: '', last: '' });
  });

  it('collapses repeated internal whitespace', () => {
    expect(splitDisplayName('Ada   Lovelace')).toEqual({ first: 'Ada', last: 'Lovelace' });
  });

  it('trims leading and trailing whitespace', () => {
    expect(splitDisplayName('  Ada Lovelace  ')).toEqual({ first: 'Ada', last: 'Lovelace' });
  });

  it('preserves Umlaute and hyphens in names', () => {
    expect(splitDisplayName('Björn Müller-Schmidt')).toEqual({
      first: 'Björn',
      last: 'Müller-Schmidt',
    });
  });

  it('handles tabs and newlines as whitespace separators', () => {
    expect(splitDisplayName('Ada\tLovelace')).toEqual({ first: 'Ada', last: 'Lovelace' });
  });
});
