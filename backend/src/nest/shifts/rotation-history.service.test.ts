/**
 * Unit tests for RotationHistoryService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: History retrieval (filter chains), transactional delete cascade,
 *        date-range delete, single entry delete (NotFoundException).
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { RotationHistoryService } from './rotation-history.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('../../utils/field-mapper.js', () => ({
  dbToApi: vi.fn((row: Record<string, unknown>) => ({ ...row })),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  const query = vi.fn();
  return {
    query,
    tenantQuery: query,
    tenantQueryOne: vi.fn(),
  };
}

// =============================================================
// RotationHistoryService
// =============================================================

const mockActivityLogger = {
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
  log: vi.fn().mockResolvedValue(undefined),
};

describe('RotationHistoryService', () => {
  let service: RotationHistoryService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new RotationHistoryService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // getRotationHistory
  // =============================================================

  describe('getRotationHistory', () => {
    it('should return mapped history entries', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          tenant_id: 10,
          user_id: 5,
          pattern_id: 1,
          shift_date: '2025-06-01',
          username: 'max',
          first_name: 'Max',
          last_name: 'M',
          pattern_name: 'Early',
        },
      ]);

      const result = await service.getRotationHistory(10, {});

      expect(result).toHaveLength(1);
    });

    it('should apply filters', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getRotationHistory(10, {
        patternId: 1,
        teamId: 5,
        userId: 3,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        status: 'active',
      });

      const queryCall = mockDb.query.mock.calls[0];
      expect(queryCall?.[0]).toContain('h.pattern_id');
      expect(queryCall?.[0]).toContain('h.team_id');
      expect(queryCall?.[0]).toContain('h.user_id');
      expect(queryCall?.[0]).toContain('h.shift_date >=');
      expect(queryCall?.[0]).toContain('h.shift_date <=');
      expect(queryCall?.[0]).toContain('h.status');
    });
  });

  // =============================================================
  // deleteRotationHistory (cascade)
  // =============================================================

  describe('deleteRotationHistory', () => {
    it('should execute transactional cascade delete', async () => {
      // BEGIN
      mockDb.query.mockResolvedValueOnce([]);
      // shifts delete count
      mockDb.query.mockResolvedValueOnce([{ count: '5' }]);
      // history delete count
      mockDb.query.mockResolvedValueOnce([{ count: '10' }]);
      // assignments delete count
      mockDb.query.mockResolvedValueOnce([{ count: '3' }]);
      // patterns delete count
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);
      // plans delete count (no patternId → delete all)
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);
      // COMMIT
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteRotationHistory(10, 5, 1);

      expect(result.shifts).toBe(5);
      expect(result.history).toBe(10);
      expect(result.assignments).toBe(3);
      expect(result.patterns).toBe(1);
      expect(result.plans).toBe(1);
    });

    it('should skip plans delete when patternId is provided', async () => {
      // BEGIN
      mockDb.query.mockResolvedValueOnce([]);
      // shifts, history, assignments, patterns
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);
      // COMMIT (no plans delete)
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteRotationHistory(10, 5, 1, 1);

      expect(result.plans).toBe(0);
      // 6 calls: BEGIN + 4 deletes + COMMIT (no plans)
      expect(mockDb.query).toHaveBeenCalledTimes(6);
    });

    it('should rollback on error', async () => {
      mockDb.query.mockResolvedValueOnce([]); // BEGIN
      mockDb.query.mockRejectedValueOnce(new Error('DB error')); // first delete fails

      // ROLLBACK should be called
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.deleteRotationHistory(10, 5, 1)).rejects.toThrow('DB error');
    });
  });

  // =============================================================
  // deleteRotationHistoryByDateRange
  // =============================================================

  describe('deleteRotationHistoryByDateRange', () => {
    it('should return history delete count', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '15' }]);

      const result = await service.deleteRotationHistoryByDateRange(
        10,
        5,
        1,
        '2025-01-01',
        '2025-06-30',
      );

      expect(result.history).toBe(15);
      expect(result.patterns).toBe(0);
      expect(result.assignments).toBe(0);
    });
  });

  // =============================================================
  // deleteRotationHistoryEntry
  // =============================================================

  describe('deleteRotationHistoryEntry', () => {
    it('should throw NotFoundException when entry not found', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '0' }]);

      await expect(service.deleteRotationHistoryEntry(999, 10, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete single entry', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: '1' }]);

      await service.deleteRotationHistoryEntry(1, 10, 1);

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });
});
