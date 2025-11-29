import { IncomingMessage, Server } from 'http';
import jwt from 'jsonwebtoken';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { URL } from 'url';
import { WebSocket, Data as WebSocketData, WebSocketServer } from 'ws';

import { execute, query } from './utils/db.js';
import { logger } from './utils/logger.js';

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
  attachments?: {
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }[];
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

interface MessageDetailsResult extends RowDataPacket {
  id: number;
  conversation_id: number;
  content: string;
  sender_id: number;
  created_at: Date | string;
  tenant_id: number;
}

interface MessageWithSenderResult extends RowDataPacket {
  queue_id: number; // From message_delivery_queue.id
  message_id: number;
  conversation_id: number;
  content: string;
  sender_id: number;
  recipient_id: number; // From message_delivery_queue.recipient_id
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
  created_at: Date | string;
}

interface NotificationQueueResult extends RowDataPacket {
  queue_id: number;
  recipient_id: number;
  message_id: number;
  attempts: number;
}

export class ChatWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<number, ExtendedWebSocket>;

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/chat-ws',
    });

    this.clients = new Map();
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

  private async handleConnection(
    ws: ExtendedWebSocket,
    request: {
      url: string | undefined;
      headers: {
        host: string | undefined;
        authorization: string | undefined;
      };
    },
  ): Promise<void> {
    try {
      // Token aus Query-Parameter oder Header extrahieren
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      const token =
        url.searchParams.get('token') ?? request.headers.authorization?.replace('Bearer ', '');

      if (token === undefined || token === '') {
        ws.close(1008, 'Token erforderlich');
        return;
      }

      // Token verifizieren
      const jwtSecret = process.env['JWT_SECRET'];
      if (jwtSecret === undefined || jwtSecret === '') {
        ws.close(1008, 'JWT Secret nicht konfiguriert');
        return;
      }

      const decoded = jwt.verify(token, jwtSecret) as {
        id: number;
        tenantId: number; // v2 uses camelCase!
        role: string;
      };
      const userId = decoded.id;
      const tenantId = decoded.tenantId; // Use camelCase to match v2 tokens

      // Benutzer-Informationen zur Verbindung hinzufügen
      ws.userId = userId;
      ws.tenantId = tenantId;
      ws.role = decoded.role;
      ws.isAlive = true;

      // Verbindung in Map speichern
      this.clients.set(userId, ws);

      // Event-Handler registrieren
      ws.on('message', (data: WebSocketData) => void this.handleMessage(ws, data));
      ws.on('close', () => void this.handleDisconnection(ws));
      ws.on('error', (error: Error) => {
        this.handleError(ws, error);
      });
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Willkommensnachricht senden
      this.sendMessage(ws, {
        type: 'connection_established',
        data: { userId, timestamp: new Date().toISOString() },
      });

      // Online-Status an andere Benutzer senden
      await this.broadcastUserStatus(userId, tenantId, 'online');
    } catch (error: unknown) {
      logger.error('WebSocket Authentifizierung fehlgeschlagen:', error);
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
      logger.error('Fehler beim Verarbeiten der WebSocket Nachricht:', error);
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
      WHERE cp.conversation_id = ?
      AND c.tenant_id = ?
      AND cp.tenant_id = ?
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
      INSERT INTO messages (conversation_id, sender_id, content, tenant_id)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await execute<ResultSetHeader>(messageQuery, [
      conversationId,
      senderId,
      content,
      tenantId,
    ]);
    return result.insertId;
  }

  private async getSenderInfo(userId: number, tenantId: number): Promise<
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
      FROM users WHERE id = ? AND tenant_id = ?
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
    return {
      id: messageId,
      conversation_id: conversationId,
      content,
      sender_id: senderId,
      sender_name: this.getSenderDisplayName(sender, UNKNOWN_USER),
      first_name: sender?.first_name ?? '',
      last_name: sender?.last_name ?? '',
      username: sender?.username ?? '',
      profile_picture_url: sender?.profile_picture_url ?? null,
      created_at: new Date().toISOString(),
      delivery_status: 'sent',
      is_read: false,
      attachments,
    };
  }

  /**
   * Broadcast message to all participants in a conversation
   */
  private broadcastToParticipants(participantIds: number[], type: string, data: unknown): void {
    for (const participantId of participantIds) {
      const clientWs = this.clients.get(participantId);
      if (clientWs !== undefined && clientWs.readyState === WebSocket.OPEN) {
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
    const { conversationId, content, attachments = [] } = data;

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

      const messageId = await this.saveMessage(conversationId, ws.userId, content, ws.tenantId);
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
      logger.error('Fehler beim Senden der Nachricht:', error);
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
        WHERE cp.conversation_id = ?
        AND c.tenant_id = ?
        AND cp.tenant_id = ?
        AND cp.user_id != ?
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
        if (clientWs && clientWs.readyState === WebSocket.OPEN) {
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
      logger.error('Fehler beim Typing-Event:', error);
    }
  }

  private async handleMarkRead(ws: ExtendedWebSocket, data: MarkReadData): Promise<void> {
    const { messageId } = data;

    try {
      // Nachricht als gelesen markieren
      await execute<ResultSetHeader>(
        `
        UPDATE messages
        SET is_read = 1
        WHERE id = ?
        AND tenant_id = ?
        AND EXISTS (
          SELECT 1 FROM conversation_participants cp
          WHERE cp.conversation_id = messages.conversation_id
          AND cp.user_id = ?
        )
      `,
        [messageId, ws.tenantId, ws.userId],
      );

      // Sender über Lesebestätigung informieren
      const messageQuery = `
        SELECT sender_id, conversation_id FROM messages WHERE id = ?
      `;
      const [messageInfo] = await query<MessageInfoResult[]>(messageQuery, [messageId]);

      if (messageInfo.length > 0 && messageInfo[0] !== undefined) {
        const senderId = messageInfo[0].sender_id;
        const senderWs = this.clients.get(senderId);

        if (senderWs && senderWs.readyState === WebSocket.OPEN) {
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
      logger.error('Fehler beim Markieren als gelesen:', error);
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
        WHERE cp.conversation_id = ?
        AND c.tenant_id = ?
        AND cp.tenant_id = ?
        AND cp.user_id != ?
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
        if (clientWs && clientWs.readyState === WebSocket.OPEN) {
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
      logger.error('Fehler beim Beitreten zur Unterhaltung:', error);
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
    logger.error('WebSocket Fehler:', error);
  }

  private async broadcastUserStatus(
    userId: number,
    tenantId: number,
    status: string,
  ): Promise<void> {
    try {
      // Alle Unterhaltungen des Benutzers ermitteln
      const conversationsQuery = `
        SELECT DISTINCT cp2.user_id
        FROM conversation_participants cp1
        JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
        JOIN conversations c ON cp1.conversation_id = c.id
        WHERE cp1.user_id = ? AND c.tenant_id = ? AND cp2.user_id != ?
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
        if (clientWs && clientWs.readyState === WebSocket.OPEN) {
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
      logger.error('Fehler beim Senden des User-Status:', error);
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

  /**
   * Process a single scheduled message - mark delivered and broadcast
   */
  private async processOneScheduledMessage(message: MessageDetailsResult): Promise<void> {
    await execute<ResultSetHeader>(
      'UPDATE messages SET delivery_status = "delivered", scheduled_delivery = NULL WHERE id = ?',
      [message.id],
    );

    const [participants] = await query<ConversationParticipantResult[]>(
      'SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND tenant_id = ?',
      [message.conversation_id, message.tenant_id],
    );

    const [senderInfo] = await query<UserInfoResult[]>(
      'SELECT first_name, last_name, profile_picture as profile_picture_url FROM users WHERE id = ? AND tenant_id = ?',
      [message.sender_id, message.tenant_id],
    );
    const sender = senderInfo[0] as
      | { first_name: string | null; last_name: string | null; profile_picture_url: string | null }
      | undefined;

    const messageData = {
      id: message.id,
      conversation_id: message.conversation_id,
      content: message.content,
      sender_id: message.sender_id,
      sender_name: this.getSenderDisplayName(sender, 'Unbekannter Benutzer'),
      first_name: sender?.first_name ?? '',
      last_name: sender?.last_name ?? '',
      profile_picture_url: sender?.profile_picture_url ?? null,
      created_at: message.created_at as string,
      delivery_status: 'delivered',
      is_read: false,
      is_scheduled: true,
      attachments: [] as {
        filename: string;
        content?: string | Buffer;
        path?: string;
        contentType?: string;
      }[],
    };

    const participantIds = participants.map((p: ConversationParticipantResult) => p.user_id);
    this.broadcastToParticipants(participantIds, 'scheduled_message_delivered', messageData);
  }

  // Geplante Nachrichten verarbeiten
  private async processScheduledMessages(): Promise<void> {
    try {
      const [scheduledMessages] = await query<MessageDetailsResult[]>(`
        SELECT m.*, c.id as conversation_id
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE m.scheduled_delivery IS NOT NULL
        AND m.scheduled_delivery <= NOW()
        AND m.delivery_status = 'scheduled'
      `);

      for (const message of scheduledMessages) {
        await this.processOneScheduledMessage(message);
      }
    } catch (error: unknown) {
      logger.error('Fehler beim Verarbeiten geplanter Nachrichten:', error);
    }
  }

  // Geplante Nachrichten alle Minute prüfen
  public startScheduledMessageProcessor(): void {
    setInterval(() => {
      void this.processScheduledMessages();
    }, 60000); // Alle 60 Sekunden
  }

  /**
   * Get queued messages from database
   */
  private async getQueuedMessages(): Promise<MessageWithSenderResult[]> {
    const queueQuery = `
      SELECT
        mdq.id as queue_id,
        mdq.message_id,
        mdq.recipient_id,
        m.conversation_id,
        m.content,
        m.sender_id,
        m.created_at,
        u.first_name,
        u.last_name,
        u.profile_picture as profile_picture_url
      FROM message_delivery_queue mdq
      JOIN messages m ON mdq.message_id = m.id
      JOIN users u ON m.sender_id = u.id
      WHERE mdq.status = 'pending'
      AND mdq.attempts < 3
      LIMIT 50
    `;

    const [queuedMessages] = await query<MessageWithSenderResult[]>(queueQuery);
    return queuedMessages;
  }

  /**
   * Build message data object from database row
   */
  private buildMessageDataFromRow(message: MessageWithSenderResult): {
    id: number;
    conversation_id: number;
    content: string;
    sender_id: number;
    sender_name: string;
    first_name: string;
    last_name: string;
    profile_picture_url: string | null;
    created_at: string;
    delivery_status: string;
    is_read: boolean;
    attachments: {
      filename: string;
      content?: string | Buffer;
      path?: string;
      contentType?: string;
    }[];
  } {
    return {
      id: message.message_id,
      conversation_id: message.conversation_id,
      content: message.content,
      sender_id: message.sender_id,
      sender_name: (() => {
        const name = `${message.first_name ?? ''} ${message.last_name ?? ''}`.trim();
        return name !== '' ? name : 'Unbekannter Benutzer';
      })(),
      first_name: message.first_name ?? '',
      last_name: message.last_name ?? '',
      profile_picture_url: message.profile_picture_url ?? null,
      created_at:
        typeof message.created_at === 'string' ?
          message.created_at
        : message.created_at.toISOString(),
      delivery_status: 'delivered',
      is_read: false,
      attachments: [],
    };
  }

  /**
   * Deliver message to recipient
   */
  private async deliverMessage(message: MessageWithSenderResult): Promise<void> {
    // Update status to processing
    await execute<ResultSetHeader>(
      'UPDATE message_delivery_queue SET status = "processing", last_attempt = NOW(), attempts = attempts + 1 WHERE id = ?',
      [message.queue_id],
    );

    // Build message data
    const messageData = this.buildMessageDataFromRow(message);

    // Send to recipient if online
    const recipientId = message.recipient_id;
    const recipientWs = this.clients.get(recipientId);
    if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
      this.sendMessage(recipientWs, {
        type: 'new_message',
        data: messageData,
      });
    }

    // Mark as delivered
    await execute<ResultSetHeader>(
      'UPDATE message_delivery_queue SET status = "delivered" WHERE id = ?',
      [message.queue_id],
    );

    await execute<ResultSetHeader>(
      'UPDATE messages SET delivery_status = "delivered" WHERE id = ?',
      [message.message_id],
    );
  }

  /**
   * Handle message delivery failure
   */
  private async handleDeliveryFailure(message: MessageWithSenderResult): Promise<void> {
    const [result] = await query<NotificationQueueResult[]>(
      'SELECT attempts FROM message_delivery_queue WHERE id = ?',
      [message.queue_id],
    );

    if (result[0] && result[0].attempts >= 3) {
      // Mark as failed after max attempts
      await execute<ResultSetHeader>(
        'UPDATE message_delivery_queue SET status = "failed" WHERE id = ?',
        [message.queue_id],
      );
      await execute<ResultSetHeader>(
        'UPDATE messages SET delivery_status = "failed" WHERE id = ?',
        [message.message_id],
      );
    } else {
      // Reset to pending for retry
      await execute<ResultSetHeader>(
        'UPDATE message_delivery_queue SET status = "pending" WHERE id = ?',
        [message.queue_id],
      );
    }
  }

  /**
   * Process single message from queue
   */
  private async processSingleMessage(message: MessageWithSenderResult): Promise<void> {
    try {
      await this.deliverMessage(message);
    } catch (error: unknown) {
      logger.error(`Fehler beim Zustellen der Nachricht ${String(message.message_id)}:`, error);
      await this.handleDeliveryFailure(message);
    }
  }

  // Message Delivery Queue verarbeiten
  private async processMessageDeliveryQueue(): Promise<void> {
    try {
      const queuedMessages = await this.getQueuedMessages();

      for (const message of queuedMessages) {
        await this.processSingleMessage(message);
      }
    } catch (error: unknown) {
      logger.error('Fehler beim Verarbeiten der Message Delivery Queue:', error);
    }
  }

  // Message Delivery Queue Processor starten
  public startMessageDeliveryProcessor(): void {
    // Initial ausführen
    void this.processMessageDeliveryQueue();

    // Alle 5 Sekunden prüfen
    setInterval(() => {
      void this.processMessageDeliveryQueue();
    }, 5000);
  }
}

export default ChatWebSocketServer;
