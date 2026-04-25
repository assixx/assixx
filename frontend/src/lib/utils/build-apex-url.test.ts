/**
 * Unit tests for `buildApexUrl` / `buildLoginUrl` — pure-function tests.
 *
 * Parity with `backend/src/nest/auth/oauth/build-subdomain-url.test.ts`:
 * every PUBLIC_APP_URL shape handled by the subdomain helper is also
 * covered here from the inverse direction. A drift between the two means
 * the logout → apex redirect and the OAuth handoff → subdomain redirect
 * can disagree on origin/port/scheme, which would surface as broken
 * cookies or 403 `CROSS_TENANT_HOST_MISMATCH` chains.
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md
 *      §"Amendment — Logout → Apex"
 */
import { describe, expect, it } from 'vitest';

import { buildApexUrl, buildLoginUrl, type LoginRedirectReason } from './build-apex-url.js';

// Extracted constants satisfy sonarjs/no-duplicate-string. The reason values
// under test are the very enum members of `LoginRedirectReason` — binding
// them to typed constants also keeps the test honest if a member is ever
// renamed (the `LoginRedirectReason` import would break, not a silent
// string-typo mismatch).
const LOGOUT_SUCCESS: LoginRedirectReason = 'logout-success';
const SESSION_EXPIRED: LoginRedirectReason = 'session-expired';
const SESSION_FORBIDDEN: LoginRedirectReason = 'session-forbidden';

// Shared URL literals — extracted to satisfy sonarjs/no-duplicate-string after
// the SSR-fallback tests were added (Phase 1 ADR-050 fix, 2026-04-25). These
// are the canonical fixtures for the dev-apex / prod-apex / dev-subdomain
// shapes referenced across both the browser-fallback and SSR-fallback test
// suites — single source of truth keeps client/server parity literal-explicit.
const DEV_APEX_URL = 'http://localhost:5173';
const DEV_LOGIN_URL = 'http://localhost:5173/login';
const DEV_LOGIN_LOGOUT = 'http://localhost:5173/login?logout=success';
const DEV_LOGIN_SESSION_EXPIRED = 'http://localhost:5173/login?session=expired';
const PROD_LOGIN_SESSION_EXPIRED = 'https://www.assixx.com/login?session=expired';
const PROD_LOGIN_SESSION_FORBIDDEN = 'https://www.assixx.com/login?session=forbidden';
// Canonical "user is on a tenant subdomain in dev" fixture — used by both
// browser-fallback (setLocation) and SSR-fallback (new URL(...)) suites.
const DEV_SUBDOMAIN_DASHBOARD = 'http://testfirma.localhost:5173/dashboard';

describe('buildApexUrl', () => {
  describe('dev (PUBLIC_APP_URL=http://localhost:5173)', () => {
    const publicAppUrl = DEV_APEX_URL;

    it('returns origin + path unchanged', () => {
      expect(buildApexUrl('/login', publicAppUrl)).toBe(DEV_LOGIN_URL);
    });

    it('preserves query string in path', () => {
      expect(buildApexUrl('/login?logout=success', publicAppUrl)).toBe(DEV_LOGIN_LOGOUT);
    });

    it('preserves port', () => {
      expect(buildApexUrl('/', publicAppUrl)).toBe('http://localhost:5173/');
    });
  });

  describe('prod (PUBLIC_APP_URL=https://www.assixx.com)', () => {
    const publicAppUrl = 'https://www.assixx.com';

    it('keeps www label as apex origin', () => {
      // Unlike buildSubdomainUrl which drops `www` before prepending a slug,
      // the apex IS whatever PUBLIC_APP_URL points at — that is the contract.
      expect(buildApexUrl('/login', publicAppUrl)).toBe('https://www.assixx.com/login');
    });

    it('omits default :443', () => {
      expect(buildApexUrl('/login', 'https://www.assixx.com:443')).toBe(
        'https://www.assixx.com/login',
      );
    });
  });

  describe('prod-bare (PUBLIC_APP_URL=https://assixx.com)', () => {
    it('returns bare apex unchanged', () => {
      expect(buildApexUrl('/login', 'https://assixx.com')).toBe('https://assixx.com/login');
    });
  });

  describe('path invariants', () => {
    it('caller must provide leading slash (mirrors buildSubdomainUrl contract)', () => {
      // No auto-prepend. Contract parity with the subdomain twin — neither
      // helper tries to be clever about path shape.
      expect(buildApexUrl('no-leading-slash', 'https://assixx.com')).toBe(
        'https://assixx.comno-leading-slash',
      );
    });
  });
});

