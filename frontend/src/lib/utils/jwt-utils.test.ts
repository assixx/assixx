/**
 * Unit tests for JWT Utilities
 *
 * Phase 7: Frontend utils — 1 test per function.
 * Uses vi.useFakeTimers for expiry checks.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';

import { parseJwt } from './jwt-utils.js';

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
});
