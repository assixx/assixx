/**
 * Unit tests for PermissionGuard
 *
 * Tests guard enforcement: no metadata pass-through, authentication check,
 * root bypass, admin full access bypass, employee DB check,
 * role-switching, logging, metadata resolution.
 *
 * @see docs/USER-PERMISSIONS-UNIT-TEST-PLAN.md — Test-Datei 4
 */
import { ForbiddenException, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserPermissionsService } from '../../user-permissions/user-permissions.service.js';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator.js';
import type { NestAuthUser } from '../interfaces/auth.interface.js';
import { PermissionGuard } from './permission.guard.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockReflector() {
  return {
    getAllAndOverride: vi.fn(),
  };
}

function createMockPermissionService() {
  return {
    hasPermission: vi.fn(),
  };
}

function createMockExecutionContext(
  user?: Partial<NestAuthUser>,
): ExecutionContext {
  const mockRequest = {
    user:
      user !== undefined ?
        {
          id: 1,
          email: 'test@example.com',
          role: 'employee' as const,
          activeRole: 'employee' as const,
          isRoleSwitched: false,
          hasFullAccess: false,
          tenantId: 42,
          ...user,
        }
      : undefined,
  };

  const handler = vi.fn();
  const clazz = vi.fn();

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
    getHandler: () => handler,
    getClass: () => clazz,
  } as unknown as ExecutionContext;
}

// =============================================================
// Tests
// =============================================================

