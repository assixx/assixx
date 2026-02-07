/**
 * Dashboard Service
 *
 * Aggregates data from multiple services for the dashboard.
 * Executes all count queries in parallel for optimal performance.
 *
 * Performance optimization: Instead of 5 HTTP requests from the frontend,
 * this service executes all queries server-side in parallel, reducing
 * network latency from ~150ms (5 parallel requests) to ~50ms (1 request).
 */
import { Injectable, Logger } from '@nestjs/common';

import { BlackboardService } from '../blackboard/blackboard.service.js';
import { CalendarService } from '../calendar/calendar.service.js';
import { ChatService } from '../chat/chat.service.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import { DocumentsService } from '../documents/documents.service.js';
import { KvpService } from '../kvp/kvp.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SurveysService } from '../surveys/surveys.service.js';
import { UserPermissionsService } from '../user-permissions/user-permissions.service.js';
import type {
  ChatCounts,
  DashboardCounts,
  NotificationStats,
} from './dto/dashboard-counts.dto.js';

/** Fallback for chat counts on error */
const EMPTY_CHAT: ChatCounts = { totalUnread: 0, conversations: [] };

/** Fallback for notification stats on error */
const EMPTY_NOTIFICATIONS: NotificationStats = {
  total: 0,
  unread: 0,
  byType: {},
};

