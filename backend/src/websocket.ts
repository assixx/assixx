import { IncomingMessage, Server } from 'http';
import { Redis } from 'ioredis';
import { URL } from 'url';
import { WebSocket, Data as WebSocketData, WebSocketServer } from 'ws';

import { CONNECTION_TICKET_PREFIX } from './nest/auth/connection-ticket.service.js';
import { ResultSetHeader, RowDataPacket, execute, query } from './utils/db.js';
import { logger } from './utils/logger.js';

// ============================================================================
// Connection Ticket Types (must match connection-ticket.service.ts)
// ============================================================================

interface ConnectionTicketData {
  userId: number;
  tenantId: number;
  role: string;
  activeRole: string;
  purpose: 'websocket' | 'sse';
  createdAt: number;
}

interface ExtendedWebSocket extends WebSocket {
  userId?: number;
  tenantId?: number;
  role?: string;
  isAlive?: boolean;
  conversations?: Set<number>;
}

interface WebSocketMessage {
  type: string;
  data: unknown;
}

interface SendMessageData {
  conversationId: number;
  content: string;
  attachments?: number[]; // Document IDs from frontend upload
}

interface TypingData {
  conversationId: number;
}

interface MarkReadData {
  messageId: number;
}

interface JoinConversationData {
  conversationId: number;
}

// ============================================================================
// Database Query Result Interfaces
// ============================================================================

interface ConversationParticipantResult extends RowDataPacket {
  user_id: number;
}

interface UserInfoResult extends RowDataPacket {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
}

interface MessageInfoResult extends RowDataPacket {
  sender_id: number;
  conversation_id: number;
}

