/**
 * Unit tests for Tenant Deletion Helpers + Types
 *
 * Phase 13 Batch C (C8): Quick Win — pure validateTenantId + DB-mocked table queries.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  getTablesWithTenantId,
  getUserRelatedTables,
  validateTenantId,
} from './tenant-deletion.helpers.js';
import {
  CRITICAL_TABLES,
  GRACE_PERIOD_MINUTES,
  MAX_DELETION_PASSES,
} from './tenant-deletion.types.js';

// ============================================
// Constants (from types)
// ============================================

describe('tenant-deletion constants', () => {
  it('CRITICAL_TABLES should contain expected tables', () => {
    expect(CRITICAL_TABLES).toContain('tenant_deletion_queue');
    expect(CRITICAL_TABLES).toContain('deletion_audit_trail');
    expect(CRITICAL_TABLES).toContain('legal_holds');
    expect(CRITICAL_TABLES).toContain('audit_trail');
  });

  it('CRITICAL_TABLES should have 7 entries', () => {
    expect(CRITICAL_TABLES).toHaveLength(7);
  });

  it('MAX_DELETION_PASSES should be 15', () => {
    expect(MAX_DELETION_PASSES).toBe(15);
  });

  it('GRACE_PERIOD_MINUTES should be positive', () => {
    expect(GRACE_PERIOD_MINUTES).toBeGreaterThan(0);
  });
});

// ============================================
// validateTenantId (pure function)
// ============================================

describe('validateTenantId', () => {
  it('should accept positive integer', () => {
    expect(() => validateTenantId(1)).not.toThrow();
    expect(() => validateTenantId(999)).not.toThrow();
  });

  it('should throw for zero', () => {
    expect(() => validateTenantId(0)).toThrow('INVALID TENANT_ID');
  });

  it('should throw for negative number', () => {
    expect(() => validateTenantId(-1)).toThrow('INVALID TENANT_ID');
  });

  it('should throw for non-integer', () => {
    expect(() => validateTenantId(1.5)).toThrow('INVALID TENANT_ID');
  });

  it('should include tenantId in error message', () => {
    expect(() => validateTenantId(-42)).toThrow('-42');
  });
});

// ============================================
// getTablesWithTenantId (DB-mocked)
// ============================================

describe('getTablesWithTenantId', () => {
  it('should query information_schema and return table names', async () => {
    const mockConn = {
      query: vi
        .fn()
        .mockResolvedValue([
          { TABLE_NAME: 'users' },
          { TABLE_NAME: 'departments' },
        ]),
    };

    const result = await getTablesWithTenantId(mockConn as never);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ TABLE_NAME: 'users' });
    expect(mockConn.query).toHaveBeenCalledWith(
      expect.stringContaining('tenant_id'),
    );
  });

  it('should return empty array when no tables found', async () => {
    const mockConn = { query: vi.fn().mockResolvedValue([]) };

    const result = await getTablesWithTenantId(mockConn as never);

    expect(result).toHaveLength(0);
  });
});

// ============================================
// getUserRelatedTables (DB-mocked)
// ============================================

describe('getUserRelatedTables', () => {
  it('should query for user_id tables excluding critical tables', async () => {
    const mockConn = {
      query: vi.fn().mockResolvedValue([{ TABLE_NAME: 'user_sessions' }]),
    };

    const result = await getUserRelatedTables(mockConn as never);

    expect(result).toEqual([{ TABLE_NAME: 'user_sessions' }]);
    expect(mockConn.query).toHaveBeenCalledWith(
      expect.stringContaining('user_id'),
      expect.arrayContaining(['tenant_deletion_queue']),
    );
  });

  it('should pass CRITICAL_TABLES as exclusion params', async () => {
    const mockConn = { query: vi.fn().mockResolvedValue([]) };

    await getUserRelatedTables(mockConn as never);

    const calledParams = mockConn.query.mock.calls[0]?.[1] as string[];
    expect(calledParams).toHaveLength(CRITICAL_TABLES.length);
  });
});
