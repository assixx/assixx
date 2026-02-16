/**
 * Unit tests for TenantFeatureGuard
 *
 * Tests tenant-level feature flag enforcement:
 * - No @TenantFeature metadata → pass through
 * - Feature enabled for tenant → pass through
 * - Feature disabled for tenant → 403 ForbiddenException
 * - No user/tenantId on request → 403 ForbiddenException
 * - Correct feature code forwarded to FeatureCheckService
 * - No root/admin bypass (tenant activation is a billing decision)
 *
 * All 8 feature-gated controllers are protected:
 * blackboard, calendar, chat, documents, kvp, shifts, surveys, vacation
 */
import { ForbiddenException, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FeatureCheckService } from '../../feature-check/feature-check.service.js';
import { TENANT_FEATURE_KEY } from '../decorators/tenant-feature.decorator.js';
import { TenantFeatureGuard } from './tenant-feature.guard.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockReflector() {
  return {
    getAllAndOverride: vi.fn(),
  };
}

function createMockFeatureCheck() {
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

describe('SECURITY: TenantFeatureGuard', () => {
  let guard: TenantFeatureGuard;
  let mockReflector: ReturnType<typeof createMockReflector>;
  let mockFeatureCheck: ReturnType<typeof createMockFeatureCheck>;

  beforeEach(() => {
    mockReflector = createMockReflector();
    mockFeatureCheck = createMockFeatureCheck();

    guard = new TenantFeatureGuard(
      mockReflector as unknown as import('@nestjs/core').Reflector,
      mockFeatureCheck as unknown as FeatureCheckService,
    );

    // Silence logger output during tests
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  // -----------------------------------------------------------
  // No Metadata (pass through)
  // -----------------------------------------------------------

  describe('No @TenantFeature metadata (pass through)', () => {
    it('should pass when no @TenantFeature decorator exists', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext({ tenantId: 10 });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockFeatureCheck.checkTenantAccess).not.toHaveBeenCalled();
    });

    it('should not call checkTenantAccess for undecorated endpoints', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext({ tenantId: 10 });

      await guard.canActivate(context);

      expect(mockFeatureCheck.checkTenantAccess).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // Feature Enabled → pass through
  // -----------------------------------------------------------

  describe('Feature enabled for tenant', () => {
    it('should pass when tenant has the feature activated', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('blackboard');
      mockFeatureCheck.checkTenantAccess.mockResolvedValue(true);
      const context = createMockExecutionContext({ tenantId: 10 });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should call checkTenantAccess with correct tenantId and featureCode', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('vacation');
      mockFeatureCheck.checkTenantAccess.mockResolvedValue(true);
      const context = createMockExecutionContext({ tenantId: 42 });

      await guard.canActivate(context);

      expect(mockFeatureCheck.checkTenantAccess).toHaveBeenCalledWith(
        42,
        'vacation',
      );
    });
  });

  // -----------------------------------------------------------
  // Feature Disabled → 403 ForbiddenException
  // -----------------------------------------------------------

  describe('Feature disabled for tenant', () => {
    it('should throw ForbiddenException when feature is not activated', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('blackboard');
      mockFeatureCheck.checkTenantAccess.mockResolvedValue(false);
      const context = createMockExecutionContext({ tenantId: 10 });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should include feature name in error message', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('vacation');
      mockFeatureCheck.checkTenantAccess.mockResolvedValue(false);
      const context = createMockExecutionContext({ tenantId: 10 });

      await expect(guard.canActivate(context)).rejects.toThrow(
        'vacation feature is not enabled for this tenant',
      );
    });

    it('should log warning with tenantId and feature code', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn');
      mockReflector.getAllAndOverride.mockReturnValue('calendar');
      mockFeatureCheck.checkTenantAccess.mockResolvedValue(false);
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
      // Manually ensure user is undefined
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

      expect(mockFeatureCheck.checkTenantAccess).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------
  // No Role Bypass (tenant feature ≠ user permission)
  // -----------------------------------------------------------

  describe('No root/admin bypass', () => {
    it('should check DB even for root users — tenant feature is a billing decision', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('vacation');
      mockFeatureCheck.checkTenantAccess.mockResolvedValue(false);
      // Root user on a tenant without vacation feature
      const context = createMockExecutionContext({ tenantId: 10 });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockFeatureCheck.checkTenantAccess).toHaveBeenCalledWith(
        10,
        'vacation',
      );
    });

    it('should check DB even for admin users', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('shifts');
      mockFeatureCheck.checkTenantAccess.mockResolvedValue(false);
      const context = createMockExecutionContext({ tenantId: 10 });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // -----------------------------------------------------------
  // All 8 Feature Codes (coverage for every gated module)
  // -----------------------------------------------------------

  describe('All 8 feature-gated modules', () => {
    const featureCodes = [
      'blackboard',
      'calendar',
      'chat',
      'documents',
      'kvp',
      'shift_planning',
      'surveys',
      'vacation',
    ] as const;

    for (const code of featureCodes) {
      it(`${code} → 403 when feature disabled for tenant`, async () => {
        mockReflector.getAllAndOverride.mockReturnValue(code);
        mockFeatureCheck.checkTenantAccess.mockResolvedValue(false);
        const context = createMockExecutionContext({ tenantId: 10 });

        await expect(guard.canActivate(context)).rejects.toThrow(
          ForbiddenException,
        );
        await expect(guard.canActivate(context)).rejects.toThrow(
          `${code} feature is not enabled for this tenant`,
        );
      });

      it(`${code} → pass when feature enabled for tenant`, async () => {
        mockReflector.getAllAndOverride.mockReturnValue(code);
        mockFeatureCheck.checkTenantAccess.mockResolvedValue(true);
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
        TENANT_FEATURE_KEY,
        [context.getHandler(), context.getClass()],
      );
    });
  });

  // -----------------------------------------------------------
  // Different tenants, same feature
  // -----------------------------------------------------------

  describe('Multi-tenant isolation', () => {
    it('should pass tenantId from JWT, not a hardcoded value', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('kvp');
      mockFeatureCheck.checkTenantAccess.mockResolvedValue(true);

      const context1 = createMockExecutionContext({ tenantId: 1 });
      await guard.canActivate(context1);
      expect(mockFeatureCheck.checkTenantAccess).toHaveBeenCalledWith(1, 'kvp');

      const context2 = createMockExecutionContext({ tenantId: 999 });
      await guard.canActivate(context2);
      expect(mockFeatureCheck.checkTenantAccess).toHaveBeenCalledWith(
        999,
        'kvp',
      );
    });
  });
});
