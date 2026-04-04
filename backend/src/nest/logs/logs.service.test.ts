/**
 * Unit tests for LogsService
 *
 * Phase 11 → Phase 14: Service tests — mocked dependencies.
 * Focus: Root access control, password verification,
 *        paginated logs query, stats aggregation, soft delete,
 *        private helper methods (query building, formatting, filters).
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
  const qf = vi.fn();
  return { query: qf, tenantQuery: qf };
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

/** DbLogRow shape (not exported from service, replicated for tests) */
interface TestDbLogRow {
  id: number;
  tenant_id: number;
  user_id: number;
  action: string;
  was_role_switched: number;
  created_at: Date | null;
  tenant_name?: string;
  user_name?: string;
  user_role?: string;
  user_first_name?: string;
  user_last_name?: string;
  employee_number?: string;
  department_name?: string;
  area_name?: string;
  team_name?: string;
  entity_type?: string;
  entity_id?: number;
  old_values?: string;
  new_values?: string;
  ip_address?: string;
  user_agent?: string;
  is_active?: number;
}

/** Full log row for formatting tests */
function makeFullDbLogRow(overrides: Partial<TestDbLogRow> = {}): TestDbLogRow {
  return {
    id: 1,
    tenant_id: 10,
    user_id: 1,
    action: 'login',
    was_role_switched: 0,
    created_at: new Date('2025-06-01T10:00:00Z'),
    user_name: 'admin',
    user_role: 'root',
    user_first_name: 'Admin',
    user_last_name: 'User',
    employee_number: 'EMP-001',
    tenant_name: 'TestCorp',
    entity_type: 'user',
    entity_id: 42,
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0',
    department_name: 'Engineering',
    area_name: 'West',
    team_name: 'Alpha',
    old_values: '{"status":"inactive"}',
    new_values: '{"status":"active"}',
    ...overrides,
  };
}

// =============================================================
// Private helper methods (via bracket notation)
// =============================================================

