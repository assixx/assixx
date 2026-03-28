/**
 * Unit tests for NotificationAddonService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Addon notification creation (fire-and-forget),
 *        markAddonTypeAsRead (batch), ON CONFLICT DO NOTHING.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { NotificationAddonService } from './notification-addon.service.js';

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
// NotificationAddonService
// =============================================================

describe('NotificationAddonService', () => {
  let service: NotificationAddonService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new NotificationAddonService(mockDb as unknown as DatabaseService);
  });

  // =============================================================
  // createAddonNotification
  // =============================================================

  describe('createAddonNotification', () => {
    it('should insert notification', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.createAddonNotification(
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
        service.createAddonNotification('document', 1, 'New Doc', 'Check it', 'user', 5, 10, 1),
      ).resolves.toBeUndefined();
    });
  });

  // =============================================================
  // markAddonEntityAsRead
  // =============================================================

  describe('markAddonEntityAsRead', () => {
    it('should return count of marked notifications', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

      const result = await service.markAddonEntityAsRead(
        'work_orders',
        '019cb994-aaaa-bbbb-cccc-dddddddddddd',
        5,
        10,
      );

      expect(result).toBe(2);
    });

    it('should pass entityUuid in query params', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      const entityUuid = '019cb994-aaaa-bbbb-cccc-dddddddddddd';

      await service.markAddonEntityAsRead('work_orders', entityUuid, 5, 10);

      const params = mockDb.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toContain(entityUuid);
    });

    it('should filter by metadata entityUuid in SQL', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      await service.markAddonEntityAsRead(
        'work_orders',
        '019cb994-aaaa-bbbb-cccc-dddddddddddd',
        5,
        10,
      );

      const sql = mockDb.query.mock.calls[0]?.[0] as string;
      expect(sql).toContain("metadata->>'entityUuid'");
    });

    it('should return 0 when nothing to mark', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.markAddonEntityAsRead(
        'work_orders',
        '019cb994-aaaa-bbbb-cccc-dddddddddddd',
        5,
        10,
      );

      expect(result).toBe(0);
    });
  });

  // =============================================================
  // markAddonTypeAsRead
  // =============================================================

  describe('markAddonTypeAsRead', () => {
    it('should return count of marked notifications', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);

      const result = await service.markAddonTypeAsRead('survey', 5, 10);

      expect(result).toBe(3);
    });

    it('should return 0 when nothing to mark', async () => {
      mockDb.query.mockResolvedValueOnce([]);

      const result = await service.markAddonTypeAsRead('kvp', 5, 10);

      expect(result).toBe(0);
    });
  });
});
