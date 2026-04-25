/**
 * Unit tests for `buildSubdomainUrl` — pure-function tests, no Nest harness.
 *
 * Every row of the apex-derivation table in the helper's JSDoc gets a matching
 * test here. A regression in dev/prod parity (e.g. someone re-hardcodes
 * `https://${slug}.assixx.com`) fails a test instead of leaking a silent bug
 * — the same bug the 2026-04-22 OAuth-subdomain-fix was catching retroactively.
 *
 * Reason-for-tests coupling: `buildSubdomainUrl` is the load-bearing line for
 * the R15 host-cross-check — if it produces a URL whose host decodes to a
 * different tenant than the payload tenant, cookies land nowhere or trigger
 * HANDOFF_HOST_MISMATCH. Any change here needs corresponding frontend-helper
 * (`buildSubdomainHandoffUrl` in `login/+page.server.ts`) review.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §"Local Dev"
 */
import { describe, expect, it } from 'vitest';

import { buildSubdomainUrl } from './build-subdomain-url.js';

describe('buildSubdomainUrl', () => {
  describe('dev (PUBLIC_APP_URL=http://localhost:5173)', () => {
    const publicAppUrl = 'http://localhost:5173';

    it('prepends slug, keeps http scheme, keeps :5173', () => {
      expect(buildSubdomainUrl('scs-technik', '/root-dashboard', publicAppUrl)).toBe(
        'http://scs-technik.localhost:5173/root-dashboard',
      );
    });

    it('preserves query-string in path', () => {
      expect(
        buildSubdomainUrl('testfirma', '/signup/oauth-complete?token=abc123', publicAppUrl),
      ).toBe('http://testfirma.localhost:5173/signup/oauth-complete?token=abc123');
    });

    it('accepts slugs with hyphens (RFC-1035)', () => {
      expect(buildSubdomainUrl('firma-a', '/', publicAppUrl)).toBe(
        'http://firma-a.localhost:5173/',
      );
    });
  });

  describe('prod (PUBLIC_APP_URL=https://www.assixx.com)', () => {
    const publicAppUrl = 'https://www.assixx.com';

    it('drops the www label and prepends slug — `*.www.assixx.com` would not match wildcard cert', () => {
      expect(buildSubdomainUrl('scs-technik', '/root-dashboard', publicAppUrl)).toBe(
        'https://scs-technik.assixx.com/root-dashboard',
      );
    });

    it('keeps https scheme, omits port suffix (:443 default)', () => {
      expect(buildSubdomainUrl('testfirma', '/login', publicAppUrl)).toBe(
        'https://testfirma.assixx.com/login',
      );
    });
  });

  describe('prod-bare (PUBLIC_APP_URL=https://assixx.com)', () => {
    const publicAppUrl = 'https://assixx.com';

    it('prepends slug to bare apex', () => {
      expect(buildSubdomainUrl('scs-technik', '/root-dashboard', publicAppUrl)).toBe(
        'https://scs-technik.assixx.com/root-dashboard',
      );
    });
  });

  describe('pathological PUBLIC_APP_URL (already subdomain-shaped)', () => {
    it('swaps first label — prevents `{slug}.{sub}.assixx.com` wildcard-cert miss', () => {
      // Guards against a misconfiguration where PUBLIC_APP_URL accidentally
      // points at a subdomain (e.g. after a bad Doppler edit). We cannot fix
      // the env but we can avoid producing a URL the wildcard cert wouldn't
      // cover (RFC 6125 §6.4.3 — one label deep).
      expect(buildSubdomainUrl('scs-technik', '/x', 'https://staging.assixx.com')).toBe(
        'https://scs-technik.assixx.com/x',
      );
    });
  });

  describe('port preservation', () => {
    it('non-default port is carried through', () => {
      expect(buildSubdomainUrl('t', '/p', 'http://localhost:8080')).toBe(
        'http://t.localhost:8080/p',
      );
    });

    it('default ports (443 for https, 80 for http) are normalised out by `new URL`', () => {
      expect(buildSubdomainUrl('t', '/p', 'https://assixx.com')).toBe('https://t.assixx.com/p');
      // new URL('https://...:443') strips the redundant :443 → we inherit that
      // normalisation. Same for http:80. Intended: never emit default-port URLs.
      expect(buildSubdomainUrl('t', '/p', 'https://assixx.com:443')).toBe('https://t.assixx.com/p');
      expect(buildSubdomainUrl('t', '/p', 'http://localhost:80')).toBe('http://t.localhost/p');
    });
  });

  describe('path invariants', () => {
    it('relative-path input MUST begin with `/` — we do not inject one', () => {
      // Caller responsibility. Mirrors the frontend twin — neither side tries
      // to be clever about path shape.
      const result = buildSubdomainUrl('t', 'no-leading-slash', 'https://assixx.com');
      // No crash; the URL is technically valid even if malformed for routing.
      // We assert the shape so a future change that DOES auto-prepend `/`
      // surfaces as a test fail (it would silently change caller contract).
      expect(result).toBe('https://t.assixx.comno-leading-slash');
    });
  });
});
