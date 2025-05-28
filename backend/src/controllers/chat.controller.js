const chatService = require('../services/chat.service');
const path = require('path');
const fs = require('fs').promises;

class ChatController {
  /**
   * Holt alle verfügbaren Chat-Benutzer
   * GET /api/chat/users
   */
  async getUsers(req, res) {
    try {
      const users = await chatService.getUsers(req.user.tenantId, req.user.userId);
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
  async getConversations(req, res) {
    try {
      const conversations = await chatService.getConversations(
        req.user.tenantId,
        req.user.userId
      );
      res.json(conversations);
    } catch (error) {
      console.error('Fehler beim Abrufen der Konversationen:', error);
      res.status(500).json({ error: 'Fehler beim Abrufen der Konversationen' });
    }
  }

  /**
   * Erstellt eine neue Konversation
   * POST /api/chat/conversations
   */
  async createConversation(req, res) {
    try {
      const { participantIds, isGroup, name } = req.body;

      if (!participantIds || participantIds.length === 0) {
        return res.status(400).json({ error: 'Keine Teilnehmer angegeben' });
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
  async getMessages(req, res) {
    try {
      const conversationId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

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
      if (error.message === 'Nicht autorisiert') {
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
  async sendMessage(req, res) {
    try {
      const conversationId = parseInt(req.params.id);
      const { content } = req.body;

      if (!content && !req.file) {
        return res.status(400).json({ error: 'Nachricht oder Anhang erforderlich' });
      }

      let attachment = null;
      if (req.file) {
        attachment = {
          path: `/uploads/chat/${req.file.filename}`,
          name: req.file.originalname,
          type: req.file.mimetype
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
      const io = req.app.get('io');
      if (io) {
        io.to(`tenant_${req.user.tenantId}`).emit('new_message', {
          conversationId,
          message
        });
      }

      res.json(message);
    } catch (error) {
      console.error('Fehler beim Senden der Nachricht:', error);
      if (error.message === 'Nicht autorisiert') {
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
  async getAttachment(req, res) {
    try {
      const filename = req.params.filename;
      const filePath = path.join(__dirname, '../../uploads/chat', filename);

      // Prüfe ob Datei existiert
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: 'Datei nicht gefunden' });
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
  async markAsRead(req, res) {
    try {
      const messageId = parseInt(req.params.id);
      
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
  async getWorkSchedules(req, res) {
    try {
      // Diese Funktion könnte in einen separaten Service verschoben werden
      const users = await chatService.getUsers(req.user.tenantId, req.user.userId);
      const workSchedules = users.filter(user => user.shift_type).map(user => ({
        user_id: user.id,
        username: user.username,
        shift_type: user.shift_type,
        start_time: user.start_time,
        end_time: user.end_time,
        location: user.location
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
  async deleteMessage(req, res) {
    try {
      const messageId = parseInt(req.params.id);
      
      const success = await chatService.deleteMessage(messageId, req.user.userId);
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(403).json({ error: 'Nicht autorisiert oder Nachricht nicht gefunden' });
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
  async getUnreadCount(req, res) {
    try {
      const count = await chatService.getUnreadCount(
        req.tenantDb,
        req.user.tenantId,
        req.user.userId
      );
      
      res.json({ unreadCount: count });
    } catch (error) {
      console.error('Fehler beim Abrufen der ungelesenen Nachrichten:', error);
      res.status(500).json({ error: 'Fehler beim Abrufen der ungelesenen Nachrichten' });
    }
  }

  /**
   * Archiviert eine Nachricht
   * PUT /api/chat/messages/:id/archive
   */
  async archiveMessage(req, res) {
    try {
      const messageId = parseInt(req.params.id);
      
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
  async deleteConversation(req, res) {
    try {
      const conversationId = parseInt(req.params.id);
      
      await chatService.deleteConversation(conversationId, req.user.userId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Fehler beim Löschen der Konversation:', error);
      res.status(500).json({ error: 'Fehler beim Löschen der Konversation' });
    }
  }
}

module.exports = new ChatController();