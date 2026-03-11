/**
 * Notifications Service – Unit Tests
 *
 * Tests for DB-mocked public methods.
 * This is a facade service, so most logic is delegation + DB queries.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import type { NotificationAddonService } from './notification-addon.service.js';
import type { NotificationPreferencesService } from './notification-preferences.service.js';
import type { NotificationStatisticsService } from './notification-statistics.service.js';
import { NotificationsService } from './notifications.service.js';

// ============================================================
// Setup
// ============================================================

function createServiceWithMock(): {
  service: NotificationsService;
  mockDb: { query: ReturnType<typeof vi.fn> };
  mockPreferences: Record<string, ReturnType<typeof vi.fn>>;
  mockStatistics: Record<string, ReturnType<typeof vi.fn>>;
  mockAddon: Record<string, ReturnType<typeof vi.fn>>;
} {
  const mockDb = { query: vi.fn() };
  const mockPreferences = {
    getPreferences: vi.fn(),
    upsertPreferences: vi.fn(),
  };
  const mockStatistics = {
    getStatistics: vi.fn(),
    getPersonalStats: vi.fn(),
  };
  const mockAddon = {
    createAddonNotification: vi.fn(),
    markAddonTypeAsRead: vi.fn(),
    markAddonEntityAsRead: vi.fn(),
  };

  const service = new NotificationsService(
    mockDb as unknown as DatabaseService,
    mockPreferences as unknown as NotificationPreferencesService,
    mockStatistics as unknown as NotificationStatisticsService,
    mockAddon as unknown as NotificationAddonService,
  );

  return { service, mockDb, mockPreferences, mockStatistics, mockAddon };
}

// ============================================================
// DB-Mocked Methods
// ============================================================

describe('NotificationsService – DB-mocked methods', () => {
  let service: NotificationsService;
  let mockDb: { query: ReturnType<typeof vi.fn> };
  let mockPreferences: Record<string, ReturnType<typeof vi.fn>>;
  let mockStatistics: Record<string, ReturnType<typeof vi.fn>>;
  let mockAddon: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
    mockPreferences = result.mockPreferences;
    mockStatistics = result.mockStatistics;
    mockAddon = result.mockAddon;
  });

  describe('markAsRead', () => {
    it('throws NotFoundException when notification does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]); // SELECT notification

      await expect(service.markAsRead(999, 1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('inserts read status for existing notification', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 1, tenant_id: 1 }]) // notification found
        .mockResolvedValueOnce([]); // INSERT read status

      await service.markAsRead(1, 5, 1);

      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('markAllAsRead', () => {
    it('returns 0 when no unread notifications', async () => {
      mockDb.query.mockResolvedValueOnce([]); // no unread

      const result = await service.markAllAsRead(1, 1);

      expect(result.updated).toBe(0);
    });

    it('marks multiple notifications as read', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]) // 3 unread
        .mockResolvedValueOnce([]) // INSERT for id 1
        .mockResolvedValueOnce([]) // INSERT for id 2
        .mockResolvedValueOnce([]); // INSERT for id 3

      const result = await service.markAllAsRead(5, 1);

      expect(result.updated).toBe(3);
    });
  });

  describe('createNotification', () => {
    it('throws BadRequestException when insert fails', async () => {
      mockDb.query.mockResolvedValueOnce([]); // INSERT returns no rows

      await expect(
        service.createNotification(
          {
            type: 'info',
            title: 'Test',
            message: 'Test message',
            recipientType: 'all',
          } as never,
          1,
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns notification ID on success', async () => {
      mockDb.query
        .mockResolvedValueOnce([{ id: 42 }]) // INSERT RETURNING id
        .mockResolvedValueOnce([]); // audit log INSERT

      const result = await service.createNotification(
        {
          type: 'info',
          title: 'Test',
          message: 'Test message',
          recipientType: 'all',
        } as never,
        1,
        1,
      );

      expect(result.notificationId).toBe(42);
    });
  });

  describe('deleteNotification', () => {
    it('throws NotFoundException when notification does not exist', async () => {
      mockDb.query.mockResolvedValueOnce([]); // SELECT

      await expect(
        service.deleteNotification(999, 1, 1, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for non-admin on others notification', async () => {
      mockDb.query.mockResolvedValueOnce([
        {
          id: 1,
          type: 'info',
          recipient_type: 'user',
          recipient_id: 99, // belongs to user 99
          tenant_id: 1,
        },
      ]);

      await expect(
        service.deleteNotification(1, 5, 1, 'employee'), // user 5 trying to delete
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes notification for admin', async () => {
      mockDb.query
        .mockResolvedValueOnce([
          {
            id: 1,
            type: 'info',
            recipient_type: 'all',
            recipient_id: null,
            tenant_id: 1,
          },
        ]) // SELECT
        .mockResolvedValueOnce([]) // DELETE
        .mockResolvedValueOnce([]); // audit log

      await service.deleteNotification(1, 5, 1, 'admin');

      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('resolveNotificationIdByUuid', () => {
    it('throws NotFoundException when UUID not found', async () => {
      mockDb.query.mockResolvedValueOnce([]); // SELECT

      await expect(
        service['resolveNotificationIdByUuid']('non-existent-uuid', 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns ID for valid UUID', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 42 }]);

      const result = await service['resolveNotificationIdByUuid'](
        'valid-uuid',
        1,
      );

      expect(result).toBe(42);
    });
  });

  // ==========================================================================
  // Delegation Tests
  // ==========================================================================

  describe('getPreferences – delegation', () => {
    it('delegates to preferences sub-service', async () => {
      const expected = {
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
      };
      mockPreferences.getPreferences.mockResolvedValueOnce(expected);

      const result = await service.getPreferences(5, 1);

      expect(mockPreferences.getPreferences).toHaveBeenCalledWith(5, 1);
      expect(result).toBe(expected);
    });
  });

  describe('getStatistics – delegation', () => {
    it('delegates to statistics sub-service', async () => {
      const expected = { total: 100, unread: 20 };
      mockStatistics.getStatistics.mockResolvedValueOnce(expected);

      const result = await service.getStatistics(1);

      expect(mockStatistics.getStatistics).toHaveBeenCalledWith(1);
      expect(result).toBe(expected);
    });
  });

  describe('markAddonTypeAsRead – delegation', () => {
    it('delegates to feature sub-service', async () => {
      mockAddon.markAddonTypeAsRead.mockResolvedValueOnce(5);

      const result = await service.markAddonTypeAsRead('survey', 1, 1);

      expect(mockAddon.markAddonTypeAsRead).toHaveBeenCalledWith(
        'survey',
        1,
        1,
      );
      expect(result).toBe(5);
    });
  });

  describe('markAddonEntityAsRead – delegation', () => {
    it('delegates to feature sub-service', async () => {
      mockAddon.markAddonEntityAsRead.mockResolvedValueOnce(2);

      const result = await service.markAddonEntityAsRead(
        'work_orders',
        '019cb994-aaaa-bbbb-cccc-dddddddddddd',
        5,
        10,
      );

      expect(mockAddon.markAddonEntityAsRead).toHaveBeenCalledWith(
        'work_orders',
        '019cb994-aaaa-bbbb-cccc-dddddddddddd',
        5,
        10,
      );
      expect(result).toBe(2);
    });
  });
});
