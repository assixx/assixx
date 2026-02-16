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
 * - PUT    /notifications/mark-all-read      - Mark all as read
 * - PUT    /notifications/:id/read           - Mark as read
 * - DELETE /notifications/:id                - Delete notification
 * - GET    /notifications/stream             - SSE stream
 * - GET    /notifications/stream/stats       - SSE stats
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
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
import { UserPermissionsService } from '../user-permissions/user-permissions.service.js';
import {
  CreateNotificationDto,
  ListNotificationsQueryDto,
  UpdatePreferencesDto,
} from './dto/index.js';
import { NotificationsService } from './notifications.service.js';
import type { PaginatedNotificationsResult } from './notifications.types.js';

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
  request?: {
    id: string;
    requesterId: number;
    approverId: number | null;
    startDate: string;
    endDate: string;
    vacationType: string;
    status: string;
    computedDays: number;
    requesterName?: string | undefined;
    approverName?: string | undefined;
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
  VACATION_REQUEST_CREATED: 'vacation.request.created',
  VACATION_REQUEST_RESPONDED: 'vacation.request.responded',
  VACATION_REQUEST_WITHDRAWN: 'vacation.request.withdrawn',
  VACATION_REQUEST_CANCELLED: 'vacation.request.cancelled',
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
 * Create SSE vacation handler that only sends to the intended recipient.
 *
 * Recipient logic per event type:
 * - CREATED / WITHDRAWN → approverId (the person who needs to act)
 * - RESPONDED / CANCELLED → requesterId (the person who submitted the request)
 *
 * This prevents the requester from seeing their own badge increment when
 * they create a request — matching the persistent notification targeting.
 */
function createVacationHandler(
  messageType: string,
  userId: number,
  tenantId: number,
  eventSubject: Subject<{ data: SSEMessageData }>,
): (eventData: NotificationEventData) => void {
  /** Event types where the requester is the recipient (not the actor) */
  const REQUESTER_IS_RECIPIENT = new Set([
    'VACATION_REQUEST_RESPONDED',
    'VACATION_REQUEST_CANCELLED',
  ]);

  return (eventData: NotificationEventData): void => {
    const { request } = eventData;
    if (eventData.tenantId !== tenantId || request === undefined) return;

    const recipientId =
      REQUESTER_IS_RECIPIENT.has(messageType) ?
        request.requesterId
      : request.approverId;

    if (recipientId !== userId) return;

    eventSubject.next({
      data: {
        type: messageType,
        request: {
          id: request.id,
          requesterId: request.requesterId,
          approverId: request.approverId,
          startDate: request.startDate,
          endDate: request.endDate,
          vacationType: request.vacationType,
          status: request.status,
          computedDays: request.computedDays,
          requesterName: request.requesterName,
          approverName: request.approverName,
        },
        timestamp: new Date().toISOString(),
      },
    });
  };
}

/** Register a handler on eventBus and track it for cleanup */
function registerHandler(
  handlers: EventHandler[],
  event: string,
  handler: (eventData: NotificationEventData) => void,
): void {
  eventBus.on(event, handler);
  handlers.push({ event, handler });
}

/** Register vacation-related SSE event handlers with recipient filtering */
function registerVacationHandlers(
  handlers: EventHandler[],
  userId: number,
  tenantId: number,
  eventSubject: Subject<{ data: SSEMessageData }>,
): void {
  const vacationEvents = [
    {
      event: SSE_EVENTS.VACATION_REQUEST_CREATED,
      type: 'VACATION_REQUEST_CREATED',
    },
    {
      event: SSE_EVENTS.VACATION_REQUEST_RESPONDED,
      type: 'VACATION_REQUEST_RESPONDED',
    },
    {
      event: SSE_EVENTS.VACATION_REQUEST_WITHDRAWN,
      type: 'VACATION_REQUEST_WITHDRAWN',
    },
    {
      event: SSE_EVENTS.VACATION_REQUEST_CANCELLED,
      type: 'VACATION_REQUEST_CANCELLED',
    },
  ] as const;

  for (const { event, type } of vacationEvents) {
    registerHandler(
      handlers,
      event,
      createVacationHandler(type, userId, tenantId, eventSubject),
    );
  }
}

/**
 * Register SSE handlers based on user role AND feature permissions (ADR-020).
 * Only registers handlers for features the user has read access to.
 * Root and admin with fullAccess: readableFeatures is null → all features.
 */
function registerSSEHandlers(
  role: string,
  tenantId: number,
  userId: number,
  eventSubject: Subject<{ data: SSEMessageData }>,
  readableFeatures: Set<string> | null,
): EventHandler[] {
  const handlers: EventHandler[] = [];
  const make = (
    type: string,
    key: string,
  ): ((e: NotificationEventData) => void) =>
    createSSEHandler(type, key, tenantId, eventSubject);
  const canAccess = (code: string): boolean =>
    readableFeatures === null || readableFeatures.has(code);

  if (canAccess('documents')) {
    registerHandler(
      handlers,
      SSE_EVENTS.DOCUMENT_UPLOADED,
      make('NEW_DOCUMENT', 'document'),
    );
  }
  if (canAccess('chat')) {
    registerHandler(
      handlers,
      SSE_EVENTS.MESSAGE_CREATED,
      createMessageHandler(userId, tenantId, eventSubject),
    );
  }
  if (role === 'employee' && canAccess('surveys')) {
    registerHandler(
      handlers,
      SSE_EVENTS.SURVEY_CREATED,
      make('NEW_SURVEY', 'survey'),
    );
    registerHandler(
      handlers,
      SSE_EVENTS.SURVEY_UPDATED,
      make('SURVEY_UPDATED', 'survey'),
    );
  }
  if (canAccess('vacation')) {
    registerVacationHandlers(handlers, userId, tenantId, eventSubject);
  }
  if ((role === 'admin' || role === 'root') && canAccess('kvp')) {
    registerHandler(handlers, SSE_EVENTS.KVP_SUBMITTED, make('NEW_KVP', 'kvp'));
  }
  if ((role === 'admin' || role === 'root') && canAccess('surveys')) {
    registerHandler(
      handlers,
      SSE_EVENTS.SURVEY_CREATED,
      make('NEW_SURVEY_CREATED', 'survey'),
    );
  }

  return handlers;
}

function cleanupSSEHandlers(handlers: EventHandler[]): void {
  handlers.forEach(({ event, handler }: EventHandler): void => {
    eventBus.off(event, handler);
  });
}

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly permissionsService: UserPermissionsService,
  ) {}

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
    return await this.notificationsService.listNotifications(
      user.id,
      tenantId,
      {
        type: query.type,
        priority: query.priority,
        unread: query.unread,
        page: query.page,
        limit: query.limit,
      },
    );
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
    const preferences = await this.notificationsService.getPreferences(
      user.id,
      tenantId,
    );
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
    await this.notificationsService.updatePreferences(
      user.id,
      tenantId,
      dto,
      ipAddress,
      userAgent,
    );
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
   * POST /notifications/mark-read/:type
   * Mark all notifications of a feature type as read (ADR-004)
   *
   * @param type - 'survey' | 'document' | 'kvp' | 'vacation'
   */
  @Post('mark-read/:type')
  @HttpCode(HttpStatus.OK)
  async markFeatureTypeAsRead(
    @Param('type') type: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ marked: number; message: string }> {
    // Validate type
    const validTypes = ['survey', 'document', 'kvp', 'vacation'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(
        `Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`,
      );
    }

    const marked = await this.notificationsService.markFeatureTypeAsRead(
      type as 'survey' | 'document' | 'kvp' | 'vacation',
      user.id,
      tenantId,
    );

    return {
      marked,
      message: `${marked} ${type} notifications marked as read`,
    };
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
    await this.notificationsService.markAsRead(
      notificationId,
      user.id,
      tenantId,
    );
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
   * SSE stream for real-time notifications.
   *
   * Permission-aware (ADR-020): Only registers handlers for features
   * the user has read access to. Root/admin with fullAccess bypasses.
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

    // Resolve readable features for permission filtering (ADR-020)
    // Root and admin with fullAccess: null = all features
    const readableFeaturesPromise = this.resolveReadableFeatures(user);

    // Register handlers asynchronously after permission check
    void readableFeaturesPromise.then(
      (readableFeatures: Set<string> | null) => {
        const handlers = registerSSEHandlers(
          role,
          tenantId,
          userId,
          eventSubject,
          readableFeatures,
        );
        eventSubject.pipe(takeUntil(destroy$)).subscribe({
          complete: (): void => {
            cleanupSSEHandlers(handlers);
          },
        });
        return undefined;
      },
    );

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
   * Resolve readable feature codes for SSE permission filtering.
   * Root and admin with fullAccess: null (all features accessible).
   * Others: Set of feature codes with can_read = true.
   */
  private async resolveReadableFeatures(
    user: NestAuthUser,
  ): Promise<Set<string> | null> {
    if (user.activeRole === 'root') return null;
    if (user.activeRole === 'admin' && user.hasFullAccess) return null;
    return await this.permissionsService.getReadableFeatureCodes(user.id);
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
        [SSE_EVENTS.SURVEY_CREATED]: eventBus.getListenerCount(
          SSE_EVENTS.SURVEY_CREATED,
        ),
        [SSE_EVENTS.SURVEY_UPDATED]: eventBus.getListenerCount(
          SSE_EVENTS.SURVEY_UPDATED,
        ),
        [SSE_EVENTS.DOCUMENT_UPLOADED]: eventBus.getListenerCount(
          SSE_EVENTS.DOCUMENT_UPLOADED,
        ),
        [SSE_EVENTS.KVP_SUBMITTED]: eventBus.getListenerCount(
          SSE_EVENTS.KVP_SUBMITTED,
        ),
        [SSE_EVENTS.MESSAGE_CREATED]: eventBus.getListenerCount(
          SSE_EVENTS.MESSAGE_CREATED,
        ),
        [SSE_EVENTS.VACATION_REQUEST_CREATED]: eventBus.getListenerCount(
          SSE_EVENTS.VACATION_REQUEST_CREATED,
        ),
        [SSE_EVENTS.VACATION_REQUEST_RESPONDED]: eventBus.getListenerCount(
          SSE_EVENTS.VACATION_REQUEST_RESPONDED,
        ),
        [SSE_EVENTS.VACATION_REQUEST_WITHDRAWN]: eventBus.getListenerCount(
          SSE_EVENTS.VACATION_REQUEST_WITHDRAWN,
        ),
        [SSE_EVENTS.VACATION_REQUEST_CANCELLED]: eventBus.getListenerCount(
          SSE_EVENTS.VACATION_REQUEST_CANCELLED,
        ),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
