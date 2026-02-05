/**
 * Unit tests for BlackboardConfirmationsService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Confirm/unconfirm entries, confirmation status retrieval,
 *        unconfirmed count with visibility filtering, UUID resolution.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { BlackboardConfirmationsService } from './blackboard-confirmations.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('../../utils/fieldMapper.js', () => ({
  dbToApi: vi.fn((row: Record<string, unknown>) => ({ ...row })),
}));

vi.mock('./blackboard.constants.js', () => ({
  ERROR_ENTRY_NOT_FOUND: 'Entry not found',
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

// =============================================================
// BlackboardConfirmationsService
// =============================================================

describe('BlackboardConfirmationsService', () => {
  let service: BlackboardConfirmationsService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new BlackboardConfirmationsService(
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // confirmEntry
  // =============================================================

  describe('confirmEntry', () => {
    it('should throw BadRequestException when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.confirmEntry(1, 999)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when entry not found', async () => {
      // user found
      mockDb.query.mockResolvedValueOnce([{ tenant_id: 10 }]);
      // resolveEntryId → not found
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.confirmEntry(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should confirm entry successfully', async () => {
      // user found
      mockDb.query.mockResolvedValueOnce([{ tenant_id: 10 }]);
      // resolveEntryId
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // UPSERT confirmation
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.confirmEntry(1, 5);

      expect(result.message).toBe('Entry confirmed successfully');
    });
  });

  // =============================================================
  // unconfirmEntry
  // =============================================================

  describe('unconfirmEntry', () => {
    it('should unconfirm entry successfully', async () => {
      // user found
      mockDb.query.mockResolvedValueOnce([{ tenant_id: 10 }]);
      // resolveEntryId
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // UPDATE is_confirmed = false
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.unconfirmEntry(1, 5);

      expect(result.message).toBe('Entry marked as unread successfully');
    });
  });

  // =============================================================
  // getConfirmationStatus
  // =============================================================

  describe('getConfirmationStatus', () => {
    it('should return empty array when entry not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getConfirmationStatus(999, 10);

      expect(result).toEqual([]);
    });

    it('should return confirmation list for company-level entry', async () => {
      // entry found
      mockDb.query.mockResolvedValueOnce([
        { id: 1, org_level: 'company', org_id: null },
      ]);
      // users with confirmation status
      mockDb.query.mockResolvedValueOnce([
        { id: 5, username: 'max', confirmed: 1, confirmed_at: new Date() },
        { id: 6, username: 'anna', confirmed: 0, confirmed_at: null },
      ]);

      const result = await service.getConfirmationStatus(1, 10);

      expect(result).toHaveLength(2);
    });
  });

  // =============================================================
  // getUnconfirmedCount
  // =============================================================

  describe('getUnconfirmedCount', () => {
    it('should return 0 when user not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getUnconfirmedCount(999, 10);

      expect(result.count).toBe(0);
    });

    it('should return count for admin (no visibility filter)', async () => {
      // user info
      mockDb.query.mockResolvedValueOnce([
        { role: 'admin', department_id: null, team_id: null },
      ]);
      // count query
      mockDb.query.mockResolvedValueOnce([{ count: '5' }]);

      const result = await service.getUnconfirmedCount(1, 10);

      expect(result.count).toBe(5);
    });

    it('should apply visibility filter for employee', async () => {
      // user info
      mockDb.query.mockResolvedValueOnce([
        { role: 'employee', department_id: 3, team_id: 7 },
      ]);
      // count query
      mockDb.query.mockResolvedValueOnce([{ count: '2' }]);

      const result = await service.getUnconfirmedCount(5, 10);

      expect(result.count).toBe(2);
      // Verify employee filter was applied (has $3 and $4 params)
      const queryCall = mockDb.query.mock.calls[1];
      expect(queryCall?.[1]).toContain(3); // departmentId
      expect(queryCall?.[1]).toContain(7); // teamId
    });
  });
});
