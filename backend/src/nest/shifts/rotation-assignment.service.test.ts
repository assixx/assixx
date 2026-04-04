/**
 * Unit tests for RotationAssignmentService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Pattern assignment CRUD, validation (pattern/team/users),
 *        upsert logic for existing assignments.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { RotationAssignmentService } from './rotation-assignment.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

vi.mock('../../utils/field-mapper.js', () => ({
  dbToApi: vi.fn((row: Record<string, unknown>) => ({ ...row })),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  const query = vi.fn();
  return { query, tenantQuery: query, tenantQueryOne: vi.fn() };
}

// =============================================================
// RotationAssignmentService
// =============================================================

const mockActivityLogger = {
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
  log: vi.fn().mockResolvedValue(undefined),
};

describe('RotationAssignmentService', () => {
  let service: RotationAssignmentService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new RotationAssignmentService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // getPatternAssignments
  // =============================================================

  describe('getPatternAssignments', () => {
    it('should return mapped assignments', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1, user_id: 5, pattern_id: 1, username: 'max' }]);

      const result = await service.getPatternAssignments(1, 10);

      expect(result).toHaveLength(1);
    });
  });

  // =============================================================
  // assignUsersToPattern
  // =============================================================

  describe('assignUsersToPattern', () => {
    it('should throw NotFoundException when pattern not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.assignUsersToPattern(
          {
            patternId: 999,
            assignments: [{ userId: 5, group: 'A' }],
            startsAt: '2025-06-01',
          } as never,
          10,
          1,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update existing assignment', async () => {
      // validatePatternExists
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // existing assignment found
      mockDb.query.mockResolvedValueOnce([{ id: 10 }]);
      // UPDATE
      mockDb.query.mockResolvedValueOnce([]);
      // getPatternAssignments (re-fetch)
      mockDb.query.mockResolvedValueOnce([{ id: 10, user_id: 5, pattern_id: 1, shift_group: 'A' }]);

      const result = await service.assignUsersToPattern(
        {
          patternId: 1,
          assignments: [{ userId: 5, group: 'A' }],
          startsAt: '2025-06-01',
        } as never,
        10,
        1,
      );

      expect(result).toHaveLength(1);
    });

    it('should create new assignment when none exists', async () => {
      // validatePatternExists
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);
      // no existing assignment
      mockDb.query.mockResolvedValueOnce([]);
      // INSERT
      mockDb.query.mockResolvedValueOnce([]);
      // getPatternAssignments (re-fetch)
      mockDb.query.mockResolvedValueOnce([{ id: 11, user_id: 5, pattern_id: 1, shift_group: 'B' }]);

      const result = await service.assignUsersToPattern(
        {
          patternId: 1,
          assignments: [{ userId: 5, group: 'B' }],
          startsAt: '2025-06-01',
        } as never,
        10,
        1,
      );

      expect(result).toHaveLength(1);
    });
  });

  // =============================================================
  // validateTeamExists
  // =============================================================

  describe('validateTeamExists', () => {
    it('should skip when teamId is null', async () => {
      await service.validateTeamExists(null, 10);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should skip when teamId is undefined', async () => {
      await service.validateTeamExists(undefined, 10);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when team not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(service.validateTeamExists(999, 10)).rejects.toThrow(BadRequestException);
    });

    it('should pass when team exists', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);

      await service.validateTeamExists(1, 10);

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  // =============================================================
  // validateAssignmentUserIds
  // =============================================================

  describe('validateAssignmentUserIds', () => {
    it('should skip when assignments is empty', async () => {
      await service.validateAssignmentUserIds([], 10);

      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid user IDs', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5 }]);

      await expect(
        service.validateAssignmentUserIds(
          [
            { userId: 5, startGroup: 'A' },
            { userId: 999, startGroup: 'B' },
          ],
          10,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should pass when all users are valid', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 5 }, { id: 8 }]);

      await service.validateAssignmentUserIds(
        [
          { userId: 5, startGroup: 'A' },
          { userId: 8, startGroup: 'B' },
        ],
        10,
      );

      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });
});
