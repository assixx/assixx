/**
 * Unit tests for NotificationFeatureService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Feature notification creation (fire-and-forget),
 *        markFeatureTypeAsRead (batch), ON CONFLICT DO NOTHING.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { NotificationFeatureService } from './notification-feature.service.js';

// =============================================================
// Module mocks
// =============================================================

vi.mock('uuid', () => ({
  v7: vi.fn().mockReturnValue('mock-uuid-v7'),
}));

// =============================================================
// Mock factories
// =============================================================

function createMockDb() {
  return { query: vi.fn() };
}

// =============================================================
// NotificationFeatureService
// =============================================================

describe('NotificationFeatureService', () => {
  let service: NotificationFeatureService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new NotificationFeatureService(
      mockDb as unknown as DatabaseService,
    );
  });

  // =============================================================
  // createFeatureNotification
  // =============================================================

  describe('createFeatureNotification', () => {
    it('should insert notification', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.createFeatureNotification(
        'survey',
        42,
        'New Survey',
        'Please fill out',
        'all',
        null,
        10,
        5,
      );

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params?.[0]).toBe(10); // tenantId
      expect(params?.[1]).toBe('survey'); // type
      expect(params?.[8]).toBe('mock-uuid-v7'); // uuid
    });

    it('should not throw on DB error (fire-and-forget)', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB down'));

      await expect(
        service.createFeatureNotification(
          'document',
          1,
          'New Doc',
          'Check it',
          'user',
          5,
          10,
          1,
        ),
      ).resolves.toBeUndefined();
    });
  });

  // =============================================================
  // markFeatureTypeAsRead
  // =============================================================

  describe('markFeatureTypeAsRead', () => {
    it('should return count of marked notifications', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);

      const result = await service.markFeatureTypeAsRead('survey', 5, 10);

      expect(result).toBe(3);
    });

    it('should return 0 when nothing to mark', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.markFeatureTypeAsRead('kvp', 5, 10);

      expect(result).toBe(0);
    });
  });
});
