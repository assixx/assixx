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

import { eventBus } from '../../utils/event-bus.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequirePermission } from '../common/decorators/require-permission.decorator.js';
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
  workOrder?: {
    uuid: string;
    title: string;
    status: string;
    priority: string;
    assigneeUserIds: number[];
  };
  changedByUserId?: number;
  approval?: {
    uuid: string;
    title: string;
    addonCode: string;
    status: string;
    requestedByName: string;
    decidedByName?: string;
  };
  approverUserIds?: number[];
  requestedByUserId?: number;
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
  TPM_MAINTENANCE_DUE: 'tpm.maintenance.due',
  TPM_MAINTENANCE_OVERDUE: 'tpm.maintenance.overdue',
  TPM_MAINTENANCE_COMPLETED: 'tpm.maintenance.completed',
  TPM_APPROVAL_REQUIRED: 'tpm.approval.required',
  TPM_APPROVAL_RESULT: 'tpm.approval.result',
  WORKORDER_ASSIGNED: 'workorder.assigned',
  WORKORDER_STATUS_CHANGED: 'workorder.status.changed',
  WORKORDER_DUE_SOON: 'workorder.due.soon',
  WORKORDER_VERIFIED: 'workorder.verified',
  APPROVAL_CREATED: 'approval.created',
  APPROVAL_DECIDED: 'approval.decided',
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
 * Create work order SSE handler — targeted to assignees + admins.
 * Employees only see events for work orders they are assigned to.
 * Admins/root see all work orders in their tenant.
 */
function createWorkOrderHandler(
  messageType: string,
  userId: number,
  role: string,
  tenantId: number,
  eventSubject: Subject<{ data: SSEMessageData }>,
): (eventData: NotificationEventData) => void {
  return (eventData: NotificationEventData): void => {
    const { workOrder } = eventData;
    if (eventData.tenantId !== tenantId || workOrder === undefined) return;

    // Employees only see their own assignments
    const isAdmin = role === 'admin' || role === 'root';
    if (!isAdmin && !workOrder.assigneeUserIds.includes(userId)) return;

    eventSubject.next({
      data: {
        type: messageType,
        workOrder: {
          uuid: workOrder.uuid,
          title: workOrder.title,
          status: workOrder.status,
        },
        timestamp: new Date().toISOString(),
      },
    });
  };
}

/** Register work order SSE event handlers — targeted to assignees + admins */
function registerWorkOrderHandlers(
  handlers: EventHandler[],
  userId: number,
  role: string,
  tenantId: number,
  eventSubject: Subject<{ data: SSEMessageData }>,
): void {
  const woEvents = [
    { event: SSE_EVENTS.WORKORDER_ASSIGNED, type: 'WORK_ORDER_ASSIGNED' },
    {
      event: SSE_EVENTS.WORKORDER_STATUS_CHANGED,
      type: 'WORK_ORDER_STATUS_CHANGED',
    },
    { event: SSE_EVENTS.WORKORDER_DUE_SOON, type: 'WORK_ORDER_DUE_SOON' },
    { event: SSE_EVENTS.WORKORDER_VERIFIED, type: 'WORK_ORDER_VERIFIED' },
  ] as const;

  for (const { event, type } of woEvents) {
    registerHandler(
      handlers,
      event,
      createWorkOrderHandler(type, userId, role, tenantId, eventSubject),
    );
  }
}

/** Register TPM-related SSE event handlers — broadcast to all users in tenant */
function registerTpmHandlers(
  handlers: EventHandler[],
  tenantId: number,
  eventSubject: Subject<{ data: SSEMessageData }>,
): void {
  const tpmEvents = [
    { event: SSE_EVENTS.TPM_MAINTENANCE_DUE, type: 'TPM_MAINTENANCE_DUE' },
    {
      event: SSE_EVENTS.TPM_MAINTENANCE_OVERDUE,
      type: 'TPM_MAINTENANCE_OVERDUE',
    },
    {
      event: SSE_EVENTS.TPM_MAINTENANCE_COMPLETED,
      type: 'TPM_MAINTENANCE_COMPLETED',
    },
    {
      event: SSE_EVENTS.TPM_APPROVAL_REQUIRED,
      type: 'TPM_APPROVAL_REQUIRED',
    },
    { event: SSE_EVENTS.TPM_APPROVAL_RESULT, type: 'TPM_APPROVAL_RESULT' },
  ] as const;

  for (const { event, type } of tpmEvents) {
    registerHandler(
      handlers,
      event,
      createSSEHandler(type, 'card', tenantId, eventSubject),
    );
  }
}

