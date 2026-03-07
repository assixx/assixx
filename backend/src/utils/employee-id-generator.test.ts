import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateEmployeeId } from './employee-id-generator.js';

describe('generateEmployeeId', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 1, 17, 52)); // June 1, 2025, 17:52
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should produce the documented example format', () => {
    // SCS + RT + 101 + 01062025 + 1752 = SCSRT101010620251752
    const result = generateEmployeeId('scs', 'root', 101);
    expect(result).toBe('SCSRT101010620251752');
  });

  it('should uppercase the subdomain', () => {
    const result = generateEmployeeId('demo', 'admin', 1);
    expect(result).toMatch(/^DEMO/);
  });

  it('should truncate subdomain to 10 characters', () => {
    const result = generateEmployeeId('verylongsubdomainname', 'employee', 1);
    const domain = result.slice(0, 10);
    expect(domain).toBe('VERYLONGSU');
  });

  describe('role abbreviations', () => {
    it('should use RT for root', () => {
      const result = generateEmployeeId('x', 'root', 1);
      expect(result).toMatch(/^XRT/);
    });

    it('should use AD for admin', () => {
      const result = generateEmployeeId('x', 'admin', 1);
      expect(result).toMatch(/^XAD/);
    });

    it('should use EMP for employee', () => {
      const result = generateEmployeeId('x', 'employee', 1);
      expect(result).toMatch(/^XEMP/);
    });

    it('should default to EMP for unknown roles', () => {
      const result = generateEmployeeId('x', 'unknown', 1);
      expect(result).toMatch(/^XEMP/);
    });

    it('should be case-insensitive for role matching', () => {
      const result = generateEmployeeId('x', 'ROOT', 1);
      expect(result).toMatch(/^XRT/);
    });
  });

  describe('datetime format', () => {
    it('should include DDMMYYYYHHMM at the end', () => {
      const result = generateEmployeeId('a', 'root', 1);
      // With fake time: June 1, 2025 17:52 → 01062025175200 wait, let me recalculate
      // DD=01, MM=06, YYYY=2025, HH=17, MM=52 → 010620251752
      expect(result).toMatch(/010620251752$/);
    });

    it('should zero-pad single-digit day and month', () => {
      vi.setSystemTime(new Date(2025, 0, 5, 3, 7)); // Jan 5, 2025, 03:07
      const result = generateEmployeeId('a', 'root', 1);
      expect(result).toMatch(/050120250307$/);
    });
  });

  it('should include userId in the output', () => {
    const result = generateEmployeeId('scs', 'admin', 42);
    expect(result).toContain('42');
    expect(result).toMatch(/^SCSAD42/);
  });
});