describe('LogsService – private helpers', () => {
  let service: LogsService;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockDb = createMockDb();
    const mockUserRepo = createMockUserRepository();
    service = new LogsService(
      mockDb as unknown as DatabaseService,
      mockUserRepo as unknown as UserRepository,
    );
  });

  // =============================================================
  // addSearchCondition
  // =============================================================

  describe('addSearchCondition', () => {
    it('adds 10 ILIKE search params for non-empty search', () => {
      const conditions: string[] = [];
      const params: unknown[] = [10]; // existing tenantId param

      service['addSearchCondition']('admin', conditions, params);

      expect(conditions).toHaveLength(1);
      expect(conditions[0]).toContain('ILIKE');
      // 1 existing + 10 new search params (email removed, Spec Deviation D1)
      expect(params).toHaveLength(11);
      expect(params[1]).toBe('%admin%');
      expect(params[10]).toBe('%admin%');
    });

    it('does nothing for undefined or empty search', () => {
      const conditions: string[] = [];
      const params: unknown[] = [];

      service['addSearchCondition'](undefined, conditions, params);
      expect(conditions).toHaveLength(0);
      expect(params).toHaveLength(0);

      service['addSearchCondition']('', conditions, params);
      expect(conditions).toHaveLength(0);
      expect(params).toHaveLength(0);
    });
  });

  // =============================================================
  // buildWhereClause
  // =============================================================

  describe('buildWhereClause', () => {
    it('builds minimal clause with only tenantId', () => {
      const result = service['buildWhereClause']({ tenantId: 10 });

      // Soft-delete filter + tenantId
      expect(result.whereClause).toContain('is_active');
      expect(result.whereClause).toContain('rl.tenant_id');
      expect(result.params).toContain(10);
    });

    it('includes all standard filter conditions', () => {
      const result = service['buildWhereClause']({
        tenantId: 10,
        userId: 1,
        action: 'login',
        entityType: 'user',
        startDate: '2025-01-01',
        endDate: '2025-06-30',
      });

      expect(result.whereClause).toContain('rl.user_id');
      expect(result.whereClause).toContain('rl.action');
      expect(result.whereClause).toContain('rl.entity_type');
      expect(result.whereClause).toContain('>='); // startDate
      expect(result.whereClause).toContain('<='); // endDate
      expect(result.params).toEqual([1, 10, 'login', 'user', '2025-01-01', '2025-06-30']);
    });

    it('includes search condition when search is provided', () => {
      const result = service['buildWhereClause']({
        tenantId: 10,
        search: 'admin',
      });

      expect(result.whereClause).toContain('ILIKE');
      // tenantId(1) + 10 search params
      expect(result.params).toHaveLength(11);
    });
  });

  // =============================================================
  // parseJsonValue
  // =============================================================

  describe('parseJsonValue', () => {
    it('parses JSON string into object', () => {
      const result = service['parseJsonValue']('{"key":"value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('passes through object values unchanged', () => {
      const input = { key: 'value' };
      const result = service['parseJsonValue'](input);
      expect(result).toBe(input); // same reference
    });
  });

  // =============================================================
  // formatCreatedAt
  // =============================================================

  describe('formatCreatedAt', () => {
    it('returns ISO string for Date object', () => {
      const date = new Date('2025-06-01T10:00:00Z');
      const result = service['formatCreatedAt'](date);
      expect(result).toBe('2025-06-01T10:00:00.000Z');
    });

    it('returns current ISO string for null', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z'));

      const result = service['formatCreatedAt'](null);
      expect(result).toBe('2025-06-15T12:00:00.000Z');

      vi.useRealTimers();
    });

    it('returns String() for non-Date truthy values', () => {
      // Service checks `instanceof Date` — a string bypasses it
      const result = service['formatCreatedAt']('2025-06-01' as unknown as Date);
      expect(result).toBe('2025-06-01');
    });
  });

  // =============================================================
  // buildUserFields
  // =============================================================

  describe('buildUserFields', () => {
    it('maps all user fields from DB row', () => {
      const log = makeFullDbLogRow();
      const result = service['buildUserFields'](log);

      expect(result).toEqual({
        userName: 'admin',
        userRole: 'root',
        userFirstName: 'Admin',
        userLastName: 'User',
        employeeNumber: 'EMP-001',
      });
    });

    it('returns empty object when no user fields present', () => {
      const log: TestDbLogRow = {
        id: 1,
        tenant_id: 10,
        user_id: 1,
        action: 'login',
        was_role_switched: 0,
        created_at: null,
      };
      const result = service['buildUserFields'](log);
      expect(result).toEqual({});
    });
  });

  // =============================================================
  // buildContextFields
  // =============================================================

  describe('buildContextFields', () => {
    it('maps all context fields including parsed JSON values', () => {
      const log = makeFullDbLogRow();
      const result = service['buildContextFields'](log);

      expect(result['tenantName']).toBe('TestCorp');
      expect(result['entityType']).toBe('user');
      expect(result['entityId']).toBe(42);
      expect(result['ipAddress']).toBe('192.168.1.1');
      expect(result['userAgent']).toBe('Mozilla/5.0');
      expect(result['departmentName']).toBe('Engineering');
      expect(result['areaName']).toBe('West');
      expect(result['teamName']).toBe('Alpha');
      expect(result['oldValues']).toEqual({ status: 'inactive' });
      expect(result['newValues']).toEqual({ status: 'active' });
    });

    it('returns empty object when no context fields present', () => {
      const log: TestDbLogRow = {
        id: 1,
        tenant_id: 10,
        user_id: 1,
        action: 'login',
        was_role_switched: 0,
        created_at: null,
      };
      const result = service['buildContextFields'](log);
      expect(result).toEqual({});
    });
  });

  // =============================================================
  // formatLogResponse
  // =============================================================

  describe('formatLogResponse', () => {
    it('formats a full DB log row to API response', () => {
      const log = makeFullDbLogRow();
      const result = service['formatLogResponse'](log);

      expect(result['id']).toBe(1);
      expect(result['tenantId']).toBe(10);
      expect(result['userId']).toBe(1);
      expect(result['action']).toBe('login');
      expect(result['wasRoleSwitched']).toBe(false);
      expect(result['createdAt']).toBe('2025-06-01T10:00:00.000Z');
      expect(result['userName']).toBe('admin');
      expect(result['oldValues']).toEqual({ status: 'inactive' });
    });
  });

  // =============================================================
  // hasAnyDeleteFilter
  // =============================================================

  describe('hasAnyDeleteFilter', () => {
    it('returns false for empty DTO (no filters)', () => {
      const dto = { confirmPassword: 'pass' } as unknown as DeleteLogsBodyDto;
      expect(service['hasAnyDeleteFilter'](dto)).toBe(false);
    });

    it('returns true when userId is set', () => {
      const dto = {
        confirmPassword: 'pass',
        userId: 5,
      } as unknown as DeleteLogsBodyDto;
      expect(service['hasAnyDeleteFilter'](dto)).toBe(true);
    });

    it('returns true when olderThanDays is set', () => {
      const dto = {
        confirmPassword: 'pass',
        olderThanDays: 30,
      } as unknown as DeleteLogsBodyDto;
      expect(service['hasAnyDeleteFilter'](dto)).toBe(true);
    });

    it('returns false for empty string action', () => {
      const dto = {
        confirmPassword: 'pass',
        action: '',
      } as unknown as DeleteLogsBodyDto;
      expect(service['hasAnyDeleteFilter'](dto)).toBe(false);
    });
  });

  // =============================================================
  // buildDeleteFilters
  // =============================================================

  describe('buildDeleteFilters', () => {
    it('builds all filters from DTO', () => {
      const dto = {
        confirmPassword: 'pass',
        userId: 5,
        olderThanDays: 30,
        action: 'login',
        entityType: 'user',
        search: 'admin',
      } as unknown as DeleteLogsBodyDto;

      const result = service['buildDeleteFilters'](dto, 10);

      expect(result).toEqual({
        tenantId: 10,
        userId: 5,
        olderThanDays: 30,
        action: 'login',
        entityType: 'user',
        search: 'admin',
      });
    });

    it('ignores empty string values for action/entityType/search', () => {
      const dto = {
        confirmPassword: 'pass',
        action: '',
        entityType: '',
        search: '',
      } as unknown as DeleteLogsBodyDto;

      const result = service['buildDeleteFilters'](dto, 10);

      expect(result).toEqual({ tenantId: 10 });
    });
  });
});

