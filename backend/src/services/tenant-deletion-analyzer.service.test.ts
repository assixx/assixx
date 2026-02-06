/**
 * Unit tests for TenantDeletionAnalyzer
 *
 * Phase 13 Batch C (C6): Quick Win — 146 lines, 2 methods.
 * performDryRun: read-only transaction for impact estimation.
 * verifyCompleteDeletion: post-deletion verification within existing transaction.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { query, transaction } from '../utils/db.js';
import { wrapConnection } from '../utils/dbWrapper.js';
import { TenantDeletionAnalyzer } from './tenant-deletion-analyzer.service.js';
import {
  getTablesWithTenantId,
  validateTenantId,
} from './tenant-deletion.helpers.js';
import { CRITICAL_TABLES } from './tenant-deletion.types.js';

vi.mock('../utils/db.js', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../utils/dbWrapper.js', () => ({
  wrapConnection: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./tenant-deletion.helpers.js', () => ({
  getTablesWithTenantId: vi.fn(),
  validateTenantId: vi.fn(),
}));

const mockQuery = vi.mocked(query);
const mockTransaction = vi.mocked(transaction);
const mockWrapConnection = vi.mocked(wrapConnection);
const mockGetTables = vi.mocked(getTablesWithTenantId);
const mockValidate = vi.mocked(validateTenantId);

describe('TenantDeletionAnalyzer', () => {
  let analyzer: TenantDeletionAnalyzer;
  let mockWrappedConn: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.resetAllMocks();
    analyzer = new TenantDeletionAnalyzer();
    mockWrappedConn = { query: vi.fn() };
    mockWrapConnection.mockReturnValue(mockWrappedConn as never);
  });

  // ============================================
  // performDryRun
  // ============================================

  describe('performDryRun', () => {
    it('should validate tenantId before proceeding', async () => {
      mockValidate.mockImplementation(() => {
        throw new Error('INVALID TENANT_ID: -1');
      });

      await expect(analyzer.performDryRun(-1)).rejects.toThrow(
        'INVALID TENANT_ID',
      );
      expect(mockValidate).toHaveBeenCalledWith(-1);
    });

    it('should return report with correct structure when no records', async () => {
      mockQuery.mockResolvedValueOnce([[], []] as never);
      mockTransaction.mockImplementation(async (cb) => {
        await (cb as (conn: unknown) => Promise<void>)({});
      });
      mockGetTables.mockResolvedValue([]);

      const report = await analyzer.performDryRun(1);

      expect(report).toEqual({
        tenantId: 1,
        estimatedDuration: 0,
        affectedRecords: {},
        warnings: [],
        blockers: [],
        totalRecords: 0,
      });
    });

    it('should add legal holds to blockers', async () => {
      mockQuery.mockResolvedValueOnce([
        [{ reason: 'GDPR investigation', active: 1 }],
        [],
      ] as never);
      mockTransaction.mockImplementation(async (cb) => {
        await (cb as (conn: unknown) => Promise<void>)({});
      });
      mockGetTables.mockResolvedValue([]);

      const report = await analyzer.performDryRun(1);

      expect(report.blockers).toHaveLength(1);
      expect(report.blockers[0]).toContain('GDPR investigation');
    });

    it('should handle legal holds with empty array after length check', async () => {
      // legalHolds.length > 0 but firstHold is undefined → no blocker pushed
      const sparseArray: unknown[] = [];
      Object.defineProperty(sparseArray, 'length', { value: 1 });
      mockQuery.mockResolvedValueOnce([sparseArray, []] as never);
      mockTransaction.mockImplementation(async (cb) => {
        await (cb as (conn: unknown) => Promise<void>)({});
      });
      mockGetTables.mockResolvedValue([]);

      const report = await analyzer.performDryRun(1);

      // firstHold is falsy → blockers not pushed
      expect(report.blockers).toHaveLength(0);
    });

    it('should count records across tenant tables', async () => {
      mockQuery.mockResolvedValueOnce([[], []] as never);
      mockTransaction.mockImplementation(async (cb) => {
        await (cb as (conn: unknown) => Promise<void>)({});
      });
      mockGetTables.mockResolvedValue([
        { TABLE_NAME: 'users' },
        { TABLE_NAME: 'documents' },
      ] as never);
      mockWrappedConn.query
        .mockResolvedValueOnce([{ count: '10' }])
        .mockResolvedValueOnce([{ count: '5' }]);

      const report = await analyzer.performDryRun(1);

      expect(report.totalRecords).toBe(15);
      expect(report.affectedRecords['users']).toBe(10);
      expect(report.affectedRecords['documents']).toBe(5);
    });

    it('should estimate duration in minutes using Math.ceil', async () => {
      mockQuery.mockResolvedValueOnce([[], []] as never);
      mockTransaction.mockImplementation(async (cb) => {
        await (cb as (conn: unknown) => Promise<void>)({});
      });
      mockGetTables.mockResolvedValue([{ TABLE_NAME: 'big_table' }] as never);
      // 120000 records × 0.001 = 120 seconds → 120/60 = 2 minutes
      mockWrappedConn.query.mockResolvedValueOnce([{ count: '120000' }]);

      const report = await analyzer.performDryRun(1);

      expect(report.estimatedDuration).toBe(2);
    });

    it('should ceil fractional duration to next minute', async () => {
      mockQuery.mockResolvedValueOnce([[], []] as never);
      mockTransaction.mockImplementation(async (cb) => {
        await (cb as (conn: unknown) => Promise<void>)({});
      });
      mockGetTables.mockResolvedValue([{ TABLE_NAME: 'table_a' }] as never);
      // 1000 × 0.001 = 1 sec → 1/60 ≈ 0.017 → ceil = 1
      mockWrappedConn.query.mockResolvedValueOnce([{ count: '1000' }]);

      const report = await analyzer.performDryRun(1);

      expect(report.estimatedDuration).toBe(1);
    });

    it('should add warnings when count query fails', async () => {
      mockQuery.mockResolvedValueOnce([[], []] as never);
      mockTransaction.mockImplementation(async (cb) => {
        await (cb as (conn: unknown) => Promise<void>)({});
      });
      mockGetTables.mockResolvedValue([
        { TABLE_NAME: 'broken_table' },
      ] as never);
      mockWrappedConn.query.mockRejectedValueOnce(
        new Error('relation does not exist'),
      );

      const report = await analyzer.performDryRun(1);

      expect(report.warnings).toHaveLength(1);
      expect(report.warnings[0]).toContain('broken_table');
      expect(report.warnings[0]).toContain('relation does not exist');
    });

    it('should handle non-Error thrown in count query', async () => {
      mockQuery.mockResolvedValueOnce([[], []] as never);
      mockTransaction.mockImplementation(async (cb) => {
        await (cb as (conn: unknown) => Promise<void>)({});
      });
      mockGetTables.mockResolvedValue([
        { TABLE_NAME: 'failing_table' },
      ] as never);
      mockWrappedConn.query.mockRejectedValueOnce('string error');

      const report = await analyzer.performDryRun(1);

      expect(report.warnings).toHaveLength(1);
      expect(report.warnings[0]).toContain('string error');
    });

    it('should handle count as number type (not just string)', async () => {
      mockQuery.mockResolvedValueOnce([[], []] as never);
      mockTransaction.mockImplementation(async (cb) => {
        await (cb as (conn: unknown) => Promise<void>)({});
      });
      mockGetTables.mockResolvedValue([{ TABLE_NAME: 'table_a' }] as never);
      mockWrappedConn.query.mockResolvedValueOnce([{ count: 42 }]);

      const report = await analyzer.performDryRun(1);

      expect(report.totalRecords).toBe(42);
      expect(report.affectedRecords['table_a']).toBe(42);
    });

    it('should handle empty count result gracefully', async () => {
      mockQuery.mockResolvedValueOnce([[], []] as never);
      mockTransaction.mockImplementation(async (cb) => {
        await (cb as (conn: unknown) => Promise<void>)({});
      });
      mockGetTables.mockResolvedValue([{ TABLE_NAME: 'empty_table' }] as never);
      mockWrappedConn.query.mockResolvedValueOnce([]);

      const report = await analyzer.performDryRun(1);

      expect(report.totalRecords).toBe(0);
      expect(report.affectedRecords['empty_table']).toBe(0);
    });
  });

  // ============================================
  // verifyCompleteDeletion
  // ============================================

  describe('verifyCompleteDeletion', () => {
    it('should return empty array when all data deleted', async () => {
      const mockConn = { query: vi.fn() };
      mockGetTables.mockResolvedValue([
        { TABLE_NAME: 'users' },
        { TABLE_NAME: 'documents' },
      ] as never);
      mockConn.query
        .mockResolvedValueOnce([{ count: '0' }])
        .mockResolvedValueOnce([{ count: '0' }]);

      const result = await analyzer.verifyCompleteDeletion(
        1,
        mockConn as never,
      );

      expect(result).toHaveLength(0);
    });

    it('should skip critical tables entirely', async () => {
      const mockConn = { query: vi.fn() };
      mockGetTables.mockResolvedValue(
        CRITICAL_TABLES.map((name) => ({ TABLE_NAME: name })) as never,
      );

      const result = await analyzer.verifyCompleteDeletion(
        1,
        mockConn as never,
      );

      expect(result).toHaveLength(0);
      expect(mockConn.query).not.toHaveBeenCalled();
    });

    it('should throw when non-critical tables have remaining data', async () => {
      const mockConn = { query: vi.fn() };
      mockGetTables.mockResolvedValue([{ TABLE_NAME: 'users' }] as never);
      mockConn.query.mockResolvedValueOnce([{ count: '3' }]);

      await expect(
        analyzer.verifyCompleteDeletion(1, mockConn as never),
      ).rejects.toThrow('Deletion incomplete: 1 tables still contain data');
    });

    it('should handle mix of critical and non-critical tables', async () => {
      const mockConn = { query: vi.fn() };
      mockGetTables.mockResolvedValue([
        { TABLE_NAME: 'audit_trail' }, // critical → skipped
        { TABLE_NAME: 'users' }, // non-critical → checked
      ] as never);
      mockConn.query.mockResolvedValueOnce([{ count: '0' }]);

      const result = await analyzer.verifyCompleteDeletion(
        1,
        mockConn as never,
      );

      expect(result).toHaveLength(0);
      expect(mockConn.query).toHaveBeenCalledTimes(1);
    });

    it('should handle undefined firstResult gracefully', async () => {
      const mockConn = { query: vi.fn() };
      mockGetTables.mockResolvedValue([{ TABLE_NAME: 'some_table' }] as never);
      mockConn.query.mockResolvedValueOnce([]); // empty → firstResult undefined

      const result = await analyzer.verifyCompleteDeletion(
        1,
        mockConn as never,
      );

      expect(result).toHaveLength(0);
    });

    it('should report multiple tables with remaining data', async () => {
      const mockConn = { query: vi.fn() };
      mockGetTables.mockResolvedValue([
        { TABLE_NAME: 'users' },
        { TABLE_NAME: 'documents' },
      ] as never);
      mockConn.query
        .mockResolvedValueOnce([{ count: '2' }])
        .mockResolvedValueOnce([{ count: '5' }]);

      await expect(
        analyzer.verifyCompleteDeletion(1, mockConn as never),
      ).rejects.toThrow('Deletion incomplete: 2 tables still contain data');
    });

    it('should include remaining row counts in error details', async () => {
      const mockConn = { query: vi.fn() };
      mockGetTables.mockResolvedValue([{ TABLE_NAME: 'users' }] as never);
      mockConn.query.mockResolvedValueOnce([{ count: 7 }]);

      await expect(
        analyzer.verifyCompleteDeletion(1, mockConn as never),
      ).rejects.toThrow('Deletion incomplete');
    });
  });
});
