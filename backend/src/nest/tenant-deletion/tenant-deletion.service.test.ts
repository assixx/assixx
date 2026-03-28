/**
 * Unit tests for TenantDeletionService (NestJS Coordinator Facade)
 *
 * Migrated from services/tenantDeletion.service.test.ts.
 * Key changes:
 * - DI bypass: sub-services injected via constructor, no vi.mock on them
 * - DatabaseService.query() returns T[] directly (not [rows, fields] tuple)
 * - DatabaseService.transaction() passes PoolClient to callback
 * - No execute()/query()/transaction() from utils/db.js
 * - No wrapConnection — PoolClient used directly
 * - ConfigService mock for Redis configuration
 */
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { TenantDeletionAnalyzer } from './tenant-deletion-analyzer.service.js';
import type { TenantDeletionAudit } from './tenant-deletion-audit.service.js';
import type { TenantDeletionExecutor } from './tenant-deletion-executor.service.js';
import type { TenantDeletionExporter } from './tenant-deletion-exporter.service.js';
import { validateTenantId } from './tenant-deletion.helpers.js';
import { TenantDeletionService } from './tenant-deletion.service.js';

// ============================================
// Hoisted Redis mock
// ============================================

const { mockRedisInstance } = vi.hoisted(() => ({
  mockRedisInstance: {
    keys: vi.fn(),
    del: vi.fn(),
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue('OK'),
  },
}));

vi.mock('ioredis', () => ({
  Redis: vi.fn(function FakeRedis() {
    return mockRedisInstance;
  }),
}));

vi.mock('./tenant-deletion.helpers.js', () => ({
  validateTenantId: vi.fn(),
}));

const mockValidate = vi.mocked(validateTenantId);

