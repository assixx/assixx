/**
 * Unit tests for role-based redirect path helpers.
 *
 * These pure functions are used by profile/dashboard guards in 4+ page.server.ts files.
 * A wrong path means 404s or security bypasses — every role must be covered.
 */
import { describe, expect, it } from 'vitest';

import { dashboardForRole, profileForRole } from './role-redirects';

// ─── dashboardForRole ────────────────────────────────────────────────────────

describe('dashboardForRole', () => {
  it('should return /root-dashboard for root', () => {
    expect(dashboardForRole('root')).toBe('/root-dashboard');
  });

  it('should return /admin-dashboard for admin', () => {
    expect(dashboardForRole('admin')).toBe('/admin-dashboard');
  });

  it('should return /employee-dashboard for employee', () => {
    expect(dashboardForRole('employee')).toBe('/employee-dashboard');
  });

  it('should return /blackboard for dummy', () => {
    expect(dashboardForRole('dummy')).toBe('/blackboard');
  });

  it('should fall back to /login for unknown role', () => {
    expect(dashboardForRole('unknown')).toBe('/login');
  });

  it('should fall back to /login for empty string', () => {
    expect(dashboardForRole('')).toBe('/login');
  });
});

// ─── profileForRole ──────────────────────────────────────────────────────────

describe('profileForRole', () => {
  it('should return /root-profile for root', () => {
    expect(profileForRole('root')).toBe('/root-profile');
  });

  it('should return /admin-profile for admin', () => {
    expect(profileForRole('admin')).toBe('/admin-profile');
  });

  it('should return /employee-profile for employee', () => {
    expect(profileForRole('employee')).toBe('/employee-profile');
  });

  it('should return /blackboard for dummy', () => {
    expect(profileForRole('dummy')).toBe('/blackboard');
  });

  it('should fall back to /login for unknown role', () => {
    expect(profileForRole('unknown')).toBe('/login');
  });

  it('should fall back to /login for empty string', () => {
    expect(profileForRole('')).toBe('/login');
  });
});
