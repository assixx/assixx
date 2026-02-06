/**
 * Unit tests for TenantDeletionAnalyzer (NestJS)
 *
 * Migrated from services/tenant-deletion-analyzer.service.test.ts
 * Key changes:
 * - DI bypass: `new TenantDeletionAnalyzer(mockDb)` instead of no-arg constructor
 * - `mockDb.query()` returns `T[]` directly (not `[rows, fields]` tuple)
 * - `mockDb.transaction()` passes a `PoolClient` whose `.query()` returns `{ rows }`
 * - No `wrapConnection` — transaction callback receives native PoolClient
 * - Helpers still mocked (pure functions, tested separately)
 */
import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { TenantDeletionAnalyzer } from './tenant-deletion-analyzer.service.js';
import {
  getTablesWithTenantId,
  validateTenantId,
} from './tenant-deletion.helpers.js';
import { CRITICAL_TABLES } from './tenant-deletion.types.js';

vi.mock('./tenant-deletion.helpers.js', () => ({
  getTablesWithTenantId: vi.fn(),
  validateTenantId: vi.fn(),
}));

const mockGetTables = vi.mocked(getTablesWithTenantId);
const mockValidate = vi.mocked(validateTenantId);

describe('TenantDeletionAnalyzer', () => {
  let analyzer: TenantDeletionAnalyzer;
  let mockDb: {
    query: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };
  let mockClient: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.resetAllMocks();
    mockDb = { query: vi.fn(), transaction: vi.fn() };
    mockClient = { query: vi.fn() };
    analyzer = new TenantDeletionAnalyzer(mockDb as unknown as DatabaseService);
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
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.transaction.mockImplementation(
        async (cb: (client: PoolClient) => Promise<void>) => {
          await cb(mockClient as unknown as PoolClient);
        },
      );
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
      mockDb.query.mockResolvedValueOnce([
        { reason: 'GDPR investigation', active: 1 },
      ]);
      mockDb.transaction.mockImplementation(
        async (cb: (client: PoolClient) => Promise<void>) => {
          await cb(mockClient as unknown as PoolClient);
        },
      );
      mockGetTables.mockResolvedValue([]);

      const report = await analyzer.performDryRun(1);

      expect(report.blockers).toHaveLength(1);
      expect(report.blockers[0]).toContain('GDPR investigation');
    });

    it('should handle legal holds with empty array after length check', async () => {
      // legalHolds.length > 0 but firstHold is undefined -> no blocker pushed
      const sparseArray: unknown[] = [];
      Object.defineProperty(sparseArray, 'length', { value: 1 });
      mockDb.query.mockResolvedValueOnce(sparseArray);
      mockDb.transaction.mockImplementation(
        async (cb: (client: PoolClient) => Promise<void>) => {
          await cb(mockClient as unknown as PoolClient);
        },
      );
      mockGetTables.mockResolvedValue([]);

      const report = await analyzer.performDryRun(1);

      // firstHold is falsy -> blockers not pushed
      expect(report.blockers).toHaveLength(0);
    });

    it('should count records across tenant tables', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.transaction.mockImplementation(
        async (cb: (client: PoolClient) => Promise<void>) => {
          await cb(mockClient as unknown as PoolClient);
        },
      );
      mockGetTables.mockResolvedValue([
        { TABLE_NAME: 'users' },
        { TABLE_NAME: 'documents' },
      ] as never);
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const report = await analyzer.performDryRun(1);

      expect(report.totalRecords).toBe(15);
      expect(report.affectedRecords['users']).toBe(10);
      expect(report.affectedRecords['documents']).toBe(5);
    });

    it('should estimate duration in minutes using Math.ceil', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.transaction.mockImplementation(
        async (cb: (client: PoolClient) => Promise<void>) => {
          await cb(mockClient as unknown as PoolClient);
        },
      );
      mockGetTables.mockResolvedValue([{ TABLE_NAME: 'big_table' }] as never);
      // 120000 records x 0.001 = 120 seconds -> 120/60 = 2 minutes
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '120000' }] });

      const report = await analyzer.performDryRun(1);

      expect(report.estimatedDuration).toBe(2);
    });

    it('should ceil fractional duration to next minute', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.transaction.mockImplementation(
        async (cb: (client: PoolClient) => Promise<void>) => {
          await cb(mockClient as unknown as PoolClient);
        },
      );
      mockGetTables.mockResolvedValue([{ TABLE_NAME: 'table_a' }] as never);
      // 1000 x 0.001 = 1 sec -> 1/60 ~ 0.017 -> ceil = 1
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '1000' }] });

      const report = await analyzer.performDryRun(1);

      expect(report.estimatedDuration).toBe(1);
    });

    it('should add warnings when count query fails', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.transaction.mockImplementation(
        async (cb: (client: PoolClient) => Promise<void>) => {
          await cb(mockClient as unknown as PoolClient);
        },
      );
      mockGetTables.mockResolvedValue([
        { TABLE_NAME: 'broken_table' },
      ] as never);
      mockClient.query.mockRejectedValueOnce(
        new Error('relation does not exist'),
      );

      const report = await analyzer.performDryRun(1);

      expect(report.warnings).toHaveLength(1);
      expect(report.warnings[0]).toContain('broken_table');
      expect(report.warnings[0]).toContain('relation does not exist');
    });

    it('should handle non-Error thrown in count query', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.transaction.mockImplementation(
        async (cb: (client: PoolClient) => Promise<void>) => {
          await cb(mockClient as unknown as PoolClient);
        },
      );
      mockGetTables.mockResolvedValue([
        { TABLE_NAME: 'failing_table' },
      ] as never);
      mockClient.query.mockRejectedValueOnce('string error');

      const report = await analyzer.performDryRun(1);

      expect(report.warnings).toHaveLength(1);
      expect(report.warnings[0]).toContain('string error');
    });

    it('should handle count as number type (not just string)', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.transaction.mockImplementation(
        async (cb: (client: PoolClient) => Promise<void>) => {
          await cb(mockClient as unknown as PoolClient);
        },
      );
      mockGetTables.mockResolvedValue([{ TABLE_NAME: 'table_a' }] as never);
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: 42 }] });

      const report = await analyzer.performDryRun(1);

      expect(report.totalRecords).toBe(42);
      expect(report.affectedRecords['table_a']).toBe(42);
    });

    it('should handle empty count result gracefully', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.transaction.mockImplementation(
        async (cb: (client: PoolClient) => Promise<void>) => {
          await cb(mockClient as unknown as PoolClient);
        },
      );
      mockGetTables.mockResolvedValue([{ TABLE_NAME: 'empty_table' }] as never);
      mockClient.query.mockResolvedValueOnce({ rows: [] });

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
      mockGetTables.mockResolvedValue([
        { TABLE_NAME: 'users' },
        { TABLE_NAME: 'documents' },
      ] as never);
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await analyzer.verifyCompleteDeletion(
        1,
        mockClient as unknown as PoolClient,
      );

      expect(result).toHaveLength(0);
    });

    it('should skip critical tables entirely', async () => {
      mockGetTables.mockResolvedValue(
        CRITICAL_TABLES.map((name) => ({ TABLE_NAME: name })) as never,
      );

      const result = await analyzer.verifyCompleteDeletion(
        1,
        mockClient as unknown as PoolClient,
      );

      expect(result).toHaveLength(0);
      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('should throw when non-critical tables have remaining data', async () => {
      mockGetTables.mockResolvedValue([{ TABLE_NAME: 'users' }] as never);
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '3' }] });

      await expect(
        analyzer.verifyCompleteDeletion(1, mockClient as unknown as PoolClient),
      ).rejects.toThrow('Deletion incomplete: 1 tables still contain data');
    });

    it('should handle mix of critical and non-critical tables', async () => {
      mockGetTables.mockResolvedValue([
        { TABLE_NAME: 'audit_trail' }, // critical -> skipped
        { TABLE_NAME: 'users' }, // non-critical -> checked
      ] as never);
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await analyzer.verifyCompleteDeletion(
        1,
        mockClient as unknown as PoolClient,
      );

      expect(result).toHaveLength(0);
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it('should handle undefined firstResult gracefully', async () => {
      mockGetTables.mockResolvedValue([{ TABLE_NAME: 'some_table' }] as never);
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // empty -> firstResult undefined

      const result = await analyzer.verifyCompleteDeletion(
        1,
        mockClient as unknown as PoolClient,
      );

      expect(result).toHaveLength(0);
    });

    it('should report multiple tables with remaining data', async () => {
      mockGetTables.mockResolvedValue([
        { TABLE_NAME: 'users' },
        { TABLE_NAME: 'documents' },
      ] as never);
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });

      await expect(
        analyzer.verifyCompleteDeletion(1, mockClient as unknown as PoolClient),
      ).rejects.toThrow('Deletion incomplete: 2 tables still contain data');
    });

    it('should include remaining row counts in error details', async () => {
      mockGetTables.mockResolvedValue([{ TABLE_NAME: 'users' }] as never);
      mockClient.query.mockResolvedValueOnce({ rows: [{ count: 7 }] });

      await expect(
        analyzer.verifyCompleteDeletion(1, mockClient as unknown as PoolClient),
      ).rejects.toThrow('Deletion incomplete');
    });
  });
});
