/**
 * Unit tests for RootAdminService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Admin CRUD, duplicate email guard, password hashing,
 *        activity logging, NotFoundException guards.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { UserRepository } from '../database/repositories/user.repository.js';
import type { TenantVerificationService } from '../domains/tenant-verification.service.js';
import type { UserPositionService } from '../organigram/user-position.service.js';
import { RootAdminService } from './root-admin.service.js';
import type { RootProtectionService } from './root-protection.service.js';

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

vi.mock('./root.helpers.js', () => ({
  ERROR_CODES: {
    NOT_FOUND: 'NOT_FOUND',
    DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  },
  buildUserUpdateFields: vi.fn().mockReturnValue({
    fields: [],
    values: [],
    nextIndex: 1,
  }),
  handleDuplicateEntryError: vi.fn(),
  mapDbUserToAdminUser: vi.fn((row: Record<string, unknown>) => ({
    id: row['id'],
    email: row['email'],
    firstName: row['first_name'] ?? '',
    lastName: row['last_name'] ?? '',
    role: 'admin',
  })),
  mapDbLogToAdminLog: vi.fn((row: Record<string, unknown>) => ({
    id: row['id'],
    action: row['action'],
    createdAt: row['created_at'],
  })),
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

function createMockUserRepo() {
  return {
    isEmailTaken: vi.fn().mockResolvedValue(false),
  };
}

function makeAdminRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    email: 'admin@example.com',
    username: 'admin@example.com',
    first_name: 'Admin',
    last_name: 'User',
    role: 'admin',
    is_active: IS_ACTIVE.ACTIVE,
    tenant_id: 10,
    created_at: new Date('2025-01-01'),
    updated_at: null,
    position: null,
    notes: null,
    employee_number: null,
    has_full_access: false,
    last_login: null,
    ...overrides,
  };
}

// =============================================================
// RootAdminService
// =============================================================

describe('RootAdminService', () => {
  let service: RootAdminService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;
  let mockUserRepo: ReturnType<typeof createMockUserRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockActivityLogger = createMockActivityLogger();
    mockUserRepo = createMockUserRepo();
    const mockUserPositions = createMockUserPositionService();
    service = new RootAdminService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
      mockUserRepo as unknown as UserRepository,
      mockUserPositions as unknown as UserPositionService,
      // Step 2.9 KISS gate (§2.9 + D33) — assertVerified no-op so existing
      // createAdmin tests see a verified tenant.
      {
        assertVerified: vi.fn().mockResolvedValue(undefined),
        isVerified: vi.fn().mockResolvedValue(true),
      } as unknown as TenantVerificationService,
      // Layer-2 root-protection (FEAT_ROOT_ACCOUNT_PROTECTION_MASTERPLAN.md
      // §2.3, Session 4). All methods no-op — `getAdminById` filters
      // role='admin', so the cross-root branch is never entered in normal
      // flow. Defaults exist purely to satisfy DI.
      {
        assertCrossRootTerminationForbidden: vi.fn().mockResolvedValue(undefined),
        assertNotLastRoot: vi.fn().mockResolvedValue(undefined),
        countActiveRoots: vi.fn().mockResolvedValue(2),
        isTerminationOp: vi.fn().mockReturnValue(false),
        auditDeniedAttempt: vi.fn().mockResolvedValue(undefined),
      } as unknown as RootProtectionService,
    );
  });

  // =============================================================
  // getAdmins
  // =============================================================

  describe('getAdmins', () => {
    it('should return mapped admin users', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([makeAdminRow()]);

      const result = await service.getAdmins(10);

      expect(result).toHaveLength(1);
      expect(result[0]?.email).toBe('admin@example.com');
    });
  });

  // =============================================================
  // getAdminById
  // =============================================================

  describe('getAdminById', () => {
    it('should return null when not found', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]);

      const result = await service.getAdminById(999, 10);

      expect(result).toBeNull();
    });

    it('should return admin with last login', async () => {
      // admin row
      mockDb.systemQuery.mockResolvedValueOnce([makeAdminRow()]);
      // last login
      mockDb.systemQuery.mockResolvedValueOnce([{ created_at: new Date('2025-06-01') }]);

      const result = await service.getAdminById(1, 10);

      expect(result?.email).toBe('admin@example.com');
      expect(result?.lastLogin).toEqual(new Date('2025-06-01'));
    });
  });

  // =============================================================
  // createAdmin
  // =============================================================

  describe('createAdmin', () => {
    it('should throw ConflictException on duplicate email', async () => {
      mockUserRepo.isEmailTaken.mockResolvedValueOnce(true);

      await expect(
        service.createAdmin(
          {
            email: 'existing@example.com',
            password: 'SecurePass123!',
          } as never,
          10,
          1,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should create admin and return id + uuid', async () => {
      // INSERT RETURNING id, uuid
      mockDb.systemQuery.mockResolvedValueOnce([{ id: 5, uuid: 'mock-uuid-v7' }]);

      const result = await service.createAdmin(
        {
          email: 'new-admin@example.com',
          password: 'SecurePass123!',
          firstName: 'New',
          lastName: 'Admin',
        } as never,
        10,
        1,
      );

      expect(result).toEqual({ id: 5, uuid: 'mock-uuid-v7' });
      expect(mockActivityLogger.logCreate).toHaveBeenCalled();
    });
  });

  // =============================================================
  // updateAdmin
  // =============================================================

  describe('updateAdmin', () => {
    it('should throw NotFoundException when admin not found', async () => {
      // getAdminById → not found
      mockDb.systemQuery.mockResolvedValueOnce([]);

      await expect(service.updateAdmin(999, {} as never, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // deleteAdmin
  // =============================================================

  describe('deleteAdmin', () => {
    it('should throw NotFoundException when admin not found', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]);

      await expect(service.deleteAdmin(999, 10, 1)).rejects.toThrow(NotFoundException);
    });

    it('should soft-delete admin and revoke auth artifacts', async () => {
      // getAdminById → admin row
      mockDb.systemQuery.mockResolvedValueOnce([makeAdminRow()]);
      // last login (from getAdminById)
      mockDb.systemQuery.mockResolvedValueOnce([]);
      // UPDATE users SET is_active = 4 (soft-delete, ADR-020/045)
      mockDb.systemQuery.mockResolvedValueOnce([]);
      // DELETE FROM user_sessions
      mockDb.systemQuery.mockResolvedValueOnce([]);
      // DELETE FROM refresh_tokens
      mockDb.systemQuery.mockResolvedValueOnce([]);

      await service.deleteAdmin(1, 10, 5);

      expect(mockActivityLogger.logDelete).toHaveBeenCalled();
      // Assert the SQL strategy: UPDATE on users, DELETE only on auth tables.
      // The arch-test in shared/src/architectural.test.ts is the strict guard;
      // this is an in-unit smoke check for regression visibility.
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
  // getAdminLogs
  // =============================================================

  describe('getAdminLogs', () => {
    it('should throw NotFoundException when admin not found', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]);

      await expect(service.getAdminLogs(999, 10)).rejects.toThrow(NotFoundException);
    });

    it('should return mapped logs', async () => {
      // getAdminById → admin row
      mockDb.systemQuery.mockResolvedValueOnce([makeAdminRow()]);
      // last login
      mockDb.systemQuery.mockResolvedValueOnce([]);
      // logs query
      mockDb.systemQuery.mockResolvedValueOnce([
        { id: 1, action: 'login', created_at: new Date('2025-06-01') },
      ]);

      const result = await service.getAdminLogs(1, 10);

      expect(result).toHaveLength(1);
    });
  });
});
