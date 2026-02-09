/**
 * Unit tests for FeatureCheckService
 *
 * DatabaseService is mocked via constructor DI — no vi.mock() on module paths.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { FeatureCheckService } from './feature-check.service.js';

function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

describe('FeatureCheckService', () => {
  let service: FeatureCheckService;
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new FeatureCheckService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // checkTenantAccess
  // =============================================================

  describe('checkTenantAccess', () => {
    it('should return true when feature is found', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);

      const result = await service.checkTenantAccess(10, 'email_notifications');

      expect(result).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_features'),
        [10, 'email_notifications'],
      );
    });

    it('should return false when no feature rows returned', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.checkTenantAccess(10, 'premium_feature');

      expect(result).toBe(false);
    });

    it('should return false on error and not throw', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB connection failed'));

      const result = await service.checkTenantAccess(10, 'any_feature');

      expect(result).toBe(false);
    });
  });

  // =============================================================
  // logUsage
  // =============================================================

  describe('logUsage', () => {
    it('should return true on successful log', async () => {
      // Find feature ID
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);
      // Insert usage log
      mockDb.query.mockResolvedValueOnce([]);
      // Update counter
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.logUsage(10, 'email', 1, {
        action: 'send',
      });

      expect(result).toBe(true);
    });

    it('should return false when feature not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.logUsage(10, 'nonexistent', 1);

      expect(result).toBe(false);
    });

    it('should return false on error and not throw', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.logUsage(10, 'email', 1);

      expect(result).toBe(false);
    });

    it('should pass null userId by default', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.logUsage(10, 'email');

      // Second call is the INSERT — check that userId (param 3) is null
      const insertCall = mockDb.query.mock.calls[1];
      expect(insertCall?.[1]?.[2]).toBeNull();
    });

    it('should pass correct feature ID to INSERT and UPDATE', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      await service.logUsage(10, 'email', 1, { action: 'send' });

      // INSERT call
      const insertCall = mockDb.query.mock.calls[1];
      expect(insertCall?.[1]?.[1]).toBe(42);

      // UPDATE call
      const updateCall = mockDb.query.mock.calls[2];
      expect(updateCall?.[1]?.[1]).toBe(42);
    });
  });
});
