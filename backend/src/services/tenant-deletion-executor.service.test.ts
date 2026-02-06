/**
 * Unit tests for TenantDeletionExecutor
 *
 * Phase 13 Batch C (C3): MITTEL — 402 lines, 3 public methods + private helpers.
 * Multi-pass FK dependency resolution with SAVEPOINT pattern.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResultSetHeader } from '../utils/db.js';
import { TenantDeletionExecutor } from './tenant-deletion-executor.service.js';
import {
  getTablesWithTenantId,
  getUserRelatedTables,
} from './tenant-deletion.helpers.js';

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
  getUserRelatedTables: vi.fn(),
}));

const mockGetTables = vi.mocked(getTablesWithTenantId);
const mockGetUserTables = vi.mocked(getUserRelatedTables);

describe('TenantDeletionExecutor', () => {
  let executor: TenantDeletionExecutor;
  let mockConn: { query: ReturnType<typeof vi.fn> };

  /** Helper to create a mock ResultSetHeader */
  function mockResult(affectedRows: number): ResultSetHeader {
    return { affectedRows } as ResultSetHeader;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new TenantDeletionExecutor();
    mockConn = { query: vi.fn() };
  });

  // ============================================
  // executeDeletions (orchestrator)
  // ============================================

  describe('executeDeletions', () => {
    it('should execute full deletion pipeline and return log', async () => {
      // Phase 1: all tables
      mockGetTables.mockResolvedValue([
        { TABLE_NAME: 'departments' },
        { TABLE_NAME: 'users' },
        { TABLE_NAME: 'tenants' },
        { TABLE_NAME: 'audit_trail' }, // critical → excluded from regular
      ] as never);

      // Phase 2: regular table deletion (departments only)
      // SAVEPOINT, DELETE, RELEASE
      mockConn.query
        .mockResolvedValueOnce(undefined) // SAVEPOINT sp_departments
        .mockResolvedValueOnce(mockResult(3)) // DELETE from departments
        .mockResolvedValueOnce(undefined); // RELEASE SAVEPOINT

      // Phase 3: user-related tables
      mockGetUserTables.mockResolvedValue([
        { TABLE_NAME: 'user_sessions' },
      ] as never);
      mockConn.query
        .mockResolvedValueOnce(undefined) // SAVEPOINT sp_user_user_sessions
        .mockResolvedValueOnce(mockResult(2)) // DELETE with USING users
        .mockResolvedValueOnce(undefined); // RELEASE SAVEPOINT

      // Phase 4: clear critical table user references (3 tables × 3 queries each)
      mockConn.query
        .mockResolvedValueOnce(undefined) // SAVEPOINT sp_clear_tenant_deletion_queue
        .mockResolvedValueOnce(undefined) // UPDATE tenant_deletion_queue
        .mockResolvedValueOnce(undefined) // RELEASE SAVEPOINT
        .mockResolvedValueOnce(undefined) // SAVEPOINT sp_clear_deletion_audit_trail
        .mockResolvedValueOnce(undefined) // UPDATE deletion_audit_trail
        .mockResolvedValueOnce(undefined) // RELEASE SAVEPOINT
        .mockResolvedValueOnce(undefined) // SAVEPOINT sp_clear_legal_holds
        .mockResolvedValueOnce(undefined) // UPDATE legal_holds
        .mockResolvedValueOnce(undefined); // RELEASE SAVEPOINT

      // Phase 5: delete users
      mockConn.query.mockResolvedValueOnce(mockResult(10));

      // Phase 6: delete tenant
      mockConn.query.mockResolvedValueOnce(mockResult(1));

      const result = await executor.executeDeletions(1, mockConn as never);

      expect(result.length).toBeGreaterThanOrEqual(3);
      const tableNames = result.map((r) => r.table);
      expect(tableNames).toContain('departments');
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('tenants');
    });

    it('should handle empty table list', async () => {
      mockGetTables.mockResolvedValue([] as never);
      mockGetUserTables.mockResolvedValue([] as never);

      // Phase 4: clear critical refs (3 tables × SAVEPOINT + UPDATE + RELEASE)
      mockConn.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      // Phase 5 & 6: users + tenants
      mockConn.query
        .mockResolvedValueOnce(mockResult(0))
        .mockResolvedValueOnce(mockResult(0));

      const result = await executor.executeDeletions(1, mockConn as never);

      // Only users and tenants entries (both with 0 deleted)
      expect(result).toEqual(
        expect.arrayContaining([
          { table: 'users', deleted: 0 },
          { table: 'tenants', deleted: 0 },
        ]),
      );
    });

    it('should warn about stuck tables when multi-pass makes no progress', async () => {
      mockGetTables.mockResolvedValue([
        { TABLE_NAME: 'circular_a' },
        { TABLE_NAME: 'circular_b' },
      ] as never);

      // Both tables fail in first pass (FK errors)
      mockConn.query
        .mockResolvedValueOnce(undefined) // SAVEPOINT circular_a
        .mockRejectedValueOnce(new Error('FK violation')) // DELETE fails
        .mockResolvedValueOnce(undefined) // ROLLBACK TO SAVEPOINT
        .mockResolvedValueOnce(undefined) // SAVEPOINT circular_b
        .mockRejectedValueOnce(new Error('FK violation')) // DELETE fails
        .mockResolvedValueOnce(undefined); // ROLLBACK TO SAVEPOINT

      // No progress → returns stuck immediately
      // Then phase 3+4+5+6 continues:
      mockGetUserTables.mockResolvedValue([] as never);
      // Phase 4: 3 safe updates
      mockConn.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);
      // Phase 5+6
      mockConn.query
        .mockResolvedValueOnce(mockResult(0))
        .mockResolvedValueOnce(mockResult(0));

      const result = await executor.executeDeletions(1, mockConn as never);

      // No regular tables deleted — only users/tenants with 0
      const regularDeleted = result.filter(
        (r) => r.table !== 'users' && r.table !== 'tenants',
      );
      expect(regularDeleted).toHaveLength(0);
    });
  });

  // ============================================
  // deleteFromTableDirect (public)
  // ============================================

  describe('deleteFromTableDirect', () => {
    it('should delete using tenant_id by default', async () => {
      mockConn.query.mockResolvedValueOnce(mockResult(5));

      const result = await executor.deleteFromTableDirect(
        'users',
        1,
        mockConn as never,
      );

      expect(result).toEqual({ table: 'users', deleted: 5 });
      expect(mockConn.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id'),
        [1],
      );
    });

    it('should use custom idColumn when provided', async () => {
      mockConn.query.mockResolvedValueOnce(mockResult(1));

      const result = await executor.deleteFromTableDirect(
        'tenants',
        1,
        mockConn as never,
        'id',
      );

      expect(result).toEqual({ table: 'tenants', deleted: 1 });
      expect(mockConn.query).toHaveBeenCalledWith(
        expect.stringContaining('"tenants" WHERE id = $1'),
        [1],
      );
    });

    it('should return log entry with 0 when no rows affected', async () => {
      mockConn.query.mockResolvedValueOnce(mockResult(0));

      const result = await executor.deleteFromTableDirect(
        'empty_table',
        999,
        mockConn as never,
      );

      expect(result).toEqual({ table: 'empty_table', deleted: 0 });
    });

    it('should rethrow on query error', async () => {
      mockConn.query.mockRejectedValueOnce(
        new Error('relation does not exist'),
      );

      await expect(
        executor.deleteFromTableDirect('bad_table', 1, mockConn as never),
      ).rejects.toThrow('relation does not exist');
    });
  });

  // ============================================
  // clearCriticalTableUserReferences (public)
  // ============================================

  describe('clearCriticalTableUserReferences', () => {
    it('should update all 3 critical tables', async () => {
      // Each table: SAVEPOINT + UPDATE + RELEASE = 3 queries × 3 tables = 9
      for (let i = 0; i < 9; i++) {
        mockConn.query.mockResolvedValueOnce(undefined);
      }

      await executor.clearCriticalTableUserReferences(1, mockConn as never);

      expect(mockConn.query).toHaveBeenCalledTimes(9);
      // Verify savepoint names
      const calls = mockConn.query.mock.calls.map((c) => c[0] as string);
      expect(calls[0]).toContain('sp_clear_tenant_deletion_queue');
      expect(calls[3]).toContain('sp_clear_deletion_audit_trail');
      expect(calls[6]).toContain('sp_clear_legal_holds');
    });

    it('should handle safeUpdate failure gracefully', async () => {
      // First table fails
      mockConn.query
        .mockResolvedValueOnce(undefined) // SAVEPOINT
        .mockRejectedValueOnce(new Error('NOT NULL constraint')) // UPDATE fails
        .mockResolvedValueOnce(undefined); // ROLLBACK TO SAVEPOINT

      // Second table succeeds
      mockConn.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      // Third table succeeds
      mockConn.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      // Should not throw — safeUpdate catches errors
      await expect(
        executor.clearCriticalTableUserReferences(1, mockConn as never),
      ).resolves.toBeUndefined();
    });

    it('should handle ROLLBACK failure in safeUpdate', async () => {
      // Table update fails AND rollback fails
      mockConn.query
        .mockResolvedValueOnce(undefined) // SAVEPOINT
        .mockRejectedValueOnce(new Error('constraint')) // UPDATE fails
        .mockRejectedValueOnce(new Error('rollback failed')); // ROLLBACK fails too

      // Other tables succeed normally
      for (let i = 0; i < 6; i++) {
        mockConn.query.mockResolvedValueOnce(undefined);
      }

      await expect(
        executor.clearCriticalTableUserReferences(1, mockConn as never),
      ).resolves.toBeUndefined();
    });

    it('should set created_by, second_approver_id, emergency_stopped_by to NULL for queue', async () => {
      for (let i = 0; i < 9; i++) {
        mockConn.query.mockResolvedValueOnce(undefined);
      }

      await executor.clearCriticalTableUserReferences(1, mockConn as never);

      const updateCall = mockConn.query.mock.calls[1] as [string, unknown[]];
      const sql = updateCall[0];
      expect(sql).toContain('created_by = NULL');
      expect(sql).toContain('second_approver_id = NULL');
      expect(sql).toContain('emergency_stopped_by = NULL');
    });
  });

  // ============================================
  // Private method: hasNoProgress (pure function)
  // ============================================

  describe('hasNoProgress (private)', () => {
    it('should return true when all tables failed', () => {
      const result = (
        executor as unknown as {
          hasNoProgress: (f: number, p: number) => boolean;
        }
      ).hasNoProgress(3, 3);
      expect(result).toBe(true);
    });

    it('should return false when some progress made', () => {
      const result = (
        executor as unknown as {
          hasNoProgress: (f: number, p: number) => boolean;
        }
      ).hasNoProgress(1, 3);
      expect(result).toBe(false);
    });

    it('should return false when no tables failed', () => {
      const result = (
        executor as unknown as {
          hasNoProgress: (f: number, p: number) => boolean;
        }
      ).hasNoProgress(0, 3);
      expect(result).toBe(false);
    });

    it('should return false when both counts are zero', () => {
      const result = (
        executor as unknown as {
          hasNoProgress: (f: number, p: number) => boolean;
        }
      ).hasNoProgress(0, 0);
      expect(result).toBe(false);
    });
  });

  // ============================================
  // Private method: deleteFromTable (SAVEPOINT pattern)
  // ============================================

  describe('deleteFromTable (private)', () => {
    const callPrivate = async (
      table: string,
      tenantId: number,
    ): Promise<unknown> => {
      return await (
        executor as unknown as {
          deleteFromTable: (
            t: string,
            id: number,
            c: unknown,
          ) => Promise<unknown>;
        }
      ).deleteFromTable(table, tenantId, mockConn);
    };

    it('should use SAVEPOINT pattern for FK recovery', async () => {
      mockConn.query
        .mockResolvedValueOnce(undefined) // SAVEPOINT
        .mockResolvedValueOnce(mockResult(2)) // DELETE
        .mockResolvedValueOnce(undefined); // RELEASE SAVEPOINT

      const result = await callPrivate('test_table', 1);

      expect(result).toEqual({ table: 'test_table', deleted: 2 });
      const firstCall = mockConn.query.mock.calls[0]?.[0] as string;
      expect(firstCall).toContain('SAVEPOINT sp_test_table');
    });

    it('should return null on FK constraint error', async () => {
      mockConn.query
        .mockResolvedValueOnce(undefined) // SAVEPOINT
        .mockRejectedValueOnce(new Error('FK violation')) // DELETE fails
        .mockResolvedValueOnce(undefined); // ROLLBACK TO SAVEPOINT

      const result = await callPrivate('fk_table', 1);

      expect(result).toBeNull();
    });

    it('should sanitize table name in savepoint name', async () => {
      mockConn.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(mockResult(0))
        .mockResolvedValueOnce(undefined);

      await callPrivate('table-with-dashes', 1);

      const firstCall = mockConn.query.mock.calls[0]?.[0] as string;
      expect(firstCall).toContain('sp_table_with_dashes');
    });

    it('should handle rollback failure silently', async () => {
      mockConn.query
        .mockResolvedValueOnce(undefined) // SAVEPOINT
        .mockRejectedValueOnce(new Error('FK')) // DELETE fails
        .mockRejectedValueOnce(new Error('rollback error')); // ROLLBACK fails

      const result = await callPrivate('broken', 1);

      expect(result).toBeNull();
    });
  });

  // ============================================
  // Private method: deleteFromUserRelatedTable
  // ============================================

  describe('deleteFromUserRelatedTable (private)', () => {
    const callPrivate = async (
      table: string,
      tenantId: number,
    ): Promise<unknown> => {
      return await (
        executor as unknown as {
          deleteFromUserRelatedTable: (
            t: string,
            id: number,
            c: unknown,
          ) => Promise<unknown>;
        }
      ).deleteFromUserRelatedTable(table, tenantId, mockConn);
    };

    it('should use USING clause with users table', async () => {
      mockConn.query
        .mockResolvedValueOnce(undefined) // SAVEPOINT
        .mockResolvedValueOnce(mockResult(4)) // DELETE USING users
        .mockResolvedValueOnce(undefined); // RELEASE SAVEPOINT

      const result = await callPrivate('user_sessions', 1);

      expect(result).toEqual({
        table: 'user_sessions (via users)',
        deleted: 4,
      });
      const deleteCall = mockConn.query.mock.calls[1]?.[0] as string;
      expect(deleteCall).toContain('USING users');
    });

    it('should return null on FK error', async () => {
      mockConn.query
        .mockResolvedValueOnce(undefined) // SAVEPOINT
        .mockRejectedValueOnce(new Error('FK')); // DELETE fails

      // Rollback might also fail
      mockConn.query.mockResolvedValueOnce(undefined);

      const result = await callPrivate('problem_table', 1);

      expect(result).toBeNull();
    });
  });
});
