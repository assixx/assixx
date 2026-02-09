/**
 * Unit tests for UsersService
 *
 * Focus: Admin CRUD operations, access control (role changes), soft delete,
 *        UUID resolution, pagination.
 * Profile self-service tests moved to user-profile.service.test.ts.
 * Pure functions already tested in users.helpers.test.ts.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import bcryptjs from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { UserRepository } from '../database/repositories/user.repository.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { UserAvailabilityService } from './user-availability.service.js';
import { UsersService } from './users.service.js';
import type { UserRow } from './users.types.js';

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

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function createMockActivityLogger() {
  return {
    logCreate: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
    logDelete: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockUserRepository() {
  return {
    getPasswordHash: vi.fn(),
    resolveUuidToId: vi.fn(),
  };
}

function createMockAvailabilityService() {
  return {
    getUserAvailabilityBatch: vi.fn().mockResolvedValue(new Map()),
    getUserAvailability: vi.fn().mockResolvedValue(null),
    addAvailabilityInfo: vi.fn(),
    insertAvailabilityHistoryIfNeeded: vi.fn().mockResolvedValue(undefined),
  };
}

/** Standard user row — all optional fields set to null (NOT undefined!) */
function makeUserRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 1,
    uuid: 'test-uuid-v7',
    tenant_id: 10,
    email: 'max@example.com',
    password: 'hashed-secret',
    role: 'employee',
    username: 'maxm',
    first_name: 'Max',
    last_name: 'Mustermann',
    is_active: 1,
    last_login: null,
    created_at: new Date('2025-01-01'),
    updated_at: null,
    phone: null,
    address: null,
    position: null,
    employee_number: 'EMP001',
    profile_picture: null,
    emergency_contact: null,
    date_of_birth: null,
    has_full_access: 0,
    ...overrides,
  };
}

// =============================================================
// UsersService
// =============================================================

