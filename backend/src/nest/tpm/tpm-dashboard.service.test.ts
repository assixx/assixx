/**
 * Unit tests for TpmDashboardService
 *
 * Mocked dependencies: DatabaseService (query).
 * Tests: getUnreadCount — count parsing, empty result, null safety.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { TpmDashboardService } from './tpm-dashboard.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return {
    query: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;

// =============================================================
// TpmDashboardService
// =============================================================

describe('TpmDashboardService', () => {
  let service: TpmDashboardService;
  let mockDb: MockDb;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new TpmDashboardService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // getUnreadCount
  // =============================================================

  describe('getUnreadCount()', () => {
    it('should return parsed count from DB', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '7' }]);

      const result = await service.getUnreadCount(42, 10);

      expect(result).toEqual({ count: 7 });
    });

    it('should return 0 when count is "0"', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);

      const result = await service.getUnreadCount(42, 10);

      expect(result).toEqual({ count: 0 });
    });

    it('should return 0 when query returns empty array', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getUnreadCount(42, 10);

      expect(result).toEqual({ count: 0 });
    });

    it('should return 0 when first row has undefined count', async () => {
      mockDb.query.mockResolvedValueOnce([{}]);

      const result = await service.getUnreadCount(42, 10);

      expect(result).toEqual({ count: 0 });
    });

    it('should pass correct params to DB query', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '3' }]);

      await service.getUnreadCount(42, 10);

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];

      expect(sql).toContain("type = 'tpm'");
      expect(sql).toContain('notification_read_status');
      expect(params).toEqual([10, 42]);
    });

    it('should filter by tenant_id and user_id', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);

      await service.getUnreadCount(99, 5);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[0]).toBe(5);
      expect(params?.[1]).toBe(99);
    });

    it('should handle large counts', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '9999' }]);

      const result = await service.getUnreadCount(42, 10);

      expect(result).toEqual({ count: 9999 });
    });
  });
});
