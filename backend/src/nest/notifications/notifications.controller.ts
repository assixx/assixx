/**
 * Notifications Controller
 *
 * HTTP endpoints for notification management:
 * - GET    /notifications                    - List notifications
 * - POST   /notifications                    - Create notification (admin)
 * - GET    /notifications/preferences        - Get preferences
 * - PUT    /notifications/preferences        - Update preferences
 * - GET    /notifications/stats              - Get statistics (admin)
 * - GET    /notifications/stats/me           - Get personal stats
 * - POST   /notifications/subscribe          - Subscribe to push
 * - GET    /notifications/templates          - Get templates (admin)
 * - POST   /notifications/from-template      - Create from template (admin)
 * - PUT    /notifications/mark-all-read      - Mark all as read
 * - DELETE /notifications/subscribe/:id      - Unsubscribe
 * - PUT    /notifications/:id/read           - Mark as read
 * - DELETE /notifications/:id                - Delete notification
 * - GET    /notifications/stream             - SSE stream
 * - GET    /notifications/stream/stats       - SSE stats
 */
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable, Subject, interval, map, merge, takeUntil } from 'rxjs';

import { eventBus } from '../../utils/eventBus.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import type { NestAuthUser } from '../common/interfaces/auth.interface.js';
import {
  CreateFromTemplateDto,
  CreateNotificationDto,
  ListNotificationsQueryDto,
  SubscribeDto,
  SubscriptionIdParamDto,
  UpdatePreferencesDto,
} from './dto/index.js';
import type { PaginatedNotificationsResult } from './notifications.service.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Response type for message-only responses
 */
interface MessageResponse {
  message: string;
}

/**
 * SSE message data interface
 */