describe('UsersService', () => {
  let service: UsersService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;
  let mockUserRepo: ReturnType<typeof createMockUserRepository>;
  let mockAvailability: ReturnType<typeof createMockAvailabilityService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockActivityLogger = createMockActivityLogger();
    mockUserRepo = createMockUserRepository();
    mockAvailability = createMockAvailabilityService();
    service = new UsersService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
      mockUserRepo as unknown as UserRepository,
      mockAvailability as unknown as UserAvailabilityService,
    );
  });

  // =============================================================
  // listUsers
  // =============================================================

  describe('listUsers', () => {
    it('should return paginated result with users', async () => {
      const userRow1 = makeUserRow({ id: 1 });
      const userRow2 = makeUserRow({ id: 2, email: 'anna@example.com' });
      // COUNT query
      mockDb.query.mockResolvedValueOnce([{ count: '2' }]);
      // SELECT users
      mockDb.query.mockResolvedValueOnce([userRow1, userRow2]);
      // getUserTeamsBatch (called because userIds.length > 0)
      mockDb.query.mockResolvedValueOnce([]);

      const query = {
        page: 1,
        limit: 10,
      } as unknown as ListUsersQueryDto;

      const result = await service.listUsers(10, query);

      expect(result.data).toHaveLength(2);
      expect(result.pagination.totalItems).toBe(2);
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should return empty result when no users match', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);
      mockDb.query.mockResolvedValueOnce([]);
      // No team batch query because userIds is empty

      const query = { page: 1, limit: 10 } as unknown as ListUsersQueryDto;
      const result = await service.listUsers(10, query);

      expect(result.data).toHaveLength(0);
      expect(result.pagination.totalItems).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should calculate totalPages correctly for partial last page', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '25' }]);
      mockDb.query.mockResolvedValueOnce(
        Array.from({ length: 10 }, (_, i) =>
          makeUserRow({ id: i + 1, email: `u${String(i)}@test.com` }),
        ),
      );
      mockDb.query.mockResolvedValueOnce([]); // teams batch

      const query = { page: 1, limit: 10 } as unknown as ListUsersQueryDto;
      const result = await service.listUsers(10, query);

      expect(result.pagination.totalPages).toBe(3); // ceil(25/10)
      expect(result.pagination.pageSize).toBe(10);
    });
  });

  // =============================================================
  // getUserById
  // =============================================================

  describe('getUserById', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getUserById(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return enriched response with tenant info', async () => {
      const userRow = makeUserRow();
      // findUserById
      mockDb.query.mockResolvedValueOnce([userRow]);
      // getUserDepartments (Promise.all[0])
      mockDb.query.mockResolvedValueOnce([]);
      // getUserTeams (Promise.all[1])
      mockDb.query.mockResolvedValueOnce([]);
      // getTenantInfo (Promise.all[3])
      mockDb.query.mockResolvedValueOnce([
        { company_name: 'Test Corp', subdomain: 'test' },
      ]);

      const result = await service.getUserById(1, 10);

      expect(result.email).toBe('max@example.com');
      expect(result.tenant?.companyName).toBe('Test Corp');
      expect(result.tenant?.subdomain).toBe('test');
    });

    it('should omit tenant when tenant row not found', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow()]);
      mockDb.query.mockResolvedValueOnce([]); // departments
      mockDb.query.mockResolvedValueOnce([]); // teams
      mockDb.query.mockResolvedValueOnce([]); // tenant → empty

      const result = await service.getUserById(1, 10);

      expect(result.tenant).toBeUndefined();
    });

    it('should enrich response with departments and teams', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow()]);
      // departments
      mockDb.query.mockResolvedValueOnce([
        {
          user_id: 1,
          department_id: 100,
          department_name: 'Engineering',
          is_primary: true,
        },
      ]);
      // teams
      mockDb.query.mockResolvedValueOnce([
        {
          user_id: 1,
          team_id: 200,
          team_name: 'Alpha',
          team_department_id: 100,
          team_department_name: 'Engineering',
          team_area_id: 50,
          team_area_name: 'Tech',
        },
      ]);
      // tenant
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getUserById(1, 10);

      expect(result.departmentIds).toEqual([100]);
      expect(result.departmentNames).toEqual(['Engineering']);
      expect(result.teamIds).toEqual([200]);
      expect(result.teamNames).toEqual(['Alpha']);
      expect(result.teamDepartmentName).toBe('Engineering');
      expect(result.teamAreaName).toBe('Tech');
    });
  });

  // =============================================================
  // createUser
  // =============================================================

  describe('createUser', () => {
    const createDto = {
      email: 'new@example.com',
      password: 'SecurePass123!',
      firstName: 'New',
      lastName: 'User',
      role: 'employee',
    } as unknown as CreateUserDto;

    it('should throw ConflictException on duplicate email', async () => {
      // findUserByEmail → existing user found
      mockDb.query.mockResolvedValueOnce([makeUserRow()]);

      await expect(service.createUser(createDto, 1, 10)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create user and log activity', async () => {
      // findUserByEmail → no existing user
      mockDb.query.mockResolvedValueOnce([]);
      // insertUserRecord → INSERT RETURNING id
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);
      // fetchUserWithDepartments → findUserById
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ id: 5, email: 'new@example.com' }),
      ]);
      // fetchUserWithDepartments → getUserDepartments
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.createUser(createDto, 1, 10);

      expect(result.id).toBe(5);
      expect(mockActivityLogger.logCreate).toHaveBeenCalledWith(
        10,
        1,
        'user',
        5,
        expect.stringContaining('new@example.com'),
        expect.objectContaining({ email: 'new@example.com' }),
      );
    });

    it('should assign departments when departmentIds provided', async () => {
      const dtoWithDepts = {
        ...createDto,
        departmentIds: [100, 200],
      } as unknown as CreateUserDto;

      mockDb.query.mockResolvedValueOnce([]); // findUserByEmail
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]); // INSERT
      mockDb.query.mockResolvedValueOnce([]); // assignUserDepartments dept 100
      mockDb.query.mockResolvedValueOnce([]); // assignUserDepartments dept 200
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ id: 5, email: 'new@example.com' }),
      ]); // fetchUser
      mockDb.query.mockResolvedValueOnce([]); // getDepartments

      await service.createUser(dtoWithDepts, 1, 10);

      // Verify department INSERT queries (calls 3 & 4, 0-indexed)
      const deptCall1 = mockDb.query.mock.calls[2];
      const deptSql = deptCall1?.[0] as string;
      expect(deptSql).toContain('INSERT INTO user_departments');
    });

    it('should log extra activity when hasFullAccess is true (admin)', async () => {
      const dtoWithAccess = {
        ...createDto,
        role: 'admin',
        hasFullAccess: true,
      } as unknown as CreateUserDto;

      mockDb.query.mockResolvedValueOnce([]); // findUserByEmail
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]); // INSERT
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ id: 5, email: 'new@example.com', role: 'admin' }),
      ]); // fetchUser
      mockDb.query.mockResolvedValueOnce([]); // getDepartments

      await service.createUser(dtoWithAccess, 1, 10);

      expect(mockActivityLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'assign',
          entityType: 'user',
          details: expect.stringContaining('Vollzugriff'),
        }),
      );
    });

    it('should throw BadRequestException when creating employee with hasFullAccess=true', async () => {
      const dtoEmployeeFullAccess = {
        ...createDto,
        role: 'employee',
        hasFullAccess: true,
      } as unknown as CreateUserDto;

      mockDb.query.mockResolvedValueOnce([]); // findUserByEmail

      await expect(
        service.createUser(dtoEmployeeFullAccess, 1, 10),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow creating admin with hasFullAccess=true', async () => {
      const adminDto = {
        ...createDto,
        role: 'admin',
        hasFullAccess: true,
      } as unknown as CreateUserDto;

      mockDb.query.mockResolvedValueOnce([]); // findUserByEmail
      mockDb.query.mockResolvedValueOnce([{ id: 6 }]); // INSERT
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ id: 6, email: 'new@example.com', role: 'admin' }),
      ]); // fetchUser
      mockDb.query.mockResolvedValueOnce([]); // getDepartments

      const result = await service.createUser(adminDto, 1, 10);
      expect(result.id).toBe(6);
    });

    it('should throw ConflictException on employee_number constraint violation', async () => {
      mockDb.query.mockResolvedValueOnce([]); // findUserByEmail
      // INSERT throws unique constraint on employee_number
      const pgError = Object.assign(new Error('unique violation'), {
        code: '23505',
        constraint: 'users_employee_number_tenant_id_key',
      });
      mockDb.query.mockRejectedValueOnce(pgError);

      await expect(service.createUser(createDto, 1, 10)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerError when INSERT returns no id', async () => {
      mockDb.query.mockResolvedValueOnce([]); // findUserByEmail
      mockDb.query.mockResolvedValueOnce([]); // INSERT returns empty array

      await expect(service.createUser(createDto, 1, 10)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should propagate CHECK constraint error (23514) for chk_employee_no_full_access', async () => {
      // Scenario: service-level validation bypassed, DB CHECK fires as safety net
      const adminDto = {
        ...createDto,
        role: 'admin',
        hasFullAccess: true,
      } as unknown as CreateUserDto;

      mockDb.query.mockResolvedValueOnce([]); // findUserByEmail
      // INSERT triggers CHECK constraint violation
      const pgError = Object.assign(
        new Error(
          'new row violates check constraint "chk_employee_no_full_access"',
        ),
        { code: '23514' },
      );
      mockDb.query.mockRejectedValueOnce(pgError);

      // Error must NOT be swallowed — it propagates (not ConflictException, not silent)
      await expect(service.createUser(adminDto, 1, 10)).rejects.toThrow(
        'chk_employee_no_full_access',
      );
    });
  });

  // =============================================================
  // updateUser
  // =============================================================

  describe('updateUser', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const dto = {
        firstName: 'Updated',
      } as unknown as UpdateUserDto;

      await expect(
        service.updateUser(999, dto, 1, 'admin', 10),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException on unauthorized role change', async () => {
      // findUserById → existing user
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'employee' })]);
      // assertCanChangeRole → get acting user's has_full_access
      mockDb.query.mockResolvedValueOnce([{ has_full_access: false }]);

      const dto = { role: 'admin' } as unknown as UpdateUserDto;

      await expect(service.updateUser(1, dto, 2, 'admin', 10)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow root to change role', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'employee' })]);
      // No assertCanChangeRole DB call for root
      mockDb.query.mockResolvedValueOnce([]); // executeUserUpdate
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ id: 1, role: 'admin' }),
      ]); // fetchUser
      mockDb.query.mockResolvedValueOnce([]); // getDepartments

      const dto = { role: 'admin' } as unknown as UpdateUserDto;
      const result = await service.updateUser(1, dto, 99, 'root', 10);

      expect(result).toBeDefined();
    });

    it('should allow admin with full access to change role', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'employee' })]);
      // assertCanChangeRole → admin with full access
      mockDb.query.mockResolvedValueOnce([{ has_full_access: true }]);
      mockDb.query.mockResolvedValueOnce([]); // executeUserUpdate
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'admin' })]); // fetchUser
      mockDb.query.mockResolvedValueOnce([]); // getDepartments

      const dto = { role: 'admin' } as unknown as UpdateUserDto;
      const result = await service.updateUser(1, dto, 2, 'admin', 10);

      expect(result).toBeDefined();
    });

    it('should throw ConflictException when changing to taken email', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow()]); // findUserById
      // validateEmailUniqueness → findUserByEmail → found
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ id: 2, email: 'taken@example.com' }),
      ]);

      const dto = {
        email: 'taken@example.com',
      } as unknown as UpdateUserDto;

      await expect(service.updateUser(1, dto, 99, 'root', 10)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should update department assignments when provided', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow()]); // findUserById
      mockDb.query.mockResolvedValueOnce([]); // executeUserUpdate
      mockDb.query.mockResolvedValueOnce([]); // removeUserDepartments (DELETE)
      mockDb.query.mockResolvedValueOnce([]); // assignUserDepartments dept 100
      mockDb.query.mockResolvedValueOnce([makeUserRow()]); // fetchUser
      mockDb.query.mockResolvedValueOnce([]); // getDepartments

      const dto = {
        firstName: 'Updated',
        departmentIds: [100],
      } as unknown as UpdateUserDto;

      await service.updateUser(1, dto, 99, 'root', 10);

      // Verify DELETE was called
      const deleteSql = mockDb.query.mock.calls[2]?.[0] as string;
      expect(deleteSql).toContain('DELETE FROM user_departments');
    });

    it('should hash password when included in update', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow()]); // findUserById
      mockDb.query.mockResolvedValueOnce([]); // executeUserUpdate
      mockDb.query.mockResolvedValueOnce([makeUserRow()]); // fetchUser
      mockDb.query.mockResolvedValueOnce([]); // getDepartments

      const dto = { password: 'NewSecurePass123!' } as unknown as UpdateUserDto;

      await service.updateUser(1, dto, 99, 'root', 10);

      expect(bcryptjs.hash).toHaveBeenCalledWith('NewSecurePass123!', 12);
    });

    it('should throw ConflictException on employee_number constraint during update', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow()]); // findUserById
      // executeUserUpdate throws unique constraint
      const pgError = Object.assign(new Error('unique violation'), {
        code: '23505',
        constraint: 'users_employee_number_tenant_id_key',
      });
      mockDb.query.mockRejectedValueOnce(pgError);

      const dto = {
        employeeNumber: 'EMP999',
      } as unknown as UpdateUserDto;

      await expect(service.updateUser(1, dto, 99, 'root', 10)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should delegate availability history update', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow()]); // findUserById
      mockDb.query.mockResolvedValueOnce([]); // executeUserUpdate
      mockDb.query.mockResolvedValueOnce([makeUserRow()]); // fetchUser
      mockDb.query.mockResolvedValueOnce([]); // getDepartments

      const dto = {
        firstName: 'X',
        availabilityStatus: 'available',
      } as unknown as UpdateUserDto;

      await service.updateUser(1, dto, 99, 'root', 10);

      expect(
        mockAvailability.insertAvailabilityHistoryIfNeeded,
      ).toHaveBeenCalledWith(
        1,
        10,
        'available',
        undefined,
        undefined,
        undefined,
        undefined,
        99,
      );
    });

    it('should throw BadRequestException when setting hasFullAccess=true on employee', async () => {
      // Existing user is an employee
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ role: 'employee', has_full_access: 0 }),
      ]);

      const dto = { hasFullAccess: true } as unknown as UpdateUserDto;

      await expect(service.updateUser(1, dto, 99, 'root', 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when changing role TO employee with existing full access', async () => {
      // Existing user is admin with has_full_access = 1
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ role: 'admin', has_full_access: 1 }),
      ]);
      // assertCanChangeRole → root, no DB call needed

      const dto = { role: 'employee' } as unknown as UpdateUserDto;

      await expect(service.updateUser(1, dto, 99, 'root', 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow setting hasFullAccess=true on admin', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ role: 'admin', has_full_access: 0 }),
      ]);
      mockDb.query.mockResolvedValueOnce([]); // executeUserUpdate
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ role: 'admin', has_full_access: 1 }),
      ]); // fetchUser
      mockDb.query.mockResolvedValueOnce([]); // getDepartments

      const dto = { hasFullAccess: true } as unknown as UpdateUserDto;
      const result = await service.updateUser(1, dto, 99, 'root', 10);

      expect(result).toBeDefined();
    });

    it('should propagate CHECK constraint error (23514) for chk_employee_no_full_access on update', async () => {
      // Scenario: DB CHECK fires as safety net during UPDATE
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ role: 'admin', has_full_access: 0 }),
      ]); // findUserById
      // executeUserUpdate triggers CHECK constraint
      const pgError = Object.assign(
        new Error(
          'new row violates check constraint "chk_employee_no_full_access"',
        ),
        { code: '23514' },
      );
      mockDb.query.mockRejectedValueOnce(pgError);

      const dto = { hasFullAccess: true } as unknown as UpdateUserDto;

      // Error must propagate — not swallowed, not misinterpreted as 23505
      await expect(service.updateUser(1, dto, 99, 'root', 10)).rejects.toThrow(
        'chk_employee_no_full_access',
      );
    });
  });

  // =============================================================
  // deleteUser
  // =============================================================

  describe('deleteUser', () => {
    it('should throw BadRequestException on self-delete', async () => {
      await expect(service.deleteUser(1, 1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]); // findUserById

      await expect(service.deleteUser(999, 2, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should soft-delete user (is_active=4)', async () => {
      const userRow = makeUserRow();
      // findUserById
      mockDb.query.mockResolvedValueOnce([userRow]);
      // UPDATE is_active = 4
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteUser(1, 2, 10);

      expect(result.message).toBe('User deleted successfully');
      const updateSql = mockDb.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('is_active = 4');
      expect(mockActivityLogger.logDelete).toHaveBeenCalled();
    });
  });

  // =============================================================
  // archiveUser
  // =============================================================

  describe('archiveUser', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.archiveUser(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should set is_active to 3', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow()]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.archiveUser(1, 10);

      expect(result.message).toBe('User archived successfully');
      const updateSql = mockDb.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('is_active = 3');
    });
  });

  // =============================================================
  // unarchiveUser
  // =============================================================

  describe('unarchiveUser', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.unarchiveUser(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should set is_active to 1', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow({ is_active: 3 })]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.unarchiveUser(1, 10);

      expect(result.message).toBe('User unarchived successfully');
      const updateSql = mockDb.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('is_active = 1');
    });
  });

  // =============================================================
  // getUserByUuid
  // =============================================================

  describe('getUserByUuid', () => {
    it('should throw NotFoundException for unknown UUID', async () => {
      mockUserRepo.resolveUuidToId.mockResolvedValueOnce(null);

      await expect(service.getUserByUuid('unknown-uuid', 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // updateUserByUuid
  // =============================================================

  describe('updateUserByUuid', () => {
    it('should resolve UUID and delegate to updateUser', async () => {
      mockUserRepo.resolveUuidToId.mockResolvedValueOnce(5);
      mockDb.query.mockResolvedValueOnce([makeUserRow({ id: 5 })]); // findUserById
      mockDb.query.mockResolvedValueOnce([]); // executeUserUpdate
      mockDb.query.mockResolvedValueOnce([makeUserRow({ id: 5 })]); // fetchUser
      mockDb.query.mockResolvedValueOnce([]); // getDepartments

      const dto = { firstName: 'Via UUID' } as unknown as UpdateUserDto;
      const result = await service.updateUserByUuid(
        'some-uuid',
        dto,
        99,
        'root',
        10,
      );

      expect(result.id).toBe(5);
      expect(mockUserRepo.resolveUuidToId).toHaveBeenCalledWith(
        'some-uuid',
        10,
      );
    });
  });

  // =============================================================
  // deleteUserByUuid
  // =============================================================

  describe('deleteUserByUuid', () => {
    it('should resolve UUID and delegate to deleteUser', async () => {
      mockUserRepo.resolveUuidToId.mockResolvedValueOnce(5);
      // deleteUser → findUserById
      mockDb.query.mockResolvedValueOnce([makeUserRow({ id: 5 })]);
      // deleteUser → UPDATE is_active = 4
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteUserByUuid('some-uuid', 2, 10);

      expect(result.message).toBe('User deleted successfully');
      expect(mockUserRepo.resolveUuidToId).toHaveBeenCalledWith(
        'some-uuid',
        10,
      );
    });
  });

  // =============================================================
  // archiveUserByUuid
  // =============================================================

  describe('archiveUserByUuid', () => {
    it('should resolve UUID and delegate to archiveUser', async () => {
      mockUserRepo.resolveUuidToId.mockResolvedValueOnce(5);
      mockDb.query.mockResolvedValueOnce([makeUserRow({ id: 5 })]); // findUserById
      mockDb.query.mockResolvedValueOnce([]); // UPDATE is_active = 3

      const result = await service.archiveUserByUuid('some-uuid', 10);

      expect(result.message).toBe('User archived successfully');
    });
  });

  // =============================================================
  // unarchiveUserByUuid
  // =============================================================

  describe('unarchiveUserByUuid', () => {
    it('should resolve UUID and delegate to unarchiveUser', async () => {
      mockUserRepo.resolveUuidToId.mockResolvedValueOnce(5);
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ id: 5, is_active: 3 }),
      ]); // findUserById
      mockDb.query.mockResolvedValueOnce([]); // UPDATE is_active = 1

      const result = await service.unarchiveUserByUuid('some-uuid', 10);

      expect(result.message).toBe('User unarchived successfully');
    });
  });
});
