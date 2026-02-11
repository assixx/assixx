/**
 * Unit tests for UserProfileService
 *
 * Self-service operations: profile update, password change, profile pictures.
 * Extracted from users.service.test.ts during service split.
 */
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcryptjs from 'bcryptjs';
import { promises as fs } from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { UserRepository } from '../database/repositories/user.repository.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UserProfileService } from './user-profile.service.js';
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

function createMockUserRepository() {
  return {
    getPasswordHash: vi.fn(),
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
// UserProfileService
// =============================================================

describe('UserProfileService', () => {
  let service: UserProfileService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockUserRepo: ReturnType<typeof createMockUserRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockUserRepo = createMockUserRepository();
    service = new UserProfileService(
      mockDb as unknown as DatabaseService,
      mockUserRepo as unknown as UserRepository,
    );
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

    it('should skip UPDATE when no fields provided', async () => {
      // No UPDATE query, just findUserById
      mockDb.query.mockResolvedValueOnce([makeUserRow()]);

      const dto = {} as unknown as UpdateProfileDto;
      const result = await service.updateProfile(1, dto, 10);

      expect(result.email).toBe('max@example.com');
      // Only 1 query (findUserById), no UPDATE
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when user vanishes after update', async () => {
      mockDb.query.mockResolvedValueOnce([]); // UPDATE
      mockDb.query.mockResolvedValueOnce([]); // findUserById → empty

      const dto = { firstName: 'Ghost' } as unknown as UpdateProfileDto;

      await expect(service.updateProfile(1, dto, 10)).rejects.toThrow(
        NotFoundException,
      );
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
      mockDb.query.mockResolvedValueOnce([]); // UPDATE users
      mockDb.query.mockResolvedValueOnce([{ count: '2' }]); // revoke refresh_tokens

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
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE refresh_tokens SET is_revoked'),
        [1, 10],
      );
    });
  });

  // =============================================================
  // getProfilePicturePath
  // =============================================================

  describe('getProfilePicturePath', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.getProfilePicturePath(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

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

    it('should return file path when picture exists', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ profile_picture: 'uploads/pic.jpg' }),
      ]);
      // fs.access default resolves (mocked)

      const result = await service.getProfilePicturePath(1, 10);

      expect(result).toContain('uploads/pic.jpg');
    });
  });

  // =============================================================
  // updateProfilePicture
  // =============================================================

  describe('updateProfilePicture', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.updateProfilePicture(999, '/some/path.jpg', 10),
      ).rejects.toThrow(NotFoundException);
    });

    it('should store relative path and return updated user', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow()]); // findUserById
      mockDb.query.mockResolvedValueOnce([]); // UPDATE profile_picture
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ profile_picture: 'uploads/new.jpg' }),
      ]); // findUserById after

      const result = await service.updateProfilePicture(
        1,
        `${process.cwd()}/uploads/new.jpg`,
        10,
      );

      expect(result).toBeDefined();
      const updateSql = mockDb.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('profile_picture');
    });

    it('should throw InternalServerError when user vanishes after update', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow()]); // findUserById
      mockDb.query.mockResolvedValueOnce([]); // UPDATE profile_picture
      mockDb.query.mockResolvedValueOnce([]); // findUserById after → empty

      await expect(
        service.updateProfilePicture(1, `${process.cwd()}/uploads/new.jpg`, 10),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // =============================================================
  // deleteProfilePicture
  // =============================================================

  describe('deleteProfilePicture', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.deleteProfilePicture(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when no picture to delete', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow()]);

      await expect(service.deleteProfilePicture(1, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException on directory traversal', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ profile_picture: '../../../etc/passwd' }),
      ]);

      await expect(service.deleteProfilePicture(1, 10)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete file and clear DB field on success', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ profile_picture: 'uploads/avatar.jpg' }),
      ]);
      // fs.unlink default resolves (mocked)
      mockDb.query.mockResolvedValueOnce([]); // UPDATE profile_picture = NULL

      const result = await service.deleteProfilePicture(1, 10);

      expect(result.message).toBe('Profile picture deleted successfully');
      expect(fs.unlink).toHaveBeenCalled();
      const updateSql = mockDb.query.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('profile_picture = NULL');
    });

    it('should continue when file deletion fails', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeUserRow({ profile_picture: 'uploads/missing.jpg' }),
      ]);
      vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('ENOENT'));
      mockDb.query.mockResolvedValueOnce([]); // UPDATE profile_picture = NULL

      const result = await service.deleteProfilePicture(1, 10);

      // Should NOT throw, just logs warning and continues
      expect(result.message).toBe('Profile picture deleted successfully');
    });
  });
});
