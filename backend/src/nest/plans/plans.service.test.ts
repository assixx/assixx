/**
 * Plans Service – Unit Tests
 *
 * Phase 11: Pure mapping + basic DB-mocked tests.
 * Phase 14 B3: Deepened from 12 → 30 tests.
 * Tests for pure mapping methods + DB-mocked public methods.
 * Private methods tested via bracket notation.
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { PlansService } from './plans.service.js';

// ============================================================
// Setup
// ============================================================

function createMockActivityLogger() {
  return {
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
    log: vi.fn(),
  };
}

function createServiceWithMock(): {
  service: PlansService;
  mockDb: {
    query: ReturnType<typeof vi.fn>;
    queryOne: ReturnType<typeof vi.fn>;
    generateInPlaceholders: ReturnType<typeof vi.fn>;
  };
} {
  const mockDb = {
    query: vi.fn(),
    queryOne: vi.fn(),
    generateInPlaceholders: vi.fn().mockReturnValue({ placeholders: '$2, $3' }),
  };
  const mockActivityLogger = createMockActivityLogger();
  const service = new PlansService(
    mockDb as unknown as DatabaseService,
    mockActivityLogger as unknown as ActivityLoggerService,
  );
  return { service, mockDb };
}

/** Standard DB plan row */
function makePlanRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 1,
    code: 'starter',
    name: 'Starter',
    description: null,
    base_price: '29.99',
    max_employees: 50,
    max_admins: 5,
    max_storage_gb: 10,
    is_active: true,
    sort_order: 1,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-06-01'),
    ...overrides,
  };
}

/** Standard DB tenant plan row */
function makeTenantPlanRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 1,
    tenant_id: 42,
    plan_id: 1,
    plan_code: 'starter',
    plan_name: 'Starter',
    status: 'active',
    started_at: new Date('2025-01-01'),
    expires_at: null,
    custom_price: null,
    billing_cycle: 'monthly',
    ...overrides,
  };
}

// ============================================================
// Pure Mapping Methods (private, via bracket notation)
// ============================================================

describe('PlansService – pure mappers', () => {
  let service: PlansService;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
  });

  describe('mapDbPlanToApi', () => {
    it('maps DB plan row to API format', () => {
      const row = makePlanRow({ description: 'Basic plan' });

      const result = service['mapDbPlanToApi'](row as never);

      expect(result.id).toBe(1);
      expect(result.code).toBe('starter');
      expect(result.basePrice).toBeCloseTo(29.99);
      expect(result.maxEmployees).toBe(50);
      expect(result.maxAdmins).toBe(5);
      expect(result.isActive).toBe(true);
      expect(result.description).toBe('Basic plan');
    });

    it('omits null optional fields', () => {
      const row = makePlanRow({
        description: null,
        max_employees: null,
        max_admins: null,
      });

      const result = service['mapDbPlanToApi'](row as never);

      expect(result.description).toBeUndefined();
      expect(result.maxEmployees).toBeUndefined();
      expect(result.maxAdmins).toBeUndefined();
    });
  });

  describe('mapDbFeatureToApi', () => {
    it('maps DB feature row to API format', () => {
      const row = {
        plan_id: 1,
        feature_id: 10,
        feature_code: 'chat',
        feature_name: 'Chat System',
        is_included: 1,
      };

      const result = service['mapDbFeatureToApi'](row as never);

      expect(result.planId).toBe(1);
      expect(result.featureId).toBe(10);
      expect(result.featureCode).toBe('chat');
      expect(result.featureName).toBe('Chat System');
      expect(result.isIncluded).toBe(true);
    });
  });

  describe('mapDbTenantPlanToApi', () => {
    it('maps DB tenant plan row to API format', () => {
      const row = makeTenantPlanRow({
        plan_code: 'pro',
        plan_name: 'Professional',
        expires_at: new Date('2026-01-01'),
        custom_price: 99.99,
      });

      const result = service['mapDbTenantPlanToApi'](row as never);

      expect(result.tenantId).toBe(42);
      expect(result.planCode).toBe('pro');
      expect(result.status).toBe('active');
      expect(result.expiresAt).toBeDefined();
      expect(result.customPrice).toBe(99.99);
    });

    it('omits null expires_at and custom_price', () => {
      const row = makeTenantPlanRow({
        status: 'trial',
        billing_cycle: 'yearly',
      });

      const result = service['mapDbTenantPlanToApi'](row as never);

      expect(result.expiresAt).toBeUndefined();
      expect(result.customPrice).toBeUndefined();
      expect(result.billingCycle).toBe('yearly');
    });
  });

  describe('mapDbAddonToApi', () => {
    it('maps DB addon row to API format', () => {
      const row = {
        id: 1,
        tenant_id: 42,
        addon_type: 'employees',
        quantity: 10,
        unit_price: 5,
        total_price: 50,
        status: 'active',
      };

      const result = service['mapDbAddonToApi'](row as never);

      expect(result.tenantId).toBe(42);
      expect(result.addonType).toBe('employees');
      expect(result.quantity).toBe(10);
      expect(result.unitPrice).toBe(5);
      expect(result.totalPrice).toBe(50);
      expect(result.status).toBe('active');
    });
  });
});

