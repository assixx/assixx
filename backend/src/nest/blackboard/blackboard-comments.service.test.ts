/**
 * Unit tests for BlackboardCommentsService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Get/add/delete comments, UUID resolution,
 *        NotFoundException for missing entries.
 */
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { BlackboardCommentsService } from './blackboard-comments.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('./blackboard.constants.js', () => ({
  ERROR_ENTRY_NOT_FOUND: 'Entry not found',
}));

vi.mock('./blackboard.helpers.js', () => ({
  transformComment: vi.fn((c: Record<string, unknown>) => ({
    id: c['id'],
    comment: c['comment'],
    userId: c['user_id'],
  })),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

// =============================================================
// BlackboardCommentsService
// =============================================================

describe('BlackboardCommentsService', () => {
  let service: BlackboardCommentsService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new BlackboardCommentsService(
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // getComments
  // =============================================================

  describe('getComments', () => {
    it('should return empty when entry not found (UUID)', async () => {
      mockDb.query.mockResolvedValueOnce([]); // resolveEntryId

      const result = await service.getComments('uuid-missing', 10);

      expect(result).toEqual([]);
    });

    it('should skip UUID resolution for numeric id', async () => {
      mockDb.query.mockResolvedValueOnce([
        { id: 1, comment: 'Hello', user_id: 5 },
      ]);

      const result = await service.getComments(1, 10);

      expect(result).toHaveLength(1);
      // Only 1 query (no UUID resolution needed)
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should resolve UUID and return comments', async () => {
      // resolveEntryId
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);
      // getComments
      mockDb.query.mockResolvedValueOnce([
        { id: 1, comment: 'Nice', user_id: 5 },
      ]);

      const result = await service.getComments('uuid-123', 10);

      expect(result).toHaveLength(1);
    });
  });

  // =============================================================
  // addComment
  // =============================================================

  describe('addComment', () => {
    it('should throw NotFoundException when entry not found', async () => {
      mockDb.query.mockResolvedValueOnce([]); // resolveEntryId

      await expect(
        service.addComment('uuid-missing', 5, 10, 'text', false),
      ).rejects.toThrow(NotFoundException);
    });

    it('should add comment for numeric id', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 99 }]);

      const result = await service.addComment(1, 5, 10, 'Great post', false);

      expect(result.id).toBe(99);
      expect(result.message).toBe('Comment added successfully');
    });
  });

  // =============================================================
  // deleteComment
  // =============================================================

  describe('deleteComment', () => {
    it('should delete and return message', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.deleteComment(1, 10);

      expect(result.message).toBe('Comment deleted successfully');
    });
  });
});