describe('TenantDeletionService', () => {
  let service: TenantDeletionService;
  let mockDb: {
    query: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };
  let mockConfigService: { get: ReturnType<typeof vi.fn> };
  let mockExecutor: { executeDeletions: ReturnType<typeof vi.fn> };
  let mockExporter: { createTenantDataExport: ReturnType<typeof vi.fn> };
  let mockAnalyzer: {
    performDryRun: ReturnType<typeof vi.fn>;
    verifyCompleteDeletion: ReturnType<typeof vi.fn>;
  };
  let mockAudit: {
    checkLegalHolds: ReturnType<typeof vi.fn>;
    createDeletionAuditTrail: ReturnType<typeof vi.fn>;
    sendDeletionWarningEmails: ReturnType<typeof vi.fn>;
  };
  let mockClient: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.resetAllMocks();

    mockDb = { query: vi.fn(), transaction: vi.fn() };
    mockConfigService = { get: vi.fn().mockReturnValue(undefined) };
    mockExecutor = { executeDeletions: vi.fn() };
    mockExporter = { createTenantDataExport: vi.fn() };
    mockAnalyzer = {
      performDryRun: vi.fn(),
      verifyCompleteDeletion: vi.fn(),
    };
    mockAudit = {
      checkLegalHolds: vi.fn(),
      createDeletionAuditTrail: vi.fn(),
      sendDeletionWarningEmails: vi.fn(),
    };
    mockClient = { query: vi.fn().mockResolvedValue(undefined) };
    mockRedisInstance.keys.mockResolvedValue([]);
    mockRedisInstance.del.mockResolvedValue(1);

    service = new TenantDeletionService(
      mockDb as unknown as DatabaseService,
      mockConfigService as unknown as ConfigService,
      mockExecutor as unknown as TenantDeletionExecutor,
      mockExporter as unknown as TenantDeletionExporter,
      mockAnalyzer as unknown as TenantDeletionAnalyzer,
      mockAudit as unknown as TenantDeletionAudit,
    );
  });

  // ============================================
  // deleteTenant
  // ============================================

  describe('deleteTenant', () => {
    it('should orchestrate full deletion flow', async () => {
      mockDb.transaction.mockImplementation(async (cb: (client: unknown) => Promise<unknown>) => {
        return await cb(mockClient);
      });
      mockAudit.checkLegalHolds.mockResolvedValue(undefined);
      mockExporter.createTenantDataExport.mockResolvedValue('/backup/path.tar.gz');
      mockAudit.createDeletionAuditTrail.mockResolvedValue(undefined);
      mockExecutor.executeDeletions.mockResolvedValue([{ table: 'users', deleted: 5 }]);
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

      await expect(service.deleteTenant(-1, 1, 1)).rejects.toThrow('INVALID TENANT_ID');
    });

    it('should update queue status on failure', async () => {
      mockDb.transaction.mockImplementation(async (cb: (client: unknown) => Promise<unknown>) => {
        return await cb(mockClient);
      });
      mockAudit.checkLegalHolds.mockRejectedValue(new Error('Legal hold active'));

      await expect(service.deleteTenant(1, 100, 10)).rejects.toThrow('Legal hold active');

      // Should have tried to update queue to 'failed' (status is in params)
      const queryCalls = mockClient.query.mock.calls;
      const failedUpdate = queryCalls.find((c) => {
        const params = c[1] as unknown[];
        return Array.isArray(params) && params.includes('failed');
      });
      expect(failedUpdate).toBeDefined();
    });

    it('should clear Redis cache after deletion', async () => {
      mockDb.transaction.mockImplementation(async (cb: (client: unknown) => Promise<unknown>) => {
        return await cb(mockClient);
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
      mockDb.transaction.mockImplementation(async (cb: (client: unknown) => Promise<unknown>) => {
        return await cb(mockClient);
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
      mockDb.transaction.mockImplementation(async (cb: (client: unknown) => Promise<unknown>) => {
        return await cb(mockClient);
      });
      mockAudit.checkLegalHolds.mockRejectedValue(new Error('hold'));
      // Queue update also fails
      mockClient.query.mockRejectedValueOnce(new Error('queue update fail'));

      // Should still throw original error
      await expect(service.deleteTenant(1, 100, 10)).rejects.toThrow('hold');
    });
  });

  // ============================================
  // requestDeletion
  // ============================================

  describe('requestDeletion', () => {
    it('should create queue entry and return queueId', async () => {
      mockDb.query
        .mockResolvedValueOnce([]) // existing check
        .mockResolvedValueOnce([]) // legal holds check
        .mockResolvedValueOnce([{ id: 42 }]) // INSERT RETURNING
        .mockResolvedValueOnce([]); // UPDATE tenants
      mockAudit.sendDeletionWarningEmails.mockResolvedValue(undefined);
      mockAudit.createDeletionAuditTrail.mockResolvedValue(undefined);

      const queueId = await service.requestDeletion(1, 10, 'reason', '1.1.1.1');

      expect(queueId).toBe(42);
      expect(mockValidate).toHaveBeenCalledWith(1);
    });

    it('should throw when deletion already requested', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1, tenant_id: 1, status: 'pending_approval' }]);

      await expect(service.requestDeletion(1, 10)).rejects.toThrow('Deletion already requested');
    });

    it('should throw when legal holds exist', async () => {
      mockDb.query
        .mockResolvedValueOnce([]) // no existing
        .mockResolvedValueOnce([{ id: 1, active: 1 }]); // has legal holds

      await expect(service.requestDeletion(1, 10)).rejects.toThrow(
        'Cannot delete tenant with active legal hold',
      );
    });

    it('should send warning emails after creating queue entry', async () => {
      mockDb.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([]);
      mockAudit.sendDeletionWarningEmails.mockResolvedValue(undefined);
      mockAudit.createDeletionAuditTrail.mockResolvedValue(undefined);

      await service.requestDeletion(1, 10);

      expect(mockAudit.sendDeletionWarningEmails).toHaveBeenCalledWith(1, expect.any(Date));
      expect(mockAudit.createDeletionAuditTrail).toHaveBeenCalled();
    });
  });

  // ============================================
  // cancelDeletion
  // ============================================

  describe('cancelDeletion', () => {
    it('should cancel pending deletion', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 50, tenant_id: 1, status: 'pending_approval' }])
        .mockResolvedValueOnce([]) // UPDATE queue to cancelled
        .mockResolvedValueOnce([]); // UPDATE tenants

      await service.cancelDeletion(1, 5);

      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining("'cancelled'"), [50]);
    });

    it('should handle emergency stop', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 50, tenant_id: 1, status: 'queued' }])
        .mockResolvedValueOnce([]) // UPDATE with emergency
        .mockResolvedValueOnce([]); // UPDATE tenants

      await service.cancelDeletion(1, 5, true);

      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('emergency_stop'), [5, 50]);
    });

    it('should throw when no active deletion found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.cancelDeletion(1, 5)).rejects.toThrow('No active deletion found');
    });

    it('should throw when firstQueueItem is falsy', async () => {
      // Edge case: queue.length > 0 but queue[0] is undefined
      const sparseArray: unknown[] = [];
      Object.defineProperty(sparseArray, 'length', { value: 1 });
      mockDb.query.mockResolvedValueOnce(sparseArray);

      await expect(service.cancelDeletion(1, 5)).rejects.toThrow('No pending deletion found');
    });
  });

  // ============================================
  // processQueue
  // ============================================

  describe('processQueue', () => {
    it('should process queued items', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 10,
          tenant_id: 1,
          created_by: 5,
          deletion_reason: 'cleanup',
          ip_address: '10.0.0.1',
          status: 'queued',
          approval_status: 'approved',
        },
      ]);

      // deleteTenant will be called — set up its mocks
      mockDb.transaction.mockImplementation(async (cb: (client: unknown) => Promise<unknown>) => {
        return await cb(mockClient);
      });
      mockAudit.checkLegalHolds.mockResolvedValue(undefined);
      mockExporter.createTenantDataExport.mockResolvedValue('/p');
      mockAudit.createDeletionAuditTrail.mockResolvedValue(undefined);
      mockExecutor.executeDeletions.mockResolvedValue([]);
      mockAnalyzer.verifyCompleteDeletion.mockResolvedValue([]);

      await service.processQueue();

      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should do nothing when queue is empty', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.processQueue();

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB connection lost'));

      // Should not throw
      await expect(service.processQueue()).resolves.toBeUndefined();
    });

    it('should return when firstQueueItem is falsy', async () => {
      const sparseArray: unknown[] = [];
      Object.defineProperty(sparseArray, 'length', { value: 1 });
      mockDb.query.mockResolvedValueOnce(sparseArray);

      await service.processQueue();

      expect(mockDb.transaction).not.toHaveBeenCalled();
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
      mockDb.query.mockResolvedValueOnce([
        {
          id: 10,
          status: 'queued',
          scheduled_deletion_date: new Date('2025-07-01'),
          approval_status: 'approved',
        },
      ]);

      const result = await service.getDeletionStatus(1);

      expect(result.status).toBe('queued');
      expect(result.queueId).toBe(10);
      expect(result.approvalStatus).toBe('approved');
      expect(result.scheduledDate).toEqual(new Date('2025-07-01'));
    });

    it('should return not_scheduled when no queue entry', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getDeletionStatus(1);

      expect(result).toEqual({ status: 'not_scheduled' });
    });

    it('should return not_scheduled when row is falsy', async () => {
      const sparseArray: unknown[] = [];
      Object.defineProperty(sparseArray, 'length', { value: 1 });
      mockDb.query.mockResolvedValueOnce(sparseArray);

      const result = await service.getDeletionStatus(1);

      expect(result).toEqual({ status: 'not_scheduled' });
    });

    it('should omit scheduledDate when undefined', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 10,
          status: 'pending_approval',
          scheduled_deletion_date: undefined,
          approval_status: 'pending',
        },
      ]);

      const result = await service.getDeletionStatus(1);

      expect(result.scheduledDate).toBeUndefined();
    });
  });

  // ============================================
  // Compatibility methods
  // ============================================

  describe('requestTenantDeletion', () => {
    it('should delegate to requestDeletion and return queueId + scheduledDate', async () => {
      mockDb.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 7 }])
        .mockResolvedValueOnce([]);
      mockAudit.sendDeletionWarningEmails.mockResolvedValue(undefined);
      mockAudit.createDeletionAuditTrail.mockResolvedValue(undefined);

      const result = await service.requestTenantDeletion(1, 10, 'r', 'ip');

      expect(result.queueId).toBe(7);
      expect(result.scheduledDate).toBeInstanceOf(Date);
    });
  });

  describe('approveDeletion', () => {
    it('should update approval status and process queue', async () => {
      mockDb.query
        .mockResolvedValueOnce([]) // UPDATE approval
        .mockResolvedValueOnce([]); // processQueue empty

      await service.approveDeletion(10, 5, 'approved');

      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('approved'), [5, 10]);
    });
  });

  describe('rejectDeletion', () => {
    it('should cancel deletion for the queue entry tenant', async () => {
      // rejectDeletion queries queue to get tenant_id
      mockDb.query.mockResolvedValueOnce([{ tenant_id: 1 }]);

      // cancelDeletion queries for active deletion
      mockDb.query.mockResolvedValueOnce([{ id: 50, tenant_id: 1, status: 'pending_approval' }]);
      mockDb.query
        .mockResolvedValueOnce([]) // UPDATE cancelled
        .mockResolvedValueOnce([]); // UPDATE tenants

      await service.rejectDeletion(10, 5);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_deletion_queue'),
        [10],
      );
    });

    it('should do nothing when queue entry not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.rejectDeletion(999, 5);

      // Only 1 query (the lookup), no cancelDeletion called
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('emergencyStop', () => {
    it('should call cancelDeletion with isEmergencyStop=true', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 50, tenant_id: 1, status: 'queued' }])
        .mockResolvedValueOnce([]) // UPDATE emergency
        .mockResolvedValueOnce([]); // UPDATE tenants

      await service.emergencyStop(1, 99);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('emergency_stop'),
        expect.arrayContaining([99]),
      );
    });
  });

  describe('triggerEmergencyStop', () => {
    it('should delegate to emergencyStop', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 50, tenant_id: 1, status: 'queued' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.triggerEmergencyStop(1, 99);

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('retryDeletion', () => {
    it('should update queue and process', async () => {
      mockDb.query
        .mockResolvedValueOnce([]) // UPDATE retry
        .mockResolvedValueOnce([]); // processQueue empty

      await service.retryDeletion(10);

      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('retry_count'), [10]);
    });
  });

  // ============================================
  // onModuleDestroy (lifecycle)
  // ============================================

  describe('onModuleDestroy', () => {
    it('should quit Redis if initialized', async () => {
      // Trigger Redis initialization by calling a method that uses it
      mockDb.transaction.mockImplementation(async (cb: (client: unknown) => Promise<unknown>) => {
        return await cb(mockClient);
      });
      mockAudit.checkLegalHolds.mockResolvedValue(undefined);
      mockExporter.createTenantDataExport.mockResolvedValue('/p');
      mockAudit.createDeletionAuditTrail.mockResolvedValue(undefined);
      mockExecutor.executeDeletions.mockResolvedValue([]);
      mockAnalyzer.verifyCompleteDeletion.mockResolvedValue([]);

      await service.deleteTenant(1, 100, 10);

      // Now destroy
      await service.onModuleDestroy();

      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });

    it('should not quit Redis if never initialized', async () => {
      await service.onModuleDestroy();

      expect(mockRedisInstance.quit).not.toHaveBeenCalled();
    });
  });
});
