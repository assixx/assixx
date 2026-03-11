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
      mockDb.queryOne.mockResolvedValueOnce(
        purchasableAddonRow({ trial_days: 14 }),
      );
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.activateAddon(10, 'tpm', 1);

      expect(result.daysRemaining).toBe(14);
      const expectedEnd = new Date(MOCK_NOW.getTime() + 14 * DAY_MS);
      expect(result.trialEndsAt).toBe(expectedEnd.toISOString());
    });

    it('should default to 30 days when addon.trial_days is null', async () => {
      mockDb.queryOne.mockResolvedValueOnce(
        purchasableAddonRow({ trial_days: null }),
      );
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.activateAddon(10, 'tpm', 1);

      expect(result.daysRemaining).toBe(30);
    });

    it('should throw BadRequestException for core addon', async () => {
      mockDb.queryOne.mockResolvedValueOnce(coreAddonRow());

      await expect(service.activateAddon(10, 'dashboard', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for unknown addon code', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      await expect(service.activateAddon(10, 'nonexistent', 1)).rejects.toThrow(
        NotFoundException,
      );
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

      await expect(service.deactivateAddon(10, 'tpm', 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -----------------------------------------------------------
  // Reactivation — Restores access immediately
  // -----------------------------------------------------------

  describe('reactivation', () => {
    it('should reactivate from cancelled with new trial period', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());
      mockDb.query.mockResolvedValueOnce([
        { id: 'uuid-existing', status: 'cancelled' },
      ]);
      mockDb.query.mockResolvedValueOnce([]); // UPDATE

      const result = await service.activateAddon(10, 'tpm', 1);

      expect(result.status).toBe('trial');
      expect(result.daysRemaining).toBe(30);
    });

    it('should reactivate from expired with new trial period', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());
      mockDb.query.mockResolvedValueOnce([
        { id: 'uuid-existing', status: 'expired' },
      ]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.activateAddon(10, 'tpm', 1);

      expect(result.status).toBe('trial');
      expect(result.daysRemaining).toBe(30);
    });

    it('should keep active status when reactivating already active addon', async () => {
      mockDb.queryOne.mockResolvedValueOnce(purchasableAddonRow());
      mockDb.query.mockResolvedValueOnce([
        { id: 'uuid-existing', status: 'active' },
      ]);
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
      mockDb.query.mockResolvedValueOnce([
        coreAddonRow(),
        purchasableAddonRow(),
      ]);

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
});
