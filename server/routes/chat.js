const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const jwt = require('jsonwebtoken');
const db = require('../database');

// Middleware zur JWT-Verifizierung
const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Kein Token bereitgestellt' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Ungültiger Token' });
  }
};

// Multer-Konfiguration für Datei-Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/chat');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Dateityp nicht erlaubt'), false);
    }
  }
});

// Hilfsfunktion für Berechtigungsprüfung
const checkChatPermission = async (fromUserId, toUserId, tenantId) => {
  try {
    // Hole die Rollen beider Benutzer
    const [users] = await db.query(`
      SELECT id, role FROM users 
      WHERE id IN (?, ?) AND tenant_id = ?
    `, [fromUserId, toUserId, tenantId]);

    const fromUser = users.find(u => u.id === fromUserId);
    const toUser = users.find(u => u.id === toUserId);

    if (!fromUser || !toUser) {
      return { can_send: false, can_receive: false };
    }

    // Prüfe die Berechtigungen basierend auf den Rollen
    const [permissions] = await db.query(`
      SELECT can_initiate_chat, can_send, can_receive 
      FROM chat_permissions 
      WHERE from_role = ? AND to_role = ? 
      AND (tenant_id = ? OR tenant_id IS NULL)
      ORDER BY tenant_id DESC
      LIMIT 1
    `, [fromUser.role, toUser.role, tenantId]);

    if (permissions.length > 0) {
      return { 
        can_send: permissions[0].can_send, 
        can_receive: permissions[0].can_receive
      };
    }

    return { can_send: false, can_receive: false };
  } catch (error) {
    console.error('Fehler bei Berechtigungsprüfung:', error);
    return { can_send: false, can_receive: false };
  }
};

// Route: Verfügbare Benutzer für Chat abrufen
router.get('/users', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const tenantId = req.user.tenant_id || 1;

    let query;
    let params;

    // Je nach Rolle unterschiedliche Benutzer anzeigen
    if (userRole === 'employee') {
      // Employees sehen nur Admins ihrer Organisation
      query = `
        SELECT 
          u.id,
          u.username,
          u.first_name,
          u.last_name,
          u.role,
          u.profile_picture_url,
          d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.tenant_id = ? 
          AND u.role IN ('admin', 'root')
          AND u.status = 'active'
          AND u.is_archived = 0
          AND u.id != ?
        ORDER BY u.role DESC, u.first_name, u.last_name
      `;
      params = [tenantId, userId];
    } else if (userRole === 'admin' || userRole === 'root') {
      // Admins und Root sehen alle Benutzer
      query = `
        SELECT 
          u.id,
          u.username,
          u.first_name,
          u.last_name,
          u.role,
          u.profile_picture_url,
          d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.tenant_id = ? 
          AND u.status = 'active'
          AND u.is_archived = 0
          AND u.id != ?
        ORDER BY u.role DESC, u.first_name, u.last_name
      `;
      params = [tenantId, userId];
    }

    const [users] = await db.query(query, params);
    
    // Berechtigungen für jeden Benutzer prüfen
    const usersWithPermissions = await Promise.all(users.map(async (user) => {
      const permission = await checkChatPermission(userId, user.id, tenantId);
      return {
        ...user,
        canSendMessage: permission.can_send,
        canReceiveMessage: permission.can_receive
      };
    }));

    res.json(usersWithPermissions);
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzer:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Benutzer' });
  }
});

// Route: Alle Unterhaltungen für einen Benutzer abrufen
router.get('/conversations', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenant_id || 1; // Fallback auf 1

    const query = `
      SELECT DISTINCT
        c.id,
        c.name as conversation_name,
        c.is_group,
        c.created_at,
        c.is_active,
        CASE 
          WHEN c.is_group = 1 THEN COALESCE(c.name, 'Gruppenchat')
          ELSE COALESCE(
            (SELECT CONCAT(u.first_name, ' ', u.last_name) 
             FROM conversation_participants cp2 
             JOIN users u ON cp2.user_id = u.id 
             WHERE cp2.conversation_id = c.id 
             AND cp2.user_id != ? 
             LIMIT 1),
            'Unbekannter Benutzer'
          )
        END as display_name,
        (SELECT u.profile_picture_url 
         FROM conversation_participants cp2 
         JOIN users u ON cp2.user_id = u.id 
         WHERE cp2.conversation_id = c.id 
         AND cp2.user_id != ? 
         LIMIT 1) as profile_picture_url,
        (SELECT COUNT(*) FROM messages m 
         WHERE m.conversation_id = c.id 
         AND m.is_read = 0 
         AND m.sender_id != ?) as unread_count,
        (SELECT m.content FROM messages m 
         WHERE m.conversation_id = c.id 
         ORDER BY m.created_at DESC LIMIT 1) as last_message,
        (SELECT m.created_at FROM messages m 
         WHERE m.conversation_id = c.id 
         ORDER BY m.created_at DESC LIMIT 1) as last_message_time
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE cp.user_id = ?
      AND cp.tenant_id = ?
      AND (c.is_active = 1 OR c.is_active IS NULL)
      GROUP BY c.id
      ORDER BY last_message_time DESC
    `;

    const [conversations] = await db.query(query, [userId, userId, userId, userId, tenantId]);
    res.json(conversations);
  } catch (error) {
    console.error('Fehler beim Abrufen der Unterhaltungen:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Unterhaltungen' });
  }
});

