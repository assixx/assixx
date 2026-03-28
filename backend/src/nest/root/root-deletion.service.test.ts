/**
 * Unit tests for RootDeletionService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Tenant deletion lifecycle — request (root count guard),
 *        status retrieval, approval (password verification, two-person-principle),
 *        dry run, pending approvals.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { UserRepository } from '../database/repositories/user.repository.js';
import type { TenantDeletionService } from '../tenant-deletion/tenant-deletion.service.js';
import { RootDeletionService } from './root-deletion.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function createMockUserRepo() {
  return {
    countByRole: vi.fn().mockResolvedValue(3),
    getPasswordHash: vi.fn(),
  };
}

function createMockTenantDeletion() {
  return {
    requestTenantDeletion: vi.fn().mockResolvedValue({ queueId: 42 }),
    cancelDeletion: vi.fn().mockResolvedValue(undefined),
    performDryRun: vi.fn().mockResolvedValue({
      tenantId: 10,
      estimatedDuration: 5,
      totalRecords: 100,
      affectedRecords: { users: 10, documents: 20 },
      warnings: [],
      blockers: [],
    }),
    approveDeletion: vi.fn().mockResolvedValue(undefined),
    rejectDeletion: vi.fn().mockResolvedValue(undefined),
    triggerEmergencyStop: vi.fn().mockResolvedValue(undefined),
  };
}

// =============================================================
// RootDeletionService
// =============================================================

describe('RootDeletionService', () => {
  let service: RootDeletionService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockUserRepo: ReturnType<typeof createMockUserRepo>;
  let mockTenantDeletion: ReturnType<typeof createMockTenantDeletion>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockUserRepo = createMockUserRepo();
    mockTenantDeletion = createMockTenantDeletion();
    service = new RootDeletionService(
      mockDb as unknown as DatabaseService,
      mockUserRepo as unknown as UserRepository,
      mockTenantDeletion as unknown as TenantDeletionService,
    );
  });

  // =============================================================
  // requestTenantDeletion
  // =============================================================

  describe('requestTenantDeletion', () => {
    it('should throw BadRequestException when fewer than 2 root users', async () => {
      mockUserRepo.countByRole.mockResolvedValueOnce(1);

      await expect(service.requestTenantDeletion(10, 1, 'test')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return queue id on success', async () => {
      const result = await service.requestTenantDeletion(10, 1, 'test');

      expect(result).toBe(42);
    });

    it('should throw ConflictException when already marked for deletion', async () => {
      mockTenantDeletion.requestTenantDeletion.mockRejectedValueOnce(
        new Error('already marked_for_deletion'),
      );

      await expect(service.requestTenantDeletion(10, 1, 'test')).rejects.toThrow(ConflictException);
    });
  });

  // =============================================================
  // getDeletionStatus
  // =============================================================

  describe('getDeletionStatus', () => {
    it('should return null when no active deletion', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getDeletionStatus(10);

      expect(result).toBeNull();
    });

    it('should return status with canApprove/canCancel flags', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          tenant_id: 10,
          status: 'pending_approval',
          created_by: 5,
          requested_by_name: 'root1',
          approved_by: null,
          approved_at: null,
          scheduled_for: null,
          reason: 'test',
          error_message: null,
          cooling_off_hours: 72,
          created_at: new Date('2025-06-01'),
        },
      ]);

      // currentUserId=5 is the creator → canCancel=true, canApprove=false
      const result = await service.getDeletionStatus(10, 5);

      expect(result).not.toBeNull();
      expect(result?.canCancel).toBe(true);
      expect(result?.canApprove).toBe(false);
    });

    it('should allow different user to approve', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          tenant_id: 10,
          status: 'pending_approval',
          created_by: 5,
          requested_by_name: 'root1',
          approved_by: null,
          approved_at: null,
          scheduled_for: null,
          reason: 'test',
          error_message: null,
          cooling_off_hours: 72,
          created_at: new Date('2025-06-01'),
        },
      ]);

      // currentUserId=99 is NOT the creator → canApprove=true
      const result = await service.getDeletionStatus(10, 99);

      expect(result?.canApprove).toBe(true);
      expect(result?.canCancel).toBe(false);
    });
  });

  // =============================================================
  // performDeletionDryRun
  // =============================================================

  describe('performDeletionDryRun', () => {
    it('should return formatted dry run report', async () => {
      // tenant name lookup
      mockDb.query.mockResolvedValueOnce([{ company_name: 'TestCorp' }]);

      const result = await service.performDeletionDryRun(10);

      expect(result.companyName).toBe('TestCorp');
      expect(result.estimatedDuration).toBe('5 minutes');
      expect(result.affectedRecords.users).toBe(10);
      expect(result.canProceed).toBe(true);
    });
  });

  // =============================================================
  // getAllDeletionRequests
  // =============================================================

  describe('getAllDeletionRequests', () => {
    it('should return mapped deletion requests', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          tenant_id: 10,
          company_name: 'TestCorp',
          subdomain: 'testcorp',
          created_by: 5,
          requester_name: 'root1',
          requester_email: 'root@test.com',
          created_at: new Date('2025-06-01'),
          reason: 'Test',
          status: 'pending_approval',
        },
      ]);

      const result = await service.getAllDeletionRequests();

      expect(result).toHaveLength(1);
      expect(result[0]?.companyName).toBe('TestCorp');
    });
  });

  // =============================================================
  // approveDeletion — password verification
  // =============================================================

  describe('approveDeletion', () => {
    it('should throw Error when user not found or has no password', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce(null);

      await expect(service.approveDeletion(1, 99, 10, 'password')).rejects.toThrow(
        'User password not configured',
      );
    });

    it('should throw Error when user has empty password', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce('');

      await expect(service.approveDeletion(1, 5, 10, 'password')).rejects.toThrow(
        'User password not configured',
      );
    });

    it('should throw Error on wrong password', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce('stored-hash');
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

      await expect(service.approveDeletion(1, 5, 10, 'wrong')).rejects.toThrow(
        'Ungültiges Passwort',
      );
    });

    it('should approve on correct password', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce('stored-hash');

      await service.approveDeletion(1, 5, 10, 'correct', 'Approved');

      expect(mockTenantDeletion.approveDeletion).toHaveBeenCalledWith(1, 5, 'Approved');
    });
  });

  // =============================================================
  // cancelDeletion / emergencyStop
  // =============================================================

  describe('cancelDeletion', () => {
    it('should delegate to TenantDeletionService', async () => {
      await service.cancelDeletion(10, 1);

      expect(mockTenantDeletion.cancelDeletion).toHaveBeenCalledWith(10, 1);
    });
  });

  describe('emergencyStop', () => {
    it('should delegate to TenantDeletionService', async () => {
      await service.emergencyStop(10, 1);

      expect(mockTenantDeletion.triggerEmergencyStop).toHaveBeenCalledWith(10, 1);
    });
  });
});
