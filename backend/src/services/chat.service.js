const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// Create database connection pool
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'assixx',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

class ChatService {
  /**
   * Holt alle verfügbaren Chat-Benutzer für einen Tenant
   * @param {string} tenantId - Die Tenant-ID
   * @param {number} userId - Die aktuelle Benutzer-ID
   * @returns {Promise<Array>} Liste der Benutzer
   */
  async getUsers(tenantId, userId) {
    const query = `
      SELECT 
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        u.email,
        u.employee_number,
        u.position,
        u.department,
        u.profile_image_url,
        CASE WHEN ws.id IS NOT NULL THEN 1 ELSE 0 END AS is_online,
        ws.shift_type,
        ws.start_time,
        ws.end_time,
        ws.location
      FROM users u
      LEFT JOIN work_schedules ws ON u.id = ws.user_id 
        AND ws.date = CURDATE()
        AND ws.tenant_id = ?
      WHERE u.tenant_id = ? 
        AND u.id != ?
        AND u.archive = 0
      ORDER BY u.last_name, u.first_name
    `;

    const [users] = await db
      .promise()
      .query(query, [tenantId, tenantId, userId]);
    return users;
  }

  /**
   * Holt alle Konversationen für einen Benutzer
   * @param {string} tenantId - Die Tenant-ID
   * @param {number} userId - Die Benutzer-ID
   * @returns {Promise<Array>} Liste der Konversationen
   */
  async getConversations(tenantId, userId) {
    try {
      console.log('ChatService.getConversations called with:', { tenantId, userId });
    
    const query = `
      SELECT 
        c.id,
        c.name,
        c.is_group,
        c.created_at,
        CASE 
          WHEN c.is_group = 1 THEN c.name
          ELSE CONCAT(
            COALESCE(u.first_name, ''), 
            ' ', 
            COALESCE(u.last_name, '')
          )
        END AS display_name,
        m.content AS last_message,
        m.created_at AS last_message_time,
        sender.username AS last_message_sender,
        u.profile_image_url,
        COALESCE(unread.count, 0) AS unread_count
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      LEFT JOIN conversation_participants cp2 ON c.id = cp2.conversation_id 
        AND cp2.user_id != ? 
        AND c.is_group = 0
      LEFT JOIN users u ON cp2.user_id = u.id
      LEFT JOIN (
        SELECT conversation_id, MAX(id) AS max_id
        FROM messages
        WHERE tenant_id = ?
        GROUP BY conversation_id
      ) latest ON c.id = latest.conversation_id
      LEFT JOIN messages m ON latest.max_id = m.id
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN (
        SELECT m.conversation_id, COUNT(*) AS count
        FROM messages m
        WHERE m.tenant_id = ? 
          AND m.sender_id != ?
          AND m.deleted_at IS NULL
        GROUP BY m.conversation_id
      ) unread ON c.id = unread.conversation_id
      WHERE cp.user_id = ? AND c.tenant_id = ?
      GROUP BY c.id
      ORDER BY COALESCE(m.created_at, c.created_at) DESC
    `;

    const [conversations] = await db
      .promise()
      .query(query, [
        userId,
        tenantId,
        tenantId,
        userId,
        userId,
        tenantId,
      ]);

    return conversations;
    } catch (error) {
      console.error('Error in ChatService.getConversations:', error);
      console.error('Query error details:', error.message);
      throw error;
    }
  }