describe('SECURITY: PermissionGuard', () => {
  let guard: PermissionGuard;
  let mockReflector: ReturnType<typeof createMockReflector>;
  let mockPermissionService: ReturnType<typeof createMockPermissionService>;

  beforeEach(() => {
    mockReflector = createMockReflector();
    mockPermissionService = createMockPermissionService();

    guard = new PermissionGuard(
      mockReflector as unknown as import('@nestjs/core').Reflector,
      mockPermissionService as unknown as UserPermissionsService,
    );

    // Silence logger output during tests
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  // -----------------------------------------------------------
  // No Metadata (pass through)
  // -----------------------------------------------------------

  describe('No Metadata (pass through)', () => {
    it('should pass when no @RequirePermission metadata exists', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext({ activeRole: 'employee' });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
    });

    it('should not call hasPermission when no metadata', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext({ activeRole: 'employee' });

      await guard.canActivate(context);

      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // Authentication Check
  // -----------------------------------------------------------

  describe('Authentication Check', () => {
    it('should throw ForbiddenException when user is undefined', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        featureCode: 'blackboard',
        moduleCode: 'blackboard-posts',
        action: 'canRead',
      });
      // Pass undefined to signal no user on request
      const context = createMockExecutionContext(
        undefined as unknown as Partial<NestAuthUser>,
      );
      // Manually set user to undefined
      const request = context.switchToHttp().getRequest() as {
        user?: NestAuthUser;
      };
      request.user = undefined;

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // -----------------------------------------------------------
  // hasFullAccess Bypass (root + admin with full access)
  // -----------------------------------------------------------

  describe('hasFullAccess Bypass', () => {
    it('should pass for root user (hasFullAccess=true by DB design)', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        featureCode: 'blackboard',
        moduleCode: 'blackboard-posts',
        action: 'canRead',
      });
      const context = createMockExecutionContext({
        activeRole: 'root',
        hasFullAccess: true,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
    });

    it('should pass for admin with hasFullAccess=true', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        featureCode: 'blackboard',
        moduleCode: 'blackboard-posts',
        action: 'canRead',
      });
      const context = createMockExecutionContext({
        activeRole: 'admin',
        hasFullAccess: true,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
    });

    it('should pass for role-switched root viewing as employee', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        featureCode: 'blackboard',
        moduleCode: 'blackboard-posts',
        action: 'canRead',
      });
      const context = createMockExecutionContext({
        role: 'root',
        activeRole: 'employee',
        isRoleSwitched: true,
        hasFullAccess: true,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
    });

    it('should pass for role-switched admin viewing as employee with hasFullAccess', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        featureCode: 'blackboard',
        moduleCode: 'blackboard-posts',
        action: 'canRead',
      });
      const context = createMockExecutionContext({
        role: 'admin',
        activeRole: 'employee',
        isRoleSwitched: true,
        hasFullAccess: true,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPermissionService.hasPermission).not.toHaveBeenCalled();
    });

    it('should check DB for admin with hasFullAccess=false', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        featureCode: 'blackboard',
        moduleCode: 'blackboard-posts',
        action: 'canRead',
      });
      mockPermissionService.hasPermission.mockResolvedValue(true);
      const context = createMockExecutionContext({
        activeRole: 'admin',
        hasFullAccess: false,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPermissionService.hasPermission).toHaveBeenCalled();
    });

    it('should deny admin without hasFullAccess when permission=false', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        featureCode: 'blackboard',
        moduleCode: 'blackboard-posts',
        action: 'canRead',
      });
      mockPermissionService.hasPermission.mockResolvedValue(false);
      const context = createMockExecutionContext({
        activeRole: 'admin',
        hasFullAccess: false,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should check DB for user with hasFullAccess=false even if role is root', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        featureCode: 'blackboard',
        moduleCode: 'blackboard-posts',
        action: 'canRead',
      });
      mockPermissionService.hasPermission.mockResolvedValue(false);
      const context = createMockExecutionContext({
        activeRole: 'root',
        hasFullAccess: false,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // -----------------------------------------------------------
  // Employee DB Check
  // -----------------------------------------------------------

  describe('Employee DB Check', () => {
    it('should pass for employee when permission granted', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        featureCode: 'blackboard',
        moduleCode: 'blackboard-posts',
        action: 'canRead',
      });
      mockPermissionService.hasPermission.mockResolvedValue(true);
      const context = createMockExecutionContext({
        activeRole: 'employee',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny employee when permission not granted', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        featureCode: 'blackboard',
        moduleCode: 'blackboard-posts',
        action: 'canRead',
      });
      mockPermissionService.hasPermission.mockResolvedValue(false);
      const context = createMockExecutionContext({
        activeRole: 'employee',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should call hasPermission with correct params', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        featureCode: 'blackboard',
        moduleCode: 'posts',
        action: 'canWrite',
      });
      mockPermissionService.hasPermission.mockResolvedValue(true);
      const context = createMockExecutionContext({
        id: 42,
        activeRole: 'employee',
      });

      await guard.canActivate(context);

      expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
        42,
        'blackboard',
        'posts',
        'canWrite',
      );
    });
  });

  // -----------------------------------------------------------
  // Role-Switching
  // -----------------------------------------------------------

  describe('Role-Switching', () => {
    it('should deny role-switched admin without hasFullAccess when DB denies', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        featureCode: 'blackboard',
        moduleCode: 'blackboard-posts',
        action: 'canRead',
      });
      mockPermissionService.hasPermission.mockResolvedValue(false);
      const context = createMockExecutionContext({
        role: 'admin',
        activeRole: 'employee',
        isRoleSwitched: true,
        hasFullAccess: false,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should pass for role-switched admin without hasFullAccess when DB grants', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        featureCode: 'blackboard',
        moduleCode: 'blackboard-posts',
        action: 'canRead',
      });
      mockPermissionService.hasPermission.mockResolvedValue(true);
      const context = createMockExecutionContext({
        role: 'admin',
        activeRole: 'employee',
        isRoleSwitched: true,
        hasFullAccess: false,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  // -----------------------------------------------------------
  // Logging
  // -----------------------------------------------------------

  describe('Logging', () => {
    it('should log warning with user details on permission denied', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn');
      mockReflector.getAllAndOverride.mockReturnValue({
        featureCode: 'blackboard',
        moduleCode: 'blackboard-posts',
        action: 'canRead',
      });
      mockPermissionService.hasPermission.mockResolvedValue(false);
      const context = createMockExecutionContext({
        id: 42,
        activeRole: 'employee',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('42'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('employee'));
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('blackboard'),
      );
    });
  });

  // -----------------------------------------------------------
  // getAllAndOverride Metadata Resolution
  // -----------------------------------------------------------

  describe('getAllAndOverride Metadata Resolution', () => {
    it('should read metadata from handler first, class second', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext({ activeRole: 'employee' });

      await guard.canActivate(context);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        PERMISSION_KEY,
        [context.getHandler(), context.getClass()],
      );
    });

    it('should pass RequiredPermission interface shape to hasPermission', async () => {
      const metadata = {
        featureCode: 'bb',
        moduleCode: 'posts',
        action: 'canRead' as const,
      };
      mockReflector.getAllAndOverride.mockReturnValue(metadata);
      mockPermissionService.hasPermission.mockResolvedValue(true);
      const context = createMockExecutionContext({
        id: 10,
        activeRole: 'employee',
      });

      await guard.canActivate(context);

      expect(mockPermissionService.hasPermission).toHaveBeenCalledWith(
        10,
        'bb',
        'posts',
        'canRead',
      );
    });
  });
});
