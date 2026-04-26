/**
 * Unit tests for RootService (Facade)
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Root user CRUD (self-delete prevention, last-root-user guard),
 *        dashboard stats, delegation to sub-services.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { UserRepository } from '../database/repositories/user.repository.js';
import type { TenantVerificationService } from '../domains/tenant-verification.service.js';
import type { UserPositionService } from '../organigram/user-position.service.js';
import type { RootAdminService } from './root-admin.service.js';
import type { RootDeletionService } from './root-deletion.service.js';
import type { RootTenantService } from './root-tenant.service.js';
import { RootService } from './root.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

vi.mock('../../utils/employee-id-generator.js', () => ({
  generateEmployeeId: vi.fn().mockReturnValue('ROOT-001'),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  const db = {
    query: vi.fn(),
    systemQuery: vi.fn(),
    systemQueryOne: vi.fn(),
    tenantTransaction: vi.fn(),
    systemTransaction: vi.fn(),
  };
  const clientQuery = vi.fn(async (...args: unknown[]) => {
    const rows: unknown = await db.systemQuery(...args);
    return { rows: rows ?? [] };
  });
  db.systemTransaction.mockImplementation(
    (callback: (client: { query: typeof clientQuery }) => Promise<unknown>) =>
      callback({ query: clientQuery }),
  );
  return db;
}

function createMockUserPositionService() {
  return {
    syncPositions: vi.fn().mockResolvedValue(undefined),
    getPositionsForUser: vi.fn().mockResolvedValue([]),
    getPositionsForUsers: vi.fn().mockResolvedValue(new Map()),
  };
}

function createMockActivityLogger() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logDelete: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockUserRepository() {
  return {
    countByRole: vi.fn().mockResolvedValue(0),
    countAll: vi.fn().mockResolvedValue(0),
    isEmailTaken: vi.fn().mockResolvedValue(false),
  };
}

function createMockAdminService() {
  return {
    getAdmins: vi.fn().mockResolvedValue([]),
    getAdminById: vi.fn().mockResolvedValue(null),
    createAdmin: vi.fn().mockResolvedValue({ id: 1, uuid: 'mock-uuid-v7' }),
    updateAdmin: vi.fn().mockResolvedValue(undefined),
    deleteAdmin: vi.fn().mockResolvedValue(undefined),
    getAdminLogs: vi.fn().mockResolvedValue([]),
  };
}

function createMockTenantService() {
  return {
    getTenants: vi.fn().mockResolvedValue([]),
    getStorageInfo: vi.fn().mockResolvedValue({}),
  };
}

function createMockDeletionService() {
  return {
    requestTenantDeletion: vi.fn().mockResolvedValue(1),
    getDeletionStatus: vi.fn().mockResolvedValue(null),
    cancelDeletion: vi.fn().mockResolvedValue(undefined),
    performDeletionDryRun: vi.fn().mockResolvedValue({}),
    getAllDeletionRequests: vi.fn().mockResolvedValue([]),
    getPendingApprovals: vi.fn().mockResolvedValue([]),
    approveDeletion: vi.fn().mockResolvedValue(undefined),
    rejectDeletion: vi.fn().mockResolvedValue(undefined),
    emergencyStop: vi.fn().mockResolvedValue(undefined),
  };
}

/** Standard DB user row for root user */
function makeDbUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    uuid: 'test-uuid',
    email: 'root@example.com',
    username: 'root@example.com',
    first_name: 'Root',
    last_name: 'User',
    role: 'root',
    position: null,
    is_active: IS_ACTIVE.ACTIVE,
    has_full_access: true,
    last_login: null,
    created_at: new Date('2025-01-01'),
    updated_at: null,
    tenant_id: 10,
    department_id: null,
    employee_number: null,
    notes: null,
    ...overrides,
  };
}

// =============================================================
// RootService
// =============================================================

