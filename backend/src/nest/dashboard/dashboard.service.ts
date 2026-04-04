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
import { DatabaseService } from '../database/database.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { KvpService } from '../kvp/kvp.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SurveysService } from '../surveys/surveys.service.js';
import { UserPermissionsService } from '../user-permissions/user-permissions.service.js';
import type {
  ChatCounts,
  CountItem,
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

/** Return type for fetchAllCounts — fixed-length tuple for safe destructuring */
type AllCounts = [
  ChatCounts,
  NotificationStats,
  CountItem,
  CountItem,
  CountItem,
  CountItem,
  CountItem,
  CountItem,
  CountItem,
  CountItem,
  CountItem,
];

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly notificationsService: NotificationsService,
    private readonly blackboardService: BlackboardService,
    private readonly calendarService: CalendarService,
    private readonly db: DatabaseService,
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
   * Permission-aware (ADR-020): Counts are only fetched for addons
   * the user has read permission for. No permission = count 0.
   * Root and admin with fullAccess bypass this check.
   */
  async getCounts(user: NestAuthUser, tenantId: number): Promise<DashboardCounts> {
    // Determine which addons the user can access (ADR-020)
    const canAccess = await this.buildAddonAccessCheck(user);

    // Execute count queries in parallel — skip addons without permission
    const [
      chat,
      notifications,
      blackboard,
      calendar,
      documents,
      kvp,
      surveys,
      vacation,
      tpm,
      workOrders,
      shiftSwap,
    ] = await this.fetchAllCounts(user, tenantId, canAccess);

    return {
      chat,
      notifications,
      blackboard,
      calendar,
      documents,
      kvp,
      surveys,
      vacation,
      tpm,
      workOrders,
      shiftSwap,
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Create a guarded fetcher that skips addons without permission.
   * Returns a function that catches errors and returns the fallback.
   */
  private createGuard(
    canAccess: (code: string) => boolean,
  ): <T>(addon: string | null, fetcher: () => Promise<T>, fallback: T) => Promise<T> {
    return <T>(addon: string | null, fetcher: () => Promise<T>, fallback: T): Promise<T> => {
      if (addon !== null && !canAccess(addon)) {
        return Promise.resolve(fallback);
      }
      return fetcher().catch((err: unknown) => {
        this.logger.warn(`${addon ?? 'global'} count failed: ${String(err)}`);
        return fallback;
      });
    };
  }

  /**
   * Execute all count queries in parallel.
   * Skips queries for addons the user cannot access (ADR-020).
   */
  private async fetchAllCounts(
    user: NestAuthUser,
    tenantId: number,
    canAccess: (addonCode: string) => boolean,
  ): Promise<AllCounts> {
    const g = this.createGuard(canAccess);
    const uid: number = user.id;
    return await Promise.all([
      g('chat', () => this.fetchChatCounts(), EMPTY_CHAT),
      g(null, () => this.fetchNotificationStats(uid, tenantId), EMPTY_NOTIFICATIONS),
      g('blackboard', () => this.fetchBlackboardCount(uid, tenantId), EMPTY_COUNT),
      g('calendar', () => this.fetchCalendarCount(user, tenantId), EMPTY_COUNT),
      g('documents', () => this.fetchDocumentsCount(user, tenantId), EMPTY_COUNT),
      g('kvp', () => this.fetchKvpCount(uid, tenantId), EMPTY_COUNT),
      g('surveys', () => this.fetchSurveyPendingCount(uid, tenantId), EMPTY_COUNT),
      g(null, () => this.fetchVacationCount(uid, tenantId), EMPTY_COUNT),
      g('tpm', () => this.fetchTpmCount(uid, tenantId), EMPTY_COUNT),
      g('work_orders', () => this.fetchWorkOrdersCount(uid, tenantId), EMPTY_COUNT),
      g('shift_planning', () => this.fetchShiftSwapCount(uid, tenantId), EMPTY_COUNT),
    ]);
  }

  /**
   * Build an addon access check function for the current user.
   * Root and admin with fullAccess bypass — all addons accessible.
   * Others: only addons with at least one can_read = true module.
   */
  private async buildAddonAccessCheck(user: NestAuthUser): Promise<(addonCode: string) => boolean> {
    // Root always has full access
    if (user.activeRole === 'root') {
      return () => true;
    }

    // Admin with full access bypasses permission checks
    if (user.activeRole === 'admin' && user.hasFullAccess) {
      return () => true;
    }

    // Query readable addon codes from DB (ADR-020)
    const readable = await this.permissionsService.getReadableAddonCodes(user.id);

    return (addonCode: string) => readable.has(addonCode);
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

  /**
   * Fetch pending survey count (active surveys not yet responded to by user)
   */
  private async fetchSurveyPendingCount(
    userId: number,
    tenantId: number,
  ): Promise<{ count: number }> {
    return await this.surveysService.getPendingSurveyCount(userId, tenantId);
  }

  /**
   * Fetch unread vacation notification count.
   * Counts notifications of type='vacation' targeted at the user
   * that have no entry in notification_read_status.
   * No permission gating — every user can have vacation notifications.
   */
  private async fetchVacationCount(userId: number, tenantId: number): Promise<{ count: number }> {
    const rows = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM notifications n
       LEFT JOIN notification_read_status nrs
         ON n.id = nrs.notification_id AND nrs.user_id = $2
       WHERE n.tenant_id = $1
         AND n.type = 'vacation'
         AND n.recipient_type = 'user'
         AND n.recipient_id = $2
         AND nrs.id IS NULL`,
      [tenantId, userId],
    );
    return { count: Number.parseInt(rows[0]?.count ?? '0', 10) };
  }

  /**
   * Fetch unread TPM notification count.
   * Counts notifications of type='tpm' targeted at the user
   * that have no entry in notification_read_status.
   */
  private async fetchTpmCount(userId: number, tenantId: number): Promise<{ count: number }> {
    const rows = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM notifications n
       LEFT JOIN notification_read_status nrs
         ON n.id = nrs.notification_id AND nrs.user_id = $2
       WHERE n.tenant_id = $1
         AND n.type = 'tpm'
         AND n.recipient_type = 'user'
         AND n.recipient_id = $2
         AND nrs.id IS NULL`,
      [tenantId, userId],
    );
    return { count: Number.parseInt(rows[0]?.count ?? '0', 10) };
  }

  /**
   * Fetch unread work order notification count.
   * Counts notifications of type='work_orders' targeted at the user
   * that have no entry in notification_read_status.
   */
  private async fetchWorkOrdersCount(userId: number, tenantId: number): Promise<{ count: number }> {
    const rows = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM notifications n
       LEFT JOIN notification_read_status nrs
         ON n.id = nrs.notification_id AND nrs.user_id = $2
       WHERE n.tenant_id = $1
         AND n.type = 'work_orders'
         AND n.recipient_type = 'user'
         AND n.recipient_id = $2
         AND nrs.id IS NULL`,
      [tenantId, userId],
    );
    return { count: Number.parseInt(rows[0]?.count ?? '0', 10) };
  }

  /**
   * Fetch pending shift swap consent count.
   * Counts swap requests where the user is the target and status is pending_partner.
   */
  private async fetchShiftSwapCount(userId: number, tenantId: number): Promise<{ count: number }> {
    const rows = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM shift_swap_requests
       WHERE tenant_id = $1
         AND target_id = $2
         AND status = 'pending_partner'
         AND is_active = 1`,
      [tenantId, userId],
    );
    return { count: Number.parseInt(rows[0]?.count ?? '0', 10) };
  }
}
