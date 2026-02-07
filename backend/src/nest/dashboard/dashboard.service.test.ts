/**
 * Unit tests for DashboardService
 *
 * Phase 11: Service tests — mocked dependencies.
 * Focus: Parallel aggregation from 7 sub-services,
 *        graceful error handling (catch → fallback values).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BlackboardService } from '../blackboard/blackboard.service.js';
import type { CalendarService } from '../calendar/calendar.service.js';
import type { ChatService } from '../chat/chat.service.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import type { DocumentsService } from '../documents/documents.service.js';
import type { KvpService } from '../kvp/kvp.service.js';
import type { NotificationsService } from '../notifications/notifications.service.js';
import type { SurveysService } from '../surveys/surveys.service.js';
import type { UserPermissionsService } from '../user-permissions/user-permissions.service.js';
import { DashboardService } from './dashboard.service.js';

// =============================================================
// Mock factories
// =============================================================

function createMockChatService() {
  return {
    getUnreadCount: vi.fn().mockResolvedValue({
      totalUnread: 3,
      conversations: [
        { conversationId: 1, conversationName: 'General', unreadCount: 3 },
      ],
    }),
  };
}

function createMockNotificationsService() {
  return {
    getPersonalStats: vi.fn().mockResolvedValue({
      total: 10,
      unread: 2,
      byType: { info: 5, warning: 5 },
    }),
  };
}

function createMockBlackboardService() {
  return {
    getUnconfirmedCount: vi.fn().mockResolvedValue({ count: 4 }),
  };
}

function createMockCalendarService() {
  return {
    getUpcomingCount: vi.fn().mockResolvedValue({ count: 7 }),
  };
}

function createMockDocumentsService() {
  return {
    getUnreadCount: vi.fn().mockResolvedValue({ count: 1 }),
  };
}

function createMockKvpService() {
  return {
    getUnconfirmedCount: vi.fn().mockResolvedValue({ count: 2 }),
  };
}

function createMockSurveysService() {
  return {
    getPendingSurveyCount: vi.fn().mockResolvedValue({ count: 3 }),
  };
}

/**
 * Mock UserPermissionsService (ADR-020).
 * Default: returns all feature codes as readable (full access).
 */
function createMockPermissionsService() {
  return {
    getReadableFeatureCodes: vi
      .fn()
      .mockResolvedValue(
        new Set([
          'blackboard',
          'calendar',
          'chat',
          'documents',
          'kvp',
          'surveys',
        ]),
      ),
    hasPermission: vi.fn().mockResolvedValue(true),
  };
}

function makeUser(overrides?: Partial<NestAuthUser>): NestAuthUser {
  return {
    id: 5,
    tenantId: 10,
    role: 'employee',
    email: 'user@test.com',
    activeRole: 'employee',
    hasFullAccess: false,
    departmentId: 3,
    teamId: 7,
    ...overrides,
  } as NestAuthUser;
}

// =============================================================
// DashboardService
// =============================================================

