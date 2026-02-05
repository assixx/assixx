/**
 * Unit tests for UsersService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: CRUD operations, access control (role changes), soft delete,
 *        profile pictures, UUID resolution, pagination.
 * Pure functions already tested in users.helpers.test.ts.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcryptjs from 'bcryptjs';
import { promises as fs } from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { UserRepository } from '../database/repositories/user.repository.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
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

vi.mock('fs', () => ({
  promises: {
    access: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
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
  });

  // =============================================================
  // updateProfile
  // =============================================================

  describe('updateProfile', () => {
    it('should update limited fields and return response', async () => {
      const updatedRow = makeUserRow({ first_name: 'Updated' });
      // UPDATE query
      mockDb.query.mockResolvedValueOnce([]);
      // findUserById after update
      mockDb.query.mockResolvedValueOnce([updatedRow]);

      const dto = {
        firstName: 'Updated',
      } as unknown as UpdateProfileDto;

      const result = await service.updateProfile(1, dto, 10);

      expect(result.firstName).toBe('Updated');
    });
  });

  // =============================================================
  // changePassword
  // =============================================================

  describe('changePassword', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce(null);

      await expect(
        service.changePassword(999, 10, 'old', 'new'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce('stored-hash');
      vi.mocked(bcryptjs.compare).mockResolvedValueOnce(false as never);

      await expect(
        service.changePassword(1, 10, 'wrong-password', 'new-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should change password successfully', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce('stored-hash');
      // bcryptjs.compare defaults to true (mocked)
      // bcryptjs.hash defaults to 'hashed-password' (mocked)
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.changePassword(
        1,
        10,
        'current-password',
        'new-password',
      );

      expect(result.message).toBe('Password changed successfully');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET password'),
        expect.arrayContaining(['hashed-password', 1, 10]),
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
  // getProfilePicturePath
  // =============================================================

  describe('getProfilePicturePath', () => {
    it('should throw NotFoundException when no profile picture set', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow()]);

      await expect(service.getProfilePicturePath(1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when file not on disk', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ profile_picture: 'uploads/pic.jpg' }),
      ]);
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));

      await expect(service.getProfilePicturePath(1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =============================================================
  // deleteProfilePicture
  // =============================================================

  describe('deleteProfilePicture', () => {
    it('should throw BadRequestException on directory traversal', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ profile_picture: '../../../etc/passwd' }),
      ]);

      await expect(service.deleteProfilePicture(1, 10)).rejects.toThrow(
        BadRequestException,
      );
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
});
