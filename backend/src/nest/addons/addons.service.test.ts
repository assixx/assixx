/**
 * Unit tests for AddonsService (ADR-033)
 *
 * Tests addon lifecycle — the critical behavioral changes from plan-tiers to addons:
 * - Activation: trial start with correct end date
 * - Deactivation: preserves user permissions (CRITICAL change vs old FeaturesService)
 * - Reactivation: from cancelled/expired restores access immediately
 * - Status checks: core_always_active, not_activated, trial with days remaining
 * - Access control: core addons always accessible, purchasable require subscription
 *
 * DatabaseService is mocked via constructor DI — no vi.mock() on module paths.
 * Uses vi.useFakeTimers() for deterministic trial date calculations.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { AddonsService } from './addons.service.js';

// =============================================================
// Constants
// =============================================================

const MOCK_NOW = new Date('2026-03-11T12:00:00.000Z');
const DAY_MS = 86_400_000;

// =============================================================
// Mock Factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

function purchasableAddonRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    code: 'tpm',
    name: 'TPM / Wartung',
    description: 'Total Productive Maintenance',
    price_monthly: '10.00',
    is_active: 1,
    requires_setup: false,
    icon: 'wrench',
    sort_order: 19,
    is_core: false,
    trial_days: 30,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

function coreAddonRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    code: 'dashboard',
    name: 'Dashboard',
    description: 'Zentrale Übersicht',
    price_monthly: null,
    is_active: 1,
    requires_setup: false,
    icon: 'dashboard',
    sort_order: 1,
    is_core: true,
    trial_days: null,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

// =============================================================
// Tests
// =============================================================

describe('AddonsService', () => {
  let service: AddonsService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_NOW);
    mockDb = createMockDb();
    service = new AddonsService(mockDb as unknown as DatabaseService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -----------------------------------------------------------
  // activateAddon — Trial Start
  // -----------------------------------------------------------

  describe('activateAddon', () => {
    it('should start trial with correct 30-day end date', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());
      // No existing tenant_addons entry
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT (createTrial)
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.activateAddon(10, 'tpm', 1);

      expect(result.status).toBe('trial');
      expect(result.addonCode).toBe('tpm');
      expect(result.daysRemaining).toBe(30);

      const expectedEnd = new Date(MOCK_NOW.getTime() + 30 * DAY_MS);
      expect(result.trialEndsAt).toBe(expectedEnd.toISOString());
    });

    it('should use addon-specific trial_days when defined', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow({ trial_days: 14 }));
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.activateAddon(10, 'tpm', 1);

      expect(result.daysRemaining).toBe(14);
      const expectedEnd = new Date(MOCK_NOW.getTime() + 14 * DAY_MS);
      expect(result.trialEndsAt).toBe(expectedEnd.toISOString());
    });

    it('should default to 30 days when addon.trial_days is null', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow({ trial_days: null }));
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.activateAddon(10, 'tpm', 1);

      expect(result.daysRemaining).toBe(30);
    });

    it('should throw BadRequestException for core addon', async () => {
      mockDb.queryOne.mockResolvedValueOnce(coreAddonRow());

      await expect(service.activateAddon(10, 'dashboard', 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for unknown addon code', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(service.activateAddon(10, 'nonexistent', 1)).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------
  // deactivateAddon — Permission Preservation (CRITICAL)
  // -----------------------------------------------------------

  describe('deactivateAddon', () => {
    it('should set status to cancelled and PRESERVE user permissions', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());
      mockDb.query.mockResolvedValueOnce([{ id: 'uuid-123' }]);

      await service.deactivateAddon(10, 'tpm', 1);

      // Verify UPDATE on tenant_addons (status → cancelled)
      const updateCall = mockDb.query.mock.calls[0];
      expect(updateCall?.[0]).toContain("status = 'cancelled'");
      expect(updateCall?.[0]).toContain('tenant_addons');

      // CRITICAL: No DELETE on user_addon_permissions
      for (const call of mockDb.query.mock.calls) {
        const sql = String(call[0]);
        expect(sql).not.toContain('user_addon_permissions');
        expect(sql.toUpperCase()).not.toMatch(/DELETE\s+FROM/);
      }
    });

    it('should throw BadRequestException for core addon', async () => {
      mockDb.queryOne.mockResolvedValueOnce(coreAddonRow());

      await expect(service.deactivateAddon(10, 'dashboard', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when addon not activated for tenant', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());
      mockDb.query.mockResolvedValueOnce([]); // RETURNING id → 0 rows

      await expect(service.deactivateAddon(10, 'tpm', 1)).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------
  // Reactivation — Restores access immediately
  // -----------------------------------------------------------

  describe('reactivation', () => {
    it('should reactivate from cancelled with new trial period', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());
      mockDb.query.mockResolvedValueOnce([{ id: 'uuid-existing', status: 'cancelled' }]);
      mockDb.query.mockResolvedValueOnce([]); // UPDATE

      const result = await service.activateAddon(10, 'tpm', 1);

      expect(result.status).toBe('trial');
      expect(result.daysRemaining).toBe(30);
    });

    it('should reactivate from expired with new trial period', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());
      mockDb.query.mockResolvedValueOnce([{ id: 'uuid-existing', status: 'expired' }]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.activateAddon(10, 'tpm', 1);

      expect(result.status).toBe('trial');
      expect(result.daysRemaining).toBe(30);
    });

    it('should keep active status when reactivating already active addon', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());
      mockDb.query.mockResolvedValueOnce([{ id: 'uuid-existing', status: 'active' }]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.activateAddon(10, 'tpm', 1);

      expect(result.status).toBe('active');
      expect(result.trialEndsAt).toBeUndefined();
      expect(result.daysRemaining).toBeUndefined();
    });
  });

  // -----------------------------------------------------------
  // getAddonStatus
  // -----------------------------------------------------------

  describe('getAddonStatus', () => {
    it('should return core_always_active for core addon', async () => {
      mockDb.queryOne.mockResolvedValueOnce(coreAddonRow());

      const result = await service.getAddonStatus(10, 'dashboard');

      expect(result.status).toBe('core_always_active');
      expect(result.isCore).toBe(true);
    });

    it('should return not_activated when no tenant_addons entry', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());
      mockDb.queryOne.mockResolvedValueOnce(null); // No tenant_addons row

      const result = await service.getAddonStatus(10, 'tpm');

      expect(result.status).toBe('not_activated');
      expect(result.isCore).toBe(false);
    });

    it('should return trial status with correct days remaining', async () => {
      const trialEnd = new Date(MOCK_NOW.getTime() + 15 * DAY_MS);

      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());
      mockDb.queryOne.mockResolvedValueOnce({
        status: 'trial',
        trial_ends_at: trialEnd,
        activated_at: MOCK_NOW,
      });

      const result = await service.getAddonStatus(10, 'tpm');

      expect(result.status).toBe('trial');
      expect(result.daysRemaining).toBe(15);
      expect(result.trialEndsAt).toBe(trialEnd.toISOString());
    });

    it('should return 0 days remaining when trial has expired', async () => {
      const trialEnd = new Date(MOCK_NOW.getTime() - 1 * DAY_MS);

      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());
      mockDb.queryOne.mockResolvedValueOnce({
        status: 'trial',
        trial_ends_at: trialEnd,
        activated_at: new Date('2026-02-08'),
      });

      const result = await service.getAddonStatus(10, 'tpm');

      expect(result.daysRemaining).toBe(0);
    });

    it('should omit trialEndsAt when trial_ends_at is null', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());
      mockDb.queryOne.mockResolvedValueOnce({
        status: 'active',
        trial_ends_at: null,
        activated_at: MOCK_NOW,
      });

      const result = await service.getAddonStatus(10, 'tpm');

      expect(result.status).toBe('active');
      expect(result.trialEndsAt).toBeUndefined();
      expect(result.daysRemaining).toBeUndefined();
      expect(result.activatedAt).toBe(MOCK_NOW.toISOString());
    });

    it('should omit activatedAt when activated_at is null', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());
      mockDb.queryOne.mockResolvedValueOnce({
        status: 'cancelled',
        trial_ends_at: null,
        activated_at: null,
      });

      const result = await service.getAddonStatus(10, 'tpm');

      expect(result.status).toBe('cancelled');
      expect(result.activatedAt).toBeUndefined();
    });
  });

  // -----------------------------------------------------------
  // checkTenantAccess
  // -----------------------------------------------------------

  describe('checkTenantAccess', () => {
    it('should return true for core addon without tenant_addons lookup', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: 1, is_core: true });

      const result = await service.checkTenantAccess(10, 'dashboard');

      expect(result).toBe(true);
      // Only 1 call (addon lookup), no tenant_addons query
      expect(mockDb.queryOne).toHaveBeenCalledTimes(1);
    });

    it('should return true for active purchasable addon', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: 5, is_core: false });
      mockDb.queryOne.mockResolvedValueOnce({ id: 'uuid-123' });

      const result = await service.checkTenantAccess(10, 'tpm');

      expect(result).toBe(true);
    });

    it('should return false for non-existent addon', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.checkTenantAccess(10, 'nonexistent');

      expect(result).toBe(false);
    });

    it('should return false when purchasable addon not active for tenant', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ id: 5, is_core: false });
      mockDb.queryOne.mockResolvedValueOnce(null); // No matching row

      const result = await service.checkTenantAccess(10, 'tpm');

      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------
  // getAllAddons
  // -----------------------------------------------------------

  describe('getAllAddons', () => {
    it('should return mapped addons with correct field names', async () => {
      mockDb.query.mockResolvedValueOnce([coreAddonRow(), purchasableAddonRow()]);

      const result = await service.getAllAddons();

      expect(result).toHaveLength(2);
      expect(result[0]?.isCore).toBe(true);
      expect(result[0]?.code).toBe('dashboard');
      expect(result[1]?.isCore).toBe(false);
      expect(result[1]?.priceMonthly).toBe(10);
    });

    it('should filter inactive addons by default', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getAllAddons();

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('is_active');
    });

    it('should include inactive addons when includeInactive=true', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getAllAddons(true);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).not.toContain('WHERE');
    });
  });

  // -----------------------------------------------------------
  // getAddonByCode
  // -----------------------------------------------------------

  describe('getAddonByCode', () => {
    it('should return mapped addon when found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());

      const result = await service.getAddonByCode('tpm');

      expect(result).not.toBeNull();
      expect(result?.code).toBe('tpm');
      expect(result?.priceMonthly).toBe(10);
      expect(result?.isCore).toBe(false);
      expect(result?.trialDays).toBe(30);
      expect(result?.icon).toBe('wrench');
    });

    it('should return null when addon not found', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.getAddonByCode('nonexistent');

      expect(result).toBeNull();
    });

    it('should omit optional fields when null in DB', async () => {
      mockDb.queryOne.mockResolvedValueOnce(
        coreAddonRow({
          description: null,
          price_monthly: null,
          trial_days: null,
          icon: null,
        }),
      );

      const result = await service.getAddonByCode('dashboard');

      expect(result).not.toBeNull();
      expect(result?.description).toBeUndefined();
      expect(result?.priceMonthly).toBeUndefined();
      expect(result?.trialDays).toBeUndefined();
      expect(result?.icon).toBeUndefined();
    });
  });

  // -----------------------------------------------------------
  // getAvailableAddons (+ mapJoinRowToAddonWithStatus + buildTenantStatus)
  // -----------------------------------------------------------

  describe('getAvailableAddons', () => {
    function joinRow(overrides: Record<string, unknown> = {}) {
      return {
        addon_id: 5,
        addon_code: 'tpm',
        addon_name: 'TPM / Wartung',
        is_core: false,
        price_monthly: '10.00',
        trial_days: 30,
        ta_id: null,
        tenant_id: null,
        status: null,
        trial_started_at: null,
        trial_ends_at: null,
        activated_at: null,
        deactivated_at: null,
        custom_price: null,
        ta_is_active: null,
        ...overrides,
      };
    }

    it('should return addons with not_activated status when no tenant entry', async () => {
      mockDb.query.mockResolvedValueOnce([joinRow()]);

      const result = await service.getAvailableAddons(10);

      expect(result).toHaveLength(1);
      expect(result[0]?.tenantStatus?.status).toBe('not_activated');
      expect(result[0]?.tenantStatus?.isActive).toBe(false);
    });

    it('should return core addon with active status', async () => {
      mockDb.query.mockResolvedValueOnce([
        joinRow({ addon_id: 1, addon_code: 'dashboard', is_core: true }),
      ]);

      const result = await service.getAvailableAddons(10);

      expect(result[0]?.tenantStatus?.status).toBe('active');
      expect(result[0]?.tenantStatus?.isActive).toBe(true);
    });

    it('should return trial addon with dates', async () => {
      const trialEnd = new Date(MOCK_NOW.getTime() + 15 * DAY_MS);
      const activatedAt = MOCK_NOW;

      mockDb.query.mockResolvedValueOnce([
        joinRow({
          ta_id: 'uuid-1',
          tenant_id: 10,
          status: 'trial',
          trial_ends_at: trialEnd,
          activated_at: activatedAt,
          ta_is_active: 1,
        }),
      ]);

      const result = await service.getAvailableAddons(10);

      expect(result[0]?.tenantStatus?.status).toBe('trial');
      expect(result[0]?.tenantStatus?.isActive).toBe(true);
      expect(result[0]?.tenantStatus?.trialEndsAt).toBe(trialEnd.toISOString());
      expect(result[0]?.tenantStatus?.activatedAt).toBe(activatedAt.toISOString());
    });

    it('should return cancelled addon as inactive', async () => {
      mockDb.query.mockResolvedValueOnce([
        joinRow({
          ta_id: 'uuid-2',
          tenant_id: 10,
          status: 'cancelled',
          ta_is_active: 0,
          deactivated_at: MOCK_NOW,
        }),
      ]);

      const result = await service.getAvailableAddons(10);

      expect(result[0]?.tenantStatus?.status).toBe('cancelled');
      expect(result[0]?.tenantStatus?.isActive).toBe(false);
    });

    it('should map priceMonthly and trialDays from join row', async () => {
      mockDb.query.mockResolvedValueOnce([joinRow({ price_monthly: '25.50', trial_days: 14 })]);

      const result = await service.getAvailableAddons(10);

      expect(result[0]?.priceMonthly).toBe(25.5);
      expect(result[0]?.trialDays).toBe(14);
    });

    it('should omit priceMonthly and trialDays when null', async () => {
      mockDb.query.mockResolvedValueOnce([joinRow({ price_monthly: null, trial_days: null })]);

      const result = await service.getAvailableAddons(10);

      expect(result[0]?.priceMonthly).toBeUndefined();
      expect(result[0]?.trialDays).toBeUndefined();
    });

    it('should pass tenantId to SQL query', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getAvailableAddons(42);

      const params = mockDb.query.mock.calls[0]?.[1] as number[];
      expect(params[0]).toBe(42);
    });
  });

  // -----------------------------------------------------------
  // getUsageStats
  // -----------------------------------------------------------

  describe('getUsageStats', () => {
    it('should return mapped usage statistics', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());
      mockDb.query.mockResolvedValueOnce([
        { date: new Date('2026-03-10'), usage_count: 15, unique_users: 5 },
        { date: new Date('2026-03-11'), usage_count: 22, unique_users: 8 },
      ]);

      const result = await service.getUsageStats(10, 'tpm', '2026-03-10', '2026-03-11');

      expect(result).toHaveLength(2);
      expect(result[0]?.date).toBe('2026-03-10');
      expect(result[0]?.addonCode).toBe('tpm');
      expect(result[0]?.usageCount).toBe(15);
      expect(result[0]?.uniqueUsers).toBe(5);
      expect(result[1]?.date).toBe('2026-03-11');
    });

    it('should throw NotFoundException for unknown addon', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(
        service.getUsageStats(10, 'nonexistent', '2026-03-01', '2026-03-11'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return empty array when no usage data', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getUsageStats(10, 'tpm', '2026-03-01', '2026-03-02');

      expect(result).toEqual([]);
    });

    it('should pass correct params to SQL', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow({ id: 7 }));
      mockDb.query.mockResolvedValueOnce([]);

      await service.getUsageStats(10, 'tpm', '2026-03-01', '2026-03-31');

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params[0]).toBe(10);
      expect(params[1]).toBe(7);
      expect(params[2]).toBe('2026-03-01');
      expect(params[3]).toBe('2026-03-31');
    });
  });

  // -----------------------------------------------------------
  // getTenantAddonsSummary
  // -----------------------------------------------------------

  describe('getTenantAddonsSummary', () => {
    function joinRowForSummary(overrides: Record<string, unknown> = {}) {
      return {
        addon_id: 5,
        addon_code: 'tpm',
        addon_name: 'TPM',
        is_core: false,
        price_monthly: '10.00',
        trial_days: 30,
        ta_id: null,
        tenant_id: null,
        status: null,
        trial_started_at: null,
        trial_ends_at: null,
        activated_at: null,
        deactivated_at: null,
        custom_price: null,
        ta_is_active: null,
        ...overrides,
      };
    }

    it('should count core, active, trial, cancelled addons correctly', async () => {
      mockDb.query.mockResolvedValueOnce([
        joinRowForSummary({
          addon_id: 1,
          addon_code: 'dashboard',
          is_core: true,
        }),
        joinRowForSummary({
          addon_id: 2,
          addon_code: 'calendar',
          is_core: true,
        }),
        joinRowForSummary({
          addon_id: 5,
          addon_code: 'tpm',
          ta_id: 'u1',
          tenant_id: 10,
          status: 'active',
          ta_is_active: 1,
          price_monthly: '10.00',
        }),
        joinRowForSummary({
          addon_id: 6,
          addon_code: 'chat',
          ta_id: 'u2',
          tenant_id: 10,
          status: 'trial',
          ta_is_active: 1,
        }),
        joinRowForSummary({
          addon_id: 7,
          addon_code: 'kvp',
          ta_id: 'u3',
          tenant_id: 10,
          status: 'cancelled',
          ta_is_active: 0,
        }),
        joinRowForSummary({
          addon_id: 8,
          addon_code: 'documents',
          ta_id: 'u4',
          tenant_id: 10,
          status: 'expired',
          ta_is_active: 0,
        }),
      ]);

      const result = await service.getTenantAddonsSummary(10);

      expect(result.tenantId).toBe(10);
      expect(result.coreAddons).toBe(2);
      expect(result.activeAddons).toBe(1);
      expect(result.trialAddons).toBe(1);
      expect(result.cancelledAddons).toBe(2);
      expect(result.monthlyCost).toBe(10);
    });

    it('should return zeros when only core addons exist', async () => {
      mockDb.query.mockResolvedValueOnce([
        joinRowForSummary({
          addon_id: 1,
          addon_code: 'dashboard',
          is_core: true,
        }),
      ]);

      const result = await service.getTenantAddonsSummary(10);

      expect(result.coreAddons).toBe(1);
      expect(result.activeAddons).toBe(0);
      expect(result.trialAddons).toBe(0);
      expect(result.cancelledAddons).toBe(0);
      expect(result.monthlyCost).toBe(0);
    });

    it('should sum monthlyCost from multiple active addons', async () => {
      mockDb.query.mockResolvedValueOnce([
        joinRowForSummary({
          addon_id: 5,
          addon_code: 'tpm',
          ta_id: 'u1',
          tenant_id: 10,
          status: 'active',
          ta_is_active: 1,
          price_monthly: '10.00',
        }),
        joinRowForSummary({
          addon_id: 6,
          addon_code: 'chat',
          ta_id: 'u2',
          tenant_id: 10,
          status: 'active',
          ta_is_active: 1,
          price_monthly: '15.00',
        }),
      ]);

      const result = await service.getTenantAddonsSummary(10);

      expect(result.monthlyCost).toBe(25);
      expect(result.activeAddons).toBe(2);
    });

    it('should use 0 when active addon has no priceMonthly', async () => {
      mockDb.query.mockResolvedValueOnce([
        joinRowForSummary({
          addon_id: 5,
          addon_code: 'tpm',
          ta_id: 'u1',
          tenant_id: 10,
          status: 'active',
          ta_is_active: 1,
          price_monthly: null,
        }),
      ]);

      const result = await service.getTenantAddonsSummary(10);

      expect(result.activeAddons).toBe(1);
      expect(result.monthlyCost).toBe(0);
    });

    it('should handle not_activated addons (no tenant entry)', async () => {
      mockDb.query.mockResolvedValueOnce([joinRowForSummary({ addon_id: 5, addon_code: 'tpm' })]);

      const result = await service.getTenantAddonsSummary(10);

      expect(result.activeAddons).toBe(0);
      expect(result.trialAddons).toBe(0);
      expect(result.cancelledAddons).toBe(0);
    });
  });

  // -----------------------------------------------------------
  // getAllTenantsWithAddons
  // -----------------------------------------------------------

  describe('getAllTenantsWithAddons', () => {
    it('should return tenants with addon summaries', async () => {
      // First query: tenants list
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          subdomain: 'apitest',
          company_name: 'API Test GmbH',
          status: 'active',
        },
        {
          id: 3,
          subdomain: 'testfirma',
          company_name: 'Testfirma GmbH',
          status: 'active',
        },
      ]);
      // getAvailableAddons for tenant 1
      mockDb.query.mockResolvedValueOnce([
        {
          addon_id: 1,
          addon_code: 'dashboard',
          addon_name: 'Dashboard',
          is_core: true,
          price_monthly: null,
          trial_days: null,
          ta_id: null,
          tenant_id: null,
          status: null,
          trial_started_at: null,
          trial_ends_at: null,
          activated_at: null,
          deactivated_at: null,
          custom_price: null,
          ta_is_active: null,
        },
      ]);
      // getAvailableAddons for tenant 3
      mockDb.query.mockResolvedValueOnce([
        {
          addon_id: 1,
          addon_code: 'dashboard',
          addon_name: 'Dashboard',
          is_core: true,
          price_monthly: null,
          trial_days: null,
          ta_id: null,
          tenant_id: null,
          status: null,
          trial_started_at: null,
          trial_ends_at: null,
          activated_at: null,
          deactivated_at: null,
          custom_price: null,
          ta_is_active: null,
        },
        {
          addon_id: 5,
          addon_code: 'tpm',
          addon_name: 'TPM',
          is_core: false,
          price_monthly: '10.00',
          trial_days: 30,
          ta_id: 'u1',
          tenant_id: 3,
          status: 'active',
          trial_started_at: null,
          trial_ends_at: null,
          activated_at: MOCK_NOW,
          deactivated_at: null,
          custom_price: null,
          ta_is_active: 1,
        },
      ]);

      const result = await service.getAllTenantsWithAddons();

      expect(result).toHaveLength(2);
      expect(result[0]?.subdomain).toBe('apitest');
      expect(result[0]?.addonSummary.coreAddons).toBe(1);
      expect(result[0]?.addonSummary.monthlyCost).toBe(0);

      expect(result[1]?.subdomain).toBe('testfirma');
      expect(result[1]?.addonSummary.coreAddons).toBe(1);
      expect(result[1]?.addonSummary.activeAddons).toBe(1);
      expect(result[1]?.addonSummary.monthlyCost).toBe(10);
    });

    it('should return empty array when no tenants exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getAllTenantsWithAddons();

      expect(result).toEqual([]);
    });
  });
});
