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
import type {
  ChatCounts,
  DashboardCounts,
  DashboardCountsResponse,
  NotificationStats,
} from './dto/dashboard-counts.dto.js';

/** Fallback for chat counts on error */
const EMPTY_CHAT: ChatCounts = { totalUnread: 0, conversations: [] };

/** Fallback for notification stats on error */
const EMPTY_NOTIFICATIONS: NotificationStats = { total: 0, unread: 0, byType: {} };

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
  ) {}

  /**
   * Get all dashboard counts in a single request
   *
   * Executes all count queries in parallel for optimal performance.
   * This replaces 5 separate API calls from the frontend.
   *
   * @param user - Current authenticated user
   * @param tenantId - Current tenant ID
   * @returns Combined counts from all services
   */
  async getCounts(user: NestAuthUser, tenantId: number): Promise<DashboardCountsResponse> {
    // Execute all count queries in parallel
    const [
      chatResult,
      notificationsResult,
      blackboardResult,
      calendarResult,
      documentsResult,
      kvpResult,
    ] = await Promise.all([
      this.fetchChatCounts().catch((err: unknown) => {
        this.logger.warn(`Chat counts failed: ${String(err)}`);
        return EMPTY_CHAT;
      }),
      this.fetchNotificationStats(user.id, tenantId).catch((err: unknown) => {
        this.logger.warn(`Notification stats failed: ${String(err)}`);
        return EMPTY_NOTIFICATIONS;
      }),
      this.fetchBlackboardCount(user.id, tenantId).catch((err: unknown) => {
        this.logger.warn(`Blackboard count failed: ${String(err)}`);
        return EMPTY_COUNT;
      }),
      this.fetchCalendarCount(user, tenantId).catch((err: unknown) => {
        this.logger.warn(`Calendar count failed: ${String(err)}`);
        return EMPTY_COUNT;
      }),
      this.fetchDocumentsCount(user, tenantId).catch((err: unknown) => {
        this.logger.warn(`Documents count failed: ${String(err)}`);
        return EMPTY_COUNT;
      }),
      this.fetchKvpCount(user.id, tenantId).catch((err: unknown) => {
        this.logger.warn(`KVP count failed: ${String(err)}`);
        return EMPTY_COUNT;
      }),
    ]);

    const data: DashboardCounts = {
      chat: chatResult,
      notifications: notificationsResult,
      blackboard: blackboardResult,
      calendar: calendarResult,
      documents: documentsResult,
      kvp: kvpResult,
      fetchedAt: new Date().toISOString(),
    };

    return { success: true, data };
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
    const stats = await this.notificationsService.getPersonalStats(userId, tenantId);
    return {
      total: stats.total,
      unread: stats.unread,
      byType: stats.byType,
    };
  }

  /**
   * Fetch blackboard unconfirmed count
   */
  private async fetchBlackboardCount(userId: number, tenantId: number): Promise<{ count: number }> {
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
    return await this.calendarService.getUpcomingCount(tenantId, user.id, departmentId, teamId);
  }

  /**
   * Fetch documents unread count
   */
  private async fetchDocumentsCount(
    user: NestAuthUser,
    tenantId: number,
  ): Promise<{ count: number }> {
    return await this.documentsService.getUnreadCount(tenantId, user.id, user.activeRole);
  }

  /**
   * Fetch KVP unconfirmed count (Pattern 2: Individual read tracking)
   */
  private async fetchKvpCount(userId: number, tenantId: number): Promise<{ count: number }> {
    return await this.kvpService.getUnconfirmedCount(userId, tenantId);
  }
}
