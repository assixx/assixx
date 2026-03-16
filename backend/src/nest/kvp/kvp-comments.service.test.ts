/**
 * Unit tests for KvpCommentsService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Employee visibility filter, permission-based addComment,
 *        isInternal enforcement for non-admin, field mapping.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActivityLoggerService } from '../common/services/activity-logger.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { KvpCommentsService } from './kvp-comments.service.js';

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

function makeDbComment(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    suggestion_id: 42,
    user_id: 5,
    comment: 'Good idea',
    is_internal: false,
    created_at: new Date('2025-06-01T10:00:00Z'),
    first_name: 'Max',
    last_name: 'M',
    role: 'admin',
    profile_picture: null,
    ...overrides,
  };
}

// =============================================================
// KvpCommentsService
// =============================================================

describe('KvpCommentsService', () => {
  let service: KvpCommentsService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockActivityLogger: ReturnType<typeof createMockActivityLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockActivityLogger = createMockActivityLogger();
    service = new KvpCommentsService(
      mockDb as unknown as DatabaseService,
      mockActivityLogger as unknown as ActivityLoggerService,
    );
  });

  // =============================================================
  // getComments
  // =============================================================

  describe('getComments', () => {
    it('should return all comments for admin', async () => {
      // count query
      mockDb.query.mockResolvedValueOnce([{ total: 1 }]);
      // comments query
      mockDb.query.mockResolvedValueOnce([makeDbComment()]);

      const result = await service.getComments(42, 10, 'admin');

      expect(result.comments).toHaveLength(1);
      expect(result.comments[0]?.comment).toBe('Good idea');
      expect(result.comments[0]?.createdByName).toBe('Max');
    });

    it('should filter internal comments for employee', async () => {
      // count query
      mockDb.query.mockResolvedValueOnce([{ total: 0 }]);
      // comments query
      mockDb.query.mockResolvedValueOnce([]);

      await service.getComments(42, 10, 'employee');

      // Both count and comments queries should have the filter
      const countCall = mockDb.query.mock.calls[0];
      expect(countCall?.[0]).toContain('is_internal = FALSE');
    });

    it('should not filter internal comments for root', async () => {
      // count query
      mockDb.query.mockResolvedValueOnce([{ total: 0 }]);
      // comments query
      mockDb.query.mockResolvedValueOnce([]);

      await service.getComments(42, 10, 'root');

      const countCall = mockDb.query.mock.calls[0];
      expect(countCall?.[0]).not.toContain('is_internal = FALSE');
    });
  });

  // =============================================================
  // getReplies
  // =============================================================

  describe('getReplies', () => {
    it('should return replies for admin (including internal)', async () => {
      mockDb.query.mockResolvedValueOnce([
        makeDbComment({ id: 10, comment: 'Reply 1' }),
      ]);

      const result = await service.getReplies(1, 10, 'admin');

      expect(result).toHaveLength(1);
      expect(result[0]?.comment).toBe('Reply 1');
      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).not.toContain('is_internal = FALSE');
    });

    it('should filter internal replies for employee', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.getReplies(1, 10, 'employee');

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain('is_internal = FALSE');
    });
  });

  // =============================================================
  // addComment
  // =============================================================

  describe('addComment', () => {
    it('should allow employee to comment with isInternal forced to false', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 101 }]);

      const result = await service.addComment(
        42,
        5,
        10,
        'Employee comment',
        true,
        'employee',
      );

      expect(result.id).toBe(101);
      expect(result.isInternal).toBe(false);
    });

    it('should add comment for admin', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 99 }]);

      const result = await service.addComment(
        42,
        5,
        10,
        'Admin feedback',
        true,
        'admin',
      );

      expect(result.id).toBe(99);
      expect(result.isInternal).toBe(true);
    });

    it('should add comment for root', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 100 }]);

      const result = await service.addComment(
        42,
        1,
        10,
        'Root note',
        false,
        'root',
      );

      expect(result.id).toBe(100);
    });

    it('should throw when insert fails', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.addComment(42, 5, 10, 'Comment', false, 'admin'),
      ).rejects.toThrow('Failed to add comment');
    });

    it('should validate parentId belongs to same suggestion', async () => {
      // Parent lookup returns matching suggestion
      mockDb.query.mockResolvedValueOnce([{ suggestion_id: 42 }]);
      // Insert
      mockDb.query.mockResolvedValueOnce([{ id: 200 }]);

      const result = await service.addComment(
        42,
        5,
        10,
        'Reply',
        false,
        'admin',
        7,
      );

      expect(result.id).toBe(200);
      expect(result.parentId).toBe(7);
    });

    it('should throw when parent comment not found', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await expect(
        service.addComment(42, 5, 10, 'Reply', false, 'admin', 999),
      ).rejects.toThrow('Parent comment not found');
    });

    it('should throw when parent belongs to different suggestion', async () => {
      mockDb.query.mockResolvedValueOnce([{ suggestion_id: 99 }]);

      await expect(
        service.addComment(42, 5, 10, 'Reply', false, 'admin', 7),
      ).rejects.toThrow('Parent comment does not belong to this suggestion');
    });
  });
});