describe('buildLoginUrl', () => {
  const publicAppUrl = DEV_APEX_URL;

  it('no reason → neutral /login (direct link / first visit)', () => {
    expect(buildLoginUrl(undefined, publicAppUrl)).toBe(DEV_LOGIN_URL);
  });

  it('logout-success → ?logout=success (active user action)', () => {
    expect(buildLoginUrl(LOGOUT_SUCCESS, publicAppUrl)).toBe(DEV_LOGIN_LOGOUT);
  });

  it('session-expired → ?session=expired (passive JWT expiry)', () => {
    expect(buildLoginUrl(SESSION_EXPIRED, publicAppUrl)).toBe(DEV_LOGIN_SESSION_EXPIRED);
  });

  it('session-forbidden → ?session=forbidden (CROSS_TENANT_HOST_MISMATCH)', () => {
    expect(buildLoginUrl(SESSION_FORBIDDEN, publicAppUrl)).toBe(
      'http://localhost:5173/login?session=forbidden',
    );
  });

  describe('namespace split is semantic — logout=* vs session=* are distinct', () => {
    it('active action uses logout= namespace', () => {
      expect(buildLoginUrl(LOGOUT_SUCCESS, publicAppUrl)).toContain('logout=');
      expect(buildLoginUrl(LOGOUT_SUCCESS, publicAppUrl)).not.toContain('session=');
    });

    it('passive system events use session= namespace', () => {
      expect(buildLoginUrl(SESSION_EXPIRED, publicAppUrl)).toContain('session=');
      expect(buildLoginUrl(SESSION_EXPIRED, publicAppUrl)).not.toContain('logout=');
      expect(buildLoginUrl(SESSION_FORBIDDEN, publicAppUrl)).toContain('session=');
      expect(buildLoginUrl(SESSION_FORBIDDEN, publicAppUrl)).not.toContain('logout=');
    });
  });

  it('prod default apex (no explicit publicAppUrl, no env, no window.location → hardcoded fallback)', () => {
    // vitest-mock window (from vitest.frontend-setup.ts) is globalThis with no
    // `location` property — deriveApexFromBrowser() returns null, helper falls
    // back to DEFAULT_PUBLIC_APP_URL = https://www.assixx.com.
    expect(buildLoginUrl(LOGOUT_SUCCESS)).toBe('https://www.assixx.com/login?logout=success');
  });
});

