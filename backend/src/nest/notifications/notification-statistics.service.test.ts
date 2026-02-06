/**
 * Unit tests for NotificationStatisticsService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Tenant-wide stats aggregation (5 queries),
 *        personal stats (3 queries), parseInt fallbacks.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { NotificationStatisticsService } from './notification-statistics.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('./notifications.helpers.js', () => ({
  rowsToRecord: vi.fn(
    (rows: { count: string }[], keyFn: (r: never) => string) => {
      const record: Record<string, number> = {};
      for (const row of rows) {
        record[keyFn(row as never)] = Number.parseInt(row.count, 10);
      }
      return record;
    },
  ),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

// =============================================================
// NotificationStatisticsService
// =============================================================

describe('NotificationStatisticsService', () => {
  let service: NotificationStatisticsService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new NotificationStatisticsService(
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // getStatistics
  // =============================================================

  describe('getStatistics', () => {
    it('should aggregate tenant statistics from 5 queries', async () => {
      // total
      mockDb.query.mockResolvedValueOnce([{ total: '100' }]);
      // byType
      mockDb.query.mockResolvedValueOnce([
        { type: 'info', count: '60' },
        { type: 'warning', count: '40' },
      ]);
      // byPriority
      mockDb.query.mockResolvedValueOnce([
        { priority: 'high', count: '20' },
        { priority: 'low', count: '80' },
      ]);
      // readRate
      mockDb.query.mockResolvedValueOnce([
        { total_notifications: '100', read_notifications: '75' },
      ]);
      // trends
      mockDb.query.mockResolvedValueOnce([
        { date: '2025-06-01', count: '10' },
        { date: '2025-06-02', count: '5' },
      ]);

      const result = await service.getStatistics(10);

      expect(result.total).toBe(100);
      expect(result.readRate).toBe(0.75);
      expect(result.trends).toHaveLength(2);
      expect(result.trends[0]?.count).toBe(10);
      expect(mockDb.query).toHaveBeenCalledTimes(5);
    });

    it('should handle zero totals', async () => {
      mockDb.query.mockResolvedValueOnce([{ total: '0' }]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([
        { total_notifications: '0', read_notifications: '0' },
      ]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getStatistics(10);

      expect(result.total).toBe(0);
      expect(result.readRate).toBe(0);
      expect(result.trends).toEqual([]);
    });
  });

  // =============================================================
  // getPersonalStats
  // =============================================================

  describe('getPersonalStats', () => {
    it('should return personal notification stats', async () => {
      // total
      mockDb.query.mockResolvedValueOnce([{ total: '25' }]);
      // unread
      mockDb.query.mockResolvedValueOnce([{ unread_count: '5' }]);
      // byType
      mockDb.query.mockResolvedValueOnce([
        { type: 'info', count: '3' },
        { type: 'warning', count: '2' },
      ]);

      const result = await service.getPersonalStats(5, 10);

      expect(result.total).toBe(25);
      expect(result.unread).toBe(5);
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('should default to 0 when no rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getPersonalStats(999, 10);

      expect(result.total).toBe(0);
      expect(result.unread).toBe(0);
    });
  });
});
