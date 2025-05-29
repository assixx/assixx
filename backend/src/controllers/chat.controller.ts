/**
 * Chat Controller
 * Handles chat-related operations including messages, conversations, and file attachments
 */

import { Request, Response } from 'express';
import { Pool } from 'mysql2/promise';
import chatService from '../services/chat.service';
import path from 'path';
import fs from 'fs/promises';

// Multer file type
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

// Extended Request interfaces for chat operations
interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    tenantId: number;
    id: number;
    username: string;
    email: string;
    role: string;
  };
  tenantDb?: Pool;
}

interface ChatUsersRequest extends AuthenticatedRequest {
  user: {
    userId: number;
    tenantId: number;
    id: number;
    username: string;
    email: string;
    role: string;
  };
}

interface CreateConversationRequest extends AuthenticatedRequest {
  user: {
    userId: number;
    tenantId: number;
    id: number;
    username: string;
    email: string;
    role: string;
  };
  body: {
    participantIds: number[];
    isGroup?: boolean;
    name?: string;
  };
}

interface GetMessagesRequest extends AuthenticatedRequest {
  user: {
    userId: number;
    tenantId: number;
    id: number;
    username: string;
    email: string;
    role: string;
  };
  params: {
    id: string;
  };
  query: {
    limit?: string;
    offset?: string;
  };
}

interface SendMessageRequest extends AuthenticatedRequest {
  user: {
    userId: number;
    tenantId: number;
    id: number;
    username: string;
    email: string;
    role: string;
  };
  params: {
    id: string;
  };
  body: {
    content?: string;
  };
  file?: MulterFile;
}

interface GetAttachmentRequest extends Request {
  params: {
    filename: string;
  };
}

interface MessageActionRequest extends AuthenticatedRequest {
  user: {
    userId: number;
    tenantId: number;
    id: number;
    username: string;
    email: string;
    role: string;
  };
  params: {
    id: string;
  };
}

interface ConversationActionRequest extends AuthenticatedRequest {
  user: {
    userId: number;
    tenantId: number;
    id: number;
    username: string;
    email: string;
    role: string;
  };
  params: {
    id: string;
  };
}

interface UnreadCountRequest extends AuthenticatedRequest {
  user: {
    userId: number;
    tenantId: number;
    id: number;
    username: string;
    email: string;
    role: string;
  };
  tenantDb: Pool;
}

// Attachment interface
interface MessageAttachment {
  path: string;
  name: string;
  type: string;
}

class ChatController {
  /**
   * Holt alle verfügbaren Chat-Benutzer
   * GET /api/chat/users
   */
  async getUsers(req: ChatUsersRequest, res: Response): Promise<void> {
    try {
      // Debug logging
      console.log('getUsers - Full req.user:', req.user);
      console.log(
        'getUsers - tenantId type:',
        typeof req.user.tenantId,
        'value:',
        req.user.tenantId
      );
      console.log(
        'getUsers - userId type:',
        typeof req.user.userId,
        'value:',
        req.user.userId
      );

      // Convert to numbers to ensure proper data types
      const tenantId = parseInt(String(req.user.tenantId));
      const userId = parseInt(String(req.user.userId));

      console.log('getUsers - Parsed tenantId:', tenantId, 'userId:', userId);

      const users = await chatService.getUsers(tenantId, userId);
      res.json(users);
    } catch (error) {
      console.error('Fehler beim Abrufen der Benutzer:', error);
      res.status(500).json({ error: 'Fehler beim Abrufen der Benutzer' });
    }
  }

  /**
   * Holt alle Konversationen des Benutzers
   * GET /api/chat/conversations
   */
  async getConversations(req: ChatUsersRequest, res: Response): Promise<void> {
    try {
      console.log('Chat getConversations - user:', req.user);
      console.log('tenantId:', req.user.tenantId, 'userId:', req.user.userId);

      // Convert to numbers to ensure proper data types
      const tenantId = parseInt(String(req.user.tenantId));
      const userId = parseInt(String(req.user.userId));

      const conversations = await chatService.getConversations(
        tenantId,
        userId
      );
      res.json(conversations);
    } catch (error) {
      console.error('Fehler beim Abrufen der Konversationen:', error);
      console.error(
        'Stack:',
        error instanceof Error ? error.stack : 'Unknown error'
      );
      res.status(500).json({ error: 'Fehler beim Abrufen der Konversationen' });
    }
  }