/** Fallback for simple counts on error */
const EMPTY_COUNT = { count: 0 };

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly notificationsService: NotificationsService,
    private readonly blackboardService: BlackboardService,
    private readonly calendarService: CalendarService,
    private readonly documentsService: DocumentsService,
    private readonly kvpService: KvpService,
    private readonly surveysService: SurveysService,
    private readonly permissionsService: UserPermissionsService,
  ) {}

  /**
   * Get all dashboard counts in a single request.
   *
   * Executes all count queries in parallel for optimal performance.
   * This replaces 5 separate API calls from the frontend.
   *
   * Permission-aware (ADR-020): Counts are only fetched for features
   * the user has read permission for. No permission = count 0.
   * Root and admin with fullAccess bypass this check.
   *
   * @param user - Current authenticated user
   * @param tenantId - Current tenant ID
   * @returns Combined counts from all services
   */
  async getCounts(
    user: NestAuthUser,
    tenantId: number,
  ): Promise<DashboardCounts> {
    // Determine which features the user can access (ADR-020)
    const canAccess = await this.buildFeatureAccessCheck(user);

    // Execute count queries in parallel — skip features without permission
    const [chat, notifications, blackboard, calendar, documents, kvp, surveys] =
      await this.fetchAllCounts(user, tenantId, canAccess);

    return {
      chat,
      notifications,
      blackboard,
      calendar,
      documents,
      kvp,
      surveys,
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Execute all count queries in parallel.
   * Skips queries for features the user cannot access (ADR-020).
   */
  private async fetchAllCounts(
    user: NestAuthUser,
    tenantId: number,
    canAccess: (featureCode: string) => boolean,
  ): Promise<
    [
      ChatCounts,
      NotificationStats,
      { count: number },
      { count: number },
      { count: number },
      { count: number },
      { count: number },
    ]
  > {
    return await Promise.all([
      canAccess('chat') ?
        this.fetchChatCounts().catch((err: unknown) => {
          this.logger.warn(`Chat counts failed: ${String(err)}`);
          return EMPTY_CHAT;
        })
      : Promise.resolve(EMPTY_CHAT),
      this.fetchNotificationStats(user.id, tenantId).catch((err: unknown) => {
        this.logger.warn(`Notification stats failed: ${String(err)}`);
        return EMPTY_NOTIFICATIONS;
      }),
      canAccess('blackboard') ?
        this.fetchBlackboardCount(user.id, tenantId).catch((err: unknown) => {
          this.logger.warn(`Blackboard count failed: ${String(err)}`);
          return EMPTY_COUNT;
        })
      : Promise.resolve(EMPTY_COUNT),
      canAccess('calendar') ?
        this.fetchCalendarCount(user, tenantId).catch((err: unknown) => {
          this.logger.warn(`Calendar count failed: ${String(err)}`);
          return EMPTY_COUNT;
        })
      : Promise.resolve(EMPTY_COUNT),
      canAccess('documents') ?
        this.fetchDocumentsCount(user, tenantId).catch((err: unknown) => {
          this.logger.warn(`Documents count failed: ${String(err)}`);
          return EMPTY_COUNT;
        })
      : Promise.resolve(EMPTY_COUNT),
      canAccess('kvp') ?
        this.fetchKvpCount(user.id, tenantId).catch((err: unknown) => {
          this.logger.warn(`KVP count failed: ${String(err)}`);
          return EMPTY_COUNT;
        })
      : Promise.resolve(EMPTY_COUNT),
      canAccess('surveys') ?
        this.fetchSurveyPendingCount(user.id, tenantId).catch(
          (err: unknown) => {
            this.logger.warn(`Survey count failed: ${String(err)}`);
            return EMPTY_COUNT;
          },
        )
      : Promise.resolve(EMPTY_COUNT),
    ]);
  }

  /**
   * Build a feature access check function for the current user.
   * Root and admin with fullAccess bypass — all features accessible.
   * Others: only features with at least one can_read = true module.
   */
  private async buildFeatureAccessCheck(
    user: NestAuthUser,
  ): Promise<(featureCode: string) => boolean> {
    // Root always has full access
    if (user.activeRole === 'root') {
      return () => true;
    }

    // Admin with full access bypasses permission checks
    if (user.activeRole === 'admin' && user.hasFullAccess) {
      return () => true;
    }

    // Query readable feature codes from DB (ADR-020)
    const readable = await this.permissionsService.getReadableFeatureCodes(
      user.id,
    );

    return (featureCode: string) => readable.has(featureCode);
  }

  /**
   * Fetch chat unread counts
   * Converts null conversationName to empty string for type safety
   */
  private async fetchChatCounts(): Promise<ChatCounts> {
    const result = await this.chatService.getUnreadCount();
    return {
      totalUnread: result.totalUnread,
      conversations: result.conversations.map(
        (conv: {
          conversationId: number;
          conversationName: string | null;
          unreadCount: number;
        }) => ({
          conversationId: conv.conversationId,
          conversationName: conv.conversationName ?? '',
          unreadCount: conv.unreadCount,
        }),
      ),
    };
  }

  /**
   * Fetch notification stats
   */
  private async fetchNotificationStats(
    userId: number,
    tenantId: number,
  ): Promise<NotificationStats> {
    const stats = await this.notificationsService.getPersonalStats(
      userId,
      tenantId,
    );
    return {
      total: stats.total,
      unread: stats.unread,
      byType: stats.byType,
    };
  }

  /**
   * Fetch blackboard unconfirmed count
   */
  private async fetchBlackboardCount(
    userId: number,
    tenantId: number,
  ): Promise<{ count: number }> {
    return await this.blackboardService.getUnconfirmedCount(userId, tenantId);
  }

  /**
   * Fetch calendar upcoming events count
   */
  private async fetchCalendarCount(
    user: NestAuthUser,
    tenantId: number,
  ): Promise<{ count: number }> {
    const departmentId = user.departmentId ?? 0;
    const teamId = user.teamId ?? 0;
    return await this.calendarService.getUpcomingCount(
      tenantId,
      user.id,
      departmentId,
      teamId,
    );
  }

  /**
   * Fetch documents unread count
   */
  private async fetchDocumentsCount(
    user: NestAuthUser,
    tenantId: number,
  ): Promise<{ count: number }> {
    return await this.documentsService.getUnreadCount(
      tenantId,
      user.id,
      user.activeRole,
    );
  }

  /**
   * Fetch KVP unconfirmed count (Pattern 2: Individual read tracking)
   */
  private async fetchKvpCount(
    userId: number,
    tenantId: number,
  ): Promise<{ count: number }> {
    return await this.kvpService.getUnconfirmedCount(userId, tenantId);
  }

  /**
   * Fetch pending survey count (active surveys not yet responded to by user)
   */
  private async fetchSurveyPendingCount(
    userId: number,
    tenantId: number,
  ): Promise<{ count: number }> {
    return await this.surveysService.getPendingSurveyCount(userId, tenantId);
  }
}