  /**
   * Erstellt eine neue Konversation
   * @param {string} tenantId - Die Tenant-ID
   * @param {number} userId - Die Benutzer-ID des Erstellers
   * @param {Array<number>} participantIds - IDs der Teilnehmer
   * @param {boolean} isGroup - Ob es eine Gruppenkonversation ist
   * @param {string} name - Name der Gruppe (optional)
   * @returns {Promise<Object>} Die erstellte Konversation
   */
  async createConversation(
    tenantId,
    userId,
    participantIds,
    isGroup = false,
    name = null
  ) {
    const connection = await db.promise().getConnection();

    try {
      await connection.beginTransaction();

      // Prüfe ob bereits eine 1:1 Konversation existiert
      if (!isGroup && participantIds.length === 1) {
        const [existing] = await connection.query(
          `SELECT c.id 
           FROM conversations c
           INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
           INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
           WHERE c.tenant_id = ? 
             AND c.is_group = 0
             AND cp1.user_id = ?
             AND cp2.user_id = ?
             AND c.id IN (
               SELECT conversation_id 
               FROM conversation_participants 
               GROUP BY conversation_id 
               HAVING COUNT(*) = 2
             )`,
          [tenantId, userId, participantIds[0]]
        );

        if (existing.length > 0) {
          await connection.commit();
          return { id: existing[0].id, existing: true };
        }
      }

      // Erstelle neue Konversation
      const [result] = await connection.query(
        'INSERT INTO conversations (tenant_id, is_group, name) VALUES (?, ?, ?)',
        [tenantId, isGroup, name]
      );

      const conversationId = result.insertId;

      // Füge Ersteller als Teilnehmer hinzu
      await connection.query(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)',
        [conversationId, userId]
      );

      // Füge andere Teilnehmer hinzu
      for (const participantId of participantIds) {
        await connection.query(
          'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)',
          [conversationId, participantId]
        );
      }

      await connection.commit();
      return { id: conversationId, existing: false };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Holt Nachrichten einer Konversation
   * @param {string} tenantId - Die Tenant-ID
   * @param {number} conversationId - Die Konversations-ID
   * @param {number} userId - Die Benutzer-ID
   * @param {number} limit - Anzahl der Nachrichten
   * @param {number} offset - Offset für Pagination
   * @returns {Promise<Object>} Nachrichten und Konversationsdetails
   */
  async getMessages(tenantId, conversationId, userId, limit = 50, offset = 0) {
    // Prüfe Berechtigung
    const [participant] = await db
      .promise()
      .query(
        'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
        [conversationId, userId]
      );

    if (participant.length === 0) {
      throw new Error('Nicht autorisiert');
    }

    // Hole Konversationsdetails
    const [conversationData] = await db.promise().query(
      `SELECT c.*, 
        CASE 
          WHEN c.is_group = 1 THEN c.name
          ELSE CONCAT(u.first_name, ' ', u.last_name)
        END AS display_name,
        u.profile_image_url
      FROM conversations c
      LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id 
        AND cp.user_id != ? AND c.is_group = 0
      LEFT JOIN users u ON cp.user_id = u.id
      WHERE c.id = ? AND c.tenant_id = ?`,
      [userId, conversationId, tenantId]
    );

    // Hole Nachrichten
    const [messages] = await db.promise().query(
      `SELECT 
        m.*,
        u.username,
        u.first_name,
        u.last_name,
        u.profile_image_url,
        CASE WHEN ms.is_read = 1 THEN 1 ELSE 0 END AS is_read
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.user_id = ?
      WHERE m.conversation_id = ? AND m.tenant_id = ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?`,
      [userId, conversationId, tenantId, limit, offset]
    );

    // Hole Teilnehmer für Gruppenkonversationen
    let participants = [];
    if (conversationData[0]?.is_group) {
      const [participantData] = await db.promise().query(
        `SELECT u.id, u.username, u.first_name, u.last_name, u.profile_image_url
         FROM conversation_participants cp
         JOIN users u ON cp.user_id = u.id
         WHERE cp.conversation_id = ?`,
        [conversationId]
      );
      participants = participantData;
    }

    return {
      conversation: conversationData[0],
      messages: messages.reverse(),
      participants,
    };
  }

  /**
   * Sendet eine Nachricht
   * @param {string} tenantId - Die Tenant-ID
   * @param {number} conversationId - Die Konversations-ID
   * @param {number} senderId - Die Sender-ID
   * @param {string} content - Der Nachrichteninhalt
   * @param {Object} attachment - Anhang-Informationen (optional)
   * @returns {Promise<Object>} Die gesendete Nachricht
   */
  async sendMessage(
    tenantId,
    conversationId,
    senderId,
    content,
    attachment = null
  ) {
    // Prüfe Berechtigung
    const [participant] = await db
      .promise()
      .query(
        'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
        [conversationId, senderId]
      );

    if (participant.length === 0) {
      throw new Error('Nicht autorisiert');
    }

    // Erstelle Nachricht
    const [result] = await db.promise().query(
      `INSERT INTO messages (tenant_id, conversation_id, sender_id, content, attachment_path, attachment_name, attachment_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        conversationId,
        senderId,
        content,
        attachment?.path || null,
        attachment?.name || null,
        attachment?.type || null,
      ]
    );

    // Hole die erstellte Nachricht mit Benutzerdetails
    const [message] = await db.promise().query(
      `SELECT m.*, u.username, u.first_name, u.last_name, u.profile_image_url
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [result.insertId]
    );

    return message[0];
  }

  /**
   * Markiert Nachrichten als gelesen
   * @param {number} messageId - Die Nachrichten-ID
   * @param {number} userId - Die Benutzer-ID
   * @returns {Promise<void>}
   */
  async markAsRead(messageId, userId) {
    await db.promise().query(
      `INSERT INTO message_status (message_id, user_id, is_read, read_at)
       VALUES (?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE is_read = 1, read_at = NOW()`,
      [messageId, userId]
    );
  }

  /**
   * Löscht eine Nachricht
   * @param {number} messageId - Die Nachrichten-ID
   * @param {number} userId - Die Benutzer-ID
   * @returns {Promise<boolean>} Erfolg
   */
  async deleteMessage(messageId, userId) {
    const [result] = await db
      .promise()
      .query(
        'UPDATE messages SET deleted_at = NOW() WHERE id = ? AND sender_id = ?',
        [messageId, userId]
      );

    return result.affectedRows > 0;
  }

  /**
   * Holt die Anzahl ungelesener Nachrichten
   * @param {Object} tenantDb - Die Tenant-Datenbankverbindung (wird hier nicht verwendet)
   * @param {string} tenantId - Die Tenant-ID
   * @param {number} userId - Die Benutzer-ID
   * @returns {Promise<number>} Anzahl ungelesener Nachrichten
   */
  async getUnreadCount(tenantDb, tenantId, userId) {
    try {
      // Chat-Daten sind in der Hauptdatenbank, nicht in der Tenant-DB
      const [result] = await db.promise().query(
        `SELECT COUNT(DISTINCT m.id) as count
       FROM messages m
       INNER JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
       LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.user_id = ?
       WHERE cp.user_id = ? 
         AND m.tenant_id = ?
         AND m.sender_id != ?
         AND (ms.is_read IS NULL OR ms.is_read = 0)
         AND m.deleted_at IS NULL`,
        [userId, userId, tenantId, userId]
      );

      return result[0].count;
    } catch (error) {
      console.error('Error in getUnreadCount:', error);
      return 0;
    }
  }

  /**
   * Archiviert eine Nachricht
   * @param {number} messageId - Die Nachrichten-ID
   * @param {number} userId - Die Benutzer-ID
   * @returns {Promise<boolean>} Erfolg
   */
  async archiveMessage(messageId, userId) {
    await db.promise().query(
      `INSERT INTO message_status (message_id, user_id, is_archived, archived_at)
       VALUES (?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE is_archived = 1, archived_at = NOW()`,
      [messageId, userId]
    );

    return true;
  }

  /**
   * Löscht eine Konversation für einen Benutzer
   * @param {number} conversationId - Die Konversations-ID
   * @param {number} userId - Die Benutzer-ID
   * @returns {Promise<boolean>} Erfolg
   */
  async deleteConversation(conversationId, userId) {
    const connection = await db.promise().getConnection();

    try {
      await connection.beginTransaction();

      // Markiere alle Nachrichten als archiviert für diesen Benutzer
      await connection.query(
        `INSERT INTO message_status (message_id, user_id, is_archived, archived_at)
         SELECT m.id, ?, 1, NOW()
         FROM messages m
         WHERE m.conversation_id = ?
         ON DUPLICATE KEY UPDATE is_archived = 1, archived_at = NOW()`,
        [userId, conversationId]
      );

      // Optional: Entferne Benutzer aus Konversation wenn es eine Gruppe ist
      const [conversation] = await connection.query(
        'SELECT is_group FROM conversations WHERE id = ?',
        [conversationId]
      );

      if (conversation[0]?.is_group) {
        await connection.query(
          'DELETE FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
          [conversationId, userId]
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = new ChatService();
