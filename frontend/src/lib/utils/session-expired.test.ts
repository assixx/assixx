/**
 * Unit tests for the centralized session-expired detection + redirect util.
 *
 * The util has been load-bearing since 15 route-level duplicates were
 * consolidated into it; the architectural test (`shared/src/architectural.test.ts`
 * — "Frontend: Session-Expired Centralization") rejects local re-implementations.
 * These tests protect the contract from the opposite direction — if the
 * error-code shape or the redirect URL/mechanism changes silently, the
 * centralized behaviour would drift out from under every caller.
 *
 * ADR-050 Amendment (Logout → Apex): `handleSessionExpired` now uses
 * `buildLoginUrl('session-expired')` + a hard `window.location.href`
 * navigation (cross-origin from tenant subdomain to apex). The browser-
 * fallback in `buildApexUrl` drops to the current origin when
 * `PUBLIC_APP_URL` is unset — exercised by the "browser-fallback" suite
 * below to mirror the real dev setup (`pnpm run dev:svelte` without
 * Doppler).
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §"Amendment — Logout → Apex"
 * @see shared/src/architectural.test.ts — Frontend: Session-Expired Centralization
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  checkSessionExpired,
  handleSessionExpired,
  isSessionExpiredError,
} from './session-expired.js';

describe('isSessionExpiredError', () => {
  it('returns true for the canonical backend error shape', () => {
    // The only shape the backend actually emits. Changing this constant on
    // either side (service throw or this check) breaks every caller silently.
    expect(isSessionExpiredError({ code: 'SESSION_EXPIRED' })).toBe(true);
  });

  it('returns true when extra fields are present (structural check, not exact match)', () => {
    expect(
      isSessionExpiredError({
        code: 'SESSION_EXPIRED',
        message: 'Token expired',
        statusCode: 401,
      }),
    ).toBe(true);
  });

  it('returns false for a different error code', () => {
    expect(isSessionExpiredError({ code: 'CROSS_TENANT_HOST_MISMATCH' })).toBe(false);
    expect(isSessionExpiredError({ code: 'PERMISSION_DENIED' })).toBe(false);
    expect(isSessionExpiredError({ code: 'UNKNOWN_ERROR' })).toBe(false);
  });

  it('returns false for an object without a `code` field', () => {
    expect(isSessionExpiredError({ message: 'Token expired' })).toBe(false);
    expect(isSessionExpiredError({})).toBe(false);
  });

  it('returns false for non-object inputs', () => {
    // Defensive: the centralized util is called from catch-blocks where the
    // unknown error type is not guaranteed to be an object.
    expect(isSessionExpiredError(null)).toBe(false);
    expect(isSessionExpiredError(undefined)).toBe(false);
    expect(isSessionExpiredError('SESSION_EXPIRED')).toBe(false);
    expect(isSessionExpiredError(401)).toBe(false);
    expect(isSessionExpiredError(new Error('SESSION_EXPIRED'))).toBe(false);
  });
});

// Shared location-spy helper. `handleSessionExpired` writes to
// `window.location.href` — we stand in a mutable shim with getter/setter so
// each test can assert the navigation target. `configurable: true` is
// required so subsequent tests can re-install a fresh shim.
interface LocationSpy {
  readonly captured: () => string | undefined;
  readonly restore: () => void;
}

function installLocationSpy(
  currentHref: string,
  originalLocation: Location | undefined,
): LocationSpy {
  let captured: string | undefined;
  Object.defineProperty(globalThis, 'location', {
    value: {
      get href(): string {
        return captured ?? currentHref;
      },
      set href(v: string) {
        captured = v;
      },
    },
    writable: true,
    configurable: true,
  });
  return {
    captured: () => captured,
    restore: () => {
      if (originalLocation === undefined) {
        delete (globalThis as { location?: Location }).location;
      } else {
        (globalThis as { location?: Location }).location = originalLocation;
      }
    },
  };
}

describe('handleSessionExpired — hard-navigate to apex', () => {
  const originalLocation = (globalThis as { location?: Location }).location;
  let spy: LocationSpy | null = null;

  afterEach(() => {
    spy?.restore();
    spy = null;
  });

  // Expected redirect target — browser-fallback in buildApexUrl strips
  // the `testfirma.` slug label, leaving `localhost:5173` as apex.
  const DEV_APEX_REDIRECT = 'http://localhost:5173/login?session=expired';

  it('dev on tenant subdomain → redirects to apex `/login?session=expired`', () => {
    spy = installLocationSpy('http://testfirma.localhost:5173/dashboard', originalLocation);

    handleSessionExpired();

    expect(spy.captured()).toBe(DEV_APEX_REDIRECT);
  });

  it('prod on tenant subdomain → redirects to `www.assixx.com/login?session=expired`', () => {
    // ADR-050 §Decision: bare `assixx.com` after slug-strip is normalised to
    // `www.assixx.com` (the canonical apex host registered as explicit SAN).
    spy = installLocationSpy('https://scs-technik.assixx.com/tpm/plans', originalLocation);

    handleSessionExpired();

    expect(spy.captured()).toBe('https://www.assixx.com/login?session=expired');
  });

  it('already on apex → redirect stays on same origin', () => {
    spy = installLocationSpy('http://localhost:5173/dashboard', originalLocation);

    handleSessionExpired();

    expect(spy.captured()).toBe(DEV_APEX_REDIRECT);
  });
});

describe('checkSessionExpired — conditional redirect', () => {
  const originalLocation = (globalThis as { location?: Location }).location;
  let spy: LocationSpy | null = null;

  afterEach(() => {
    spy?.restore();
    spy = null;
  });

  it('returns true and triggers redirect for SESSION_EXPIRED', () => {
    spy = installLocationSpy('http://testfirma.localhost:5173/', originalLocation);

    const handled = checkSessionExpired({ code: 'SESSION_EXPIRED' });

    expect(handled).toBe(true);
    expect(spy.captured()).toBe('http://localhost:5173/login?session=expired');
  });

  it('returns false and does NOT redirect for other errors', () => {
    spy = installLocationSpy('http://testfirma.localhost:5173/', originalLocation);

    const handled = checkSessionExpired({ code: 'PERMISSION_DENIED' });

    expect(handled).toBe(false);
    expect(spy.captured()).toBeUndefined();
  });

  it('returns false and does NOT redirect for non-error-shape inputs', () => {
    spy = installLocationSpy('http://testfirma.localhost:5173/', originalLocation);

    expect(checkSessionExpired(null)).toBe(false);
    expect(checkSessionExpired(undefined)).toBe(false);
    expect(checkSessionExpired('SESSION_EXPIRED')).toBe(false);
    expect(spy.captured()).toBeUndefined();
  });
});