/** Register survey SSE handlers (split by role) */
function registerSurveyHandlers(
  handlers: EventHandler[],
  role: string,
  make: (type: string, key: string) => (e: NotificationEventData) => void,
): void {
  if (role === 'employee') {
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
  if (role === 'admin' || role === 'root') {
    registerHandler(
      handlers,
      SSE_EVENTS.SURVEY_CREATED,
      make('NEW_SURVEY_CREATED', 'survey'),
    );
  }
}

/**
 * Register approval SSE handlers (Core addon — always active).
 * NEW_APPROVAL: targeted to configured masters (approverUserIds).
 * APPROVAL_DECIDED: targeted to the requester (requestedByUserId).
 */
function registerApprovalHandlers(
  handlers: EventHandler[],
  userId: number,
  tenantId: number,
  eventSubject: Subject<{ data: SSEMessageData }>,
): void {
  // New approval → notify configured masters
  const createdHandler = (eventData: NotificationEventData): void => {
    if (eventData.tenantId !== tenantId) return;
    const approverIds = eventData.approverUserIds ?? [];
    if (!approverIds.includes(userId)) return;
    eventSubject.next({
      data: {
        type: 'NEW_APPROVAL',
        timestamp: new Date().toISOString(),
        approval: eventData.approval,
      },
    });
  };
  registerHandler(handlers, SSE_EVENTS.APPROVAL_CREATED, createdHandler);

  // Approval decided → notify the requester
  const decidedHandler = (eventData: NotificationEventData): void => {
    if (eventData.tenantId !== tenantId) return;
    if (eventData.requestedByUserId !== userId) return;
    eventSubject.next({
      data: {
        type: 'APPROVAL_DECIDED',
        timestamp: new Date().toISOString(),
        approval: eventData.approval,
      },
    });
  };
  registerHandler(handlers, SSE_EVENTS.APPROVAL_DECIDED, decidedHandler);
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
  const isAdmin = role === 'admin' || role === 'root';

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
  if (canAccess('surveys')) {
    registerSurveyHandlers(handlers, role, make);
  }
  if (canAccess('vacation')) {
    registerVacationHandlers(handlers, userId, tenantId, eventSubject);
  }
  if (isAdmin && canAccess('kvp')) {
    registerHandler(handlers, SSE_EVENTS.KVP_SUBMITTED, make('NEW_KVP', 'kvp'));
  }
  if (canAccess('tpm')) {
    registerTpmHandlers(handlers, tenantId, eventSubject);
  }
  if (canAccess('work_orders')) {
    registerWorkOrderHandlers(handlers, userId, role, tenantId, eventSubject);
  }

  // Approvals — Core addon, always registered (no canAccess check)
  registerApprovalHandlers(handlers, userId, tenantId, eventSubject);

  return handlers;
}

function cleanupSSEHandlers(handlers: EventHandler[]): void {
  handlers.forEach(({ event, handler }: EventHandler): void => {
    eventBus.off(event, handler);
  });
}

/** Permission constants */
const FEAT = 'notifications';
const MOD_MANAGE = 'notifications-manage';

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
  @RequirePermission(FEAT, MOD_MANAGE, 'canWrite')
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
  @RequirePermission(FEAT, MOD_MANAGE, 'canRead')
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
   * Mark all notifications of an addon type as read (ADR-004)
   *
   * @param type - 'survey' | 'document' | 'kvp' | 'vacation'
   */
  @Post('mark-read/:type')
  @HttpCode(HttpStatus.OK)
  async markAddonTypeAsRead(
    @Param('type') type: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ marked: number; message: string }> {
    // Validate type
    const validTypes = [
      'survey',
      'document',
      'kvp',
      'vacation',
      'tpm',
      'work_orders',
    ];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(
        `Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`,
      );
    }

    const marked = await this.notificationsService.markAddonTypeAsRead(
      type as
        | 'survey'
        | 'document'
        | 'kvp'
        | 'vacation'
        | 'tpm'
        | 'work_orders',
      user.id,
      tenantId,
    );

    return {
      marked,
      message: `${marked} ${type} notifications marked as read`,
    };
  }

  /**
   * POST /notifications/mark-read/:type/:entityUuid
   * Mark notifications for a specific entity as read (e.g., one work order)
   */
  @Post('mark-read/:type/:entityUuid')
  @HttpCode(HttpStatus.OK)
  async markAddonEntityAsRead(
    @Param('type') type: string,
    @Param('entityUuid') entityUuid: string,
    @CurrentUser() user: NestAuthUser,
    @TenantId() tenantId: number,
  ): Promise<{ marked: number; message: string }> {
    const validTypes = ['work_orders'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(
        `Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`,
      );
    }

    const marked = await this.notificationsService.markAddonEntityAsRead(
      type as 'work_orders',
      entityUuid,
      user.id,
      tenantId,
    );

    return {
      marked,
      message: `${marked} ${type} notifications for entity ${entityUuid} marked as read`,
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

    // Resolve readable addons for permission filtering (ADR-020)
    // Root and admin with fullAccess: null = all addons
    const readableAddonsPromise = this.resolveReadableAddons(user);

    // Register handlers asynchronously after permission check
    void readableAddonsPromise.then((readableAddons: Set<string> | null) => {
      const handlers = registerSSEHandlers(
        role,
        tenantId,
        userId,
        eventSubject,
        readableAddons,
      );
      eventSubject.pipe(takeUntil(destroy$)).subscribe({
        complete: (): void => {
          cleanupSSEHandlers(handlers);
        },
      });
      return undefined;
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
   * Resolve readable addon codes for SSE permission filtering.
   * Root and admin with fullAccess: null (all addons accessible).
   * Others: Set of addon codes with can_read = true.
   */
  private async resolveReadableAddons(
    user: NestAuthUser,
  ): Promise<Set<string> | null> {
    if (user.activeRole === 'root') return null;
    if (user.activeRole === 'admin' && user.hasFullAccess) return null;
    return await this.permissionsService.getReadableAddonCodes(user.id);
  }

  /**
   * GET /notifications/stream/stats
   * Get SSE connection statistics
   */
  @Get('stream/stats')
  @UseGuards(RolesGuard)
  @Roles('admin', 'root')
  @RequirePermission(FEAT, MOD_MANAGE, 'canRead')
  getStreamStats(): {
    activeEvents: string[];
    listenerCounts: Record<string, number>;
    timestamp: string;
  } {
    const listenerCounts: Record<string, number> = {};
    for (const eventName of Object.values(SSE_EVENTS)) {
      listenerCounts[eventName] = eventBus.getListenerCount(eventName);
    }

    return {
      activeEvents: eventBus.getActiveEvents(),
      listenerCounts,
      timestamp: new Date().toISOString(),
    };
  }
}