export class ChatWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<number, ExtendedWebSocket>;
  private redis: Redis;

  /** Lua script for atomic GET + DELETE (single-use ticket) */
  private readonly CONSUME_TICKET_SCRIPT = `
    local value = redis.call('GET', KEYS[1])
    if value then
      redis.call('DEL', KEYS[1])
    end
    return value
  `;

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/chat-ws',
    });

    this.clients = new Map();

    // Initialize Redis client for connection ticket validation
    const redisHost = process.env['REDIS_HOST'] ?? 'redis';
    const redisPortEnv = process.env['REDIS_PORT'];
    const redisPort =
      redisPortEnv !== undefined && redisPortEnv !== '' ? Number(redisPortEnv) : 6379;
    const redisPassword = process.env['REDIS_PASSWORD'];

    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      ...(redisPassword !== undefined && redisPassword !== '' && { password: redisPassword }),
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
  }

  private init(): void {
    this.wss.on('connection', (ws: ExtendedWebSocket, request: IncomingMessage) => {
      // Extract only the properties we need from IncomingMessage to satisfy exactOptionalPropertyTypes
      const sanitizedRequest = {
        url: request.url,
        headers: {
          host: request.headers.host,
          authorization: request.headers.authorization,
        },
      };
      void this.handleConnection(ws, sanitizedRequest);
    });
  }

  /** Extract connection ticket from request URL query parameter */
  private extractTicketFromRequest(request: {
    url: string | undefined;
    headers: { host: string | undefined; authorization: string | undefined };
  }): string | null {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const ticket = url.searchParams.get('ticket');
    return ticket !== null && ticket !== '' ? ticket : null;
  }

  /**
   * Consume a connection ticket from Redis (atomic GET + DELETE)
   * Returns null if ticket is invalid/expired/already used
   */
  private async consumeTicket(ticket: string): Promise<ConnectionTicketData | null> {
    try {
      // Use shared constant to ensure consistency with ConnectionTicketService
      const key = `${CONNECTION_TICKET_PREFIX}${ticket}`;
      const result = await this.redis.eval(this.CONSUME_TICKET_SCRIPT, 1, key);

      if (result === null || typeof result !== 'string') {
        return null;
      }

      const data = JSON.parse(result) as ConnectionTicketData;

      // Verify purpose is websocket
      if (data.purpose !== 'websocket') {
        logger.warn({ purpose: data.purpose }, 'WebSocket: Ticket has wrong purpose');
        return null;
      }

      return data;
    } catch (error: unknown) {
      logger.error({ err: error }, 'WebSocket: Failed to consume ticket');
      return null;
    }
  }

  /** Check if user is active in database (is_active = 1) */
  private async isUserActive(userId: number, tenantId: number): Promise<boolean> {
    interface UserActiveResult extends RowDataPacket {
      is_active: number;
    }
    const [userRows] = await query<UserActiveResult[]>(
      'SELECT is_active FROM users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId],
    );
    return userRows[0]?.is_active === 1;
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

    ws.on('message', (data: WebSocketData) => void this.handleMessage(ws, data));
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
      headers: { host: string | undefined; authorization: string | undefined };
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
        logger.warn({ userId: ticketData.userId }, 'WebSocket: Rejected inactive/deleted user');
        ws.close(1008, 'User account inactive');
        return;
      }

      // Use activeRole if available, otherwise fall back to role
      const effectiveRole = ticketData.activeRole !== '' ? ticketData.activeRole : ticketData.role;
      this.setupWebSocketClient(ws, ticketData.userId, ticketData.tenantId, effectiveRole);

      this.sendMessage(ws, {
        type: 'connection_established',
        data: { userId: ticketData.userId, timestamp: new Date().toISOString() },
      });

      await this.broadcastUserStatus(ticketData.userId, ticketData.tenantId, 'online');
      logger.info({ userId: ticketData.userId }, 'WebSocket: Connection established via ticket');
    } catch (error: unknown) {
      logger.error({ err: error }, 'WebSocket Authentifizierung fehlgeschlagen');
      ws.close(1008, 'Authentifizierung fehlgeschlagen');
    }
  }

  private async handleMessage(ws: ExtendedWebSocket, data: WebSocketData): Promise<void> {
    try {
      const dataString =
        typeof data === 'string' ? data
        : Buffer.isBuffer(data) ? data.toString()
        : JSON.stringify(data);
      const message = JSON.parse(dataString) as WebSocketMessage;

      switch (message.type) {
        case 'send_message':
          await this.handleSendMessage(ws, message.data as SendMessageData);
          break;
        case 'typing_start':
          await this.handleTyping(ws, message.data as TypingData, true);
          break;
        case 'typing_stop':
          await this.handleTyping(ws, message.data as TypingData, false);
          break;
        case 'mark_read':
          await this.handleMarkRead(ws, message.data as MarkReadData);
          break;
        case 'join_conversation':
          await this.handleJoinConversation(ws, message.data as JoinConversationData);
          break;
        case 'ping':
          this.sendMessage(ws, {
            type: 'pong',
            data: { timestamp: new Date().toISOString() },
          });
          break;
        default:
          logger.warn(`Unbekannter WebSocket Message Typ: ${message.type}`);
      }
    } catch (error: unknown) {
      logger.error({ err: error }, 'Fehler beim Verarbeiten der WebSocket Nachricht');
      this.sendMessage(ws, {
        type: 'error',
        data: { message: 'Fehler beim Verarbeiten der Nachricht' },
      });
    }
  }

  private async verifyConversationAccess(
    conversationId: number,
    tenantId: number,
  ): Promise<number[]> {
    const participantQuery = `
      SELECT cp.user_id
      FROM conversation_participants cp
      JOIN conversations c ON cp.conversation_id = c.id
      WHERE cp.conversation_id = $1
      AND c.tenant_id = $2
      AND cp.tenant_id = $3
    `;
    const [participants] = await query<ConversationParticipantResult[]>(participantQuery, [
      conversationId,
      tenantId,
      tenantId,
    ]);

    return participants.map((p: ConversationParticipantResult) => p.user_id);
  }

  private async saveMessage(
    conversationId: number,
    senderId: number,
    content: string,
    tenantId: number,
  ): Promise<number> {
    const messageQuery = `
      INSERT INTO messages (conversation_id, sender_id, content, tenant_id, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `;
    // PostgreSQL RETURNING clause returns rows, not MySQL-style insertId
    interface InsertResult extends RowDataPacket {
      id: number;
    }
    const [rows] = await query<InsertResult[]>(messageQuery, [
      conversationId,
      senderId,
      content,
      tenantId,
    ]);

    const insertedRow = rows[0];
    if (insertedRow === undefined) {
      throw new Error('Failed to insert message - no row returned');
    }
    return insertedRow.id;
  }

  /**
   * Link uploaded documents to a message
   */
  private async linkAttachmentsToMessage(
    messageId: number,
    attachmentIds: number[],
    tenantId: number,
  ): Promise<void> {
    if (attachmentIds.length === 0) return;

    // Update documents to link them to this message
    const placeholders = attachmentIds.map((_: number, i: number) => `$${i + 3}`).join(', ');
    const updateQuery = `
      UPDATE documents
      SET message_id = $1
      WHERE id IN (${placeholders})
      AND tenant_id = $2
      AND message_id IS NULL
    `;
    await execute(updateQuery, [messageId, tenantId, ...attachmentIds]);
    logger.info(`Linked ${attachmentIds.length} attachments to message ${messageId}`);
  }

  /**
   * Get attachment details for a message
   */
  private async getMessageAttachments(
    attachmentIds: number[],
    tenantId: number,
  ): Promise<
    {
      id: number;
      fileUuid: string;
      fileName: string;
      originalName: string;
      fileSize: number;
      mimeType: string;
      downloadUrl: string;
    }[]
  > {
    if (attachmentIds.length === 0) return [];

    const placeholders = attachmentIds.map((_: number, i: number) => `$${i + 2}`).join(', ');
    const attachmentQuery = `
      SELECT id, file_uuid, filename, original_name, file_size, mime_type
      FROM documents
      WHERE id IN (${placeholders})
      AND tenant_id = $1
    `;
    interface AttachmentRow extends RowDataPacket {
      id: number;
      file_uuid: string;
      filename: string;
      original_name: string;
      file_size: number;
      mime_type: string;
    }
    const [rows] = await query<AttachmentRow[]>(attachmentQuery, [tenantId, ...attachmentIds]);

    return rows.map((row: AttachmentRow) => ({
      id: row.id,
      fileUuid: row.file_uuid,
      fileName: row.filename,
      originalName: row.original_name,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      downloadUrl: `/api/v2/documents/${row.id}/download`,
    }));
  }

  private async getSenderInfo(
    userId: number,
    tenantId: number,
  ): Promise<
    | {
        id: number;
        username: string;
        first_name: string | null;
        last_name: string | null;
        profile_picture_url: string | null;
      }
    | undefined
  > {
    const senderQuery = `
      SELECT id, username, first_name, last_name, profile_picture as profile_picture_url
      FROM users WHERE id = $1 AND tenant_id = $2
    `;
    const [senderInfo] = await query<UserInfoResult[]>(senderQuery, [userId, tenantId]);
    return senderInfo[0] as
      | {
          id: number;
          username: string;
          first_name: string | null;
          last_name: string | null;
          profile_picture_url: string | null;
        }
      | undefined;
  }

  /**
   * Get display name from sender info with fallbacks
   */
  private getSenderDisplayName(
    sender:
      | { first_name?: string | null; last_name?: string | null; username?: string | null }
      | null
      | undefined,
    fallback: string,
  ): string {
    if (sender === null || sender === undefined) return fallback;

    const fullName = [sender.first_name, sender.last_name]
      .filter(
        (part: string | null | undefined): part is string =>
          part !== undefined && part !== null && part !== '',
      )
      .join(' ');
    if (fullName !== '') return fullName;

    if (sender.username !== undefined && sender.username !== null && sender.username !== '') {
      return sender.username;
    }

    return fallback;
  }

  private buildMessageData(
    messageId: number,
    conversationId: number,
    content: string,
    senderId: number,
    sender: ReturnType<typeof this.getSenderInfo> extends Promise<infer T> ? T : never,
    attachments: unknown[],
  ): unknown {
    const UNKNOWN_USER = 'Unbekannter Benutzer';
    // API v2 Standard: camelCase für alle Felder
    return {
      id: messageId,
      conversationId,
      content,
      senderId,
      senderName: this.getSenderDisplayName(sender, UNKNOWN_USER),
      firstName: sender?.first_name ?? '',
      lastName: sender?.last_name ?? '',
      senderUsername: sender?.username ?? '',
      senderProfilePicture: sender?.profile_picture_url ?? null,
      createdAt: new Date().toISOString(),
      deliveryStatus: 'sent',
      isRead: false,
      attachments,
    };
  }

  /**
   * Broadcast message to all participants in a conversation
   */
  private broadcastToParticipants(participantIds: number[], type: string, data: unknown): void {
    for (const participantId of participantIds) {
      const clientWs = this.clients.get(participantId);
      if (clientWs?.readyState === WebSocket.OPEN) {
        this.sendMessage(clientWs, { type, data });
      }
    }
  }

  /**
   * Check if user has permission to send to conversation
   */
  private checkUserInParticipants(userId: number, participantIds: number[]): boolean {
    const participantIdsStr = participantIds.map((id: number) => String(id));
    return participantIdsStr.includes(String(userId));
  }

  private async handleSendMessage(ws: ExtendedWebSocket, data: SendMessageData): Promise<void> {
    const { conversationId, content, attachments: attachmentIds = [] } = data;

    // DEBUG: Log incoming data to verify attachments are received
    logger.info(
      `[WS] handleSendMessage: convId=${conversationId}, attachmentIds=${JSON.stringify(attachmentIds)}, raw data.attachments=${JSON.stringify(data.attachments)}`,
    );

    if (ws.userId === undefined || ws.tenantId === undefined) {
      this.sendMessage(ws, { type: 'error', data: { message: 'Not authenticated' } });
      return;
    }

    try {
      const participantIds = await this.verifyConversationAccess(conversationId, ws.tenantId);

      if (!this.checkUserInParticipants(ws.userId, participantIds)) {
        this.sendMessage(ws, {
          type: 'error',
          data: { message: 'Keine Berechtigung für diese Unterhaltung' },
        });
        return;
      }

      // Save message
      const messageId = await this.saveMessage(conversationId, ws.userId, content, ws.tenantId);

      // Link attachments to message (updates documents.message_id)
      if (attachmentIds.length > 0) {
        await this.linkAttachmentsToMessage(messageId, attachmentIds, ws.tenantId);
      }

      // Get attachment details for broadcast
      const attachments = await this.getMessageAttachments(attachmentIds, ws.tenantId);

      const sender = await this.getSenderInfo(ws.userId, ws.tenantId);
      const messageData = this.buildMessageData(
        messageId,
        conversationId,
        content,
        ws.userId,
        sender,
        attachments,
      );

      this.broadcastToParticipants(participantIds, 'new_message', messageData);
      this.sendMessage(ws, {
        type: 'message_sent',
        data: { messageId, timestamp: new Date().toISOString() },
      });
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
    const { conversationId } = data;

    try {
      // Teilnehmer der Unterhaltung ermitteln
      const participantQuery = `
        SELECT cp.user_id
        FROM conversation_participants cp
        JOIN conversations c ON cp.conversation_id = c.id
        WHERE cp.conversation_id = $1
        AND c.tenant_id = $2
        AND cp.tenant_id = $3
        AND cp.user_id != $4
      `;
      const [participants] = await query<ConversationParticipantResult[]>(participantQuery, [
        conversationId,
        ws.tenantId,
        ws.tenantId,
        ws.userId,
      ]);

      // Typing-Event an andere Teilnehmer senden
      for (const participant of participants) {
        const userId = participant.user_id;
        const clientWs = this.clients.get(userId);
        if (clientWs?.readyState === WebSocket.OPEN) {
          this.sendMessage(clientWs, {
            type: isTyping ? 'user_typing' : 'user_stopped_typing',
            data: {
              conversationId,
              userId: ws.userId,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }
    } catch (error: unknown) {
      logger.error({ err: error }, 'Fehler beim Typing-Event');
    }
  }

  private async handleMarkRead(ws: ExtendedWebSocket, data: MarkReadData): Promise<void> {
    const { messageId } = data;

    try {
      // Nachricht als gelesen markieren
      await execute<ResultSetHeader>(
        `
        UPDATE messages
        SET is_read = true
        WHERE id = $1
        AND tenant_id = $2
        AND EXISTS (
          SELECT 1 FROM conversation_participants cp
          WHERE cp.conversation_id = messages.conversation_id
          AND cp.user_id = $3
        )
      `,
        [messageId, ws.tenantId, ws.userId],
      );

      // Sender über Lesebestätigung informieren
      const messageQuery = `
        SELECT sender_id, conversation_id FROM messages WHERE id = $1
      `;
      const [messageInfo] = await query<MessageInfoResult[]>(messageQuery, [messageId]);

      if (messageInfo.length > 0 && messageInfo[0] !== undefined) {
        const senderId = messageInfo[0].sender_id;
        const senderWs = this.clients.get(senderId);

        if (senderWs?.readyState === WebSocket.OPEN) {
          this.sendMessage(senderWs, {
            type: 'message_read',
            data: {
              messageId,
              readBy: ws.userId,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }
    } catch (error: unknown) {
      logger.error({ err: error }, 'Fehler beim Markieren als gelesen');
    }
  }

  private async handleJoinConversation(
    ws: ExtendedWebSocket,
    data: JoinConversationData,
  ): Promise<void> {
    const { conversationId } = data;

    // Conversation-ID zur WebSocket-Verbindung hinzufügen für Gruppierung
    ws.conversations ??= new Set();
    ws.conversations.add(conversationId);

    // Anderen Teilnehmern mitteilen, dass Benutzer online ist
    try {
      const participantQuery = `
        SELECT cp.user_id
        FROM conversation_participants cp
        JOIN conversations c ON cp.conversation_id = c.id
        WHERE cp.conversation_id = $1
        AND c.tenant_id = $2
        AND cp.tenant_id = $3
        AND cp.user_id != $4
      `;
      const [participants] = await query<ConversationParticipantResult[]>(participantQuery, [
        conversationId,
        ws.tenantId,
        ws.tenantId,
        ws.userId,
      ]);

      for (const participant of participants) {
        const userId = participant.user_id;
        const clientWs = this.clients.get(userId);
        if (clientWs?.readyState === WebSocket.OPEN) {
          this.sendMessage(clientWs, {
            type: 'user_joined_conversation',
            data: {
              conversationId,
              userId: ws.userId,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }
    } catch (error: unknown) {
      logger.error({ err: error }, 'Fehler beim Beitreten zur Unterhaltung');
    }
  }

  private async handleDisconnection(ws: ExtendedWebSocket): Promise<void> {
    if (ws.userId !== undefined) {
      this.clients.delete(ws.userId);

      // Offline-Status senden
      if (ws.tenantId !== undefined) {
        await this.broadcastUserStatus(ws.userId, ws.tenantId, 'offline');
      }
    }
  }

  private handleError(_ws: ExtendedWebSocket, error: unknown): void {
    logger.error({ err: error }, 'WebSocket Fehler');
  }

  private async broadcastUserStatus(
    userId: number,
    tenantId: number,
    status: string,
  ): Promise<void> {
    try {
      // Alle Unterhaltungen des Benutzers ermitteln
      // PostgreSQL params: $1=userId, $2=tenantId, $3=userId (for != check)
      const conversationsQuery = `
        SELECT DISTINCT cp2.user_id
        FROM conversation_participants cp1
        JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
        JOIN conversations c ON cp1.conversation_id = c.id
        WHERE cp1.user_id = $1 AND c.tenant_id = $2 AND cp2.user_id != $3
      `;
      const [relatedUsers] = await query<ConversationParticipantResult[]>(conversationsQuery, [
        userId,
        tenantId,
        userId,
      ]);

      // Status an alle verbundenen Benutzer senden
      for (const user of relatedUsers) {
        const userId = user.user_id;
        const clientWs = this.clients.get(userId);
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

  private sendMessage(ws: ExtendedWebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Heartbeat-System für Verbindungsüberwachung
  public startHeartbeat(): void {
    setInterval(() => {
      this.wss.clients.forEach((ws: ExtendedWebSocket) => {
        if (ws.isAlive === false) {
          ws.terminate();
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // Alle 30 Sekunden
  }
}

export default ChatWebSocketServer;