interface SSEMessageData {
  type: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * SSE notification event data
 */
interface NotificationEventData {
  tenantId: number;
  survey?: {
    id: number;
    title: string;
    deadline?: string;
  };
  document?: {
    id: number;
    filename: string;
    category: string;
  };
  kvp?: {
    id: number;
    title: string;
    submitted_by: string;
  };
  message?: {
    id: number;
    conversationId: number;
    senderId: number;
    recipientIds: number[];
    preview?: string;
  };
}

/**
 * Event handler registration
 */
interface EventHandler {
  event: string;
  handler: (data: NotificationEventData) => void;
}

/**
 * SSE Event constants to avoid string duplication
 */
const SSE_EVENTS = {
  SURVEY_CREATED: 'survey.created',
  SURVEY_UPDATED: 'survey.updated',
  DOCUMENT_UPLOADED: 'document.uploaded',
  KVP_SUBMITTED: 'kvp.submitted',
  MESSAGE_CREATED: 'message.created',
} as const;

/**
 * Create SSE event handler factory
 */
function createSSEHandler(
  messageType: string,
  dataKey: string,
  tenantId: number,
  eventSubject: Subject<{ data: SSEMessageData }>,
): (eventData: NotificationEventData) => void {
  return (eventData: NotificationEventData): void => {
    if (eventData.tenantId === tenantId) {
      const payload = eventData[dataKey as keyof NotificationEventData];
      if (payload !== undefined && typeof payload === 'object') {
        eventSubject.next({
          data: {
            type: messageType,
            [dataKey]: payload,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }
  };
}

/**
 * Create SSE message handler that checks if user is a recipient
 */
function createMessageHandler(
  userId: number,
  tenantId: number,
  eventSubject: Subject<{ data: SSEMessageData }>,
): (eventData: NotificationEventData) => void {
  return (eventData: NotificationEventData): void => {
    const { message } = eventData;
    if (eventData.tenantId !== tenantId || message === undefined) return;
    if (!message.recipientIds.includes(userId)) return;

    eventSubject.next({
      data: {
        type: 'NEW_MESSAGE',
        message: {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          preview: message.preview,
        },
        timestamp: new Date().toISOString(),
      },
    });
  };
}

/**
 * Register SSE handlers based on user role
 */
function registerSSEHandlers(
  role: string,
  tenantId: number,
  userId: number,
  eventSubject: Subject<{ data: SSEMessageData }>,
): EventHandler[] {
  const handlers: EventHandler[] = [];

  // Document notifications for all users
  const documentHandler = createSSEHandler('NEW_DOCUMENT', 'document', tenantId, eventSubject);
  eventBus.on(SSE_EVENTS.DOCUMENT_UPLOADED, documentHandler);
  handlers.push({ event: SSE_EVENTS.DOCUMENT_UPLOADED, handler: documentHandler });

  // Message notifications for all users (checks recipientIds inside handler)
  const messageHandler = createMessageHandler(userId, tenantId, eventSubject);
  eventBus.on(SSE_EVENTS.MESSAGE_CREATED, messageHandler);
  handlers.push({ event: SSE_EVENTS.MESSAGE_CREATED, handler: messageHandler });

  // Survey notifications for employees
  if (role === 'employee') {
    const surveyCreatedHandler = createSSEHandler('NEW_SURVEY', 'survey', tenantId, eventSubject);
    const surveyUpdatedHandler = createSSEHandler(
      'SURVEY_UPDATED',
      'survey',
      tenantId,
      eventSubject,
    );
    eventBus.on(SSE_EVENTS.SURVEY_CREATED, surveyCreatedHandler);
    eventBus.on(SSE_EVENTS.SURVEY_UPDATED, surveyUpdatedHandler);
    handlers.push({ event: SSE_EVENTS.SURVEY_CREATED, handler: surveyCreatedHandler });
    handlers.push({ event: SSE_EVENTS.SURVEY_UPDATED, handler: surveyUpdatedHandler });
  }

  // Admin notifications
  if (role === 'admin' || role === 'root') {
    const kvpHandler = createSSEHandler('NEW_KVP', 'kvp', tenantId, eventSubject);
    const adminSurveyHandler = createSSEHandler(
      'NEW_SURVEY_CREATED',
      'survey',
      tenantId,
      eventSubject,
    );
    eventBus.on(SSE_EVENTS.KVP_SUBMITTED, kvpHandler);
    eventBus.on(SSE_EVENTS.SURVEY_CREATED, adminSurveyHandler);
    handlers.push({ event: SSE_EVENTS.KVP_SUBMITTED, handler: kvpHandler });
    handlers.push({ event: SSE_EVENTS.SURVEY_CREATED, handler: adminSurveyHandler });
  }

  return handlers;
}

/**
 * Cleanup SSE handlers
 */
function cleanupSSEHandlers(handlers: EventHandler[]): void {
  handlers.forEach(({ event, handler }: EventHandler): void => {
    eventBus.off(event, handler);
  });
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications
   * List notifications for authenticated user
   */
  @Get()
  async listNotifications(
    @Query() query: ListNotificationsQueryDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<PaginatedNotificationsResult> {
    return await this.notificationsService.listNotifications(user.id, tenantId, {
      type: query.type,
      priority: query.priority,
      unread: query.unread,
      page: query.page,
      limit: query.limit,
    });
  }

  /**
   * POST /notifications
   * Create a new notification (admin only)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  async createNotification(
    @Body() dto: CreateNotificationDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<{ notificationId: number }> {
    return await this.notificationsService.createNotification(
      dto,
      user.id,
      tenantId,
      ipAddress,
      userAgent,
    );
  }

  /**
   * GET /notifications/preferences
   * Get notification preferences
   */
  @Get('preferences')
  async getPreferences(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ preferences: unknown }> {
    const preferences = await this.notificationsService.getPreferences(user.id, tenantId);
    return { preferences };
  }

  /**
   * PUT /notifications/preferences
   * Update notification preferences
   */
  @Put('preferences')
  async updatePreferences(
    @Body() dto: UpdatePreferencesDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<MessageResponse> {
    await this.notificationsService.updatePreferences(user.id, tenantId, dto, ipAddress, userAgent);
    return { message: 'Preferences updated successfully' };
  }

  /**
   * GET /notifications/stats
   * Get notification statistics (admin only)
   */
  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  async getStatistics(@TenantId() tenantId: number): Promise<unknown> {
    return await this.notificationsService.getStatistics(tenantId);
  }

  /**
   * GET /notifications/stats/me
   * Get personal notification statistics
   */
  @Get('stats/me')
  async getPersonalStats(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<unknown> {
    return await this.notificationsService.getPersonalStats(user.id, tenantId);
  }

  /**
   * POST /notifications/subscribe
   * Subscribe to push notifications
   */
  @Post('subscribe')
  subscribe(
    @Body() dto: SubscribeDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): { subscriptionId: string; message: string } {
    const result = this.notificationsService.subscribe(
      user.id,
      tenantId,
      dto.deviceToken,
      dto.platform,
    );
    return { ...result, message: 'Successfully subscribed to notifications' };
  }

  /**
   * GET /notifications/templates
   * Get notification templates (admin only)
   */
  @Get('templates')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  getTemplates(@TenantId() tenantId: number): { templates: unknown[] } {
    return this.notificationsService.getTemplates(tenantId);
  }

  /**
   * POST /notifications/from-template
   * Create notification from template (admin only)
   */
  @Post('from-template')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  createFromTemplate(
    @Body() dto: CreateFromTemplateDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): never {
    try {
      return this.notificationsService.createFromTemplate(
        dto.templateId,
        tenantId,
        user.id,
        dto.recipientType,
        dto.recipientId,
        dto.variables,
      );
    } catch {
      throw new NotFoundException('Template not found');
    }
  }

  /**
   * PUT /notifications/mark-all-read
   * Mark all notifications as read
   */
  @Put('mark-all-read')
  async markAllAsRead(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ updated: number }> {
    return await this.notificationsService.markAllAsRead(user.id, tenantId);
  }

  /**
   * DELETE /notifications/subscribe/:id
   * Unsubscribe from push notifications
   */
  @Delete('subscribe/:id')
  unsubscribe(
    @Param() params: SubscriptionIdParamDto,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): MessageResponse {
    this.notificationsService.unsubscribe(user.id, tenantId, params.id);
    return { message: 'Successfully unsubscribed from notifications' };
  }

  /**
   * PUT /notifications/uuid/:uuid/read
   * Mark notification as read by UUID (preferred)
   */
  @Put('uuid/:uuid/read')
  async markAsReadByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    await this.notificationsService.markAsReadByUuid(uuid, user.id, tenantId);
    return { message: 'Notification marked as read' };
  }

  /**
   * PUT /notifications/:id/read
   * Mark notification as read
   * @deprecated Use PUT /notifications/uuid/:uuid/read instead
   */
  @Put(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<MessageResponse> {
    const notificationId = Number.parseInt(id, 10);
    await this.notificationsService.markAsRead(notificationId, user.id, tenantId);
    return { message: 'Notification marked as read' };
  }

  /**
   * DELETE /notifications/uuid/:uuid
   * Delete notification by UUID (preferred)
   */
  @Delete('uuid/:uuid')
  async deleteNotificationByUuid(
    @Param('uuid') uuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<MessageResponse> {
    await this.notificationsService.deleteNotificationByUuid(
      uuid,
      user.id,
      tenantId,
      user.role,
      ipAddress,
      userAgent,
    );
    return { message: 'Notification deleted successfully' };
  }

  /**
   * DELETE /notifications/:id
   * Delete notification
   * @deprecated Use DELETE /notifications/uuid/:uuid instead
   */
  @Delete(':id')
  async deleteNotification(
    @Param('id') id: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<MessageResponse> {
    const notificationId = Number.parseInt(id, 10);
    await this.notificationsService.deleteNotification(
      notificationId,
      user.id,
      tenantId,
      user.role,
      ipAddress,
      userAgent,
    );
    return { message: 'Notification deleted successfully' };
  }

  /**
   * GET /notifications/stream
   * SSE stream for real-time notifications
   */
  @Sse('stream')
  stream(
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Observable<{ data: SSEMessageData }> {
    const { id: userId, role } = user;
    const destroy$ = new Subject<void>();
    const eventSubject = new Subject<{ data: SSEMessageData }>();

    // Initial message and heartbeat
    const initialMessage: SSEMessageData = {
      type: 'CONNECTED',
      timestamp: new Date().toISOString(),
      user: { id: userId, role, tenantId },
    };

    const heartbeat$ = interval(30000).pipe(
      takeUntil(destroy$),
      map((): { data: SSEMessageData } => ({
        data: { type: 'HEARTBEAT', timestamp: new Date().toISOString() },
      })),
    );

    // Register handlers and setup cleanup
    const handlers = registerSSEHandlers(role, tenantId, userId, eventSubject);
    eventSubject.pipe(takeUntil(destroy$)).subscribe({
      complete: (): void => {
        cleanupSSEHandlers(handlers);
      },
    });

    // Merge streams
    type SSESubscriber = import('rxjs').Subscriber<{ data: SSEMessageData }>;
    return merge(
      new Observable<{ data: SSEMessageData }>((subscriber: SSESubscriber) => {
        subscriber.next({ data: initialMessage });
        subscriber.complete();
      }),
      heartbeat$,
      eventSubject.pipe(takeUntil(destroy$)),
    );
  }

  /**
   * GET /notifications/stream/stats
   * Get SSE connection statistics
   */
  @Get('stream/stats')
  getStreamStats(@CurrentUser() user: NestAuthUser): {
    activeEvents: string[];
    listenerCounts: Record<string, number>;
    timestamp: string;
  } {
    // Check admin permission
    if (user.role !== 'admin' && user.role !== 'root') {
      throw new ForbiddenException('Only admins can view SSE statistics');
    }

    return {
      activeEvents: eventBus.getActiveEvents(),
      listenerCounts: {
        [SSE_EVENTS.SURVEY_CREATED]: eventBus.getListenerCount(SSE_EVENTS.SURVEY_CREATED),
        [SSE_EVENTS.SURVEY_UPDATED]: eventBus.getListenerCount(SSE_EVENTS.SURVEY_UPDATED),
        [SSE_EVENTS.DOCUMENT_UPLOADED]: eventBus.getListenerCount(SSE_EVENTS.DOCUMENT_UPLOADED),
        [SSE_EVENTS.KVP_SUBMITTED]: eventBus.getListenerCount(SSE_EVENTS.KVP_SUBMITTED),
        [SSE_EVENTS.MESSAGE_CREATED]: eventBus.getListenerCount(SSE_EVENTS.MESSAGE_CREATED),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