// =============================================================
// DB-Mocked Public Methods
// =============================================================

describe('LogsService – DB-mocked methods', () => {
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
  // getLogs — access control + pagination
  // =============================================================

  describe('getLogs', () => {
    it('should throw ForbiddenException for non-root user', async () => {
      await expect(
        service.getLogs(makeEmployeeUser(), {}),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return paginated logs for root user', async () => {
      mockDb.query.mockResolvedValueOnce([{ total: '2' }]);
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

    it('should pass all filter params through to WHERE clause', async () => {
      mockDb.query.mockResolvedValueOnce([{ total: '0' }]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.getLogs(makeRootUser(), {
        userId: 5,
        action: 'login',
        entityType: 'user',
        startDate: '2025-01-01',
        endDate: '2025-06-30',
      });

      // COUNT query is first call — check its params include filter values
      const countParams = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(countParams).toContain(5); // userId
      expect(countParams).toContain('login'); // action
      expect(countParams).toContain('user'); // entityType
    });

    it('should set hasMore flag correctly', async () => {
      mockDb.query.mockResolvedValueOnce([{ total: '100' }]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getLogs(makeRootUser(), {
        page: 1,
        limit: 10,
      });

      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.totalPages).toBe(10);
    });

    it('should apply search filter with ILIKE params', async () => {
      mockDb.query.mockResolvedValueOnce([{ total: '1' }]);
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          tenant_id: 10,
          user_id: 1,
          action: 'login',
          was_role_switched: 0,
          created_at: new Date('2025-06-01'),
        },
      ]);

      const result = await service.getLogs(makeRootUser(), {
        search: 'admin',
      });

      expect(result.logs).toHaveLength(1);
      // COUNT query params: tenantId(1) + 10 search params = 11
      const countParams = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(countParams).toHaveLength(11);
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
      mockDb.query.mockResolvedValueOnce([
        {
          total_logs: 100,
          today_logs: 5,
          unique_users: 10,
          unique_tenants: 2,
        },
      ]);
      mockDb.query.mockResolvedValueOnce([
        { action: 'login', count: '50' },
        { action: 'create', count: '30' },
      ]);
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

    it('should convert string counts to numbers for topActions/topUsers', async () => {
      mockDb.query.mockResolvedValueOnce([
        { total_logs: 50, today_logs: 2, unique_users: 5, unique_tenants: 1 },
      ]);
      mockDb.query.mockResolvedValueOnce([
        { action: 'login', count: '42' },
      ]);
      mockDb.query.mockResolvedValueOnce([
        { user_id: 1, user_name: 'admin', count: '37' },
      ]);

      const result = await service.getStats(makeRootUser());

      // PostgreSQL bigint → string, service must Number() it
      expect(result.topActions[0]?.count).toBe(42);
      expect(result.topUsers[0]?.count).toBe(37);
    });

    it('should handle null values in topActions/topUsers gracefully', async () => {
      mockDb.query.mockResolvedValueOnce([
        { total_logs: 10, today_logs: 0, unique_users: 1, unique_tenants: 1 },
      ]);
      mockDb.query.mockResolvedValueOnce([
        { action: null, count: null },
      ]);
      mockDb.query.mockResolvedValueOnce([
        { user_id: null, user_name: null, count: null },
      ]);

      const result = await service.getStats(makeRootUser());

      expect(result.topActions[0]?.action).toBe('unknown');
      expect(result.topActions[0]?.count).toBe(0);
      expect(result.topUsers[0]?.userName).toBe('Unknown');
      expect(result.topUsers[0]?.count).toBe(0);
    });
  });

  // =============================================================
  // deleteLogs — access control + validation + execution
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

    it('should throw UnauthorizedException when user not found (null hash)', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce(null);

      const dto = {
        confirmPassword: 'password',
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
      mockDb.query.mockResolvedValueOnce({ rowCount: 5 });

      const dto = {
        confirmPassword: 'correct',
        olderThanDays: 30,
      } as unknown as DeleteLogsBodyDto;

      const result = await service.deleteLogs(makeRootUser(), dto);

      expect(result.deletedCount).toBe(5);
      expect(result.message).toContain('5');
    });

    it('should use deleteLogsWithSearch when search filter is present', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce('stored-hash');
      // deleteLogsWithSearch UPDATE query
      mockDb.query.mockResolvedValueOnce({ rowCount: 3 });

      const dto = {
        confirmPassword: 'correct',
        search: 'admin',
      } as unknown as DeleteLogsBodyDto;

      const result = await service.deleteLogs(makeRootUser(), dto);

      expect(result.deletedCount).toBe(3);
      // Verify query uses subquery pattern (search-based delete)
      const querySql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(querySql).toContain('WHERE id IN');
    });

    it('should delete with action filter via standard deletion', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce('stored-hash');
      mockDb.query.mockResolvedValueOnce({ rowCount: 10 });

      const dto = {
        confirmPassword: 'correct',
        action: 'login',
      } as unknown as DeleteLogsBodyDto;

      const result = await service.deleteLogs(makeRootUser(), dto);

      expect(result.deletedCount).toBe(10);
      const queryParams = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(queryParams).toContain('login');
    });
  });
});
