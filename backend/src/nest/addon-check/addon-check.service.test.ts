/**
 * Unit tests for AddonCheckService
 *
 * Tests addon access checking with is_core logic:
 * - Core addons → always true (no tenant_addons lookup)
 * - Purchasable addons → check tenant_addons (active/trial + expiry)
 * - Unknown addon code → false
 * - DB errors → false (fail safe)
 *
 * DatabaseService is mocked via constructor DI — no vi.mock() on module paths.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { AddonCheckService } from './addon-check.service.js';

function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
    tenantQuery: vi.fn(),
    tenantQueryOne: vi.fn(),
    systemQuery: vi.fn(),
    systemQueryOne: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

describe('AddonCheckService', () => {
  let service: AddonCheckService;
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new AddonCheckService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // checkTenantAccess
  // =============================================================

  describe('checkTenantAccess', () => {
    // --- Core addons ---

    it('should return true for core addon without tenant_addons lookup', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1, is_core: true }]);

      const result = await service.checkTenantAccess(10, 'dashboard');

      expect(result).toBe(true);
      // Only 1 query (addon lookup), no tenant_addons query
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('addons'), ['dashboard']);
    });

    it('should skip tenant_addons check for all 8 core addons', async () => {
      const coreAddons = [
        'dashboard',
        'calendar',
        'blackboard',
        'settings',
        'notifications',
        'employees',
        'departments',
        'teams',
      ];

      for (const code of coreAddons) {
        mockDb.query.mockResolvedValueOnce([{ id: 1, is_core: true }]);
        const result = await service.checkTenantAccess(10, code);
        expect(result).toBe(true);
      }

      // Each core addon should only trigger 1 query (no tenant_addons lookup)
      expect(mockDb.query).toHaveBeenCalledTimes(coreAddons.length);
    });

    // --- Purchasable addons ---

    it('should return true when purchasable addon is active for tenant', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5, is_core: false }]);
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 'uuid-123' }]);

      const result = await service.checkTenantAccess(10, 'tpm');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(1);
    });

    it('should return false when purchasable addon is not in tenant_addons', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5, is_core: false }]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.checkTenantAccess(10, 'tpm');

      expect(result).toBe(false);
    });

    it('should pass correct tenantId and addon.id to tenant_addons query', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42, is_core: false }]);
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 'uuid-123' }]);

      await service.checkTenantAccess(99, 'vacation');

      const tenantAddonsCall = mockDb.tenantQuery.mock.calls[0];
      expect(tenantAddonsCall?.[1]).toEqual([99, 42]);
    });

    it('should check status IN (active, trial) and trial_ends_at', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5, is_core: false }]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await service.checkTenantAccess(10, 'chat');

      const sql = mockDb.tenantQuery.mock.calls[0]?.[0] as string;
      expect(sql).toContain("('active', 'trial')");
      expect(sql).toContain('trial_ends_at');
    });

    // --- Edge cases ---

    it('should return false when addon code does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.checkTenantAccess(10, 'nonexistent');

      expect(result).toBe(false);
    });

    it('should return false on DB error and not throw', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB connection failed'));

      const result = await service.checkTenantAccess(10, 'any_addon');

      expect(result).toBe(false);
    });

    // --- Trial expiry ---

    it('should return false when purchasable addon trial has expired', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5, is_core: false }]);
      // No matching rows — trial_ends_at < NOW() filtered out by SQL
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.checkTenantAccess(10, 'vacation');

      expect(result).toBe(false);
    });

    it('should filter by trial_ends_at > NOW() to exclude expired trials', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5, is_core: false }]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await service.checkTenantAccess(10, 'tpm');

      const sql = mockDb.tenantQuery.mock.calls[0]?.[0] as string;
      expect(sql).toContain('trial_ends_at IS NULL OR');
      expect(sql).toContain('trial_ends_at > NOW()');
    });
  });

  // =============================================================
  // logUsage
  // =============================================================

  describe('logUsage', () => {
    it('should return true on successful log', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5, is_core: false }]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      const result = await service.logUsage(10, 'tpm', 1, {
        action: 'card_check',
      });

      expect(result).toBe(true);
    });

    it('should insert into addon_usage_logs table', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5, is_core: false }]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await service.logUsage(10, 'tpm', 1);

      const insertCall = mockDb.tenantQuery.mock.calls[0];
      expect(insertCall?.[0]).toContain('addon_usage_logs');
      expect(insertCall?.[0]).toContain('addon_id');
    });

    it('should return false when addon not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.logUsage(10, 'nonexistent', 1);

      expect(result).toBe(false);
    });

    it('should return false on error and not throw', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.logUsage(10, 'tpm', 1);

      expect(result).toBe(false);
    });

    it('should pass null userId by default', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5, is_core: false }]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await service.logUsage(10, 'tpm');

      const insertCall = mockDb.tenantQuery.mock.calls[0];
      expect(insertCall?.[1]?.[2]).toBeNull();
    });

    it('should pass correct addon ID to INSERT', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42, is_core: false }]);
      mockDb.tenantQuery.mockResolvedValueOnce([]);

      await service.logUsage(10, 'chat', 1, { action: 'send' });

      const insertCall = mockDb.tenantQuery.mock.calls[0];
      expect(insertCall?.[1]?.[1]).toBe(42);
    });
  });
});