// =============================================================================
// Browser-fallback path (self-healing when PUBLIC_APP_URL is not injected).
//
// Reproduces the 2026-04-22 dev bug: user on `testfirma.localhost:5173`
// triggered logout and landed on `https://www.assixx.com/login?logout=success`
// because `pnpm run dev:svelte` does not inject Doppler env into the Vite
// server — `env.PUBLIC_APP_URL` was undefined, hardcoded-prod fallback kicked
// in. The browser-fallback derives apex from `window.location` so the redirect
// correctly lands on the local dev origin without any env setup.
// =============================================================================
describe('buildLoginUrl — browser-fallback (no env)', () => {
  // Locally patch window.location so the implementation's
  // `deriveApexFromBrowser()` has a realistic URL to work with. `afterEach`
  // restores the pre-test state so the "hardcoded fallback" test above
  // keeps its no-location precondition.
  const originalLocation = (globalThis as { location?: Location }).location;

  function setLocation(href: string): void {
    (globalThis as { location?: Partial<Location> }).location = { href };
  }

  function restoreLocation(): void {
    if (originalLocation === undefined) {
      delete (globalThis as { location?: Location }).location;
    } else {
      (globalThis as { location?: Location }).location = originalLocation;
    }
  }

  it('dev: `testfirma.localhost:5173` subdomain → strips to `localhost:5173` apex', () => {
    setLocation(DEV_SUBDOMAIN_DASHBOARD);
    try {
      expect(buildLoginUrl(LOGOUT_SUCCESS)).toBe(DEV_LOGIN_LOGOUT);
    } finally {
      restoreLocation();
    }
  });

  it('prod: `scs.assixx.com` subdomain → normalises to `www.assixx.com` apex', () => {
    // ADR-050 §Decision: `www.assixx.com` is the canonical apex host
    // (explicit SAN on the wildcard cert); bare-apex strip must renormalise.
    setLocation('https://scs.assixx.com/dashboard');
    try {
      expect(buildLoginUrl(SESSION_EXPIRED)).toBe(PROD_LOGIN_SESSION_EXPIRED);
    } finally {
      restoreLocation();
    }
  });

  it('apex (no subdomain): `localhost:5173` → apex stays `localhost:5173`', () => {
    setLocation('http://localhost:5173/login');
    try {
      expect(buildLoginUrl(LOGOUT_SUCCESS)).toBe(DEV_LOGIN_LOGOUT);
    } finally {
      restoreLocation();
    }
  });

  it('apex (no subdomain): `www.assixx.com` → apex stays `www.assixx.com`', () => {
    setLocation('https://www.assixx.com/login');
    try {
      expect(buildLoginUrl(SESSION_FORBIDDEN)).toBe(PROD_LOGIN_SESSION_FORBIDDEN);
    } finally {
      restoreLocation();
    }
  });

  it('explicit publicAppUrl param still wins over browser-fallback', () => {
    setLocation(DEV_SUBDOMAIN_DASHBOARD);
    try {
      // Explicit override → browser-fallback never consulted.
      expect(buildLoginUrl(LOGOUT_SUCCESS, 'https://assixx.com')).toBe(
        'https://assixx.com/login?logout=success',
      );
    } finally {
      restoreLocation();
    }
  });
});

// =============================================================================
// SSR fallback path — caller passes `event.url` so server-side redirects keep
// dev parity even when `PUBLIC_APP_URL` is not injected into the SvelteKit
// dev server. Mirrors the browser-fallback behaviour above; the same slug-strip
// + www-normalisation logic feeds both paths via `deriveApexFromUrl()`.
//
// Drift between client and server fallback would surface as a logout from
// `testfirma.localhost:5173` landing on different origins depending on which
// code path fired — the bug class this block guards against.
// =============================================================================
describe('buildLoginUrl — SSR fallback (no env, no window, requestUrl provided)', () => {
  it('dev: subdomain `testfirma.localhost:5173` → strips to `localhost:5173` apex', () => {
    const requestUrl = new URL(DEV_SUBDOMAIN_DASHBOARD);
    expect(buildLoginUrl(SESSION_EXPIRED, undefined, requestUrl)).toBe(DEV_LOGIN_SESSION_EXPIRED);
  });

  it('prod: subdomain `scs.assixx.com` → normalises to `www.assixx.com` apex', () => {
    const requestUrl = new URL('https://scs.assixx.com/dashboard');
    expect(buildLoginUrl(SESSION_EXPIRED, undefined, requestUrl)).toBe(PROD_LOGIN_SESSION_EXPIRED);
  });

  it('apex (no subdomain): `localhost:5173` → apex stays `localhost:5173`', () => {
    const requestUrl = new URL('http://localhost:5173/login');
    expect(buildLoginUrl(LOGOUT_SUCCESS, undefined, requestUrl)).toBe(DEV_LOGIN_LOGOUT);
  });

  it('apex (no subdomain): `www.assixx.com` → apex stays `www.assixx.com`', () => {
    const requestUrl = new URL('https://www.assixx.com/login');
    expect(buildLoginUrl(SESSION_FORBIDDEN, undefined, requestUrl)).toBe(
      PROD_LOGIN_SESSION_FORBIDDEN,
    );
  });

  it('explicit publicAppUrl param still wins over SSR fallback', () => {
    const requestUrl = new URL(DEV_SUBDOMAIN_DASHBOARD);
    expect(buildLoginUrl(LOGOUT_SUCCESS, 'https://assixx.com', requestUrl)).toBe(
      'https://assixx.com/login?logout=success',
    );
  });

  it('neutral entry (no reason) — bare /login on apex', () => {
    const requestUrl = new URL(DEV_SUBDOMAIN_DASHBOARD);
    expect(buildLoginUrl(undefined, undefined, requestUrl)).toBe(DEV_LOGIN_URL);
  });
});
