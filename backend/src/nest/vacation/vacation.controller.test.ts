/**
 * Unit tests for VacationController — Tenant Feature Guard
 *
 * Verifies every endpoint throws ForbiddenException when the tenant's
 * vacation feature is disabled (tenant_features.is_active ≠ 1).
 *
 * Pattern: ensureFeatureEnabled() calls FeatureCheckService.checkTenantAccess()
 * BEFORE any business logic. If it returns false → ForbiddenException.
 *
 * ARCHITECTURE GAP: Only VacationController implements ensureFeatureEnabled().
 * BlackboardController, DocumentsController, CalendarController, KvpController,
 * ShiftsController, ChatController, SurveysController do NOT check tenant
 * feature flags — they only use @RequirePermission (user-level permissions).
 * See TODO.md §2 for the fix plan.
 */
import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JwtPayload } from '../common/interfaces/auth.interface.js';
import type { FeatureCheckService } from '../feature-check/feature-check.service.js';
import type {
  CapacityQueryDto,
  CreateBlackoutDto,
  CreateEntitlementDto,
  CreateHolidayDto,
  CreateStaffingRuleDto,
  CreateVacationRequestDto,
  RespondVacationRequestDto,
  UpdateBlackoutDto,
  UpdateHolidayDto,
  UpdateSettingsDto,
  UpdateStaffingRuleDto,
  UpdateVacationRequestDto,
  VacationQueryDto,
} from './dto/index.js';
import type { VacationBlackoutsService } from './vacation-blackouts.service.js';
import type { VacationCapacityService } from './vacation-capacity.service.js';
import type { VacationEntitlementsService } from './vacation-entitlements.service.js';
import type { VacationHolidaysService } from './vacation-holidays.service.js';
import type { VacationQueriesService } from './vacation-queries.service.js';
import type { VacationSettingsService } from './vacation-settings.service.js';
import type { VacationStaffingRulesService } from './vacation-staffing-rules.service.js';
import { VacationController } from './vacation.controller.js';
import type { VacationService } from './vacation.service.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Mock FeatureCheckService with configurable tenant access result */
function createMockFeatureCheck(enabled: boolean) {
  return {
    checkTenantAccess: vi.fn().mockResolvedValue(enabled),
    logUsage: vi.fn().mockResolvedValue(true),
  };
}

type MockFeatureCheck = ReturnType<typeof createMockFeatureCheck>;