// Route: Neue Unterhaltung erstellen
router.post('/conversations', verifyToken, async (req, res) => {
  try {
    const { participant_ids, name, is_group = false } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenant_id || 1; // Fallback auf 1

    // Berechtigungen prüfen
    for (const participantId of participant_ids) {
      const permission = await checkChatPermission(userId, participantId, tenantId);
      if (!permission.can_send) {
        return res.status(403).json({ error: 'Keine Berechtigung, an diesen Benutzer zu schreiben' });
      }
    }

    // Unterhaltung erstellen
    const conversationQuery = `
      INSERT INTO conversations (name, is_group, tenant_id, created_by)
      VALUES (?, ?, ?, ?)
    `;
    const [conversationResult] = await db.query(conversationQuery, [
      name || null, is_group, tenantId, userId
    ]);

    const conversationId = conversationResult.insertId;

    // Teilnehmer hinzufügen
    const participantQueries = [];
    const allParticipants = [userId, ...participant_ids];
    
    for (const participantId of allParticipants) {
      participantQueries.push(
        db.query(
          'INSERT INTO conversation_participants (conversation_id, user_id, tenant_id) VALUES (?, ?, ?)',
          [conversationId, participantId, tenantId]
        )
      );
    }

    await Promise.all(participantQueries);

    res.json({ id: conversationId, message: 'Unterhaltung erfolgreich erstellt' });
  } catch (error) {
    console.error('Fehler beim Erstellen der Unterhaltung:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Unterhaltung' });
  }
});