  /**
   * Erstellt eine neue Konversation
   * POST /api/chat/conversations
   */
  async createConversation(
    req: CreateConversationRequest,
    res: Response
  ): Promise<void> {
    try {
      const { participantIds, isGroup, name } = req.body;

      if (!participantIds || participantIds.length === 0) {
        res.status(400).json({ error: 'Keine Teilnehmer angegeben' });
        return;
      }

      const result = await chatService.createConversation(
        req.user.tenantId,
        req.user.userId,
        participantIds,
        isGroup,
        name
      );

      res.json(result);
    } catch (error) {
      console.error('Fehler beim Erstellen der Konversation:', error);
      res.status(500).json({ error: 'Fehler beim Erstellen der Konversation' });
    }
  }

  /**
   * Holt Nachrichten einer Konversation
   * GET /api/chat/conversations/:id/messages
   */
  async getMessages(req: GetMessagesRequest, res: Response): Promise<void> {
    try {
      const conversationId = parseInt(req.params.id, 10);
      const limit = parseInt(req.query.limit || '50', 10);
      const offset = parseInt(req.query.offset || '0', 10);

      const result = await chatService.getMessages(
        req.user.tenantId,
        conversationId,
        req.user.userId,
        limit,
        offset
      );

      res.json(result);
    } catch (error) {
      console.error('Fehler beim Abrufen der Nachrichten:', error);
      if (error instanceof Error && error.message === 'Nicht autorisiert') {
        res.status(403).json({ error: 'Nicht autorisiert' });
      } else {
        res.status(500).json({ error: 'Fehler beim Abrufen der Nachrichten' });
      }
    }
  }

  /**
   * Sendet eine Nachricht (mit optionalem Anhang)
   * POST /api/chat/conversations/:id/messages
   */
  async sendMessage(req: SendMessageRequest, res: Response): Promise<void> {
    try {
      const conversationId = parseInt(req.params.id, 10);
      const { content } = req.body;

      if (!content && !req.file) {
        res.status(400).json({ error: 'Nachricht oder Anhang erforderlich' });
        return;
      }

      let attachment: MessageAttachment | null = null;
      if (req.file) {
        attachment = {
          path: `/uploads/chat/${req.file.filename}`,
          name: req.file.originalname,
          type: req.file.mimetype,
        };
      }

      const message = await chatService.sendMessage(
        req.user.tenantId,
        conversationId,
        req.user.userId,
        content || '',
        attachment
      );

      // WebSocket-Benachrichtigung würde hier erfolgen
      const io = (req.app as any).get('io');
      if (io) {
        io.to(`tenant_${req.user.tenantId}`).emit('new_message', {
          conversationId,
          message,
        });
      }

      res.json(message);
    } catch (error) {
      console.error('Fehler beim Senden der Nachricht:', error);
      if (error instanceof Error && error.message === 'Nicht autorisiert') {
        res.status(403).json({ error: 'Nicht autorisiert' });
      } else {
        res.status(500).json({ error: 'Fehler beim Senden der Nachricht' });
      }
    }
  }

  /**
   * Lädt einen Anhang herunter
   * GET /api/chat/attachments/:filename
   */
  async getAttachment(req: GetAttachmentRequest, res: Response): Promise<void> {
    try {
      const filename = req.params.filename;
      const filePath = path.join(__dirname, '../../uploads/chat', filename);

      // Prüfe ob Datei existiert
      try {
        await fs.access(filePath);
      } catch {
        res.status(404).json({ error: 'Datei nicht gefunden' });
        return;
      }

      // Sende Datei
      res.sendFile(filePath);
    } catch (error) {
      console.error('Fehler beim Abrufen des Anhangs:', error);
      res.status(500).json({ error: 'Fehler beim Abrufen des Anhangs' });
    }
  }

