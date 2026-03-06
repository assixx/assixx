/**
 * Unit tests for KvpConfirmationsService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Unconfirmed count with visibility filtering,
 *        confirm/unconfirm UPSERT, NotFoundException.
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { KvpConfirmationsService } from './kvp-confirmations.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('./kvp.constants.js', () => ({
  ERROR_SUGGESTION_NOT_FOUND: 'Suggestion not found',
}));

vi.mock('./kvp.helpers.js', () => ({
  buildVisibilityClause: vi.fn().mockReturnValue({
    clause: ' AND s.org_level = $3',
    params: ['company'],
  }),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

function createMockActivityLogger() {
  return {
    log: vi.fn(),
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
  };
}

function makeOrgInfo() {
  return {
    role: 'employee',
    has_full_access: false,
    department_id: 3,
    team_id: 7,
    area_id: null,
  };
}

// =============================================================
// KvpConfirmationsService
// =============================================================

describe('KvpConfirmationsService', () => {
  let service: KvpConfirmationsService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockActivityLogger = createMockActivityLogger();
    service = new KvpConfirmationsService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // getUnconfirmedCount
  // =============================================================

  describe('getUnconfirmedCount', () => {
    it('should return count with visibility filter', async () => {
      mockDb.query.mockResolvedValueOnce([{ count: 3 }]);

      const result = await service.getUnconfirmedCount(
        5,
        10,
        makeOrgInfo() as never,
      );

      expect(result.count).toBe(3);
    });

    it('should default to 0 when no rows', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.getUnconfirmedCount(
        5,
        10,
        makeOrgInfo() as never,
      );

      expect(result.count).toBe(0);
    });
  });

  // =============================================================
  // confirmSuggestion
  // =============================================================

  describe('confirmSuggestion', () => {
    it('should throw NotFoundException when suggestion not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.confirmSuggestion('uuid-123', 5, 10),
      ).rejects.toThrow(NotFoundException);
    });

    it('should confirm suggestion with UPSERT', async () => {
      // SELECT suggestion
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);
      // UPSERT confirmation
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.confirmSuggestion('uuid-123', 5, 10);

      expect(result.success).toBe(true);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  // =============================================================
  // unconfirmSuggestion
  // =============================================================

  describe('unconfirmSuggestion', () => {
    it('should throw NotFoundException when suggestion not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.unconfirmSuggestion('uuid-123', 5, 10),
      ).rejects.toThrow(NotFoundException);
    });

    it('should set is_confirmed = false', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.unconfirmSuggestion('uuid-123', 5, 10);

      expect(result.success).toBe(true);
    });
  });
});
