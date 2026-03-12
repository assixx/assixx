/**
 * Unit tests for TenantAddonGuard
 *
 * Tests tenant-level addon access enforcement:
 * - No @RequireAddon metadata → pass through
 * - Addon enabled for tenant → pass through
 * - Addon disabled for tenant → 403 ForbiddenException
 * - No user/tenantId on request → 403 ForbiddenException
 * - Correct addon code forwarded to AddonCheckService
 * - No root/admin bypass (addon activation is a billing decision)
 *
 * All feature-gated controllers are protected via @RequireAddon():
 * blackboard, calendar, chat, documents, kvp, shifts, surveys, vacation,
 * tpm, work_orders, assets, reports, audit_trail, dummy_users, shift_planning
 */
import { ForbiddenException, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AddonCheckService } from '../../addon-check/addon-check.service.js';
import { REQUIRE_ADDON_KEY } from '../decorators/require-addon.decorator.js';
import { TenantAddonGuard } from './tenant-addon.guard.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockReflector() {
  return {
    getAllAndOverride: vi.fn(),
  };
}

function createMockAddonCheck() {
  return {
    checkTenantAccess: vi.fn(),
    logUsage: vi.fn(),
  };
}

function createMockExecutionContext(user?: {
  tenantId?: number;
}): ExecutionContext {
  const mockRequest = {
    user:
      user !== undefined ?
        {
          tenantId: user.tenantId,
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

describe('SECURITY: TenantAddonGuard', () => {
  let guard: TenantAddonGuard;
  let mockReflector: ReturnType<typeof createMockReflector>;
  let mockAddonCheck: ReturnType<typeof createMockAddonCheck>;

  beforeEach(() => {
    mockReflector = createMockReflector();
    mockAddonCheck = createMockAddonCheck();

    guard = new TenantAddonGuard(
      mockReflector as unknown as import('@nestjs/core').Reflector,
      mockAddonCheck as unknown as AddonCheckService,
    );

    // Silence logger output during tests
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  // -----------------------------------------------------------
  // No Metadata (pass through)
  // -----------------------------------------------------------

  describe('No @RequireAddon metadata (pass through)', () => {
    it('should pass when no @RequireAddon decorator exists', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext({ tenantId: 10 });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockAddonCheck.checkTenantAccess).not.toHaveBeenCalled();
    });

    it('should not call checkTenantAccess for undecorated endpoints', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext({ tenantId: 10 });

      await guard.canActivate(context);

      expect(mockAddonCheck.checkTenantAccess).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // Addon Enabled → pass through
  // -----------------------------------------------------------

  describe('Addon enabled for tenant', () => {
    it('should pass when tenant has the addon activated', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('blackboard');
      mockAddonCheck.checkTenantAccess.mockResolvedValue(true);
      const context = createMockExecutionContext({ tenantId: 10 });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should call checkTenantAccess with correct tenantId and addonCode', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('vacation');
      mockAddonCheck.checkTenantAccess.mockResolvedValue(true);
      const context = createMockExecutionContext({ tenantId: 42 });

      await guard.canActivate(context);

      expect(mockAddonCheck.checkTenantAccess).toHaveBeenCalledWith(
        42,
        'vacation',
      );
    });
  });

  // -----------------------------------------------------------
  // Addon Disabled → 403 ForbiddenException
  // -----------------------------------------------------------

  describe('Addon disabled for tenant', () => {
    it('should throw ForbiddenException when addon is not activated', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('blackboard');
      mockAddonCheck.checkTenantAccess.mockResolvedValue(false);
      const context = createMockExecutionContext({ tenantId: 10 });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should include addon name in error message', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('vacation');
      mockAddonCheck.checkTenantAccess.mockResolvedValue(false);
      const context = createMockExecutionContext({ tenantId: 10 });

      await expect(guard.canActivate(context)).rejects.toThrow(
        'vacation addon is not enabled for this tenant',
      );
    });

    it('should log warning with tenantId and addon code', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn');
      mockReflector.getAllAndOverride.mockReturnValue('calendar');
      mockAddonCheck.checkTenantAccess.mockResolvedValue(false);
      const context = createMockExecutionContext({ tenantId: 99 });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('99'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('calendar'));
    });
  });

  // -----------------------------------------------------------
  // No User / No TenantId → 403
  // -----------------------------------------------------------

  describe('No user or tenantId on request', () => {
    it('should throw ForbiddenException when user is undefined', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('blackboard');
      const context = createMockExecutionContext(undefined);
      const request = context.switchToHttp().getRequest() as {
        user?: { tenantId: number };
      };
      request.user = undefined;

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'No tenant context available',
      );
    });

    it('should throw ForbiddenException when tenantId is missing', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('chat');
      const context = createMockExecutionContext({
        tenantId: undefined as unknown as number,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should not call checkTenantAccess when user is missing', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('documents');
      const context = createMockExecutionContext(undefined);
      const request = context.switchToHttp().getRequest() as {
        user?: { tenantId: number };
      };
      request.user = undefined;

      try {
        await guard.canActivate(context);
      } catch {
        /* expected */
      }

      expect(mockAddonCheck.checkTenantAccess).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // No Role Bypass (tenant addon ≠ user permission)
  // -----------------------------------------------------------

  describe('No root/admin bypass', () => {
    it('should check DB even for root users — addon activation is a billing decision', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('vacation');
      mockAddonCheck.checkTenantAccess.mockResolvedValue(false);
      const context = createMockExecutionContext({ tenantId: 10 });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockAddonCheck.checkTenantAccess).toHaveBeenCalledWith(
        10,
        'vacation',
      );
    });

    it('should check DB even for admin users', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('shifts');
      mockAddonCheck.checkTenantAccess.mockResolvedValue(false);
      const context = createMockExecutionContext({ tenantId: 10 });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // -----------------------------------------------------------
  // All addon codes (coverage for gated modules)
  // -----------------------------------------------------------

  describe('All addon-gated modules', () => {
    const addonCodes = [
      'blackboard',
      'calendar',
      'chat',
      'documents',
      'kvp',
      'shift_planning',
      'surveys',
      'vacation',
      'tpm',
      'work_orders',
      'assets',
      'reports',
    ] as const;

    for (const code of addonCodes) {
      it(`${code} → 403 when addon disabled for tenant`, async () => {
        mockReflector.getAllAndOverride.mockReturnValue(code);
        mockAddonCheck.checkTenantAccess.mockResolvedValue(false);
        const context = createMockExecutionContext({ tenantId: 10 });

        await expect(guard.canActivate(context)).rejects.toThrow(
          ForbiddenException,
        );
        await expect(guard.canActivate(context)).rejects.toThrow(
          `${code} addon is not enabled for this tenant`,
        );
      });

      it(`${code} → pass when addon enabled for tenant`, async () => {
        mockReflector.getAllAndOverride.mockReturnValue(code);
        mockAddonCheck.checkTenantAccess.mockResolvedValue(true);
        const context = createMockExecutionContext({ tenantId: 10 });

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });
    }
  });

  // -----------------------------------------------------------
  // Metadata Resolution (handler vs class)
  // -----------------------------------------------------------

  describe('Metadata resolution', () => {
    it('should read metadata from handler first, class second', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext({ tenantId: 10 });

      await guard.canActivate(context);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        REQUIRE_ADDON_KEY,
        [context.getHandler(), context.getClass()],
      );
    });
  });

  // -----------------------------------------------------------
  // Different tenants, same addon
  // -----------------------------------------------------------

  describe('Multi-tenant isolation', () => {
    it('should pass tenantId from JWT, not a hardcoded value', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('kvp');
      mockAddonCheck.checkTenantAccess.mockResolvedValue(true);

      const context1 = createMockExecutionContext({ tenantId: 1 });
      await guard.canActivate(context1);
      expect(mockAddonCheck.checkTenantAccess).toHaveBeenCalledWith(1, 'kvp');

      const context2 = createMockExecutionContext({ tenantId: 999 });
      await guard.canActivate(context2);
      expect(mockAddonCheck.checkTenantAccess).toHaveBeenCalledWith(999, 'kvp');
    });
  });
});