describe('RootService', () => {
  let service: RootService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;
  let mockUserRepo: ReturnType<typeof createMockUserRepository>;
  let mockAdminService: ReturnType<typeof createMockAdminService>;
  let mockTenantService: ReturnType<typeof createMockTenantService>;
  let mockDeletionService: ReturnType<typeof createMockDeletionService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockActivityLogger = createMockActivityLogger();
    mockUserRepo = createMockUserRepository();
    mockAdminService = createMockAdminService();
    mockTenantService = createMockTenantService();
    mockDeletionService = createMockDeletionService();
    const mockUserPositions = createMockUserPositionService();
    service = new RootService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
      mockUserRepo as unknown as UserRepository,
      mockAdminService as unknown as RootAdminService,
      mockTenantService as unknown as RootTenantService,
      mockDeletionService as unknown as RootDeletionService,
      mockUserPositions as unknown as UserPositionService,
      // Step 2.9 KISS gate (§2.9 + D33) — assertVerified no-op for
      // existing createRootUser tests; 403-path tests would reject-once.
      {
        assertVerified: vi.fn().mockResolvedValue(undefined),
        isVerified: vi.fn().mockResolvedValue(true),
      } as unknown as TenantVerificationService,
    );
  });

  // =============================================================
  // Admin delegation
  // =============================================================

  describe('getAdmins', () => {
    it('should delegate to adminService', async () => {
      const admins = [{ id: 1, email: 'admin@example.com' }];
      mockAdminService.getAdmins.mockResolvedValueOnce(admins);

      const result = await service.getAdmins(10);

      expect(result).toBe(admins);
      expect(mockAdminService.getAdmins).toHaveBeenCalledWith(10);
    });
  });

  // =============================================================
  // Tenant delegation
  // =============================================================

  describe('getTenants', () => {
    it('should delegate to tenantService', async () => {
      const tenants = [{ id: 1, name: 'TestCorp' }];
      mockTenantService.getTenants.mockResolvedValueOnce(tenants);

      const result = await service.getTenants(10);

      expect(result).toBe(tenants);
    });
  });

  // =============================================================
  // Deletion delegation
  // =============================================================

  describe('requestTenantDeletion', () => {
    it('should delegate to deletionService', async () => {
      mockDeletionService.requestTenantDeletion.mockResolvedValueOnce(42);

      const result = await service.requestTenantDeletion(10, 1, 'test');

      expect(result).toBe(42);
      expect(mockDeletionService.requestTenantDeletion).toHaveBeenCalledWith(
        10,
        1,
        'test',
        undefined,
      );
    });
  });

  // =============================================================
  // getRootUsers
  // =============================================================

  describe('getRootUsers', () => {
    it('should return mapped root users', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([makeDbUserRow()]);

      const result = await service.getRootUsers(10);

      expect(result).toHaveLength(1);
      expect(result[0]?.email).toBe('root@example.com');
    });
  });

  // =============================================================
  // getRootUserById
  // =============================================================

  describe('getRootUserById', () => {
    it('should return null when not found', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]);

      const result = await service.getRootUserById(999, 10);

      expect(result).toBeNull();
    });

    it('should return mapped root user', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([makeDbUserRow()]);

      const result = await service.getRootUserById(1, 10);

      expect(result?.email).toBe('root@example.com');
      expect(result?.firstName).toBe('Root');
    });
  });

  // =============================================================
  // createRootUser
  // =============================================================

  describe('createRootUser', () => {
    it('should throw ConflictException on duplicate email', async () => {
      mockUserRepo.isEmailTaken.mockResolvedValueOnce(true);

      await expect(
        service.createRootUser(
          {
            email: 'existing@example.com',
            password: 'SecurePass123!',
            firstName: 'Root',
            lastName: 'User',
          },
          10,
          1,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should create root user and return id', async () => {
      // isEmailTaken → false
      // getTenantSubdomain
      mockDb.systemQuery.mockResolvedValueOnce([{ subdomain: 'testcorp' }]);
      // INSERT RETURNING id
      mockDb.systemQuery.mockResolvedValueOnce([{ id: 5 }]);
      // UPDATE employee_id
      mockDb.systemQuery.mockResolvedValueOnce([]);

      const result = await service.createRootUser(
        {
          email: 'new-root@example.com',
          password: 'SecurePass123!',
          firstName: 'New',
          lastName: 'Root',
        },
        10,
        1,
      );

      expect(result).toBe(5);
      expect(mockActivityLogger.logCreate).toHaveBeenCalled();
    });
  });

  // =============================================================
  // updateRootUser
  // =============================================================

  describe('updateRootUser', () => {
    it('should throw NotFoundException when user not found', async () => {
      // getRootUserById → empty
      mockDb.systemQuery.mockResolvedValueOnce([]);

      await expect(service.updateRootUser(999, { firstName: 'Updated' }, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // deleteRootUser
  // =============================================================

  describe('deleteRootUser', () => {
    it('should throw BadRequestException on self-delete', async () => {
      await expect(service.deleteRootUser(1, 10, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when user not found', async () => {
      // getRootUserById → empty
      mockDb.systemQuery.mockResolvedValueOnce([]);

      await expect(service.deleteRootUser(99, 10, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when last root user', async () => {
      // getRootUserById → found
      mockDb.systemQuery.mockResolvedValueOnce([makeDbUserRow({ id: 2 })]);
      // COUNT root users (excluding this one) → 0
      mockDb.systemQuery.mockResolvedValueOnce([{ count: '0' }]);

      await expect(service.deleteRootUser(2, 10, 1)).rejects.toThrow(BadRequestException);
    });

    it('should soft-delete root user and revoke auth artifacts when not last', async () => {
      // getRootUserById → found
      mockDb.systemQuery.mockResolvedValueOnce([makeDbUserRow({ id: 2 })]);
      // COUNT root users → 1 remaining (Last-Root-Guard passes)
      mockDb.systemQuery.mockResolvedValueOnce([{ count: '1' }]);
      // UPDATE users SET is_active = 4 (soft-delete, ADR-020/045 — replaces
      // the previous chain of DELETE oauth_tokens / user_teams /
      // user_departments / users; those preludes were FK-driven and are
      // dead code under soft-delete)
      mockDb.systemQuery.mockResolvedValueOnce([]);
      // DELETE FROM user_sessions
      mockDb.systemQuery.mockResolvedValueOnce([]);
      // DELETE FROM refresh_tokens
      mockDb.systemQuery.mockResolvedValueOnce([]);

      await service.deleteRootUser(2, 10, 1);

      expect(mockActivityLogger.logDelete).toHaveBeenCalled();
      // Smoke check: the soft-delete UPDATE must run, and there must be NO
      // DELETE FROM users (that path is reserved for tenant erasure / DSGVO
      // Art. 17). Strict CI-gate lives in shared/src/architectural.test.ts.
      const calls = mockDb.systemQuery.mock.calls;
      const userMutation = calls.find((c: unknown[]) => /\bUPDATE users\b/i.test(String(c[0])));
      expect(userMutation).toBeDefined();
      const usersHardDelete = calls.find((c: unknown[]) =>
        /DELETE\s+FROM\s+users\b/i.test(String(c[0])),
      );
      expect(usersHardDelete).toBeUndefined();
    });
  });

  // =============================================================
  // getDashboardStats
  // =============================================================

  describe('getDashboardStats', () => {
    it('should return aggregated dashboard stats', async () => {
      mockUserRepo.countByRole
        .mockResolvedValueOnce(3) // admin count
        .mockResolvedValueOnce(50) // employee count
        .mockResolvedValueOnce(1); // root count (powers Single-Root-Warning-Banner)
      mockUserRepo.countAll.mockResolvedValueOnce(55);
      // tenant count
      mockDb.systemQuery.mockResolvedValueOnce([{ count: '2' }]);
      // addons
      mockDb.systemQuery.mockResolvedValueOnce([{ code: 'chat' }, { code: 'documents' }]);

      const result = await service.getDashboardStats(10);

      expect(result.adminCount).toBe(3);
      expect(result.employeeCount).toBe(50);
      expect(result.rootCount).toBe(1);
      expect(result.totalUsers).toBe(55);
      expect(result.tenantCount).toBe(2);
      expect(result.activeAddons).toEqual(['chat', 'documents']);
      expect(result.systemHealth.database).toBe('healthy');
    });
  });
});
