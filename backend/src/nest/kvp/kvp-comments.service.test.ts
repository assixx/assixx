/**
 * Unit tests for KvpCommentsService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Employee visibility filter, admin-only addComment,
 *        ForbiddenException for non-admin, field mapping.
 */
import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { KvpCommentsService } from './kvp-comments.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new KvpCommentsService(mockDb as unknown as DatabaseService);
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
  // addComment
  // =============================================================

  describe('addComment', () => {
    it('should throw ForbiddenException for employee', async () => {
      await expect(
        service.addComment(42, 5, 10, 'Comment', false, 'employee'),
      ).rejects.toThrow(ForbiddenException);
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
  });
});