/** Minimal valid JwtPayload for controller method calls */
function createMockUser(tenantId = 10): JwtPayload {
  return {
    sub: 1,
    id: 1,
    email: 'test@example.com',
    role: 'employee',
    tenantId,
    type: 'access',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
}

/**
 * Empty stub — no methods implemented.
 * If ensureFeatureEnabled() fails to fire, test crashes with
 * "X is not a function" instead of silently passing.
 */
function emptyStub<T>(): T {
  return {} as unknown as T;
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('VacationController — Feature Disabled Guard', () => {
  let controller: VacationController;
  let mockFeatureCheck: MockFeatureCheck;
  let user: JwtPayload;

  beforeEach(() => {
    mockFeatureCheck = createMockFeatureCheck(false);
    user = createMockUser();

    controller = new VacationController(
      emptyStub<VacationService>(),
      emptyStub<VacationQueriesService>(),
      emptyStub<VacationCapacityService>(),
      emptyStub<VacationEntitlementsService>(),
      emptyStub<VacationBlackoutsService>(),
      emptyStub<VacationStaffingRulesService>(),
      emptyStub<VacationHolidaysService>(),
      emptyStub<VacationSettingsService>(),
      mockFeatureCheck as unknown as FeatureCheckService,
    );
  });

  // ==========================================================================
  // Requests — 9 endpoints
  // ==========================================================================

  describe('Requests (9 endpoints)', () => {
    it('createRequest → 403 when feature disabled', async () => {
      await expect(
        controller.createRequest(
          user,
          {} as unknown as CreateVacationRequestDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('getMyRequests → 403 when feature disabled', async () => {
      await expect(
        controller.getMyRequests(user, {} as unknown as VacationQueryDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('getIncomingRequests → 403 when feature disabled', async () => {
      await expect(
        controller.getIncomingRequests(user, {} as unknown as VacationQueryDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('getUnreadNotificationRequestIds → 403 when feature disabled', async () => {
      await expect(
        controller.getUnreadNotificationRequestIds(user),
      ).rejects.toThrow(ForbiddenException);
    });

    it('getRequestById → 403 when feature disabled', async () => {
      await expect(
        controller.getRequestById(user, 'some-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('editRequest → 403 when feature disabled', async () => {
      await expect(
        controller.editRequest(
          user,
          'some-uuid',
          {} as unknown as UpdateVacationRequestDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('respondToRequest → 403 when feature disabled', async () => {
      await expect(
        controller.respondToRequest(
          user,
          'some-uuid',
          {} as unknown as RespondVacationRequestDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('withdrawRequest → 403 when feature disabled', async () => {
      await expect(
        controller.withdrawRequest(user, 'some-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('cancelRequest → 403 when feature disabled', async () => {
      await expect(
        controller.cancelRequest(user, 'some-uuid', 'test reason'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // Capacity — 1 endpoint
  // ==========================================================================

  describe('Capacity (1 endpoint)', () => {
    it('analyzeCapacity → 403 when feature disabled', async () => {
      await expect(
        controller.analyzeCapacity(user, {} as unknown as CapacityQueryDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // Entitlements — 4 endpoints
  // ==========================================================================

  describe('Entitlements (4 endpoints)', () => {
    it('getMyBalance → 403 when feature disabled', async () => {
      await expect(controller.getMyBalance(user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('getUserBalance → 403 when feature disabled', async () => {
      await expect(controller.getUserBalance(user, 42)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('createOrUpdateEntitlement → 403 when feature disabled', async () => {
      await expect(
        controller.createOrUpdateEntitlement(
          user,
          42,
          {} as unknown as CreateEntitlementDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('addDays → 403 when feature disabled', async () => {
      await expect(controller.addDays(user, 42, 2026, 5)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ==========================================================================
  // Blackouts — 4 endpoints
  // ==========================================================================

  describe('Blackouts (4 endpoints)', () => {
    it('getBlackouts → 403 when feature disabled', async () => {
      await expect(controller.getBlackouts(user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('createBlackout → 403 when feature disabled', async () => {
      await expect(
        controller.createBlackout(user, {} as unknown as CreateBlackoutDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updateBlackout → 403 when feature disabled', async () => {
      await expect(
        controller.updateBlackout(
          user,
          'some-uuid',
          {} as unknown as UpdateBlackoutDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deleteBlackout → 403 when feature disabled', async () => {
      await expect(
        controller.deleteBlackout(user, 'some-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // Staffing Rules — 4 endpoints
  // ==========================================================================

  describe('Staffing Rules (4 endpoints)', () => {
    it('getStaffingRules → 403 when feature disabled', async () => {
      await expect(controller.getStaffingRules(user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('createStaffingRule → 403 when feature disabled', async () => {
      await expect(
        controller.createStaffingRule(
          user,
          {} as unknown as CreateStaffingRuleDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updateStaffingRule → 403 when feature disabled', async () => {
      await expect(
        controller.updateStaffingRule(
          user,
          'some-uuid',
          {} as unknown as UpdateStaffingRuleDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deleteStaffingRule → 403 when feature disabled', async () => {
      await expect(
        controller.deleteStaffingRule(user, 'some-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // Holidays — 4 endpoints
  // ==========================================================================

  describe('Holidays (4 endpoints)', () => {
    it('getHolidays → 403 when feature disabled', async () => {
      await expect(controller.getHolidays(user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('createHoliday → 403 when feature disabled', async () => {
      await expect(
        controller.createHoliday(user, {} as unknown as CreateHolidayDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updateHoliday → 403 when feature disabled', async () => {
      await expect(
        controller.updateHoliday(
          user,
          'some-uuid',
          {} as unknown as UpdateHolidayDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deleteHoliday → 403 when feature disabled', async () => {
      await expect(controller.deleteHoliday(user, 'some-uuid')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ==========================================================================
  // Settings — 2 endpoints
  // ==========================================================================

  describe('Settings (2 endpoints)', () => {
    it('getSettings → 403 when feature disabled', async () => {
      await expect(controller.getSettings(user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('updateSettings → 403 when feature disabled', async () => {
      await expect(
        controller.updateSettings(user, {} as unknown as UpdateSettingsDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // Calendar Integration — 1 endpoint
  // ==========================================================================

  describe('Calendar Integration (1 endpoint)', () => {
    it('getMyCalendarVacations → 403 when feature disabled', async () => {
      await expect(
        controller.getMyCalendarVacations(user, '2026-01-01', '2026-12-31'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ==========================================================================
  // Overview — 2 endpoints
  // ==========================================================================

  describe('Overview (2 endpoints)', () => {
    it('getTeamCalendar → 403 when feature disabled', async () => {
      await expect(
        controller.getTeamCalendar(user, 1, 6, 2026),
      ).rejects.toThrow(ForbiddenException);
    });

    it('getOverview → 403 when feature disabled (delegates to getMyBalance)', async () => {
      await expect(controller.getOverview(user)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ==========================================================================
  // Cross-cutting: checkTenantAccess arguments
  // ==========================================================================

  describe('checkTenantAccess call verification', () => {
    it('passes tenantId and feature code "vacation" to FeatureCheckService', async () => {
      try {
        await controller.getMyRequests(user, {} as unknown as VacationQueryDto);
      } catch {
        /* expected ForbiddenException */
      }

      expect(mockFeatureCheck.checkTenantAccess).toHaveBeenCalledWith(
        10,
        'vacation',
      );
    });

    it('uses tenantId from the JWT payload, not a hardcoded value', async () => {
      const otherTenantUser = createMockUser(999);

      try {
        await controller.getMyRequests(
          otherTenantUser,
          {} as unknown as VacationQueryDto,
        );
      } catch {
        /* expected ForbiddenException */
      }

      expect(mockFeatureCheck.checkTenantAccess).toHaveBeenCalledWith(
        999,
        'vacation',
      );
    });

    it('throws ForbiddenException with descriptive message', async () => {
      await expect(
        controller.getMyRequests(user, {} as unknown as VacationQueryDto),
      ).rejects.toThrow('Vacation feature is not enabled for this tenant');
    });
  });
});

// =============================================================================
// Feature ENABLED — sanity check (proves tests above are not false positives)
// =============================================================================

describe('VacationController — Feature Enabled (sanity check)', () => {
  let controller: VacationController;
  let mockFeatureCheck: MockFeatureCheck;
  let mockQueriesService: { getMyRequests: ReturnType<typeof vi.fn> };
  let user: JwtPayload;

  beforeEach(() => {
    mockFeatureCheck = createMockFeatureCheck(true);
    user = createMockUser();

    mockQueriesService = {
      getMyRequests: vi
        .fn()
        .mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    };

    controller = new VacationController(
      emptyStub<VacationService>(),
      mockQueriesService as unknown as VacationQueriesService,
      emptyStub<VacationCapacityService>(),
      emptyStub<VacationEntitlementsService>(),
      emptyStub<VacationBlackoutsService>(),
      emptyStub<VacationStaffingRulesService>(),
      emptyStub<VacationHolidaysService>(),
      emptyStub<VacationSettingsService>(),
      mockFeatureCheck as unknown as FeatureCheckService,
    );
  });

  it('getMyRequests → proceeds to service call when feature enabled', async () => {
    await controller.getMyRequests(user, {} as unknown as VacationQueryDto);

    expect(mockFeatureCheck.checkTenantAccess).toHaveBeenCalledWith(
      10,
      'vacation',
    );
    expect(mockQueriesService.getMyRequests).toHaveBeenCalledWith(
      user.id,
      user.tenantId,
      expect.anything(),
    );
  });

  it('does NOT throw ForbiddenException when feature is enabled', async () => {
    await expect(
      controller.getMyRequests(user, {} as unknown as VacationQueryDto),
    ).resolves.toBeDefined();
  });
});