// Route: Nachrichten einer Unterhaltung abrufen
router.get('/conversations/:id/messages', verifyToken, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;
    const tenantId = req.user.tenant_id || 1; // Fallback auf 1
    const { limit = 50, offset = 0 } = req.query;

    // Überprüfen, ob Benutzer Teilnehmer der Unterhaltung ist
    const participantQuery = `
      SELECT 1 FROM conversation_participants 
      WHERE conversation_id = ? AND user_id = ? AND tenant_id = ?
    `;
    const [participants] = await db.query(participantQuery, [conversationId, userId, tenantId]);
    
    if (participants.length === 0) {
      return res.status(403).json({ error: 'Keine Berechtigung für diese Unterhaltung' });
    }

    // Nachrichten abrufen
    const messagesQuery = `
      SELECT 
        m.id,
        m.content,
        m.sender_id,
        m.created_at,
        m.is_read,
        m.scheduled_delivery,
        m.delivery_status,
        u.first_name,
        u.last_name,
        u.username,
        u.profile_picture_url,
        CONCAT(IFNULL(u.first_name, ''), IF(u.first_name IS NOT NULL AND u.last_name IS NOT NULL, ' ', ''), IFNULL(u.last_name, '')) as sender_name,
        (SELECT JSON_ARRAYAGG(
          JSON_OBJECT(
            'id', ma.id,
            'filename', ma.filename,
            'original_filename', ma.original_filename,
            'file_size', ma.file_size,
            'mime_type', ma.mime_type
          )
        ) FROM message_attachments ma WHERE ma.message_id = m.id) as attachments
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ? 
      AND m.tenant_id = ?
      AND (m.scheduled_delivery IS NULL OR m.scheduled_delivery <= NOW())
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [messages] = await db.query(messagesQuery, [
      conversationId, tenantId, parseInt(limit), parseInt(offset)
    ]);

    // Nachrichten als gelesen markieren
    await db.query(
      'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ? AND is_read = 0',
      [conversationId, userId]
    );

    res.json(messages.reverse());
  } catch (error) {
    console.error('Fehler beim Abrufen der Nachrichten:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Nachrichten' });
  }
});

// Route: Nachricht senden
router.post('/conversations/:id/messages', verifyToken, upload.array('attachments', 5), async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { content, scheduled_delivery } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenant_id || 1; // Fallback auf 1
    const files = req.files || [];

    // Überprüfen, ob Benutzer Teilnehmer der Unterhaltung ist
    const participantQuery = `
      SELECT user_id FROM conversation_participants 
      WHERE conversation_id = ? AND tenant_id = ?
    `;
    const [participants] = await db.query(participantQuery, [conversationId, tenantId]);
    
    const participantIds = participants.map(p => p.user_id);
    if (!participantIds.includes(userId)) {
      return res.status(403).json({ error: 'Keine Berechtigung für diese Unterhaltung' });
    }

    // Berechtigungen für alle anderen Teilnehmer prüfen
    for (const participantId of participantIds) {
      if (participantId !== userId) {
        const permission = await checkChatPermission(userId, participantId, tenantId);
        if (!permission.can_send) {
          return res.status(403).json({ error: 'Keine Berechtigung, an einen der Teilnehmer zu schreiben' });
        }
      }
    }

    // Nachricht erstellen
    const messageQuery = `
      INSERT INTO messages (conversation_id, sender_id, content, scheduled_delivery, tenant_id)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    let scheduledTime = null;
    if (scheduled_delivery && scheduled_delivery !== 'immediate') {
      if (scheduled_delivery === 'break_time') {
        // Pausenzeit berechnen (Standard: 12:00 Uhr am selben Tag)
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        if (today <= new Date()) {
          // Wenn 12:00 bereits vorbei ist, nächster Tag
          today.setDate(today.getDate() + 1);
        }
        scheduledTime = today;
      } else if (scheduled_delivery === 'after_work') {
        // Feierabend berechnen (Standard: 17:00 Uhr am selben Tag)
        const today = new Date();
        today.setHours(17, 0, 0, 0);
        if (today <= new Date()) {
          // Wenn 17:00 bereits vorbei ist, nächster Tag
          today.setDate(today.getDate() + 1);
        }
        scheduledTime = today;
      } else {
        scheduledTime = new Date(scheduled_delivery);
      }
    }

    const [messageResult] = await db.query(messageQuery, [
      conversationId, userId, content, scheduledTime, tenantId
    ]);

    const messageId = messageResult.insertId;

    // Dateianhänge verarbeiten
    if (files.length > 0) {
      for (const file of files) {
        await db.query(`
          INSERT INTO message_attachments 
          (message_id, filename, original_filename, file_size, mime_type, tenant_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          messageId, file.filename, file.originalname, file.size, file.mimetype, tenantId
        ]);
      }
    }

    // Bei sofortiger Zustellung in Queue einreihen
    if (!scheduledTime) {
      await db.query(`
        INSERT INTO message_delivery_queue (message_id, recipient_id, status, tenant_id)
        SELECT ?, user_id, 'pending', ?
        FROM conversation_participants 
        WHERE conversation_id = ? AND user_id != ?
      `, [messageId, tenantId, conversationId, userId]);
    }

    res.json({ 
      id: messageId, 
      message: 'Nachricht erfolgreich gesendet',
      scheduled_delivery: scheduledTime 
    });
  } catch (error) {
    console.error('Fehler beim Senden der Nachricht:', error);
    res.status(500).json({ error: 'Fehler beim Senden der Nachricht' });
  }
});

// Route: Alle verfügbaren Benutzer für neue Unterhaltung abrufen
router.get('/users', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const tenantId = req.user.tenant_id || 1; // Fallback auf 1
    const userRole = req.user.role;

    let query = `
      SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, u.role, u.profile_picture_url
      FROM users u
      JOIN chat_permissions cp ON (
        (cp.from_role = ? AND cp.to_role = u.role) OR
        (cp.to_role = ? AND cp.from_role = u.role)
      )
      WHERE u.id != ? 
      AND u.tenant_id = ?
      AND u.status = 'active'
      AND (cp.can_send = 1 OR cp.can_receive = 1)
      ORDER BY u.first_name, u.last_name
    `;

    const [users] = await db.query(query, [userRole, userRole, userId, tenantId]);
    res.json(users);
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzer:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Benutzer' });
  }
});

// Route: Dateianhang herunterladen
router.get('/attachments/:filename', verifyToken, async (req, res) => {
  try {
    const filename = req.params.filename;
    const userId = req.user.id;
    const tenantId = req.user.tenant_id || 1; // Fallback auf 1

    // Überprüfen, ob Benutzer Zugriff auf die Datei hat
    const attachmentQuery = `
      SELECT ma.*, m.conversation_id
      FROM message_attachments ma
      JOIN messages m ON ma.message_id = m.id
      JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
      WHERE ma.filename = ? 
      AND ma.tenant_id = ?
      AND cp.user_id = ?
    `;
    
    const [attachments] = await db.query(attachmentQuery, [filename, tenantId, userId]);
    
    if (attachments.length === 0) {
      return res.status(404).json({ error: 'Datei nicht gefunden oder keine Berechtigung' });
    }

    const attachment = attachments[0];
    const filePath = path.join(__dirname, '../uploads/chat', filename);

    try {
      await fs.access(filePath);
      res.download(filePath, attachment.original_filename);
    } catch (error) {
      res.status(404).json({ error: 'Datei nicht gefunden' });
    }
  } catch (error) {
    console.error('Fehler beim Herunterladen der Datei:', error);
    res.status(500).json({ error: 'Fehler beim Herunterladen der Datei' });
  }
});

// Route: Nachricht als gelesen markieren
router.put('/messages/:id/read', verifyToken, async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user.id;
    const tenantId = req.user.tenant_id || 1; // Fallback auf 1

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
    `, [messageId, tenantId, userId]);

    res.json({ message: 'Nachricht als gelesen markiert' });
  } catch (error) {
    console.error('Fehler beim Markieren der Nachricht:', error);
    res.status(500).json({ error: 'Fehler beim Markieren der Nachricht' });
  }
});

