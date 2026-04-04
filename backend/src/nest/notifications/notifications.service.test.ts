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
  mockDb: { tenantQuery: ReturnType<typeof vi.fn>; tenantQueryOne: ReturnType<typeof vi.fn> };
  mockPreferences: Record<string, ReturnType<typeof vi.fn>>;
  mockStatistics: Record<string, ReturnType<typeof vi.fn>>;
  mockAddon: Record<string, ReturnType<typeof vi.fn>>;
} {
  const mockDb = { tenantQuery: vi.fn(), tenantQueryOne: vi.fn().mockResolvedValue(null) };
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
  let mockDb: { tenantQuery: ReturnType<typeof vi.fn>; tenantQueryOne: ReturnType<typeof vi.fn> };
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
      mockDb.tenantQuery.mockResolvedValueOnce([]); // SELECT notification

      await expect(service.markAsRead(999, 1, 1)).rejects.toThrow(NotFoundException);
    });

    it('inserts read status for existing notification', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([{ id: 1, tenant_id: 1 }]) // notification found
        .mockResolvedValueOnce([]); // INSERT read status

      await service.markAsRead(1, 5, 1);

      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('markAllAsRead', () => {
    it('returns 0 when no unread notifications', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]); // no unread

      const result = await service.markAllAsRead(1, 1);

      expect(result.updated).toBe(0);
    });

    it('marks multiple notifications as read', async () => {
      mockDb.tenantQuery
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
      mockDb.tenantQuery.mockResolvedValueOnce([]); // INSERT returns no rows

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
      mockDb.tenantQuery
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
      mockDb.tenantQuery.mockResolvedValueOnce([]); // SELECT

      await expect(service.deleteNotification(999, 1, 1, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for non-admin on others notification', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([
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
      mockDb.tenantQuery
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

      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(3);
    });
  });

  describe('resolveNotificationIdByUuid', () => {
    it('throws NotFoundException when UUID not found', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]); // SELECT

      await expect(service['resolveNotificationIdByUuid']('non-existent-uuid', 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns ID for valid UUID', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([{ id: 42 }]);

      const result = await service['resolveNotificationIdByUuid']('valid-uuid', 1);

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

  describe('createAddonNotification – delegation', () => {
    it('delegates to addon sub-service', async () => {
      mockAddon.createAddonNotification.mockResolvedValueOnce(undefined);

      await service.createAddonNotification(
        'survey',
        42,
        'New Survey',
        'Please complete',
        'all',
        null,
        1,
        5,
      );

      expect(mockAddon.createAddonNotification).toHaveBeenCalledWith(
        'survey',
        42,
        'New Survey',
        'Please complete',
        'all',
        null,
        1,
        5,
      );
    });
  });

  describe('markAddonTypeAsRead – delegation', () => {
    it('delegates to addon sub-service', async () => {
      mockAddon.markAddonTypeAsRead.mockResolvedValueOnce(5);

      const result = await service.markAddonTypeAsRead('survey', 1, 1);

      expect(mockAddon.markAddonTypeAsRead).toHaveBeenCalledWith('survey', 1, 1);
      expect(result).toBe(5);
    });
  });

  describe('markAddonEntityAsRead – delegation', () => {
    it('delegates to addon sub-service', async () => {
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

  // ==========================================================================
  // listNotifications + getNotificationCounts (lines ~62-124, 502-536)
  // ==========================================================================

  describe('listNotifications', () => {
    const fakeRow = {
      id: 1,
      type: 'info',
      title: 'Test',
      message: 'Test message',
      priority: 'normal',
      recipient_type: 'all',
      recipient_id: null,
      action_url: null,
      action_label: null,
      metadata: null,
      scheduled_for: null,
      created_by: 1,
      tenant_id: 1,
      created_at: new Date('2026-01-01'),
      updated_at: new Date('2026-01-01'),
      read_at: null,
      is_read: false,
      created_by_name: 'admin',
    };

    it('returns paginated notifications with defaults (page=1, limit=20)', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([fakeRow]) // main SELECT
        .mockResolvedValueOnce([{ total: '1' }]) // count query
        .mockResolvedValueOnce([{ unread_count: '1' }]); // unread count query

      const result = await service.listNotifications(5, 1, {});

      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.unreadCount).toBe(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('uses provided page and limit from filters', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([]) // main SELECT (no results on page 3)
        .mockResolvedValueOnce([{ total: '50' }]) // total count
        .mockResolvedValueOnce([{ unread_count: '10' }]); // unread count

      const result = await service.listNotifications(5, 1, {
        page: 3,
        limit: 10,
      });

      expect(result.page).toBe(3);
      expect(result.totalPages).toBe(5);
      expect(result.total).toBe(50);
      expect(result.unreadCount).toBe(10);
      expect(result.notifications).toHaveLength(0);
      expect(result.pagination.limit).toBe(10);
    });

    it('handles unread filter', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([fakeRow]) // main SELECT with unread filter
        .mockResolvedValueOnce([{ total: '1' }])
        .mockResolvedValueOnce([{ unread_count: '1' }]);

      const result = await service.listNotifications(5, 1, { unread: true });

      expect(result.notifications).toHaveLength(1);
      // Verify the main query includes the unread filter
      const mainQueryCall = mockDb.tenantQuery.mock.calls[0];
      expect(mainQueryCall[0]).toContain('AND nrs.id IS NULL');
    });

    it('defaults to 0 when count rows are empty', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([]) // main SELECT
        .mockResolvedValueOnce([{}]) // count row without total field
        .mockResolvedValueOnce([{}]); // unread row without unread_count field

      const result = await service.listNotifications(5, 1, {});

      expect(result.total).toBe(0);
      expect(result.unreadCount).toBe(0);
    });

    it('handles type and priority filters', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ unread_count: '0' }]);

      await service.listNotifications(5, 1, {
        type: 'warning',
        priority: 'high',
      });

      // The query should contain type and priority filter params
      const mainQueryParams = mockDb.tenantQuery.mock.calls[0][1] as unknown[];
      expect(mainQueryParams).toContain('warning');
      expect(mainQueryParams).toContain('high');
    });
  });

  // ==========================================================================
  // createAuditLog error path (line 565)
  // ==========================================================================

  describe('createAuditLog – error handling', () => {
    it('swallows audit log insert errors without throwing', async () => {
      // createNotification calls createAuditLog internally
      mockDb.tenantQuery
        .mockResolvedValueOnce([{ id: 99 }]) // INSERT notification RETURNING id
        .mockRejectedValueOnce(new Error('DB connection lost')); // audit log INSERT fails

      // Should NOT throw even though audit log failed
      const result = await service.createNotification(
        {
          type: 'info',
          title: 'Audit fail test',
          message: 'This should succeed despite audit failure',
          recipientType: 'all',
        } as never,
        1,
        1,
      );

      expect(result.notificationId).toBe(99);
    });
  });

  // ==========================================================================
  // updatePreferences
  // ==========================================================================

  describe('updatePreferences', () => {
    it('delegates to preferences sub-service and creates audit log', async () => {
      mockPreferences.upsertPreferences.mockResolvedValueOnce(undefined);
      mockDb.tenantQuery.mockResolvedValueOnce([]); // audit log INSERT

      await service.updatePreferences(5, 1, {
        emailNotifications: false,
        pushNotifications: true,
        smsNotifications: true,
        notificationTypes: { info: { email: true, push: true, sms: false } },
      });

      expect(mockPreferences.upsertPreferences).toHaveBeenCalledWith(
        5,
        1,
        false,
        true,
        true,
        JSON.stringify({
          info: { email: true, push: true, sms: false },
        }),
      );
      // Audit log should be called
      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(1);
    });

    it('uses defaults when dto fields are undefined', async () => {
      mockPreferences.upsertPreferences.mockResolvedValueOnce(undefined);
      mockDb.tenantQuery.mockResolvedValueOnce([]); // audit log

      await service.updatePreferences(5, 1, {} as never);

      expect(mockPreferences.upsertPreferences).toHaveBeenCalledWith(
        5,
        1,
        true, // emailNotifications default
        true, // pushNotifications default
        false, // smsNotifications default
        '{}', // notificationTypes default
      );
    });
  });

  // ==========================================================================
  // getPersonalStats – delegation
  // ==========================================================================

  describe('getPersonalStats – delegation', () => {
    it('delegates to statistics sub-service', async () => {
      const expected = { total: 10, unread: 3, byType: { info: 10 } };
      mockStatistics.getPersonalStats.mockResolvedValueOnce(expected);

      const result = await service.getPersonalStats(5, 1);

      expect(mockStatistics.getPersonalStats).toHaveBeenCalledWith(5, 1);
      expect(result).toBe(expected);
    });
  });

  // ==========================================================================
  // UUID-based methods
  // ==========================================================================

  describe('markAsReadByUuid', () => {
    it('resolves UUID then marks as read', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([{ id: 10 }]) // resolveNotificationIdByUuid
        .mockResolvedValueOnce([{ id: 10, tenant_id: 1 }]) // markAsRead SELECT
        .mockResolvedValueOnce([]); // markAsRead INSERT read status

      await service.markAsReadByUuid('some-uuid-v7', 5, 1);

      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(3);
    });

    it('throws NotFoundException if UUID does not exist', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]); // UUID not found

      await expect(service.markAsReadByUuid('nonexistent-uuid', 5, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteNotificationByUuid', () => {
    it('resolves UUID then deletes notification', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([{ id: 10 }]) // resolveNotificationIdByUuid
        .mockResolvedValueOnce([
          {
            id: 10,
            type: 'info',
            recipient_type: 'all',
            recipient_id: null,
            tenant_id: 1,
          },
        ]) // deleteNotification SELECT
        .mockResolvedValueOnce([]) // DELETE
        .mockResolvedValueOnce([]); // audit log

      await service.deleteNotificationByUuid('some-uuid-v7', 5, 1, 'admin');

      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(4);
    });

    it('throws NotFoundException if UUID does not exist', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([]); // UUID not found

      await expect(
        service.deleteNotificationByUuid('nonexistent-uuid', 5, 1, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==========================================================================
  // deleteNotification – additional branches
  // ==========================================================================

  describe('deleteNotification – additional branches', () => {
    it('allows root role to delete any notification', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([
          {
            id: 1,
            type: 'info',
            recipient_type: 'user',
            recipient_id: 99, // belongs to user 99
            tenant_id: 1,
          },
        ]) // SELECT
        .mockResolvedValueOnce([]) // DELETE
        .mockResolvedValueOnce([]); // audit log

      // root user (id=5) deleting user 99's notification — should succeed
      await service.deleteNotification(1, 5, 1, 'root');

      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(3);
    });

    it('allows owner to delete own notification', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([
          {
            id: 1,
            type: 'info',
            recipient_type: 'user',
            recipient_id: 5, // belongs to user 5
            tenant_id: 1,
          },
        ]) // SELECT
        .mockResolvedValueOnce([]) // DELETE
        .mockResolvedValueOnce([]); // audit log

      // user 5 deleting their own notification with employee role
      await service.deleteNotification(1, 5, 1, 'employee');

      expect(mockDb.tenantQuery).toHaveBeenCalledTimes(3);
    });

    it('throws when non-admin tries to delete department notification', async () => {
      mockDb.tenantQuery.mockResolvedValueOnce([
        {
          id: 1,
          type: 'info',
          recipient_type: 'department',
          recipient_id: 10,
          tenant_id: 1,
        },
      ]);

      await expect(service.deleteNotification(1, 5, 1, 'employee')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('passes ipAddress and userAgent to audit log', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([
          {
            id: 1,
            type: 'warning',
            recipient_type: 'all',
            recipient_id: null,
            tenant_id: 1,
          },
        ]) // SELECT
        .mockResolvedValueOnce([]) // DELETE
        .mockResolvedValueOnce([]); // audit log

      await service.deleteNotification(1, 5, 1, 'admin', '192.168.1.1', 'TestAgent/1.0');

      // Verify the audit log query has ipAddress and userAgent
      const auditCall = mockDb.tenantQuery.mock.calls[2];
      const auditParams = auditCall[1] as unknown[];
      expect(auditParams).toContain('192.168.1.1');
      expect(auditParams).toContain('TestAgent/1.0');
    });
  });

  // ==========================================================================
  // createNotification – additional branches
  // ==========================================================================

  describe('createNotification – additional branches', () => {
    it('passes optional fields (metadata, scheduledFor, etc.) to query', async () => {
      mockDb.tenantQuery
        .mockResolvedValueOnce([{ id: 77 }]) // INSERT
        .mockResolvedValueOnce([]); // audit log

      const result = await service.createNotification(
        {
          type: 'warning',
          title: 'Full DTO test',
          message: 'With all optional fields',
          recipientType: 'user',
          recipientId: 10,
          priority: 'high',
          actionUrl: '/some/action',
          actionLabel: 'Click here',
          metadata: { key: 'value' },
          scheduledFor: '2026-06-01T00:00:00Z',
        } as never,
        1,
        1,
        '10.0.0.1',
        'Mozilla/5.0',
      );

      expect(result.notificationId).toBe(77);
      const insertParams = mockDb.tenantQuery.mock.calls[0][1] as unknown[];
      expect(insertParams).toContain('high');
      expect(insertParams).toContain(10); // recipientId
      expect(insertParams).toContain('/some/action');
      expect(insertParams).toContain('Click here');
      expect(insertParams).toContain('{"key":"value"}');
      expect(insertParams).toContain('2026-06-01T00:00:00Z');
    });
  });
});
