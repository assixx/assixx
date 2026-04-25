/**
 * Unit tests for UserProfileService
 *
 * Self-service operations: profile update, password change, profile pictures.
 * Extracted from users.service.test.ts during service split.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcryptjs from 'bcryptjs';
import { promises as fs } from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { UserRepository } from '../database/repositories/user.repository.js';
import type { SecuritySettingsService } from '../security-settings/security-settings.service.js';
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
  return { tenantQuery: vi.fn() };
}

function createMockUserRepository() {
  return {
    getPasswordHash: vi.fn(),
  };
}

function createMockActivityLogger() {
  return {
    log: vi.fn(),
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
  };
}

/**
 * SecuritySettings mock — default returns `true` (policy OFF = "allowed" yes)
 * so existing changePassword tests pass unchanged. New tests override via
 * `mockResolvedValueOnce(false)` to verify the Forbidden path.
 */
function createMockSecuritySettings() {
  return {
    getUserPasswordChangePolicy: vi.fn().mockResolvedValue(true),
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
    is_active: IS_ACTIVE.ACTIVE,
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
  let mockSecuritySettings: ReturnType<typeof createMockSecuritySettings>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockUserRepo = createMockUserRepository();
    const mockActivityLogger = createMockActivityLogger();
    mockSecuritySettings = createMockSecuritySettings();
    service = new UserProfileService(
      mockDb as unknown as DatabaseService,
      mockUserRepo as unknown as UserRepository,
      mockActivityLogger as unknown as ActivityLoggerService,
      mockSecuritySettings as unknown as SecuritySettingsService,
    );
  });

  // =============================================================
  // updateProfile
  // =============================================================

  describe('updateProfile', () => {
    it('should update limited fields and return response', async () => {
      const updatedRow = makeUserRow({ first_name: 'Updated' });
      // UPDATE query
      mockDb.tenantQuery.mockResolvedValueOnce([]);
      // findUserById after update
      mockDb.tenantQuery.mockResolvedValueOnce([updatedRow]);

      const dto = {
        firstName: 'Updated',
      } as unknown as UpdateProfileDto;

      const result = await service.updateProfile(1, dto, 10);

      expect(result.firstName).toBe('Updated');
    });

    it('should skip UPDATE when no fields provided', async () => {
      // No UPDATE query, just findUserById
      mockDb.tenantQuery.mockResolvedValueOnce([makeUserRow()]);

      const dto = {} as unknown as UpdateProfileDto;
      const result = await service.updateProfile(1, dto, 10);

      expect(result.email).toBe('max@example.com');
      // Only 1 query (findUserById), no UPDATE
      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when user vanishes after update', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]); // UPDATE
      mockDb.tenantQuery.mockResolvedValueOnce([]); // findUserById → empty

      const dto = { firstName: 'Ghost' } as unknown as UpdateProfileDto;

      await expect(service.updateProfile(1, dto, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // =============================================================
  // changePassword
  // =============================================================

  describe('changePassword', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce(null);

      await expect(service.changePassword(999, 10, 'employee', 'old', 'new')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce('stored-hash');
      vi.mocked(bcryptjs.compare).mockResolvedValueOnce(false as never);

      await expect(
        service.changePassword(1, 10, 'employee', 'wrong-password', 'new-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    // Security gate (ADR-045 + user-request 2026-04-20):
    // admin/employee must be blocked when the tenant policy is OFF.
    it('should throw ForbiddenException when admin tries to change password with policy=false', async () => {
      mockSecuritySettings.getUserPasswordChangePolicy.mockResolvedValueOnce(false);

      await expect(
        service.changePassword(13, 1, 'admin', 'current-password', 'new-password-12345'),
      ).rejects.toThrow(ForbiddenException);

      // Invariant: we must fail FAST — bcrypt must never run on a blocked
      // request (prevents timing-attack leak of the password hash).
      expect(mockUserRepo.getPasswordHash).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when employee tries to change password with policy=false', async () => {
      mockSecuritySettings.getUserPasswordChangePolicy.mockResolvedValueOnce(false);

      await expect(
        service.changePassword(5, 1, 'employee', 'current-password', 'new-password-12345'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockUserRepo.getPasswordHash).not.toHaveBeenCalled();
    });

    it('should bypass policy check when role is root (policy getter never called)', async () => {
      // Root can always rotate credentials — needed for recovery scenarios.
      // The getter must not be called, otherwise a missing tenant_settings
      // row could mis-gate the flow. The bcrypt step IS exercised, so we
      // wire the downstream mocks.
      mockUserRepo.getPasswordHash.mockResolvedValueOnce('stored-hash');
      mockDb.tenantQuery.mockResolvedValueOnce([]); // UPDATE users
      mockDb.tenantQuery.mockResolvedValueOnce([{ count: '0' }]); // revoke refresh_tokens

      const result = await service.changePassword(1, 1, 'root', 'current-password', 'new-password');

      expect(result.message).toBe('Password changed successfully');
      expect(mockSecuritySettings.getUserPasswordChangePolicy).not.toHaveBeenCalled();
    });

    it('should change password successfully', async () => {
      mockUserRepo.getPasswordHash.mockResolvedValueOnce('stored-hash');
      // bcryptjs.compare defaults to true (mocked)
      // bcryptjs.hash defaults to 'hashed-password' (mocked)
      mockDb.tenantQuery.mockResolvedValueOnce([]); // UPDATE users
      mockDb.tenantQuery.mockResolvedValueOnce([{ count: '2' }]); // revoke refresh_tokens

      const result = await service.changePassword(
        1,
        10,
        'employee',
        'current-password',
        'new-password',
      );

      expect(result.message).toBe('Password changed successfully');
      expect(mockDb.tenantQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET password'),
        expect.arrayContaining(['hashed-password', 1, 10]),
      );
      expect(mockDb.tenantQuery).toHaveBeenCalledWith(
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
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.getProfilePicturePath(999, 10)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when no profile picture set', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([makeUserRow()]);

      await expect(service.getProfilePicturePath(1, 10)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when file not on disk', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([
        makeUserRow({ profile_picture: 'uploads/pic.jpg' }),
      ]);
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));

      await expect(service.getProfilePicturePath(1, 10)).rejects.toThrow(NotFoundException);
    });

    it('should return file path when picture exists', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([
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
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.updateProfilePicture(999, '/some/path.jpg', 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should store relative path and return updated user', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([makeUserRow()]); // findUserById
      mockDb.tenantQuery.mockResolvedValueOnce([]); // UPDATE profile_picture
      mockDb.tenantQuery.mockResolvedValueOnce([
        makeUserRow({ profile_picture: 'uploads/new.jpg' }),
      ]); // findUserById after

      const result = await service.updateProfilePicture(1, `${process.cwd()}/uploads/new.jpg`, 10);

      expect(result).toBeDefined();
      const updateSql = mockDb.tenantQuery.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('profile_picture');
    });

    it('should throw InternalServerError when user vanishes after update', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([makeUserRow()]); // findUserById
      mockDb.tenantQuery.mockResolvedValueOnce([]); // UPDATE profile_picture
      mockDb.tenantQuery.mockResolvedValueOnce([]); // findUserById after → empty

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
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await expect(service.deleteProfilePicture(999, 10)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when no picture to delete', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([makeUserRow()]);

      await expect(service.deleteProfilePicture(1, 10)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on directory traversal', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([
        makeUserRow({ profile_picture: '../../../etc/passwd' }),
      ]);

      await expect(service.deleteProfilePicture(1, 10)).rejects.toThrow(BadRequestException);
    });

    it('should delete file and clear DB field on success', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([
        makeUserRow({ profile_picture: 'uploads/avatar.jpg' }),
      ]);
      // fs.unlink default resolves (mocked)
      mockDb.tenantQuery.mockResolvedValueOnce([]); // UPDATE profile_picture = NULL

      const result = await service.deleteProfilePicture(1, 10);

      expect(result.message).toBe('Profile picture deleted successfully');
      expect(fs.unlink).toHaveBeenCalled();
      const updateSql = mockDb.tenantQuery.mock.calls[1]?.[0] as string;
      expect(updateSql).toContain('profile_picture = NULL');
    });

    it('should continue when file deletion fails', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([
        makeUserRow({ profile_picture: 'uploads/missing.jpg' }),
      ]);
      vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('ENOENT'));
      mockDb.tenantQuery.mockResolvedValueOnce([]); // UPDATE profile_picture = NULL

      const result = await service.deleteProfilePicture(1, 10);

      // Should NOT throw, just logs warning and continues
      expect(result.message).toBe('Profile picture deleted successfully');
    });
  });
});
