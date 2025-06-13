import { WebSocket, WebSocketServer, Data as WebSocketData } from 'ws';
import jwt from 'jsonwebtoken';
import { URL } from 'url';
import { Server } from 'http';
import db from './database.js';
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
  data: any;
}

interface SendMessageData {
  conversationId: number;
  content: string;
  attachments?: any[];
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
    this.wss.on('connection', (ws: ExtendedWebSocket, request) => {
      this.handleConnection(ws, request);
    });
  }

  private async handleConnection(
    ws: ExtendedWebSocket,
    request: any
  ): Promise<void> {
    try {
      // Token aus Query-Parameter oder Header extrahieren
      const url = new URL(request.url, `http://${request.headers.host}`);
      const token =
        url.searchParams.get('token') ||
        request.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        ws.close(1008, 'Token erforderlich');
        return;
      }

      // Token verifizieren
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      const userId = decoded.id;
      const tenantId = decoded.tenant_id;

      // Benutzer-Informationen zur Verbindung hinzufügen
      ws.userId = userId;
      ws.tenantId = tenantId;
      ws.role = decoded.role;
      ws.isAlive = true;

      // Verbindung in Map speichern
      this.clients.set(userId, ws);

      // Event-Handler registrieren
      ws.on('message', (data) => this.handleMessage(ws, data));
      ws.on('close', () => this.handleDisconnection(ws));
      ws.on('error', (error) => this.handleError(ws, error));
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
    } catch (error) {
      logger.error('WebSocket Authentifizierung fehlgeschlagen:', error);
      ws.close(1008, 'Authentifizierung fehlgeschlagen');
    }
  }

  private async handleMessage(
    ws: ExtendedWebSocket,
    data: WebSocketData
  ): Promise<void> {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'send_message':
          await this.handleSendMessage(ws, message.data);
          break;
        case 'typing_start':
          await this.handleTyping(ws, message.data, true);
          break;
        case 'typing_stop':
          await this.handleTyping(ws, message.data, false);
          break;
        case 'mark_read':
          await this.handleMarkRead(ws, message.data);
          break;
        case 'join_conversation':
          await this.handleJoinConversation(ws, message.data);
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
    } catch (error) {
      logger.error('Fehler beim Verarbeiten der WebSocket Nachricht:', error);
      this.sendMessage(ws, {
        type: 'error',
        data: { message: 'Fehler beim Verarbeiten der Nachricht' },
      });
    }
  }

  private async handleSendMessage(
    ws: ExtendedWebSocket,
    data: SendMessageData
  ): Promise<void> {
    const { conversationId, content, attachments = [] } = data;

    logger.debug(`Handling send message:`, {
      conversationId,
      userId: ws.userId,
      tenantId: ws.tenantId,
      contentLength: content?.length,
      hasAttachments: attachments.length > 0,
    });

    try {
      // Berechtigung prüfen
      const participantQuery = `
        SELECT cp.user_id 
        FROM conversation_participants cp
        JOIN conversations c ON cp.conversation_id = c.id
        WHERE cp.conversation_id = ? AND c.tenant_id = ?
      `;
      const [participants] = await (db as any).query(participantQuery, [
        conversationId,
        ws.tenantId,
      ]);

      const participantIds = participants.map((p: any) => p.user_id);

      // Convert IDs to strings for comparison since ws.userId might be a string
      const participantIdsStr = participantIds.map((id: number) => String(id));
      if (!participantIdsStr.includes(String(ws.userId))) {
        this.sendMessage(ws, {
          type: 'error',
          data: { message: 'Keine Berechtigung für diese Unterhaltung' },
        });
        return;
      }

      // Nachricht in Datenbank speichern
      const messageQuery = `
        INSERT INTO messages (conversation_id, sender_id, content, tenant_id)
        VALUES (?, ?, ?, ?)
      `;
      const [result] = await (db as any).query(messageQuery, [
        conversationId,
        ws.userId,
        content,
        ws.tenantId,
      ]);

      const messageId = result.insertId;

      // Sender-Informationen abrufen
      const senderQuery = `
        SELECT id, username, first_name, last_name, profile_picture_url 
        FROM users WHERE id = ?
      `;
      const [senderInfo] = await (db as any).query(senderQuery, [ws.userId]);
      const sender = senderInfo[0];

      // Nachricht-Objekt für Broadcast erstellen
      const messageData = {
        id: messageId,
        conversation_id: conversationId,
        content,
        sender_id: ws.userId,
        sender_name: sender
          ? [sender.first_name, sender.last_name]
              .filter((n: string) => n)
              .join(' ') ||
            sender.username ||
            'Unbekannter Benutzer'
          : 'Unbekannter Benutzer',
        first_name: sender?.first_name || '',
        last_name: sender?.last_name || '',
        username: sender?.username || '',
        profile_picture_url: sender?.profile_picture_url || null,
        created_at: new Date().toISOString(),
        delivery_status: 'sent',
        is_read: false,
        attachments: attachments || [],
      };

      // Nachricht an alle Teilnehmer senden
      for (const participantId of participantIds) {
        const clientWs = this.clients.get(participantId);
        if (clientWs && clientWs.readyState === WebSocket.OPEN) {
          this.sendMessage(clientWs, {
            type: 'new_message',
            data: messageData,
          });
        }
      }

      // Bestätigung an Sender
      this.sendMessage(ws, {
        type: 'message_sent',
        data: { messageId, timestamp: new Date().toISOString() },
      });
    } catch (error) {
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
    isTyping: boolean
  ): Promise<void> {
    const { conversationId } = data;

    try {
      // Teilnehmer der Unterhaltung ermitteln
      const participantQuery = `
        SELECT cp.user_id 
        FROM conversation_participants cp
        JOIN conversations c ON cp.conversation_id = c.id
        WHERE cp.conversation_id = ? AND c.tenant_id = ? AND cp.user_id != ?
      `;
      const [participants] = await (db as any).query(participantQuery, [
        conversationId,
        ws.tenantId,
        ws.userId,
      ]);

      // Typing-Event an andere Teilnehmer senden
      for (const participant of participants) {
        const clientWs = this.clients.get(participant.user_id);
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
    } catch (error) {
      logger.error('Fehler beim Typing-Event:', error);
    }
  }

  private async handleMarkRead(
    ws: ExtendedWebSocket,
    data: MarkReadData
  ): Promise<void> {
    const { messageId } = data;

    try {
      // Nachricht als gelesen markieren
      await (db as any).query(
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
        [messageId, ws.tenantId, ws.userId]
      );

      // Sender über Lesebestätigung informieren
      const messageQuery = `
        SELECT sender_id, conversation_id FROM messages WHERE id = ?
      `;
      const [messageInfo] = await (db as any).query(messageQuery, [messageId]);

      if (messageInfo.length > 0) {
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
    } catch (error) {
      logger.error('Fehler beim Markieren als gelesen:', error);
    }
  }

  private async handleJoinConversation(
    ws: ExtendedWebSocket,
    data: JoinConversationData
  ): Promise<void> {
    const { conversationId } = data;

    // Conversation-ID zur WebSocket-Verbindung hinzufügen für Gruppierung
    if (!ws.conversations) {
      ws.conversations = new Set();
    }
    ws.conversations.add(conversationId);

    // Anderen Teilnehmern mitteilen, dass Benutzer online ist
    try {
      const participantQuery = `
        SELECT cp.user_id 
        FROM conversation_participants cp
        JOIN conversations c ON cp.conversation_id = c.id
        WHERE cp.conversation_id = ? AND c.tenant_id = ? AND cp.user_id != ?
      `;
      const [participants] = await (db as any).query(participantQuery, [
        conversationId,
        ws.tenantId,
        ws.userId,
      ]);

      for (const participant of participants) {
        const clientWs = this.clients.get(participant.user_id);
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
    } catch (error) {
      logger.error('Fehler beim Beitreten zur Unterhaltung:', error);
    }
  }

  private async handleDisconnection(ws: ExtendedWebSocket): Promise<void> {
    if (ws.userId) {
      this.clients.delete(ws.userId);

      // Offline-Status senden
      await this.broadcastUserStatus(ws.userId, ws.tenantId!, 'offline');
    }
  }

  private handleError(_ws: ExtendedWebSocket, error: Error): void {
    logger.error('WebSocket Fehler:', error);
  }

  private async broadcastUserStatus(
    userId: number,
    tenantId: number,
    status: string
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
      const [relatedUsers] = await (db as any).query(conversationsQuery, [
        userId,
        tenantId,
        userId,
      ]);

      // Status an alle verbundenen Benutzer senden
      for (const user of relatedUsers) {
        const clientWs = this.clients.get(user.user_id);
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
    } catch (error) {
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

  // Geplante Nachrichten verarbeiten
  private async processScheduledMessages(): Promise<void> {
    try {
      const query = `
        SELECT m.*, c.id as conversation_id
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE m.scheduled_delivery IS NOT NULL 
        AND m.scheduled_delivery <= NOW()
        AND m.delivery_status = 'scheduled'
      `;

      const [scheduledMessages] = await (db as any).query(query);

      for (const message of scheduledMessages) {
        // Nachricht als zugestellt markieren
        await (db as any).query(
          'UPDATE messages SET delivery_status = "delivered", scheduled_delivery = NULL WHERE id = ?',
          [message.id]
        );

        // Nachricht an alle Teilnehmer senden
        const participantQuery = `
          SELECT user_id FROM conversation_participants 
          WHERE conversation_id = ?
        `;
        const [participants] = await (db as any).query(participantQuery, [
          message.conversation_id,
        ]);

        // Sender-Informationen abrufen
        const senderQuery = `
          SELECT first_name, last_name, profile_picture_url 
          FROM users WHERE id = ?
        `;
        const [senderInfo] = await (db as any).query(senderQuery, [
          message.sender_id,
        ]);
        const sender = senderInfo[0];

        const messageData = {
          id: message.id,
          conversation_id: message.conversation_id,
          content: message.content,
          sender_id: message.sender_id,
          sender_name: sender
            ? [sender.first_name || '', sender.last_name || '']
                .filter((n: string) => n)
                .join(' ') || 'Unbekannter Benutzer'
            : 'Unbekannter Benutzer',
          first_name: sender?.first_name || '',
          last_name: sender?.last_name || '',
          profile_picture_url: sender?.profile_picture_url || null,
          created_at: message.created_at,
          delivery_status: 'delivered',
          is_read: false,
          is_scheduled: true,
          attachments: [],
        };

        for (const participant of participants) {
          const clientWs = this.clients.get(participant.user_id);
          if (clientWs && clientWs.readyState === WebSocket.OPEN) {
            this.sendMessage(clientWs, {
              type: 'scheduled_message_delivered',
              data: messageData,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Fehler beim Verarbeiten geplanter Nachrichten:', error);
    }
  }

  // Geplante Nachrichten alle Minute prüfen
  public startScheduledMessageProcessor(): void {
    setInterval(() => {
      this.processScheduledMessages();
    }, 60000); // Alle 60 Sekunden
  }

  // Message Delivery Queue verarbeiten
  private async processMessageDeliveryQueue(): Promise<void> {
    try {
      // Hole ausstehende Nachrichten aus der Queue
      const query = `
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
          u.profile_picture_url
        FROM message_delivery_queue mdq
        JOIN messages m ON mdq.message_id = m.id
        JOIN users u ON m.sender_id = u.id
        WHERE mdq.status = 'pending'
        AND mdq.attempts < 3
        LIMIT 50
      `;

      const [queuedMessages] = await (db as any).query(query);

      for (const message of queuedMessages) {
        try {
          // Update status to processing
          await (db as any).query(
            'UPDATE message_delivery_queue SET status = "processing", last_attempt = NOW(), attempts = attempts + 1 WHERE id = ?',
            [message.queue_id]
          );

          // Nachricht-Objekt erstellen
          const messageData = {
            id: message.message_id,
            conversation_id: message.conversation_id,
            content: message.content,
            sender_id: message.sender_id,
            sender_name:
              `${message.first_name || ''} ${message.last_name || ''}`.trim() ||
              'Unbekannter Benutzer',
            first_name: message.first_name || '',
            last_name: message.last_name || '',
            profile_picture_url: message.profile_picture_url || null,
            created_at: message.created_at,
            delivery_status: 'delivered',
            is_read: false,
            attachments: [],
          };

          // An Empfänger senden wenn online
          const recipientWs = this.clients.get(message.recipient_id);
          if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
            this.sendMessage(recipientWs, {
              type: 'new_message',
              data: messageData,
            });
          }

          // Als zugestellt markieren
          await (db as any).query(
            'UPDATE message_delivery_queue SET status = "delivered" WHERE id = ?',
            [message.queue_id]
          );

          // Delivery status in messages table aktualisieren
          await (db as any).query(
            'UPDATE messages SET delivery_status = "delivered" WHERE id = ?',
            [message.message_id]
          );
        } catch (error) {
          logger.error(
            `Fehler beim Zustellen der Nachricht ${message.message_id}:`,
            error
          );

          // Bei Fehler als failed markieren wenn max attempts erreicht
          const [result] = await (db as any).query(
            'SELECT attempts FROM message_delivery_queue WHERE id = ?',
            [message.queue_id]
          );

          if (result[0]?.attempts >= 3) {
            await (db as any).query(
              'UPDATE message_delivery_queue SET status = "failed" WHERE id = ?',
              [message.queue_id]
            );
            await (db as any).query(
              'UPDATE messages SET delivery_status = "failed" WHERE id = ?',
              [message.message_id]
            );
          } else {
            // Zurück auf pending setzen für erneuten Versuch
            await (db as any).query(
              'UPDATE message_delivery_queue SET status = "pending" WHERE id = ?',
              [message.queue_id]
            );
          }
        }
      }
    } catch (error) {
      logger.error(
        'Fehler beim Verarbeiten der Message Delivery Queue:',
        error
      );
    }
  }

  // Message Delivery Queue Processor starten
  public startMessageDeliveryProcessor(): void {
    // Initial ausführen
    this.processMessageDeliveryQueue();

    // Alle 5 Sekunden prüfen
    setInterval(() => {
      this.processMessageDeliveryQueue();
    }, 5000);
  }
}

export default ChatWebSocketServer;
