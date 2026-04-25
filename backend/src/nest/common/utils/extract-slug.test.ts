/**
 * extractSlug() — unit tests (ADR-050, masterplan Phase 3).
 *
 * Why the cases matter:
 *   `extractSlug()` is the single source of truth for "does this host
 *   represent a tenant subdomain?" — the JwtAuthGuard cross-check and
 *   TenantHostResolverMiddleware both rely on its three-state semantics.
 *   A bug here either (a) lets an apex request through with a phantom
 *   tenantId (false positive → cross-tenant risk) or (b) rejects a valid
 *   subdomain request as apex (false negative → routing broken). Hence
 *   every documented branch has an explicit case.
 *
 * Scope (plan §Phase 3 — "extract-slug.test.ts — 8 cases" expanded to 13
 * to cover the extra edge cases documented in the source file comments):
 *   - null-returning branches: undefined, '', apex, localhost, IP, malformed
 *   - subdomain acceptance: plain, case-normalisation, port stripping
 *   - subdomain rejection: nested, regex-boundary failures (leading/trailing
 *     hyphen, single-char slug)
 *
 * @see backend/src/nest/common/utils/extract-slug.ts
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §Decision
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 3
 */
import { describe, expect, it } from 'vitest';

import { extractSlug } from './extract-slug.js';

describe('extractSlug()', () => {
  // ─── null-returning branches (no host-based tenant context applies) ──────

  describe('returns null for non-tenant hosts', () => {
    it('returns null for undefined', () => {
      expect(extractSlug(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(extractSlug('')).toBeNull();
    });

    it('returns null for the apex `assixx.com`', () => {
      expect(extractSlug('assixx.com')).toBeNull();
    });

    it('returns null for `www.assixx.com` (apex with www)', () => {
      expect(extractSlug('www.assixx.com')).toBeNull();
    });

    it('returns null for the apex regardless of casing', () => {
      // `toLowerCase()` is applied before the apex Set lookup — belt-and-braces
      // against a hand-crafted request that uses mixed-case hostnames.
      expect(extractSlug('ASSIXX.COM')).toBeNull();
      expect(extractSlug('Www.Assixx.Com')).toBeNull();
    });

    it('returns null for `localhost` (Vite dev server)', () => {
      expect(extractSlug('localhost')).toBeNull();
    });

    it('returns null for `localhost:5173` (port stripped before check)', () => {
      expect(extractSlug('localhost:5173')).toBeNull();
    });

    it('returns null for nested `*.*.localhost` (single-label only — mirrors prod)', () => {
      // `foo.bar.localhost` fails DEV_SUBDOMAIN_REGEX (anchored, single label).
      // Same treatment as the prod nested case `a.b.assixx.com`.
      expect(extractSlug('a.b.localhost')).toBeNull();
      expect(extractSlug('foo.bar.localhost:5173')).toBeNull();
    });

    it('returns null for IPv4 literals (docker-network calls, direct-IP probes)', () => {
      expect(extractSlug('127.0.0.1')).toBeNull();
      expect(extractSlug('192.168.1.10')).toBeNull();
      expect(extractSlug('10.0.0.1:3000')).toBeNull();
    });

    it('returns null for unrelated hosts not ending in .assixx.com', () => {
      expect(extractSlug('example.com')).toBeNull();
      expect(extractSlug('assixx.io')).toBeNull();
      expect(extractSlug('firma-a.other.com')).toBeNull();
    });
  });

  // ─── accepts: valid subdomain patterns ───────────────────────────────────

  describe('returns the slug for valid subdomains', () => {
    it('returns the slug for `firma-a.assixx.com`', () => {
      expect(extractSlug('firma-a.assixx.com')).toBe('firma-a');
    });

    it('returns the slug for a two-char slug `ab.assixx.com` (regex min length)', () => {
      // SUBDOMAIN_REGEX enforces `[a-z0-9][a-z0-9-]*[a-z0-9]` — start+end
      // alphanum means the absolute minimum is 2 chars.
      expect(extractSlug('ab.assixx.com')).toBe('ab');
    });

    it('lowercases the slug when the host is submitted in mixed case', () => {
      // Documented policy (ADR-050 §Decision + source file comment):
      // host is toLowerCase()'d before match, slug is therefore always lower.
      expect(extractSlug('FIRMA-A.assixx.com')).toBe('firma-a');
      expect(extractSlug('Firma-A.Assixx.Com')).toBe('firma-a');
    });

    it('strips the port before matching', () => {
      // Prod hits nginx on :443 and forwards with the port stripped, but
      // dev/docker-network calls may carry the port in the Host header.
      expect(extractSlug('firma-a.assixx.com:443')).toBe('firma-a');
      expect(extractSlug('firma-a.assixx.com:3000')).toBe('firma-a');
    });

    it('accepts digits and hyphens inside the slug', () => {
      expect(extractSlug('tenant-123.assixx.com')).toBe('tenant-123');
      expect(extractSlug('a1b2c3.assixx.com')).toBe('a1b2c3');
    });

    it('returns the slug for `<slug>.localhost` dev opt-in (Session 12c-fix)', () => {
      // ADR-050 §"Local Dev" pattern: developer adds
      // `127.0.0.1 firma-a.localhost` to /etc/hosts, then hits
      // `http://firma-a.localhost:5173/login`. Middleware must resolve the
      // slug so R14/R15/cross-tenant defences apply identically to prod.
      // Before Session 12c-fix this returned null, making /etc/hosts setup
      // silently ineffective — documented in the masterplan bug fix.
      expect(extractSlug('firma-a.localhost')).toBe('firma-a');
      expect(extractSlug('firma-a.localhost:5173')).toBe('firma-a');
      expect(extractSlug('testfirma.localhost')).toBe('testfirma');
    });

    it('lowercases the dev-subdomain slug identically to prod', () => {
      expect(extractSlug('Firma-A.Localhost')).toBe('firma-a');
      expect(extractSlug('TESTFIRMA.LOCALHOST:5173')).toBe('testfirma');
    });
  });

  // ─── rejects: malformed / boundary-violating subdomains ───────────────────

  describe('returns null for malformed subdomain shapes', () => {
    it('returns null for nested subdomains `a.b.assixx.com` (anchored regex rejects)', () => {
      // Nginx config mirrors this shape — nested subdomains fall through to
      // the catch-all 444. Backend middleware must agree: unknown pattern →
      // null → JWT path still works for internal callers but no host
      // cross-check applies.
      expect(extractSlug('a.b.assixx.com')).toBeNull();
      expect(extractSlug('deep.nested.slug.assixx.com')).toBeNull();
    });

    it('returns null for a single-character slug (regex requires start AND end alphanum)', () => {
      // `^[a-z0-9][a-z0-9-]*[a-z0-9]$` fails on length-1 because start and
      // end are the same char — no `[a-z0-9-]*` in between.
      expect(extractSlug('a.assixx.com')).toBeNull();
    });

    it('returns null for a slug with a leading hyphen', () => {
      expect(extractSlug('-firma.assixx.com')).toBeNull();
    });

    it('returns null for a slug with a trailing hyphen', () => {
      expect(extractSlug('firma-.assixx.com')).toBeNull();
    });

    it('returns null for a slug with uppercase-only after mixed input that still breaks the shape', () => {
      // Underscores are not allowed (RFC-1035 DNS label).
      expect(extractSlug('firma_a.assixx.com')).toBeNull();
    });

    it('returns null for whitespace-only host', () => {
      // Leading/trailing space is trimmed; a host that becomes '' after
      // trim falls through to the empty-string null branch.
      expect(extractSlug('   ')).toBeNull();
    });
  });
});
