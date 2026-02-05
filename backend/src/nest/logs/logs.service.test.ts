/**
 * Unit tests for LogsService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Root access control, password verification,
 *        paginated logs query, stats aggregation, soft delete.
 */
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { DatabaseService } from '../database/database.service.js';
import type { UserRepository } from '../database/repositories/user.repository.js';
import type { DeleteLogsBodyDto } from './dto/index.js';
import { LogsService } from './logs.service.js';

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

function createMockUserRepository() {
  return {
    getPasswordHash: vi.fn(),
  };
}

/** Root user auth context */
function makeRootUser(overrides: Partial<NestAuthUser> = {}): NestAuthUser {
  return {
    id: 1,
    tenantId: 10,
    role: 'root',
    email: 'root@example.com',
    ...overrides,
  } as NestAuthUser;
}

/** Employee user auth context (for forbidden tests) */
function makeEmployeeUser(): NestAuthUser {
  return {
    id: 5,
    tenantId: 10,
    role: 'employee',
    email: 'emp@example.com',
  } as NestAuthUser;
}

// =============================================================
// LogsService
// =============================================================

describe('LogsService', () => {
  let service: LogsService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockUserRepo: ReturnType<typeof createMockUserRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockUserRepo = createMockUserRepository();
    service = new LogsService(
      mockDb as unknown as DatabaseService,
      mockUserRepo as unknown as UserRepository,
    );
  });

  // =============================================================
  // getLogs — access control
  // =============================================================

  describe('getLogs', () => {
    it('should throw ForbiddenException for non-root user', async () => {
      await expect(
        service.getLogs(makeEmployeeUser(), {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return paginated logs for root user', async () => {
      // COUNT query
      mockDb.query.mockResolvedValueOnce([{ total: '2' }]);
      // SELECT logs
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          tenant_id: 10,
          user_id: 1,
          action: 'login',
          was_role_switched: 0,
          created_at: new Date('2025-06-01'),
        },
        {
          id: 2,
          tenant_id: 10,
          user_id: 1,
          action: 'create',
          was_role_switched: 0,
          created_at: new Date('2025-06-02'),
        },
      ]);

      const result = await service.getLogs(makeRootUser(), {});

      expect(result.logs).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should convert offset to page number', async () => {
      mockDb.query.mockResolvedValueOnce([{ total: '100' }]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getLogs(makeRootUser(), {
        offset: 50,
        limit: 25,
      });

      expect(result.pagination.page).toBe(3); // floor(50/25) + 1 = 3
    });
  });

  // =============================================================
  // getStats
  // =============================================================

  describe('getStats', () => {
    it('should throw ForbiddenException for non-root user', async () => {
      await expect(
        service.getStats(makeEmployeeUser()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return aggregated stats', async () => {
      // basicStats
      mockDb.query.mockResolvedValueOnce([
        {
          total_logs: 100,
          today_logs: 5,
          unique_users: 10,
          unique_tenants: 2,
        },
      ]);
      // topActions
      mockDb.query.mockResolvedValueOnce([
        { action: 'login', count: '50' },
        { action: 'create', count: '30' },
      ]);
      // topUsers
      mockDb.query.mockResolvedValueOnce([
        { user_id: 1, user_name: 'root', count: '60' },
      ]);

      const result = await service.getStats(makeRootUser());

      expect(result.totalLogs).toBe(100);
      expect(result.todayLogs).toBe(5);
      expect(result.topActions).toHaveLength(2);
      expect(result.topUsers).toHaveLength(1);
    });

    it('should return zeros when no stats found', async () => {
      mockDb.query.mockResolvedValueOnce([undefined]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getStats(makeRootUser());

      expect(result.totalLogs).toBe(0);
      expect(result.topActions).toEqual([]);
    });
  });

  // =============================================================
  // deleteLogs — access control + validation
  // =============================================================

  describe('deleteLogs', () => {
    it('should throw ForbiddenException for non-root user', async () => {
      const dto = {
        confirmPassword: 'secret',
        olderThanDays: 30,
      } as unknown as DeleteLogsBodyDto;

      await expect(
        service.deleteLogs(makeEmployeeUser(), dto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce('stored-hash');
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);

      const dto = {
        confirmPassword: 'wrong',
        olderThanDays: 30,
      } as unknown as DeleteLogsBodyDto;

      await expect(
        service.deleteLogs(makeRootUser(), dto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException when no filter provided', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce('stored-hash');

      const dto = {
        confirmPassword: 'correct',
      } as unknown as DeleteLogsBodyDto;

      await expect(
        service.deleteLogs(makeRootUser(), dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should soft-delete logs with valid filter', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce('stored-hash');
      // executeStandardDeletion → UPDATE query
      mockDb.query.mockResolvedValueOnce({ rowCount: 5 });

      const dto = {
        confirmPassword: 'correct',
        olderThanDays: 30,
      } as unknown as DeleteLogsBodyDto;

      const result = await service.deleteLogs(makeRootUser(), dto);

      expect(result.deletedCount).toBe(5);
      expect(result.message).toContain('5');
    });
  });
});