  /**
   * Markiert eine Nachricht als gelesen
   * PUT /api/chat/messages/:id/read
   */
  async markAsRead(req: MessageActionRequest, res: Response): Promise<void> {
    try {
      const messageId = parseInt(req.params.id, 10);

      await chatService.markAsRead(messageId, req.user.userId);

      res.json({ success: true });
    } catch (error) {
      console.error('Fehler beim Markieren als gelesen:', error);
      res.status(500).json({ error: 'Fehler beim Markieren als gelesen' });
    }
  }

  /**
   * Holt Arbeitspläne (für Verfügbarkeitsanzeige)
   * GET /api/chat/work-schedules
   */
  async getWorkSchedules(req: ChatUsersRequest, res: Response): Promise<void> {
    try {
      // Diese Funktion könnte in einen separaten Service verschoben werden
      const users = await chatService.getUsers(
        req.user.tenantId,
        req.user.userId
      );

      const workSchedules = users
        .filter((user: any) => user.shift_type)
        .map((user: any) => ({
          user_id: user.id,
          username: user.username,
          shift_type: user.shift_type,
          start_time: user.start_time,
          end_time: user.end_time,
          location: user.location,
        }));

      res.json(workSchedules);
    } catch (error) {
      console.error('Fehler beim Abrufen der Arbeitspläne:', error);
      res.status(500).json({ error: 'Fehler beim Abrufen der Arbeitspläne' });
    }
  }

  /**
   * Löscht eine Nachricht
   * DELETE /api/chat/messages/:id
   */
  async deleteMessage(req: MessageActionRequest, res: Response): Promise<void> {
    try {
      const messageId = parseInt(req.params.id, 10);

      const success = await chatService.deleteMessage(
        messageId,
        req.user.userId
      );

      if (success) {
        res.json({ success: true });
      } else {
        res
          .status(403)
          .json({ error: 'Nicht autorisiert oder Nachricht nicht gefunden' });
      }
    } catch (error) {
      console.error('Fehler beim Löschen der Nachricht:', error);
      res.status(500).json({ error: 'Fehler beim Löschen der Nachricht' });
    }
  }

  /**
   * Holt die Anzahl ungelesener Nachrichten
   * GET /api/chat/unread-count
   */
  async getUnreadCount(req: UnreadCountRequest, res: Response): Promise<void> {
    try {
      const count = await chatService.getUnreadCount(
        req.tenantDb,
        req.user.tenantId,
        req.user.userId
      );

      res.json({ unreadCount: count });
    } catch (error) {
      console.error('Fehler beim Abrufen der ungelesenen Nachrichten:', error);
      res
        .status(500)
        .json({ error: 'Fehler beim Abrufen der ungelesenen Nachrichten' });
    }
  }

  /**
   * Archiviert eine Nachricht
   * PUT /api/chat/messages/:id/archive
   */
  async archiveMessage(
    req: MessageActionRequest,
    res: Response
  ): Promise<void> {
    try {
      const messageId = parseInt(req.params.id, 10);

      await chatService.archiveMessage(messageId, req.user.userId);

      res.json({ success: true });
    } catch (error) {
      console.error('Fehler beim Archivieren der Nachricht:', error);
      res.status(500).json({ error: 'Fehler beim Archivieren der Nachricht' });
    }
  }

  /**
   * Löscht/Verlässt eine Konversation
   * DELETE /api/chat/conversations/:id
   */
  async deleteConversation(
    req: ConversationActionRequest,
    res: Response
  ): Promise<void> {
    try {
      const conversationId = parseInt(req.params.id, 10);

      await chatService.deleteConversation(conversationId, req.user.userId);

      res.json({ success: true });
    } catch (error) {
      console.error('Fehler beim Löschen der Konversation:', error);
      res.status(500).json({ error: 'Fehler beim Löschen der Konversation' });
    }
  }
}

// Export singleton instance
const chatController = new ChatController();
export default chatController;

// Named export for the class
export { ChatController };

// CommonJS compatibility
