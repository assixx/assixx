/**
 * Plans Service – Unit Tests
 *
 * Tests for pure mapping methods + DB-mocked public methods.
 * Private methods tested via bracket notation.
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { PlansService } from './plans.service.js';

// ============================================================
// Setup
// ============================================================

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
  const service = new PlansService(mockDb as unknown as DatabaseService);
  return { service, mockDb };
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
      const row = {
        id: 1,
        code: 'starter',
        name: 'Starter',
        description: 'Basic plan',
        base_price: '29.99',
        max_employees: 50,
        max_admins: 5,
        max_storage_gb: 10,
        is_active: true,
        sort_order: 1,
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-06-01'),
      };

      const result = service['mapDbPlanToApi'](row);

      expect(result.id).toBe(1);
      expect(result.code).toBe('starter');
      expect(result.basePrice).toBeCloseTo(29.99);
      expect(result.maxEmployees).toBe(50);
      expect(result.maxAdmins).toBe(5);
      expect(result.isActive).toBe(true);
      expect(result.description).toBe('Basic plan');
    });

    it('omits null optional fields', () => {
      const row = {
        id: 2,
        code: 'free',
        name: 'Free',
        description: null,
        base_price: 0,
        max_employees: null,
        max_admins: null,
        max_storage_gb: 1,
        is_active: true,
        sort_order: 0,
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-01-01'),
      };

      const result = service['mapDbPlanToApi'](row);

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

      const result = service['mapDbFeatureToApi'](row);

      expect(result.planId).toBe(1);
      expect(result.featureId).toBe(10);
      expect(result.featureCode).toBe('chat');
      expect(result.featureName).toBe('Chat System');
      expect(result.isIncluded).toBe(true);
    });
  });

  describe('mapDbTenantPlanToApi', () => {
    it('maps DB tenant plan row to API format', () => {
      const row = {
        id: 1,
        tenant_id: 42,
        plan_id: 3,
        plan_code: 'pro',
        plan_name: 'Professional',
        status: 'active',
        started_at: new Date('2025-01-01'),
        expires_at: new Date('2026-01-01'),
        custom_price: 99.99,
        billing_cycle: 'monthly',
      };

      const result = service['mapDbTenantPlanToApi'](row);

      expect(result.tenantId).toBe(42);
      expect(result.planCode).toBe('pro');
      expect(result.status).toBe('active');
      expect(result.expiresAt).toBeDefined();
      expect(result.customPrice).toBe(99.99);
    });

    it('omits null expires_at and custom_price', () => {
      const row = {
        id: 1,
        tenant_id: 42,
        plan_id: 1,
        plan_code: 'starter',
        plan_name: 'Starter',
        status: 'trial',
        started_at: new Date('2025-01-01'),
        expires_at: null,
        custom_price: null,
        billing_cycle: 'yearly',
      };

      const result = service['mapDbTenantPlanToApi'](row);

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

      const result = service['mapDbAddonToApi'](row);

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
  };

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
  });

  describe('getPlanById', () => {
    it('returns null when plan does not exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.getPlanById(999);

      expect(result).toBeNull();
    });

    it('returns plan with features', async () => {
      mockDb.queryOne.mockResolvedValueOnce({
        id: 1,
        code: 'pro',
        name: 'Pro',
        description: null,
        base_price: 49,
        max_employees: 100,
        max_admins: null,
        max_storage_gb: 50,
        is_active: true,
        sort_order: 2,
        created_at: new Date(),
        updated_at: new Date(),
      });
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

  describe('upgradePlan', () => {
    it('throws NotFoundException for unknown plan code', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null); // getPlanByCode

      await expect(service.upgradePlan(1, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getCurrentPlan', () => {
    it('returns null when no active plan', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.getCurrentPlan(1);

      expect(result).toBeNull();
    });
  });
});
