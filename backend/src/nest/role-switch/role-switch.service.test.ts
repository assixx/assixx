/**
 * Unit tests for RoleSwitchService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Role switching with security checks, JWT generation,
 *        ForbiddenException for unauthorized roles, getStatus (pure).
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { RoleSwitchService } from './role-switch.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn(), queryOne: vi.fn(), tenantTransaction: vi.fn() };
}
type MockDb = ReturnType<typeof createMockDb>;

// =============================================================
// Mock factories
// =============================================================

function createMockJwtService() {
  return {
    sign: vi.fn().mockReturnValue('mock-jwt-token'),
  };
}

function makeUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    username: 'admin@example.com',
    email: 'admin@example.com',
    role: 'admin',
    tenant_id: 10,
    position: null,
    ...overrides,
  };
}

// =============================================================
// RoleSwitchService
// =============================================================

describe('SECURITY: RoleSwitchService', () => {
  let service: RoleSwitchService;
  let mockJwtService: ReturnType<typeof createMockJwtService>;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockJwtService = createMockJwtService();
    mockDb = createMockDb();
    service = new RoleSwitchService(
      mockJwtService as never,
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // switchToEmployee
  // =============================================================

  describe('switchToEmployee', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.switchToEmployee(999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for employee user', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'employee' })]);

      await expect(service.switchToEmployee(1, 10)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should switch admin to employee view', async () => {
      // verifyUserTenant
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'admin' })]);
      // logRoleSwitch
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.switchToEmployee(1, 10);

      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.activeRole).toBe('employee');
      expect(result.user.isRoleSwitched).toBe(true);
      expect(result.message).toBe('Successfully switched to employee view');
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          activeRole: 'employee',
          isRoleSwitched: true,
        }),
      );
    });
  });

  // =============================================================
  // switchToOriginal
  // =============================================================

  describe('switchToOriginal', () => {
    it('should switch back to original role', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'admin' })]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.switchToOriginal(1, 10);

      expect(result.user.activeRole).toBe('admin');
      expect(result.user.isRoleSwitched).toBe(false);
    });

    it('should throw ForbiddenException for employee', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'employee' })]);

      await expect(service.switchToOriginal(1, 10)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // =============================================================
  // rootToAdmin
  // =============================================================

  describe('rootToAdmin', () => {
    it('should throw ForbiddenException for non-root user', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'admin' })]);

      await expect(service.rootToAdmin(1, 10)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should switch root to admin view', async () => {
      mockDb.query.mockResolvedValueOnce([makeUserRow({ role: 'root' })]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.rootToAdmin(1, 10);

      expect(result.user.activeRole).toBe('admin');
      expect(result.user.role).toBe('root');
      expect(result.user.isRoleSwitched).toBe(true);
    });
  });

  // =============================================================
  // getStatus (pure function)
  // =============================================================

  describe('getStatus', () => {
    it('should return status for non-switched user', () => {
      const result = service.getStatus(1, 10, 'admin', undefined, undefined);

      expect(result.originalRole).toBe('admin');
      expect(result.activeRole).toBe('admin');
      expect(result.isRoleSwitched).toBe(false);
      expect(result.canSwitch).toBe(true);
    });

    it('should return status for switched user', () => {
      const result = service.getStatus(1, 10, 'admin', 'employee', true);

      expect(result.activeRole).toBe('employee');
      expect(result.isRoleSwitched).toBe(true);
    });

    it('should report canSwitch=false for employee', () => {
      const result = service.getStatus(5, 10, 'employee', undefined, undefined);

      expect(result.canSwitch).toBe(false);
    });
  });
});