describe('DashboardService', () => {
  let service: DashboardService;
  let mockChat: ReturnType<typeof createMockChatService>;
  let mockNotifications: ReturnType<typeof createMockNotificationsService>;
  let mockBlackboard: ReturnType<typeof createMockBlackboardService>;
  let mockCalendar: ReturnType<typeof createMockCalendarService>;
  let mockDocuments: ReturnType<typeof createMockDocumentsService>;
  let mockKvp: ReturnType<typeof createMockKvpService>;
  let mockSurveys: ReturnType<typeof createMockSurveysService>;
  let mockPermissions: ReturnType<typeof createMockPermissionsService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChat = createMockChatService();
    mockNotifications = createMockNotificationsService();
    mockBlackboard = createMockBlackboardService();
    mockCalendar = createMockCalendarService();
    mockDocuments = createMockDocumentsService();
    mockKvp = createMockKvpService();
    mockSurveys = createMockSurveysService();
    mockPermissions = createMockPermissionsService();
    service = new DashboardService(
      mockChat as unknown as ChatService,
      mockNotifications as unknown as NotificationsService,
      mockBlackboard as unknown as BlackboardService,
      mockCalendar as unknown as CalendarService,
      mockDocuments as unknown as DocumentsService,
      mockKvp as unknown as KvpService,
      mockSurveys as unknown as SurveysService,
      mockPermissions as unknown as UserPermissionsService,
    );
  });

  // =============================================================
  // getCounts — all services succeed
  // =============================================================

  describe('getCounts', () => {
    it('should aggregate counts from all services', async () => {
      const result = await service.getCounts(makeUser(), 10);

      expect(result.chat.totalUnread).toBe(3);
      expect(result.notifications.total).toBe(10);
      expect(result.notifications.unread).toBe(2);
      expect(result.blackboard.count).toBe(4);
      expect(result.calendar.count).toBe(7);
      expect(result.documents.count).toBe(1);
      expect(result.kvp.count).toBe(2);
      expect(result.surveys.count).toBe(3);
      expect(result.fetchedAt).toBeDefined();
    });
  });

  // =============================================================
  // getCounts — permission filtering (ADR-020)
  // =============================================================

  describe('getCounts — permission filtering', () => {
    it('should return 0 counts for features without permission', async () => {
      // Employee only has blackboard + chat readable
      mockPermissions.getReadableFeatureCodes.mockResolvedValue(
        new Set(['blackboard', 'chat']),
      );

      const result = await service.getCounts(makeUser(), 10);

      // Features WITH permission: normal counts
      expect(result.blackboard.count).toBe(4);
      expect(result.chat.totalUnread).toBe(3);

      // Features WITHOUT permission: 0
      expect(result.calendar.count).toBe(0);
      expect(result.documents.count).toBe(0);
      expect(result.kvp.count).toBe(0);
      expect(result.surveys.count).toBe(0);

      // Notifications always fetched (system-level)
      expect(result.notifications.total).toBe(10);
    });

    it('should skip all feature count queries when no permissions', async () => {
      mockPermissions.getReadableFeatureCodes.mockResolvedValue(new Set());

      const result = await service.getCounts(makeUser(), 10);

      expect(result.chat.totalUnread).toBe(0);
      expect(result.blackboard.count).toBe(0);
      expect(result.calendar.count).toBe(0);
      expect(result.documents.count).toBe(0);
      expect(result.kvp.count).toBe(0);
      expect(result.surveys.count).toBe(0);

      // Service methods NOT called for forbidden features
      expect(mockChat.getUnreadCount).not.toHaveBeenCalled();
      expect(mockBlackboard.getUnconfirmedCount).not.toHaveBeenCalled();
    });

    it('should bypass permission check for root user', async () => {
      const rootUser = makeUser({ activeRole: 'root' });

      const result = await service.getCounts(rootUser, 10);

      // All counts returned (root bypasses permission check)
      expect(result.blackboard.count).toBe(4);
      expect(result.chat.totalUnread).toBe(3);
      expect(result.calendar.count).toBe(7);

      // Permission service NOT called for root
      expect(mockPermissions.getReadableFeatureCodes).not.toHaveBeenCalled();
    });

    it('should bypass permission check for admin with fullAccess', async () => {
      const adminUser = makeUser({
        activeRole: 'admin',
        hasFullAccess: true,
      });

      const result = await service.getCounts(adminUser, 10);

      expect(result.blackboard.count).toBe(4);
      expect(mockPermissions.getReadableFeatureCodes).not.toHaveBeenCalled();
    });

    it('should check permissions for admin without fullAccess', async () => {
      const adminNoFull = makeUser({
        activeRole: 'admin',
        hasFullAccess: false,
      });
      mockPermissions.getReadableFeatureCodes.mockResolvedValue(
        new Set(['blackboard']),
      );

      const result = await service.getCounts(adminNoFull, 10);

      expect(result.blackboard.count).toBe(4);
      expect(result.kvp.count).toBe(0);
      expect(mockPermissions.getReadableFeatureCodes).toHaveBeenCalledWith(
        adminNoFull.id,
      );
    });
  });

  // =============================================================
  // getCounts — graceful error handling
  // =============================================================

  describe('getCounts — error fallback', () => {
    it('should use fallback when chat fails', async () => {
      mockChat.getUnreadCount.mockRejectedValueOnce(new Error('Chat down'));

      const result = await service.getCounts(makeUser(), 10);

      expect(result.chat.totalUnread).toBe(0);
      expect(result.chat.conversations).toEqual([]);
    });

    it('should use fallback when notifications fail', async () => {
      mockNotifications.getPersonalStats.mockRejectedValueOnce(
        new Error('Notifications down'),
      );

      const result = await service.getCounts(makeUser(), 10);

      expect(result.notifications.total).toBe(0);
      expect(result.notifications.unread).toBe(0);
    });

    it('should use fallback when blackboard fails', async () => {
      mockBlackboard.getUnconfirmedCount.mockRejectedValueOnce(
        new Error('BB down'),
      );

      const result = await service.getCounts(makeUser(), 10);

      expect(result.blackboard.count).toBe(0);
    });
  });
});
