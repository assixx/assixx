/**
 * Unit tests for Auth Utilities
 *
 * Phase 7: Frontend utils — 1 test per function.
 * localStorage is mocked via vitest.frontend-setup.ts (Map-based).
 * window exists (globalThis), so isBrowser() returns true.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  getAuthToken,
  getRoleDisplayName,
  getUserRole,
  hasPermission,
  isAuthenticated,
  setAuthToken,
  setUserRole,
} from './auth.js';

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

describe('auth', () => {
  it('getRoleDisplayName should return German labels', () => {
    expect(getRoleDisplayName('root')).toBe('Root');
    expect(getRoleDisplayName('admin')).toBe('Admin');
    expect(getRoleDisplayName('employee')).toBe('Mitarbeiter');
    expect(getRoleDisplayName(null)).toBe('Unbekannt');
  });

  it('setAuthToken + getAuthToken should round-trip via localStorage', () => {
    setAuthToken('test-access-token-123');

    expect(getAuthToken()).toBe('test-access-token-123');
  });

  it('setUserRole should validate role and store in localStorage', () => {
    expect(setUserRole('admin')).toBe(true);
    expect(getUserRole()).toBe('admin');

    // Invalid role should be rejected
    expect(setUserRole('superuser')).toBe(false);
  });

  it('getUserRole should return null for invalid stored role', () => {
    localStorage.setItem('userRole', 'hacker');

    expect(getUserRole()).toBeNull();
  });

  it('hasPermission should enforce role hierarchy (root > admin > employee)', () => {
    setUserRole('admin');

    expect(hasPermission('employee')).toBe(true);
    expect(hasPermission('admin')).toBe(true);
    expect(hasPermission('root')).toBe(false);
  });

  it('isAuthenticated should require both token and role', () => {
    expect(isAuthenticated()).toBe(false);

    setAuthToken('token-123');
    expect(isAuthenticated()).toBe(false); // no role yet

    setUserRole('employee');
    expect(isAuthenticated()).toBe(true);
  });
});
