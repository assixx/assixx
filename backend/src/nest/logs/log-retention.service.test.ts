/**
 * Unit tests for LogRetentionService
 *
 * Phase 9: Service tests — mocked PG Pool.
 * Focus: retention days validation (default, minimum, NaN), stats accumulation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LogRetentionService } from './log-retention.service.js';

// =============================================================
// Mocks
// =============================================================

function createMockPool() {
  return { query: vi.fn() };
}

// =============================================================
// LogRetentionService
// =============================================================

describe('LogRetentionService', () => {
  let service: LogRetentionService;
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    mockPool = createMockPool();
    service = new LogRetentionService(mockPool as never);
  });

  // =============================================================
  // getTenantRetentionDays
  // =============================================================

  describe('getTenantRetentionDays', () => {
    it('should return default 365 when no setting exists', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getTenantRetentionDays(1);

      expect(result).toBe(365);
    });

    it('should return configured retention days', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ setting_value: '90' }] });

      const result = await service.getTenantRetentionDays(1);

      expect(result).toBe(90);
    });

    it('should enforce minimum 7 days when configured value is too low', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ setting_value: '3' }] });

      const result = await service.getTenantRetentionDays(1);

      expect(result).toBe(7);
    });

    it('should enforce minimum 7 days when value is NaN', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ setting_value: 'invalid' }] });

      const result = await service.getTenantRetentionDays(1);

      expect(result).toBe(7);
    });
  });

  // =============================================================
  // setTenantRetentionDays
  // =============================================================

  describe('setTenantRetentionDays', () => {
    it('should enforce minimum 7 days when setting lower value', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.setTenantRetentionDays(1, 2);

      const args = mockPool.query.mock.calls[0] as unknown[];
      const params = args[1] as unknown[];
      expect(params[1]).toBe('7'); // Math.max(2, 7) = 7
    });

    it('should accept values above minimum', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.setTenantRetentionDays(1, 180);

      const args = mockPool.query.mock.calls[0] as unknown[];
      const params = args[1] as unknown[];
      expect(params[1]).toBe('180');
    });
  });

  // =============================================================
  // runRetentionCleanup
  // =============================================================

  describe('runRetentionCleanup', () => {
    it('should return zero stats when no tenants exist', async () => {
      // getAllTenantRetentionConfigs → SELECT id FROM tenants
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.runRetentionCleanup();

      expect(result).toEqual({ tenantsProcessed: 0, totalDeleted: 0, errors: 0 });
    });
  });

  // =============================================================
  // getRetentionStats
  // =============================================================

  describe('getRetentionStats', () => {
    it('should return default constants and DB stats', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // custom retention count
        .mockResolvedValueOnce({ rows: [{ oldest: new Date('2025-06-01') }] }); // oldest log

      const result = await service.getRetentionStats();

      expect(result.defaultRetentionDays).toBe(365);
      expect(result.minRetentionDays).toBe(7);
      expect(result.tenantsWithCustomRetention).toBe(2);
      expect(result.oldestLogDate).toEqual(new Date('2025-06-01'));
    });
  });
});