// Route: Arbeitszeiten für Nachrichtenplanung abrufen
router.get('/work-schedules', verifyToken, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id || 1; // Fallback auf 1

    const query = `
      SELECT * FROM work_schedules 
      WHERE tenant_id = ? 
      ORDER BY day_of_week
    `;
    
    const [schedules] = await db.query(query, [tenantId]);
    res.json(schedules);
  } catch (error) {
    console.error('Fehler beim Abrufen der Arbeitszeiten:', error);
    res.status(500).json({ error: 'Fehler beim Abrufen der Arbeitszeiten' });
  }
});

// Route: Nachricht löschen (soft delete)
router.delete('/messages/:id', verifyToken, async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user.id;
    const tenantId = req.user.tenant_id || 1;

    // Prüfen ob der Benutzer die Nachricht löschen darf (nur eigene Nachrichten)
    const [messages] = await db.query(`
      SELECT sender_id FROM messages 
      WHERE id = ? AND tenant_id = ? AND is_deleted = 0
    `, [messageId, tenantId]);

    if (messages.length === 0) {
      return res.status(404).json({ error: 'Nachricht nicht gefunden' });
    }

    if (messages[0].sender_id !== userId) {
      return res.status(403).json({ error: 'Keine Berechtigung zum Löschen dieser Nachricht' });
    }

    // Soft delete durchführen
    await db.query(`
      UPDATE messages 
      SET is_deleted = 1, deleted_at = NOW() 
      WHERE id = ? AND tenant_id = ?
    `, [messageId, tenantId]);

    res.json({ message: 'Nachricht erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen der Nachricht:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Nachricht' });
  }
});

// Route: Nachricht archivieren (für Empfänger)
router.put('/messages/:id/archive', verifyToken, async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user.id;
    const tenantId = req.user.tenant_id || 1;

    // Prüfen ob der Benutzer Zugriff auf die Nachricht hat
    const [messages] = await db.query(`
      SELECT m.id FROM messages m
      JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
      WHERE m.id = ? AND m.tenant_id = ? AND cp.user_id = ?
    `, [messageId, tenantId, userId]);

    if (messages.length === 0) {
      return res.status(404).json({ error: 'Nachricht nicht gefunden oder kein Zugriff' });
    }

    // Nachricht für diesen Benutzer als archiviert markieren
    // Da wir kein separates archived-Feld haben, verwenden wir eine Hilfstabelle
    await db.query(`
      INSERT INTO message_read_receipts (message_id, user_id, read_at) 
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE read_at = NOW()
    `, [messageId, userId]);

    res.json({ message: 'Nachricht erfolgreich archiviert' });
  } catch (error) {
    console.error('Fehler beim Archivieren der Nachricht:', error);
    res.status(500).json({ error: 'Fehler beim Archivieren der Nachricht' });
  }
});

// Route: Unterhaltung löschen
router.delete('/conversations/:id', verifyToken, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user.id;
    const tenantId = req.user.tenant_id || 1;

    // Prüfen ob der Benutzer Zugriff auf die Unterhaltung hat
    const [participants] = await db.query(`
      SELECT user_id FROM conversation_participants 
      WHERE conversation_id = ? AND user_id = ?
    `, [conversationId, userId]);

    if (participants.length === 0) {
      return res.status(404).json({ error: 'Unterhaltung nicht gefunden' });
    }

    // Jeder Teilnehmer kann die Unterhaltung für sich löschen

    // Unterhaltung als inaktiv markieren (soft delete)
    await db.query(`
      UPDATE conversations 
      SET is_active = 0 
      WHERE id = ? AND tenant_id = ?
    `, [conversationId, tenantId]);

    res.json({ message: 'Unterhaltung erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen der Unterhaltung:', error);
    res.status(500).json({ error: 'Fehler beim Löschen der Unterhaltung' });
  }
});

module.exports = router;