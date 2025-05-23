const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const db = require('./database');

class ChatWebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/chat-ws'
    });
    
    this.clients = new Map(); // userId -> WebSocket connection
    this.init();
  }

  init() {
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    console.log('Chat WebSocket Server initialisiert');
  }

  async handleConnection(ws, request) {
    try {
      // Token aus Query-Parameter oder Header extrahieren
      const url = new URL(request.url, `http://${request.headers.host}`);
      const token = url.searchParams.get('token') || 
                   request.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        ws.close(1008, 'Token erforderlich');
        return;
      }

      // Token verifizieren
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
      const tenantId = decoded.tenant_id;

      // Benutzer-Informationen zur Verbindung hinzufügen
      ws.userId = userId;
      ws.tenantId = tenantId;
      ws.role = decoded.role;
      ws.isAlive = true;

      // Verbindung in Map speichern
      this.clients.set(userId, ws);

      console.log(`Chat WebSocket Verbindung für Benutzer ${userId} hergestellt`);

      // Event-Handler registrieren
      ws.on('message', (data) => this.handleMessage(ws, data));
      ws.on('close', () => this.handleDisconnection(ws));
      ws.on('error', (error) => this.handleError(ws, error));
      ws.on('pong', () => { ws.isAlive = true; });

      // Willkommensnachricht senden
      this.sendMessage(ws, {
        type: 'connection_established',
        data: { userId, timestamp: new Date().toISOString() }
      });

      // Online-Status an andere Benutzer senden
      await this.broadcastUserStatus(userId, tenantId, 'online');

    } catch (error) {
      console.error('WebSocket Authentifizierung fehlgeschlagen:', error);
      ws.close(1008, 'Authentifizierung fehlgeschlagen');
    }
  }

  async handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);
      
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
          this.sendMessage(ws, { type: 'pong', data: { timestamp: new Date().toISOString() } });
          break;
        default:
          console.warn('Unbekannter WebSocket Message Type:', message.type);
      }
    } catch (error) {
      console.error('Fehler beim Verarbeiten der WebSocket Nachricht:', error);
      this.sendMessage(ws, {
        type: 'error',
        data: { message: 'Fehler beim Verarbeiten der Nachricht' }
      });
    }
  }

  async handleSendMessage(ws, data) {
    const { conversationId, content, attachments = [] } = data;
    
    try {
      // Berechtigung prüfen
      const participantQuery = `
        SELECT user_id FROM conversation_participants 
        WHERE conversation_id = ? AND tenant_id = ?
      `;
      const [participants] = await db.query(participantQuery, [conversationId, ws.tenantId]);
      
      const participantIds = participants.map(p => p.user_id);
      if (!participantIds.includes(ws.userId)) {
        this.sendMessage(ws, {
          type: 'error',
          data: { message: 'Keine Berechtigung für diese Unterhaltung' }
        });
        return;
      }

      // Nachricht in Datenbank speichern
      const messageQuery = `
        INSERT INTO messages (conversation_id, sender_id, content, tenant_id)
        VALUES (?, ?, ?, ?)
      `;
      const [result] = await db.query(messageQuery, [
        conversationId, ws.userId, content, ws.tenantId
      ]);

      const messageId = result.insertId;

      // Sender-Informationen abrufen
      const senderQuery = `
        SELECT first_name, last_name, profile_picture_url 
        FROM users WHERE id = ?
      `;
      const [senderInfo] = await db.query(senderQuery, [ws.userId]);
      const sender = senderInfo[0];

      // Nachricht-Objekt für Broadcast erstellen
      const messageData = {
        id: messageId,
        conversation_id: conversationId,
        content: content,
        sender_id: ws.userId,
        sender_name: `${sender.first_name} ${sender.last_name}`,
        profile_picture_url: sender.profile_picture_url,
        created_at: new Date().toISOString(),
        attachments: attachments
      };

      // Nachricht an alle Teilnehmer senden
      for (const participantId of participantIds) {
        const clientWs = this.clients.get(participantId);
        if (clientWs && clientWs.readyState === WebSocket.OPEN) {
          this.sendMessage(clientWs, {
            type: 'new_message',
            data: messageData
          });
        }
      }

      // Bestätigung an Sender
      this.sendMessage(ws, {
        type: 'message_sent',
        data: { messageId, timestamp: new Date().toISOString() }
      });

    } catch (error) {
      console.error('Fehler beim Senden der Nachricht:', error);
      this.sendMessage(ws, {
        type: 'error',
        data: { message: 'Fehler beim Senden der Nachricht' }
      });
    }
  }

  async handleTyping(ws, data, isTyping) {
    const { conversationId } = data;
    
    try {
      // Teilnehmer der Unterhaltung ermitteln
      const participantQuery = `
        SELECT user_id FROM conversation_participants 
        WHERE conversation_id = ? AND tenant_id = ? AND user_id != ?
      `;
      const [participants] = await db.query(participantQuery, [
        conversationId, ws.tenantId, ws.userId
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
              timestamp: new Date().toISOString()
            }
          });
        }
      }
    } catch (error) {
      console.error('Fehler beim Typing-Event:', error);
    }
  }

  async handleMarkRead(ws, data) {
    const { messageId } = data;
    
    try {
      // Nachricht als gelesen markieren
      await db.query(`
        UPDATE messages 
        SET is_read = 1 
        WHERE id = ? 
        AND tenant_id = ?
        AND EXISTS (
          SELECT 1 FROM conversation_participants cp
          WHERE cp.conversation_id = messages.conversation_id 
          AND cp.user_id = ?
        )
      `, [messageId, ws.tenantId, ws.userId]);

      // Sender über Lesebestätigung informieren
      const messageQuery = `
        SELECT sender_id, conversation_id FROM messages WHERE id = ?
      `;
      const [messageInfo] = await db.query(messageQuery, [messageId]);
      
      if (messageInfo.length > 0) {
        const senderId = messageInfo[0].sender_id;
        const senderWs = this.clients.get(senderId);
        
        if (senderWs && senderWs.readyState === WebSocket.OPEN) {
          this.sendMessage(senderWs, {
            type: 'message_read',
            data: {
              messageId,
              readBy: ws.userId,
              timestamp: new Date().toISOString()
            }
          });
        }
      }
    } catch (error) {
      console.error('Fehler beim Markieren als gelesen:', error);
    }
  }

  async handleJoinConversation(ws, data) {
    const { conversationId } = data;
    
    // Conversation-ID zur WebSocket-Verbindung hinzufügen für Gruppierung
    if (!ws.conversations) {
      ws.conversations = new Set();
    }
    ws.conversations.add(conversationId);

    // Anderen Teilnehmern mitteilen, dass Benutzer online ist
    try {
      const participantQuery = `
        SELECT user_id FROM conversation_participants 
        WHERE conversation_id = ? AND tenant_id = ? AND user_id != ?
      `;
      const [participants] = await db.query(participantQuery, [
        conversationId, ws.tenantId, ws.userId
      ]);

      for (const participant of participants) {
        const clientWs = this.clients.get(participant.user_id);
        if (clientWs && clientWs.readyState === WebSocket.OPEN) {
          this.sendMessage(clientWs, {
            type: 'user_joined_conversation',
            data: {
              conversationId,
              userId: ws.userId,
              timestamp: new Date().toISOString()
            }
          });
        }
      }
    } catch (error) {
      console.error('Fehler beim Beitreten zur Unterhaltung:', error);
    }
  }

  async handleDisconnection(ws) {
    if (ws.userId) {
      this.clients.delete(ws.userId);
      console.log(`Chat WebSocket Verbindung für Benutzer ${ws.userId} getrennt`);
      
      // Offline-Status senden
      await this.broadcastUserStatus(ws.userId, ws.tenantId, 'offline');
    }
  }

  handleError(ws, error) {
    console.error('WebSocket Fehler:', error);
  }

  async broadcastUserStatus(userId, tenantId, status) {
    try {
      // Alle Unterhaltungen des Benutzers ermitteln
      const conversationsQuery = `
        SELECT DISTINCT cp2.user_id
        FROM conversation_participants cp1
        JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
        WHERE cp1.user_id = ? AND cp1.tenant_id = ? AND cp2.user_id != ?
      `;
      const [relatedUsers] = await db.query(conversationsQuery, [userId, tenantId, userId]);

      // Status an alle verbundenen Benutzer senden
      for (const user of relatedUsers) {
        const clientWs = this.clients.get(user.user_id);
        if (clientWs && clientWs.readyState === WebSocket.OPEN) {
          this.sendMessage(clientWs, {
            type: 'user_status_changed',
            data: {
              userId,
              status,
              timestamp: new Date().toISOString()
            }
          });
        }
      }
    } catch (error) {
      console.error('Fehler beim Senden des User-Status:', error);
    }
  }

  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Heartbeat-System für Verbindungsüberwachung
  startHeartbeat() {
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
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
  async processScheduledMessages() {
    try {
      const query = `
        SELECT m.*, c.id as conversation_id
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE m.scheduled_delivery IS NOT NULL 
        AND m.scheduled_delivery <= NOW()
        AND m.delivery_status = 'scheduled'
      `;
      
      const [scheduledMessages] = await db.query(query);

      for (const message of scheduledMessages) {
        // Nachricht als zugestellt markieren
        await db.query(
          'UPDATE messages SET delivery_status = "delivered", scheduled_delivery = NULL WHERE id = ?',
          [message.id]
        );

        // Nachricht an alle Teilnehmer senden
        const participantQuery = `
          SELECT user_id FROM conversation_participants 
          WHERE conversation_id = ?
        `;
        const [participants] = await db.query(participantQuery, [message.conversation_id]);

        // Sender-Informationen abrufen
        const senderQuery = `
          SELECT first_name, last_name, profile_picture_url 
          FROM users WHERE id = ?
        `;
        const [senderInfo] = await db.query(senderQuery, [message.sender_id]);
        const sender = senderInfo[0];

        const messageData = {
          id: message.id,
          conversation_id: message.conversation_id,
          content: message.content,
          sender_id: message.sender_id,
          sender_name: `${sender.first_name} ${sender.last_name}`,
          profile_picture_url: sender.profile_picture_url,
          created_at: message.created_at,
          is_scheduled: true
        };

        for (const participant of participants) {
          const clientWs = this.clients.get(participant.user_id);
          if (clientWs && clientWs.readyState === WebSocket.OPEN) {
            this.sendMessage(clientWs, {
              type: 'scheduled_message_delivered',
              data: messageData
            });
          }
        }
      }
    } catch (error) {
      console.error('Fehler beim Verarbeiten geplanter Nachrichten:', error);
    }
  }

  // Geplante Nachrichten alle Minute prüfen
  startScheduledMessageProcessor() {
    setInterval(() => {
      this.processScheduledMessages();
    }, 60000); // Alle 60 Sekunden
  }
}

module.exports = ChatWebSocketServer;