// ============================================================
// DB-Mocked Methods
// ============================================================

describe('PlansService – DB-mocked methods', () => {
  let service: PlansService;
  let mockDb: {
    query: ReturnType<typeof vi.fn>;
    queryOne: ReturnType<typeof vi.fn>;
    generateInPlaceholders: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
  });

  // ============================================================
  // getAllPlans
  // ============================================================

  describe('getAllPlans', () => {
    it('should return plans with included features', async () => {
      mockDb.query
        .mockResolvedValueOnce([makePlanRow()]) // SELECT plans
        .mockResolvedValueOnce([
          // features for plan 1
          {
            plan_id: 1,
            feature_id: 10,
            feature_code: 'chat',
            feature_name: 'Chat',
            is_included: true,
          },
          {
            plan_id: 1,
            feature_id: 11,
            feature_code: 'docs',
            feature_name: 'Docs',
            is_included: false,
          },
        ]);

      const result = await service.getAllPlans();

      expect(result).toHaveLength(1);
      expect(result[0]?.code).toBe('starter');
      // Only included features
      expect(result[0]?.features).toHaveLength(1);
      expect(result[0]?.features[0]?.featureCode).toBe('chat');
    });

    it('should return empty array when no plans exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getAllPlans();

      expect(result).toHaveLength(0);
    });
  });

  // ============================================================
  // getPlanById
  // ============================================================

  describe('getPlanById', () => {
    it('returns null when plan does not exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.getPlanById(999);

      expect(result).toBeNull();
    });

    it('returns plan with features', async () => {
      mockDb.queryOne.mockResolvedValueOnce(makePlanRow({ code: 'pro' }));
      mockDb.query.mockResolvedValueOnce([
        {
          plan_id: 1,
          feature_id: 1,
          feature_code: 'chat',
          feature_name: 'Chat',
          is_included: true,
        },
      ]);

      const result = await service.getPlanById(1);

      expect(result).not.toBeNull();
      expect(result?.code).toBe('pro');
      expect(result?.features).toHaveLength(1);
    });
  });

  // ============================================================
  // getCurrentPlan
  // ============================================================

  describe('getCurrentPlan', () => {
    it('returns null when no active plan', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.getCurrentPlan(1);

      expect(result).toBeNull();
    });

    it('throws NotFoundException when plan details not found', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce(makeTenantPlanRow()) // tenant_plans
        .mockResolvedValueOnce(null); // getPlanByCode → null

      await expect(service.getCurrentPlan(42)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns full response with costs', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce(makeTenantPlanRow()) // tenant_plans
        .mockResolvedValueOnce(makePlanRow()); // getPlanByCode
      mockDb.query
        .mockResolvedValueOnce([]) // getPlanFeaturesFromDb
        .mockResolvedValueOnce([]); // tenant_addons
      mockDb.queryOne.mockResolvedValueOnce({
        plan_cost: '29.99',
        addon_cost: '0',
      }); // calculateCost

      const result = await service.getCurrentPlan(42);

      expect(result).not.toBeNull();
      expect(result?.plan.planCode).toBe('starter');
      expect(result?.costs.basePlanCost).toBeCloseTo(29.99);
      expect(result?.costs.totalMonthlyCost).toBeCloseTo(29.99);
      expect(result?.addons).toHaveLength(0);
    });
  });

  // ============================================================
  // getPlanFeatures
  // ============================================================

  describe('getPlanFeatures', () => {
    it('should return all features (not just included)', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          plan_id: 1,
          feature_id: 1,
          feature_code: 'chat',
          feature_name: 'Chat',
          is_included: true,
        },
        {
          plan_id: 1,
          feature_id: 2,
          feature_code: 'docs',
          feature_name: 'Docs',
          is_included: false,
        },
      ]);

      const result = await service.getPlanFeatures(1);

      expect(result).toHaveLength(2);
      expect(result[1]?.isIncluded).toBe(false);
    });
  });

  // ============================================================
  // getTenantAddons
  // ============================================================

  describe('getTenantAddons', () => {
    it('returns zero addons when none exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.getTenantAddons(1);

      expect(result.employees).toBe(0);
      expect(result.admins).toBe(0);
      expect(result.storageGb).toBe(0);
    });

    it('returns addon quantities', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        extra_employees: 10,
        extra_admins: 2,
        extra_storage_gb: 50,
      });

      const result = await service.getTenantAddons(1);

      expect(result.employees).toBe(10);
      expect(result.admins).toBe(2);
      expect(result.storageGb).toBe(50);
    });
  });

  // ============================================================
  // updateAddons
  // ============================================================

  describe('updateAddons', () => {
    it('should upsert employee addon', async () => {
      mockDb.query.mockResolvedValueOnce([]); // INSERT/UPSERT employees
      // getTenantAddons call
      mockDb.queryOne.mockResolvedValueOnce({
        extra_employees: 15,
        extra_admins: 0,
        extra_storage_gb: 0,
      });

      const result = await service.updateAddons(42, { employees: 15 });

      expect(result.employees).toBe(15);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tenant_addons'),
        [42, 'employees', 15, 5.0],
      );
    });

    it('should upsert multiple addons', async () => {
      mockDb.query
        .mockResolvedValueOnce([]) // INSERT employees
        .mockResolvedValueOnce([]) // INSERT admins
        .mockResolvedValueOnce([]); // INSERT storage_gb
      mockDb.queryOne.mockResolvedValueOnce({
        extra_employees: 10,
        extra_admins: 3,
        extra_storage_gb: 100,
      });

      const result = await service.updateAddons(42, {
        employees: 10,
        admins: 3,
        storageGb: 100,
      });

      expect(result.employees).toBe(10);
      expect(result.admins).toBe(3);
      expect(result.storageGb).toBe(100);
      // 3 upserts
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('should skip upserts when no addons provided', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.updateAddons(42, {});

      expect(result.employees).toBe(0);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // calculateCosts
  // ============================================================

  describe('calculateCosts', () => {
    it('should calculate correct costs', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce({ plan_cost: '49.99', addon_cost: '75' }) // calculateTenantCostFromDb
        .mockResolvedValueOnce({
          // getTenantAddons
          extra_employees: 10,
          extra_admins: 2,
          extra_storage_gb: 50,
        });

      const result = await service.calculateCosts(42);

      expect(result.basePlanCost).toBeCloseTo(49.99);
      expect(result.addonCosts.employees).toBeCloseTo(50); // 10 * 5.0
      expect(result.addonCosts.admins).toBeCloseTo(20); // 2 * 10.0
      expect(result.addonCosts.storage).toBeCloseTo(5); // 50 * 0.1
      expect(result.totalMonthlyCost).toBeCloseTo(124.99);
      expect(result.currency).toBe('EUR');
    });

    it('should return zero costs when no plan or addons', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce(null) // calculateTenantCostFromDb → null
        .mockResolvedValueOnce(null); // getTenantAddons → null

      const result = await service.calculateCosts(42);

      expect(result.basePlanCost).toBe(0);
      expect(result.totalMonthlyCost).toBe(0);
    });
  });

  // ============================================================
  // upgradePlan
  // ============================================================

  describe('upgradePlan', () => {
    it('throws NotFoundException for unknown plan code', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null); // getPlanByCode

      await expect(service.upgradePlan(1, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when no active plan exists', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce(makePlanRow({ id: 2, code: 'pro' })) // getPlanByCode
        .mockResolvedValueOnce(null); // current tenant_plans

      await expect(service.upgradePlan(42, 'pro')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should upgrade plan successfully', async () => {
      mockDb.queryOne
        .mockResolvedValueOnce(makePlanRow({ id: 2, code: 'pro' })) // getPlanByCode
        .mockResolvedValueOnce(makeTenantPlanRow()); // current tenant_plans
      mockDb.query
        .mockResolvedValueOnce([]) // cancel current
        .mockResolvedValueOnce([]) // insert new plan
        .mockResolvedValueOnce([]) // update tenants.current_plan_id
        .mockResolvedValueOnce([
          // getPlanFeaturesFromDb
          {
            plan_id: 2,
            feature_id: 1,
            feature_code: 'chat',
            feature_name: 'Chat',
            is_included: true,
          },
        ])
        .mockResolvedValueOnce([]); // deactivate excluded features

      // getCurrentPlan chain (called at end)
      mockDb.queryOne
        .mockResolvedValueOnce(
          makeTenantPlanRow({ plan_id: 2, plan_code: 'pro', plan_name: 'Pro' }),
        )
        .mockResolvedValueOnce(makePlanRow({ id: 2, code: 'pro' }));
      mockDb.query
        .mockResolvedValueOnce([]) // features
        .mockResolvedValueOnce([]); // addons
      mockDb.queryOne.mockResolvedValueOnce({
        plan_cost: '49.99',
        addon_cost: '0',
      }); // cost

      const result = await service.upgradePlan(42, 'pro');

      expect(result.plan.planCode).toBe('pro');
    });
  });

  // ============================================================
  // Private: calculateTenantCostFromDb
  // ============================================================

  describe('calculateTenantCostFromDb (private)', () => {
    it('returns zero costs when row is null', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service['calculateTenantCostFromDb'](42);

      expect(result.planCost).toBe(0);
      expect(result.addonCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it('parses string costs correctly', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        plan_cost: '99.50',
        addon_cost: '25.00',
      });

      const result = await service['calculateTenantCostFromDb'](42);

      expect(result.planCost).toBeCloseTo(99.5);
      expect(result.addonCost).toBeCloseTo(25);
      expect(result.totalCost).toBeCloseTo(124.5);
    });

    it('defaults null plan_cost to 0', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        plan_cost: null,
        addon_cost: '10',
      });

      const result = await service['calculateTenantCostFromDb'](42);

      expect(result.planCost).toBe(0);
      expect(result.addonCost).toBe(10);
      expect(result.totalCost).toBe(10);
    });
  });
});
