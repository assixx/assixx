/**
 * Unit tests for RolesGuard
 *
 * Tests guard enforcement: no metadata pass-through, authentication check,
 * role matching (single/multiple), role-switching (activeRole vs role),
 * and descriptive error messages.
 *
 * @see docs/USER-PERMISSIONS-UNIT-TEST-PLAN.md
 */
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { NestAuthUser } from '../interfaces/auth.interface.js';
import { RolesGuard } from './roles.guard.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockReflector() {
  return {
    getAllAndOverride: vi.fn(),
  };
}

function createMockExecutionContext(user?: Partial<NestAuthUser>): ExecutionContext {
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

describe('SECURITY: RolesGuard', () => {
  let guard: RolesGuard;
  let mockReflector: ReturnType<typeof createMockReflector>;

  beforeEach(() => {
    mockReflector = createMockReflector();
    guard = new RolesGuard(mockReflector as unknown as import('@nestjs/core').Reflector);
  });

  // -----------------------------------------------------------
  // No Metadata (pass through)
  // -----------------------------------------------------------

  describe('No Metadata (pass through)', () => {
    it('should pass when no @Roles() metadata exists', () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext({ activeRole: 'employee' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should pass when empty roles array', () => {
      mockReflector.getAllAndOverride.mockReturnValue([]);
      const context = createMockExecutionContext({ activeRole: 'employee' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  // -----------------------------------------------------------
  // Authentication Check
  // -----------------------------------------------------------

  describe('Authentication Check', () => {
    it('should throw ForbiddenException when user is undefined', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin']);
      const context = createMockExecutionContext(undefined as unknown as Partial<NestAuthUser>);
      // Manually set user to undefined
      const request = context.switchToHttp().getRequest() as {
        user?: NestAuthUser;
      };
      request.user = undefined;

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  // -----------------------------------------------------------
  // Role Matching
  // -----------------------------------------------------------

  describe('Role Matching', () => {
    it('should pass when user activeRole matches required role', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin']);
      const context = createMockExecutionContext({ activeRole: 'admin' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny when user activeRole does not match', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin']);
      const context = createMockExecutionContext({ activeRole: 'employee' });

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should pass when user has one of multiple required roles', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin', 'root']);
      const context = createMockExecutionContext({ activeRole: 'root' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  // -----------------------------------------------------------
  // Role-Switching
  // -----------------------------------------------------------

  describe('Role-Switching', () => {
    it('should use activeRole (not role) for role-switched users', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin']);
      const context = createMockExecutionContext({
        role: 'admin',
        activeRole: 'employee',
        isRoleSwitched: true,
      });

      // Admin acting as employee should be denied access to admin-only routes
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  // -----------------------------------------------------------
  // Error Message
  // -----------------------------------------------------------

  describe('Error Message', () => {
    it('should include required roles and actual role in error message', () => {
      mockReflector.getAllAndOverride.mockReturnValue(['admin', 'root']);
      const context = createMockExecutionContext({ activeRole: 'employee' });

      expect(() => guard.canActivate(context)).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('admin'),
        }),
      );

      // Re-create context to test second assertion
      const context2 = createMockExecutionContext({ activeRole: 'employee' });
      expect(() => guard.canActivate(context2)).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('employee'),
        }),
      );
    });
  });

  // -----------------------------------------------------------
  // Metadata Resolution
  // -----------------------------------------------------------

  describe('Metadata Resolution', () => {
    it('should read metadata with ROLES_KEY from handler first, class second', () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext({ activeRole: 'employee' });

      guard.canActivate(context);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });
  });
});
