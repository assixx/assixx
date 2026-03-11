/**
 * Unit tests for FeatureVisitsService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: UPSERT markVisited, queryOne getLastVisited (null path),
 *        getAllVisits Map construction.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { FeatureVisitsService } from './feature-visits.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn(), queryOne: vi.fn() };
}

// =============================================================
// FeatureVisitsService
// =============================================================

describe('FeatureVisitsService', () => {
  let service: FeatureVisitsService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new FeatureVisitsService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // markVisited
  // =============================================================

  describe('markVisited', () => {
    it('should execute UPSERT with correct params', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.markVisited(10, 5, 'calendar');

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const [sql, params] = mockDb.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('ON CONFLICT');
      expect(params).toEqual([10, 5, 'calendar']);
    });
  });

  // =============================================================
  // getLastVisited
  // =============================================================

  describe('getLastVisited', () => {
    it('should return date when visit exists', async () => {
      const visitDate = new Date('2025-06-01T10:00:00Z');
      mockDb.queryOne.mockResolvedValueOnce({ last_visited_at: visitDate });

      const result = await service.getLastVisited(10, 5, 'kvp');

      expect(result).toBe(visitDate);
    });

    it('should return null when never visited', async () => {
      mockDb.queryOne.mockResolvedValueOnce(null);

      const result = await service.getLastVisited(10, 5, 'surveys');

      expect(result).toBeNull();
    });
  });

  // =============================================================
  // getAllVisits
  // =============================================================

  describe('getAllVisits', () => {
    it('should return Map of feature visits', async () => {
      const calDate = new Date('2025-06-01T10:00:00Z');
      const kvpDate = new Date('2025-06-02T14:00:00Z');
      mockDb.query.mockResolvedValueOnce([
        { addon: 'calendar', last_visited_at: calDate },
        { addon: 'kvp', last_visited_at: kvpDate },
      ]);

      const result = await service.getAllVisits(10, 5);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get('calendar')).toBe(calDate);
      expect(result.get('kvp')).toBe(kvpDate);
    });

    it('should return empty Map when no visits', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getAllVisits(10, 5);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });
});
