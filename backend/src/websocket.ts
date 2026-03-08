import { IS_ACTIVE } from '@assixx/shared/constants';
import { IncomingMessage, Server } from 'http';
import { Redis } from 'ioredis';
import { WebSocket, Data as WebSocketData, WebSocketServer } from 'ws';
import { z } from 'zod';

import { CONNECTION_TICKET_PREFIX } from './nest/auth/connection-ticket.service.js';
import type { PresenceStore } from './nest/chat/presence.store.js';
import { DatabaseService } from './nest/database/database.service.js';
import { type ReadReceiptEntry, eventBus } from './utils/event-bus.js';
import { logger } from './utils/logger.js';
import {
  type E2eFields,
  type ProcessedMessageResult,
  type SendMessageData,
  SendMessageDataSchema,
  WebSocketMessageHandler,
} from './websocket-message-handler.js';

// ============================================================================
// Connection & Transport Types
// ============================================================================

const ConnectionTicketDataSchema = z.object({
  userId: z.number(),
  tenantId: z.number(),
  role: z.string(),
  activeRole: z.string(),
  purpose: z.enum(['websocket', 'sse']),
  createdAt: z.number(),
});
type ConnectionTicketData = z.infer<typeof ConnectionTicketDataSchema>;

interface ExtendedWebSocket extends WebSocket {
  userId?: number;
  tenantId?: number;
  role?: string;
  isAlive?: boolean;
}

const WebSocketMessageSchema = z.object({
  type: z.string(),
  data: z.unknown(),
});
type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

const TypingDataSchema = z.object({
  conversationId: z.number(),
});
type TypingData = z.infer<typeof TypingDataSchema>;

const MarkReadDataSchema = z.object({
  messageId: z.number(),
});
type MarkReadData = z.infer<typeof MarkReadDataSchema>;

// ============================================================================
// ChatWebSocketServer - Connection management, routing, presence, heartbeat
// ============================================================================

