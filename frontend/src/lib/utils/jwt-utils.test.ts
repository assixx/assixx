/**
 * Unit tests for JWT Utilities
 *
 * Phase 7: Frontend utils — 1 test per function.
 * Uses vi.useFakeTimers for expiry checks.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';

import { getTokenExpiryTime, isTokenExpired, parseJwt } from './jwt-utils.js';

// Mock logger to avoid $app/environment → pino chain
vi.mock('./logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  }),
}));

/**
 * Build a fake JWT token from payload.
 * Real JWTs have 3 base64url-encoded parts: header.payload.signature
 */
function buildFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('jwt-utils', () => {
  it('parseJwt should decode payload from valid JWT', () => {
    const token = buildFakeJwt({
      id: 1,
      email: 'admin@test.de',
      role: 'admin',
      tenantId: 10,
      type: 'access',
      iat: 1700000000,
      exp: 1700003600,
    });

    const payload = parseJwt(token);

    expect(payload).not.toBeNull();
    expect(payload?.id).toBe(1);
    expect(payload?.email).toBe('admin@test.de');
    expect(payload?.role).toBe('admin');
    expect(payload?.exp).toBe(1700003600);
  });

  it('isTokenExpired should return true for expired token', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    const pastExp = Math.floor(new Date('2025-01-01').getTime() / 1000);
    const expiredToken = buildFakeJwt({ exp: pastExp });

    expect(isTokenExpired(expiredToken)).toBe(true);

    const futureExp = Math.floor(new Date('2026-01-01').getTime() / 1000);
    const validToken = buildFakeJwt({ exp: futureExp });

    expect(isTokenExpired(validToken)).toBe(false);
  });

  it('getTokenExpiryTime should return seconds until expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));

    const nowSec = Math.floor(Date.now() / 1000);
    const token = buildFakeJwt({ exp: nowSec + 3600 }); // expires in 1 hour

    const expiryTime = getTokenExpiryTime(token);

    expect(expiryTime).toBe(3600);
  });
});
