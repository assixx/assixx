/**
 * Unit tests for TenantDeletionService (Coordinator Facade)
 *
 * Phase 13 Batch C (C1): HOCH — 510 lines, 12 public methods.
 * Mocks all 4 sub-services + Redis + db.js.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { execute, query, transaction } from '../utils/db.js';
import { wrapConnection } from '../utils/dbWrapper.js';
import { validateTenantId } from './tenant-deletion.helpers.js';
import { TenantDeletionService } from './tenantDeletion.service.js';

// ============================================
// Hoisted mocks for sub-services + Redis
// ============================================

const {
  mockExecutor,
  mockExporter,
  mockAnalyzer,
  mockAudit,
  mockRedisInstance,
} = vi.hoisted(() => ({
  mockExecutor: {
    executeDeletions: vi.fn(),
  },
  mockExporter: {
    createTenantDataExport: vi.fn(),
  },
  mockAnalyzer: {
    performDryRun: vi.fn(),
    verifyCompleteDeletion: vi.fn(),
  },
  mockAudit: {
    checkLegalHolds: vi.fn(),
    createDeletionAuditTrail: vi.fn(),
    sendDeletionWarningEmails: vi.fn(),
  },
  mockRedisInstance: {
    keys: vi.fn(),
    del: vi.fn(),
    on: vi.fn(),
  },
}));

vi.mock('./tenant-deletion-executor.service.js', () => ({
  TenantDeletionExecutor: vi.fn(function FakeExecutor() {
    return mockExecutor;
  }),
}));

vi.mock('./tenant-deletion-exporter.service.js', () => ({
  TenantDeletionExporter: vi.fn(function FakeExporter() {
    return mockExporter;
  }),
}));

vi.mock('./tenant-deletion-analyzer.service.js', () => ({
  TenantDeletionAnalyzer: vi.fn(function FakeAnalyzer() {
    return mockAnalyzer;
  }),
}));

vi.mock('./tenant-deletion-audit.service.js', () => ({
  TenantDeletionAudit: vi.fn(function FakeAudit() {
    return mockAudit;
  }),
}));

vi.mock('ioredis', () => ({
  Redis: vi.fn(function FakeRedis() {
    return mockRedisInstance;
  }),
}));

vi.mock('../utils/db.js', () => ({
  execute: vi.fn(),
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
  validateTenantId: vi.fn(),
}));

const mockQuery = vi.mocked(query);
const mockExecute = vi.mocked(execute);
const mockTransaction = vi.mocked(transaction);
const mockWrapConnection = vi.mocked(wrapConnection);
const mockValidate = vi.mocked(validateTenantId);

describe('TenantDeletionService', () => {
  let service: TenantDeletionService;
  let mockWrappedConn: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.resetAllMocks();
    service = new TenantDeletionService();
    mockWrappedConn = { query: vi.fn().mockResolvedValue(undefined) };
    mockWrapConnection.mockReturnValue(mockWrappedConn as never);
    mockRedisInstance.keys.mockResolvedValue([]);
    mockRedisInstance.del.mockResolvedValue(1);
  });

  // ============================================
  // deleteTenant
  // ============================================

  describe('deleteTenant', () => {
    it('should orchestrate full deletion flow', async () => {
      mockTransaction.mockImplementation(async (cb) => {
        return await (cb as (conn: unknown) => Promise<unknown>)({});
      });
      mockAudit.checkLegalHolds.mockResolvedValue(undefined);
      mockExporter.createTenantDataExport.mockResolvedValue(
        '/backup/path.tar.gz',
      );
      mockAudit.createDeletionAuditTrail.mockResolvedValue(undefined);
      mockExecutor.executeDeletions.mockResolvedValue([
        { table: 'users', deleted: 5 },
      ]);
      mockAnalyzer.verifyCompleteDeletion.mockResolvedValue([]);

      const result = await service.deleteTenant(1, 100, 10, 'test', '1.2.3.4');

      expect(result.success).toBe(true);
      expect(result.totalRowsDeleted).toBe(5);
      expect(result.tablesAffected).toBe(1);
      expect(mockValidate).toHaveBeenCalledWith(1);
    });

    it('should validate tenantId', async () => {
      mockValidate.mockImplementation(() => {
        throw new Error('INVALID TENANT_ID');
      });

      await expect(service.deleteTenant(-1, 1, 1)).rejects.toThrow(
        'INVALID TENANT_ID',
      );
    });

    it('should update queue status on failure', async () => {
      mockTransaction.mockImplementation(async (cb) => {
        return await (cb as (conn: unknown) => Promise<unknown>)({});
      });
      mockAudit.checkLegalHolds.mockRejectedValue(
        new Error('Legal hold active'),
      );

      await expect(service.deleteTenant(1, 100, 10)).rejects.toThrow(
        'Legal hold active',
      );

      // Should have tried to update queue to 'failed' (status is in params, not SQL)
      const queryCalls = mockWrappedConn.query.mock.calls;
      const failedUpdate = queryCalls.find((c) => {
        const params = c[1] as unknown[];
        return Array.isArray(params) && params.includes('failed');
      });
      expect(failedUpdate).toBeDefined();
    });

    it('should clear Redis cache after deletion', async () => {
      mockTransaction.mockImplementation(async (cb) => {
        return await (cb as (conn: unknown) => Promise<unknown>)({});
      });
      mockAudit.checkLegalHolds.mockResolvedValue(undefined);
      mockExporter.createTenantDataExport.mockResolvedValue('/path');
      mockAudit.createDeletionAuditTrail.mockResolvedValue(undefined);
      mockExecutor.executeDeletions.mockResolvedValue([]);
      mockAnalyzer.verifyCompleteDeletion.mockResolvedValue([]);

      await service.deleteTenant(1, 100, 10);

      expect(mockRedisInstance.keys).toHaveBeenCalledWith('tenant:1:*');
    });

    it('should delete Redis keys when they exist', async () => {
      mockTransaction.mockImplementation(async (cb) => {
        return await (cb as (conn: unknown) => Promise<unknown>)({});
      });
      mockAudit.checkLegalHolds.mockResolvedValue(undefined);
      mockExporter.createTenantDataExport.mockResolvedValue('/path');
      mockAudit.createDeletionAuditTrail.mockResolvedValue(undefined);
      mockExecutor.executeDeletions.mockResolvedValue([]);
      mockAnalyzer.verifyCompleteDeletion.mockResolvedValue([]);
      mockRedisInstance.keys.mockResolvedValue(['key1', 'key2']);

      await service.deleteTenant(1, 100, 10);

      expect(mockRedisInstance.del).toHaveBeenCalledTimes(2);
    });

    it('should handle queue status update failure gracefully', async () => {
      mockTransaction.mockImplementation(async (cb) => {
        return await (cb as (conn: unknown) => Promise<unknown>)({});
      });
      mockAudit.checkLegalHolds.mockRejectedValue(new Error('hold'));
      // Queue update also fails
      mockWrappedConn.query.mockRejectedValueOnce(
        new Error('queue update fail'),
      );

      // Should still throw original error
      await expect(service.deleteTenant(1, 100, 10)).rejects.toThrow('hold');
    });
  });

  // ============================================
  // requestDeletion
  // ============================================

  describe('requestDeletion', () => {
    it('should create queue entry and return queueId', async () => {
      mockQuery
        .mockResolvedValueOnce([[], []] as never) // existing check
        .mockResolvedValueOnce([[], []] as never); // legal holds check
      mockExecute
        .mockResolvedValueOnce([[{ id: 42 }], []] as never) // INSERT RETURNING
        .mockResolvedValueOnce([[], []] as never); // UPDATE tenants
      mockAudit.sendDeletionWarningEmails.mockResolvedValue(undefined);
      mockAudit.createDeletionAuditTrail.mockResolvedValue(undefined);

      const queueId = await service.requestDeletion(1, 10, 'reason', '1.1.1.1');

      expect(queueId).toBe(42);
      expect(mockValidate).toHaveBeenCalledWith(1);
    });

    it('should throw when deletion already requested', async () => {
      mockQuery.mockResolvedValueOnce([
        [{ id: 1, tenant_id: 1, status: 'pending_approval' }],
        [],
      ] as never);

      await expect(service.requestDeletion(1, 10)).rejects.toThrow(
        'Deletion already requested',
      );
    });

    it('should throw when legal holds exist', async () => {
      mockQuery
        .mockResolvedValueOnce([[], []] as never) // no existing
        .mockResolvedValueOnce([[{ id: 1, active: 1 }], []] as never); // has legal holds

      await expect(service.requestDeletion(1, 10)).rejects.toThrow(
        'Cannot delete tenant with active legal hold',
      );
    });

    it('should send warning emails after creating queue entry', async () => {
      mockQuery
        .mockResolvedValueOnce([[], []] as never)
        .mockResolvedValueOnce([[], []] as never);
      mockExecute
        .mockResolvedValueOnce([[{ id: 1 }], []] as never)
        .mockResolvedValueOnce([[], []] as never);
      mockAudit.sendDeletionWarningEmails.mockResolvedValue(undefined);
      mockAudit.createDeletionAuditTrail.mockResolvedValue(undefined);

      await service.requestDeletion(1, 10);

      expect(mockAudit.sendDeletionWarningEmails).toHaveBeenCalledWith(
        1,
        expect.any(Date),
      );
      expect(mockAudit.createDeletionAuditTrail).toHaveBeenCalled();
    });
  });

  // ============================================
  // cancelDeletion
  // ============================================

  describe('cancelDeletion', () => {
    it('should cancel pending deletion', async () => {
      mockQuery.mockResolvedValueOnce([
        [{ id: 50, tenant_id: 1, status: 'pending_approval' }],
        [],
      ] as never);
      mockExecute
        .mockResolvedValueOnce([[], []] as never) // UPDATE queue to cancelled
        .mockResolvedValueOnce([[], []] as never); // UPDATE tenants deletion_status

      await service.cancelDeletion(1, 5);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining("'cancelled'"),
        [50],
      );
    });

    it('should handle emergency stop', async () => {
      mockQuery.mockResolvedValueOnce([
        [{ id: 50, tenant_id: 1, status: 'queued' }],
        [],
      ] as never);
      mockExecute
        .mockResolvedValueOnce([[], []] as never)
        .mockResolvedValueOnce([[], []] as never);

      await service.cancelDeletion(1, 5, true);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('emergency_stop'),
        [5, 50],
      );
    });

    it('should throw when no active deletion found', async () => {
      mockQuery.mockResolvedValueOnce([[], []] as never);

      await expect(service.cancelDeletion(1, 5)).rejects.toThrow(
        'No active deletion found',
      );
    });

    it('should throw when firstQueueItem is falsy', async () => {
      // Edge case: queue.length > 0 but queue[0] is undefined
      const sparseArray: unknown[] = [];
      Object.defineProperty(sparseArray, 'length', { value: 1 });
      mockQuery.mockResolvedValueOnce([sparseArray, []] as never);

      await expect(service.cancelDeletion(1, 5)).rejects.toThrow(
        'No pending deletion found',
      );
    });
  });

  // ============================================
  // processQueue
  // ============================================

  describe('processQueue', () => {
    it('should process queued items', async () => {
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: 10,
            tenant_id: 1,
            created_by: 5,
            deletion_reason: 'cleanup',
            ip_address: '10.0.0.1',
            status: 'queued',
            approval_status: 'approved',
          },
        ],
        [],
      ] as never);

      // deleteTenant will be called — set up its mocks
      mockTransaction.mockImplementation(async (cb) => {
        return await (cb as (conn: unknown) => Promise<unknown>)({});
      });
      mockAudit.checkLegalHolds.mockResolvedValue(undefined);
      mockExporter.createTenantDataExport.mockResolvedValue('/p');
      mockAudit.createDeletionAuditTrail.mockResolvedValue(undefined);
      mockExecutor.executeDeletions.mockResolvedValue([]);
      mockAnalyzer.verifyCompleteDeletion.mockResolvedValue([]);

      await service.processQueue();

      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should do nothing when queue is empty', async () => {
      mockQuery.mockResolvedValueOnce([[], []] as never);

      await service.processQueue();

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

      // Should not throw
      await expect(service.processQueue()).resolves.toBeUndefined();
    });

    it('should return when firstQueueItem is falsy', async () => {
      const sparseArray: unknown[] = [];
      Object.defineProperty(sparseArray, 'length', { value: 1 });
      mockQuery.mockResolvedValueOnce([sparseArray, []] as never);

      await service.processQueue();

      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // performDryRun
  // ============================================

  describe('performDryRun', () => {
    it('should delegate to analyzer', async () => {
      const mockReport = {
        tenantId: 1,
        estimatedDuration: 5,
        affectedRecords: {},
        warnings: [],
        blockers: [],
        totalRecords: 100,
      };
      mockAnalyzer.performDryRun.mockResolvedValue(mockReport);

      const result = await service.performDryRun(1);

      expect(result).toEqual(mockReport);
      expect(mockAnalyzer.performDryRun).toHaveBeenCalledWith(1);
    });
  });

  // ============================================
  // getDeletionStatus
  // ============================================

  describe('getDeletionStatus', () => {
    it('should return status when queue entry exists', async () => {
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: 10,
            status: 'queued',
            scheduled_deletion_date: new Date('2025-07-01'),
            approval_status: 'approved',
          },
        ],
        [],
      ] as never);

      const result = await service.getDeletionStatus(1);

      expect(result.status).toBe('queued');
      expect(result.queueId).toBe(10);
      expect(result.approvalStatus).toBe('approved');
      expect(result.scheduledDate).toEqual(new Date('2025-07-01'));
    });

    it('should return not_scheduled when no queue entry', async () => {
      mockQuery.mockResolvedValueOnce([[], []] as never);

      const result = await service.getDeletionStatus(1);

      expect(result).toEqual({ status: 'not_scheduled' });
    });

    it('should return not_scheduled when row is falsy', async () => {
      const sparseArray: unknown[] = [];
      Object.defineProperty(sparseArray, 'length', { value: 1 });
      mockQuery.mockResolvedValueOnce([sparseArray, []] as never);

      const result = await service.getDeletionStatus(1);

      expect(result).toEqual({ status: 'not_scheduled' });
    });

    it('should omit scheduledDate when undefined', async () => {
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: 10,
            status: 'pending_approval',
            scheduled_deletion_date: undefined,
            approval_status: 'pending',
          },
        ],
        [],
      ] as never);

      const result = await service.getDeletionStatus(1);

      expect(result.scheduledDate).toBeUndefined();
    });
  });

  // ============================================
  // Compatibility methods
  // ============================================

  describe('requestTenantDeletion', () => {
    it('should delegate to requestDeletion and return queueId + scheduledDate', async () => {
      mockQuery
        .mockResolvedValueOnce([[], []] as never)
        .mockResolvedValueOnce([[], []] as never);
      mockExecute
        .mockResolvedValueOnce([[{ id: 7 }], []] as never)
        .mockResolvedValueOnce([[], []] as never);
      mockAudit.sendDeletionWarningEmails.mockResolvedValue(undefined);
      mockAudit.createDeletionAuditTrail.mockResolvedValue(undefined);

      const result = await service.requestTenantDeletion(1, 10, 'r', 'ip');

      expect(result.queueId).toBe(7);
      expect(result.scheduledDate).toBeInstanceOf(Date);
    });
  });

  describe('approveDeletion', () => {
    it('should update approval status and process queue', async () => {
      mockExecute.mockResolvedValueOnce([[], []] as never); // UPDATE approval
      // processQueue returns empty
      mockQuery.mockResolvedValueOnce([[], []] as never);

      await service.approveDeletion(10, 5, 'approved');

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('approved'),
        [5, 10],
      );
    });
  });

  describe('rejectDeletion', () => {
    it('should cancel deletion for the queue entry tenant', async () => {
      // rejectDeletion queries queue to get tenant_id
      mockQuery.mockResolvedValueOnce([[{ tenant_id: 1 }], []] as never);

      // cancelDeletion queries for active deletion
      mockQuery.mockResolvedValueOnce([
        [{ id: 50, tenant_id: 1, status: 'pending_approval' }],
        [],
      ] as never);
      mockExecute
        .mockResolvedValueOnce([[], []] as never)
        .mockResolvedValueOnce([[], []] as never);

      await service.rejectDeletion(10, 5);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('tenant_deletion_queue'),
        [10],
      );
    });

    it('should do nothing when queue entry not found', async () => {
      mockQuery.mockResolvedValueOnce([[], []] as never);

      await service.rejectDeletion(999, 5);

      // Only 1 query (the lookup), no cancelDeletion called
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe('emergencyStop', () => {
    it('should call cancelDeletion with isEmergencyStop=true', async () => {
      mockQuery.mockResolvedValueOnce([
        [{ id: 50, tenant_id: 1, status: 'queued' }],
        [],
      ] as never);
      mockExecute
        .mockResolvedValueOnce([[], []] as never)
        .mockResolvedValueOnce([[], []] as never);

      await service.emergencyStop(1, 99);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('emergency_stop'),
        expect.arrayContaining([99]),
      );
    });
  });

  describe('triggerEmergencyStop', () => {
    it('should delegate to emergencyStop', async () => {
      mockQuery.mockResolvedValueOnce([
        [{ id: 50, tenant_id: 1, status: 'queued' }],
        [],
      ] as never);
      mockExecute
        .mockResolvedValueOnce([[], []] as never)
        .mockResolvedValueOnce([[], []] as never);

      await service.triggerEmergencyStop(1, 99);

      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('retryDeletion', () => {
    it('should update queue and process', async () => {
      mockExecute.mockResolvedValueOnce([[], []] as never); // UPDATE retry
      mockQuery.mockResolvedValueOnce([[], []] as never); // processQueue empty

      await service.retryDeletion(10);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('retry_count'),
        [10],
      );
    });
  });
});