export class ChatWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<number, ExtendedWebSocket>;
  private redis: Redis;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private readonly messageHandler: WebSocketMessageHandler;

  /** Lua script for atomic GET + DELETE (single-use ticket) */
  private readonly CONSUME_TICKET_SCRIPT = `
    local value = redis.call('GET', KEYS[1])
    if value then
      redis.call('DEL', KEYS[1])
    end
    return value
  `;

  constructor(
    server: Server,
    private readonly db: DatabaseService,
    private readonly presenceStore: PresenceStore,
  ) {
    this.wss = new WebSocketServer({
      server,
      path: '/chat-ws',
    });

    this.clients = new Map();
    this.messageHandler = new WebSocketMessageHandler(db);

    // Initialize Redis client for connection ticket validation
    const redisHost = process.env['REDIS_HOST'] ?? 'redis';
    const redisPortEnv = process.env['REDIS_PORT'];
    const redisPort =
      redisPortEnv !== undefined && redisPortEnv !== '' ?
        Number(redisPortEnv)
      : 6379;
    const redisPassword = process.env['REDIS_PASSWORD'];

    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      ...(redisPassword !== undefined &&
        redisPassword !== '' && { password: redisPassword }),
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
    });

    this.redis.on('connect', () => {
      logger.info('WebSocket: Connected to Redis for ticket validation');
    });

    this.redis.on('error', (err: Error) => {
      logger.error({ err }, 'WebSocket: Redis connection error');
    });

    this.init();
    this.listenForReadReceipts();
  }

  // ==========================================================================
  // Connection Lifecycle
  // ==========================================================================

  /** Forward read receipts from REST markAsRead to WebSocket senders */
  private listenForReadReceipts(): void {
    eventBus.on(
      'messages.read',
      (data: { readByUserId: number; entries: ReadReceiptEntry[] }) => {
        for (const entry of data.entries) {
          const senderWs = this.clients.get(entry.senderId);
          if (senderWs?.readyState === WebSocket.OPEN) {
            this.sendMessage(senderWs, {
              type: 'message_read',
              data: {
                messageId: entry.messageId,
                readBy: data.readByUserId,
                timestamp: new Date().toISOString(),
              },
            });
          }
        }
      },
    );
  }

  private init(): void {
    this.wss.on(
      'connection',
      (ws: ExtendedWebSocket, request: IncomingMessage) => {
        const sanitizedRequest = {
          url: request.url,
          headers: {
            host: request.headers.host,
          },
        };
        void this.handleConnection(ws, sanitizedRequest);
      },
    );
  }

  /** Extract connection ticket from request URL query parameter */
  private extractTicketFromRequest(request: {
    url: string | undefined;
    headers: { host: string | undefined };
  }): string | null {
    const url = new URL(
      request.url ?? '/',
      `http://${request.headers.host ?? 'localhost'}`,
    );
    const ticket = url.searchParams.get('ticket');
    return ticket !== null && ticket !== '' ? ticket : null;
  }

  /**
   * Consume a connection ticket from Redis (atomic GET + DELETE)
   * Returns null if ticket is invalid/expired/already used
   */
  private async consumeTicket(
    ticket: string,
  ): Promise<ConnectionTicketData | null> {
    try {
      // Use shared constant to ensure consistency with ConnectionTicketService
      const key = `${CONNECTION_TICKET_PREFIX}${ticket}`;
      const result = await this.redis.eval(this.CONSUME_TICKET_SCRIPT, 1, key);

      if (result === null || typeof result !== 'string') {
        return null;
      }

      const data = ConnectionTicketDataSchema.parse(JSON.parse(result));

      // Verify purpose is websocket
      if (data.purpose !== 'websocket') {
        logger.warn(
          { purpose: data.purpose },
          'WebSocket: Ticket has wrong purpose',
        );
        return null;
      }

      return data;
    } catch (error: unknown) {
      logger.error({ err: error }, 'WebSocket: Failed to consume ticket');
      return null;
    }
  }

  /** Check if user is active in database (is_active = 1) */
  private async isUserActive(
    userId: number,
    tenantId: number,
  ): Promise<boolean> {
    interface UserActiveResult {
      is_active: number;
    }
    const userRows = await this.db.query<UserActiveResult>(
      'SELECT is_active FROM users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId],
    );
    return userRows[0]?.is_active === IS_ACTIVE.ACTIVE;
  }

  /** Setup WebSocket client with event handlers */
  private setupWebSocketClient(
    ws: ExtendedWebSocket,
    userId: number,
    tenantId: number,
    role: string,
  ): void {
    ws.userId = userId;
    ws.tenantId = tenantId;
    ws.role = role;
    ws.isAlive = true;
    this.clients.set(userId, ws);
    this.presenceStore.add(userId);

    ws.on(
      'message',
      (data: WebSocketData) => void this.handleMessage(ws, data),
    );
    ws.on('close', () => void this.handleDisconnection(ws));
    ws.on('error', (error: Error) => {
      this.handleError(ws, error);
    });
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  }

  private async handleConnection(
    ws: ExtendedWebSocket,
    request: {
      url: string | undefined;
      headers: { host: string | undefined };
    },
  ): Promise<void> {
    try {
      // SECURITY: Use connection ticket instead of JWT to prevent token leakage in logs
      // @see docs/TOKEN-SECURITY-REFACTORING-PLAN.md
      const ticket = this.extractTicketFromRequest(request);
      if (ticket === null) {
        ws.close(1008, 'Connection ticket required');
        return;
      }

      // Consume ticket (atomic GET + DELETE - single use)
      const ticketData = await this.consumeTicket(ticket);
      if (ticketData === null) {
        logger.warn('WebSocket: Invalid, expired, or already used ticket');
        ws.close(1008, 'Invalid or expired ticket');
        return;
      }

      // SECURITY: Check if user is still active (is_active = 1)
      if (!(await this.isUserActive(ticketData.userId, ticketData.tenantId))) {
        logger.warn(
          { userId: ticketData.userId },
          'WebSocket: Rejected inactive/deleted user',
        );
        ws.close(1008, 'User account inactive');
        return;
      }

      // Use activeRole if available, otherwise fall back to role
      const effectiveRole =
        ticketData.activeRole !== '' ? ticketData.activeRole : ticketData.role;
      this.setupWebSocketClient(
        ws,
        ticketData.userId,
        ticketData.tenantId,
        effectiveRole,
      );

      this.sendMessage(ws, {
        type: 'connection_established',
        data: {
          userId: ticketData.userId,
          timestamp: new Date().toISOString(),
        },
      });

      await this.broadcastUserStatus(
        ticketData.userId,
        ticketData.tenantId,
        'online',
      );
      logger.info(
        { userId: ticketData.userId },
        'WebSocket: Connection established via ticket',
      );
    } catch (error: unknown) {
      logger.error(
        { err: error },
        'WebSocket Authentifizierung fehlgeschlagen',
      );
      ws.close(1008, 'Authentifizierung fehlgeschlagen');
    }
  }

  // ==========================================================================
  // Message Routing
  // ==========================================================================

  private async handleMessage(
    ws: ExtendedWebSocket,
    data: WebSocketData,
  ): Promise<void> {
    try {
      const dataString =
        typeof data === 'string' ? data
        : Buffer.isBuffer(data) ? data.toString()
        : JSON.stringify(data);
      const message = WebSocketMessageSchema.parse(JSON.parse(dataString));

      switch (message.type) {
        case 'send_message':
          await this.handleSendMessage(
            ws,
            SendMessageDataSchema.parse(message.data),
          );
          break;
        case 'typing_start':
          await this.handleTyping(
            ws,
            TypingDataSchema.parse(message.data),
            true,
          );
          break;
        case 'typing_stop':
          await this.handleTyping(
            ws,
            TypingDataSchema.parse(message.data),
            false,
          );
          break;
        case 'mark_read':
          await this.handleMarkRead(ws, MarkReadDataSchema.parse(message.data));
          break;
        case 'ping':
          this.sendMessage(ws, {
            type: 'pong',
            data: { timestamp: new Date().toISOString() },
          });
          break;
        case 'request_presence':
          await this.sendPresenceSnapshot(ws);
          break;
        default:
          logger.warn(`Unbekannter WebSocket Message Typ: ${message.type}`);
      }
    } catch (error: unknown) {
      logger.error(
        { err: error },
        'Fehler beim Verarbeiten der WebSocket Nachricht',
      );
      this.sendMessage(ws, {
        type: 'error',
        data: { message: 'Fehler beim Verarbeiten der Nachricht' },
      });
    }
  }

  // ==========================================================================
  // Message Handling (orchestration — DB work delegated to messageHandler)
  // ==========================================================================

  /** Resolve E2E fields and validate that message has content (plaintext or encrypted) */
  private async validateAndResolveE2e(
    data: SendMessageData,
    tenantId: number,
    userId: number,
  ): Promise<
    | { error: string; isE2e?: undefined; fields?: undefined }
    | { error: undefined; isE2e: boolean; fields: E2eFields | undefined }
  > {
    const e2eResult = await this.messageHandler.resolveE2eFields(
      data,
      tenantId,
      userId,
    );
    const validationError =
      e2eResult.error ??
      (!e2eResult.isE2e && (data.content === undefined || data.content === '') ?
        'Message content or encrypted content required'
      : undefined);
    if (validationError !== undefined) {
      return { error: validationError };
    }
    return {
      error: undefined,
      isE2e: e2eResult.isE2e,
      fields: e2eResult.fields,
    };
  }

  private async handleSendMessage(
    ws: ExtendedWebSocket,
    data: SendMessageData,
  ): Promise<void> {
    const { conversationId, content, attachments: attachmentIds = [] } = data;

    if (ws.userId === undefined || ws.tenantId === undefined) {
      this.sendMessage(ws, {
        type: 'error',
        data: { message: 'Not authenticated' },
      });
      return;
    }

    const validation = await this.validateAndResolveE2e(
      data,
      ws.tenantId,
      ws.userId,
    );
    if (validation.error !== undefined) {
      this.sendMessage(ws, {
        type: 'error',
        data: { message: validation.error },
      });
      return;
    }
    const { isE2e, fields: e2eFields } = validation;

    try {
      const participantIds = await this.messageHandler.verifyConversationAccess(
        conversationId,
        ws.tenantId,
      );

      if (!participantIds.includes(ws.userId)) {
        this.sendMessage(ws, {
          type: 'error',
          data: { message: 'Keine Berechtigung für diese Unterhaltung' },
        });
        return;
      }

      const result = await this.messageHandler.processMessage(
        ws.userId,
        ws.tenantId,
        conversationId,
        isE2e ? null : (content ?? ''),
        attachmentIds,
        e2eFields,
      );

      this.broadcastAndConfirm(ws, participantIds, conversationId, result);
    } catch (error: unknown) {
      logger.error({ err: error }, 'Fehler beim Senden der Nachricht');
      this.sendMessage(ws, {
        type: 'error',
        data: { message: 'Fehler beim Senden der Nachricht' },
      });
    }
  }

  private async handleTyping(
    ws: ExtendedWebSocket,
    data: TypingData,
    isTyping: boolean,
  ): Promise<void> {
    const { userId, tenantId } = ws;
    if (userId === undefined || tenantId === undefined) return;
    const { conversationId } = data;

    try {
      const participantIds = await this.messageHandler.getOtherParticipantIds(
        conversationId,
        tenantId,
        userId,
      );
      this.broadcastToParticipants(
        participantIds,
        isTyping ? 'user_typing' : 'user_stopped_typing',
        {
          conversationId,
          userId,
          timestamp: new Date().toISOString(),
        },
      );
    } catch (error: unknown) {
      logger.error({ err: error }, 'Fehler beim Typing-Event');
    }
  }

  private async handleMarkRead(
    ws: ExtendedWebSocket,
    data: MarkReadData,
  ): Promise<void> {
    const { userId, tenantId } = ws;
    if (userId === undefined || tenantId === undefined) return;
    const { messageId } = data;

    try {
      const result = await this.messageHandler.markAsRead(
        messageId,
        tenantId,
        userId,
      );

      // Notify sender about the read receipt
      if (result !== null) {
        const senderWs = this.clients.get(result.senderId);
        if (senderWs?.readyState === WebSocket.OPEN) {
          this.sendMessage(senderWs, {
            type: 'message_read',
            data: {
              messageId,
              readBy: userId,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }
    } catch (error: unknown) {
      logger.error({ err: error }, 'Fehler beim Markieren als gelesen');
    }
  }

  // ==========================================================================
  // Broadcasting & Transport
  // ==========================================================================

  /** Broadcast new message to participants, emit SSE event, and confirm to sender */
  private broadcastAndConfirm(
    ws: ExtendedWebSocket,
    participantIds: number[],
    conversationId: number,
    result: ProcessedMessageResult,
  ): void {
    const { userId, tenantId } = ws;
    if (userId === undefined || tenantId === undefined) return;

    this.broadcastToParticipants(
      participantIds,
      'new_message',
      result.messageData,
    );

    // Emit SSE event so sidebar badges update for users NOT on the chat page
    const recipientIds = participantIds.filter((id: number) => id !== userId);
    eventBus.emitNewMessage(tenantId, {
      id: result.messageId,
      uuid: result.messageUuid,
      conversationId,
      senderId: userId,
      recipientIds,
      preview: result.preview,
    });

    this.sendMessage(ws, {
      type: 'message_sent',
      data: {
        messageId: result.messageId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /** Broadcast message to all participants in a conversation */
  private broadcastToParticipants(
    participantIds: number[],
    type: string,
    data: unknown,
  ): void {
    for (const participantId of participantIds) {
      const clientWs = this.clients.get(participantId);
      if (clientWs?.readyState === WebSocket.OPEN) {
        this.sendMessage(clientWs, { type, data });
      }
    }
  }

  private sendMessage(ws: ExtendedWebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // ==========================================================================
  // Presence & Status
  // ==========================================================================

  private async broadcastUserStatus(
    userId: number,
    tenantId: number,
    status: string,
  ): Promise<void> {
    try {
      const partnerIds = await this.messageHandler.getConversationPartnerIds(
        userId,
        tenantId,
      );

      for (const partnerId of partnerIds) {
        const clientWs = this.clients.get(partnerId);
        if (clientWs?.readyState === WebSocket.OPEN) {
          this.sendMessage(clientWs, {
            type: 'user_status_changed',
            data: {
              userId,
              status,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }
    } catch (error: unknown) {
      logger.error({ err: error }, 'Fehler beim Senden des User-Status');
    }
  }

  /**
   * Send snapshot of currently-online conversation partners to the requesting user.
   * Triggered by 'request_presence' from the chat page after it upgrades callbacks.
   */
  private async sendPresenceSnapshot(ws: ExtendedWebSocket): Promise<void> {
    const { userId, tenantId } = ws;
    if (userId === undefined || tenantId === undefined) return;

    try {
      const partnerIds = await this.messageHandler.getConversationPartnerIds(
        userId,
        tenantId,
      );

      const onlineUserIds: number[] = [];
      for (const partnerId of partnerIds) {
        const clientWs = this.clients.get(partnerId);
        if (clientWs?.readyState === WebSocket.OPEN) {
          onlineUserIds.push(partnerId);
        }
      }

      logger.debug(
        { userId, onlinePartners: onlineUserIds.length },
        'Sending presence snapshot',
      );

      this.sendMessage(ws, {
        type: 'initial_presence',
        data: { onlineUserIds },
      });
    } catch (error: unknown) {
      logger.error({ err: error }, 'Failed to send presence snapshot');
    }
  }

  // ==========================================================================
  // Disconnection, Heartbeat & Shutdown
  // ==========================================================================

  private async handleDisconnection(ws: ExtendedWebSocket): Promise<void> {
    if (ws.userId !== undefined) {
      this.clients.delete(ws.userId);
      this.presenceStore.remove(ws.userId);

      // Offline-Status senden
      if (ws.tenantId !== undefined) {
        await this.broadcastUserStatus(ws.userId, ws.tenantId, 'offline');
      }
    }
  }

  private handleError(_ws: ExtendedWebSocket, error: unknown): void {
    logger.error({ err: error }, 'WebSocket Fehler');
  }

  // Heartbeat-System for connection monitoring
  public startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: ExtendedWebSocket) => {
        if (ws.isAlive === false) {
          ws.terminate();
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Graceful shutdown - close all connections and cleanup resources
   * Called from main.ts gracefulShutdown() before app.close()
   */
  public async shutdown(): Promise<void> {
    logger.info('ChatWebSocketServer shutting down...');

    // 1. Stop heartbeat interval
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.info('Heartbeat interval stopped');
    }

    // 2. Close all WebSocket connections gracefully
    const closePromises: Promise<void>[] = [];
    this.wss.clients.forEach((ws: ExtendedWebSocket) => {
      closePromises.push(
        new Promise<void>((resolve: () => void) => {
          ws.once('close', () => {
            resolve();
          });
          ws.close(1001, 'Server shutting down');
          // Timeout fallback in case close doesn't fire
          setTimeout(() => {
            resolve();
          }, 1000);
        }),
      );
    });
    await Promise.all(closePromises);
    logger.info(`Closed ${closePromises.length} WebSocket connections`);

    // 3. Close WebSocket server
    await new Promise<void>((resolve: () => void) => {
      this.wss.close(() => {
        logger.info('WebSocket server closed');
        resolve();
      });
    });

    // 4. Close Redis connection
    await this.redis.quit();
    logger.info('Redis connection closed');

    logger.info('ChatWebSocketServer shutdown complete');
  }
}
