/**
 * Chat Service
 * Handles chat-related business logic
 */

import * as mysql from 'mysql2';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });

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

// Interfaces
interface ChatUser extends RowDataPacket {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  email: string;
  employee_number?: string | null;
  position?: string | null;
  department?: string | null;
  profile_image_url?: string | null;
  is_online: number;
  shift_type?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
}

interface Conversation extends RowDataPacket {
  id: number;
  name?: string | null;
  is_group: boolean | number;
  created_at: Date;
  display_name: string;
  last_message?: string | null;
  last_message_time?: Date | null;
  last_message_sender?: string | null;
  profile_image_url?: string | null;
  unread_count: number;
}

interface Message extends RowDataPacket {
  id: number;
  tenant_id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  attachment_path?: string | null;
  attachment_name?: string | null;
  attachment_type?: string | null;
  created_at: Date;
  deleted_at?: Date | null;
  // Extended fields from joins
  username?: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string | null;
  is_read?: number;
}

interface ConversationDetails extends RowDataPacket {
  id: number;
  tenant_id: number;
  is_group: boolean | number;
  name?: string | null;
  created_at: Date;
  display_name: string;
  profile_image_url?: string | null;
}

interface Participant extends RowDataPacket {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string | null;
}

interface ConversationCreationResult {
  id: number;
  existing: boolean;
}

interface MessagesResponse {
  conversation: ConversationDetails;
  messages: Message[];
  participants: Participant[];
}

interface AttachmentData {
  path: string;
  name: string;
  type: string;
}

interface CountResult extends RowDataPacket {
  count: number;
}

class ChatService {
  /**
   * Holt alle verfügbaren Chat-Benutzer für einen Tenant
   */
  async getUsers(
    tenantId: string | number,
    userId: string | number
  ): Promise<ChatUser[]> {
    try {
      // Log input parameters
      console.log(
        'ChatService.getUsers - tenantId:',
        tenantId,
        'type:',
        typeof tenantId
      );
      console.log(
        'ChatService.getUsers - userId:',
        userId,
        'type:',
        typeof userId
      );

      // Ensure parameters are numbers
      const numericTenantId = parseInt(tenantId.toString());
      const numericUserId = parseInt(userId.toString());

      if (isNaN(numericTenantId) || isNaN(numericUserId)) {
        throw new Error(
          `Invalid parameters: tenantId=${tenantId}, userId=${userId}`
        );
      }

      const query = `
        SELECT 
          u.id,
          u.username,
          u.first_name,
          u.last_name,
          u.email,
          NULL as employee_number,
          NULL as position,
          NULL as department,
          NULL as profile_image_url,
          0 AS is_online,
          NULL as shift_type,
          NULL as start_time,
          NULL as end_time,
          NULL as location
        FROM users u
        WHERE u.tenant_id = ? 
          AND u.id != ?
          ORDER BY u.last_name, u.first_name
      `;

      console.log('ChatService.getUsers - Executing query with params:', [
        numericTenantId,
        numericUserId,
      ]);

      const [users] = await db
        .promise()
        .query<ChatUser[]>(query, [numericTenantId, numericUserId]);

      console.log('ChatService.getUsers - Found users:', users.length);
      return users;
    } catch (error) {
      console.error('ChatService.getUsers - Error:', error);
      throw error;
    }
  }

  /**
   * Holt alle Konversationen für einen Benutzer
   */
  async getConversations(
    tenantId: string | number,
    userId: string | number
  ): Promise<Conversation[]> {
    try {
      console.log('ChatService.getConversations called with:', {
        tenantId,
        userId,
      });
      console.log('DB pool status:', db ? 'exists' : 'not initialized');

      // Ensure parameters are numbers
      const numericTenantId = parseInt(tenantId.toString());
      const numericUserId = parseInt(userId.toString());

      if (isNaN(numericTenantId) || isNaN(numericUserId)) {
        throw new Error(
          `Invalid parameters: tenantId=${tenantId}, userId=${userId}`
        );
      }

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
        NULL as profile_image_url,
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
      GROUP BY c.id, c.name, c.is_group, c.created_at, u.first_name, u.last_name, 
               m.content, m.created_at, sender.username, unread.count
      ORDER BY COALESCE(m.created_at, c.created_at) DESC
    `;

      const [conversations] = await db
        .promise()
        .query<
          Conversation[]
        >(query, [numericUserId, numericTenantId, numericTenantId, numericUserId, numericUserId, numericTenantId]);

      return conversations;
    } catch (error) {
      console.error('Error in ChatService.getConversations:', error);
      if (error instanceof Error) {
        console.error('Query error details:', error.message);
      }
      throw error;
    }
  }

  /**
   * Erstellt eine neue Konversation
   */
  async createConversation(
    tenantId: string | number,
    userId: number,
    participantIds: number[],
    isGroup: boolean = false,
    name: string | null = null
  ): Promise<ConversationCreationResult> {
    const connection = await db.promise().getConnection();

    try {
      await connection.beginTransaction();

      // Prüfe ob bereits eine 1:1 Konversation existiert
      if (!isGroup && participantIds.length === 1) {
        const [existing] = await connection.query<RowDataPacket[]>(
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
      const [result] = await connection.query<ResultSetHeader>(
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
   */
  async getMessages(
    tenantId: string | number,
    conversationId: number,
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<MessagesResponse> {
    // Prüfe Berechtigung
    const [participant] = await db
      .promise()
      .query<
        RowDataPacket[]
      >('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?', [conversationId, userId]);

    if (participant.length === 0) {
      throw new Error('Nicht autorisiert');
    }

    // Hole Konversationsdetails
    const [conversationData] = await db.promise().query<ConversationDetails[]>(
      `SELECT c.*, 
        CASE 
          WHEN c.is_group = 1 THEN c.name
          ELSE CONCAT(u.first_name, ' ', u.last_name)
        END AS display_name,
        NULL as profile_image_url
      FROM conversations c
      LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id 
        AND cp.user_id != ? AND c.is_group = 0
      LEFT JOIN users u ON cp.user_id = u.id
      WHERE c.id = ? AND c.tenant_id = ?`,
      [userId, conversationId, tenantId]
    );

    // Hole Nachrichten
    const [messages] = await db.promise().query<Message[]>(
      `SELECT 
        m.*,
        u.username,
        u.first_name,
        u.last_name,
        NULL as profile_image_url,
        0 AS is_read
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ? AND m.tenant_id = ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?`,
      [conversationId, tenantId, limit, offset]
    );

    // Hole Teilnehmer für Gruppenkonversationen
    let participants: Participant[] = [];
    if (conversationData[0]?.is_group) {
      const [participantData] = await db.promise().query<Participant[]>(
        `SELECT u.id, u.username, u.first_name, u.last_name, NULL as profile_image_url
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
   */
  async sendMessage(
    tenantId: string | number,
    conversationId: number,
    senderId: number,
    content: string,
    attachment: AttachmentData | null = null
  ): Promise<Message> {
    // Prüfe Berechtigung
    const [participant] = await db
      .promise()
      .query<
        RowDataPacket[]
      >('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?', [conversationId, senderId]);

    if (participant.length === 0) {
      throw new Error('Nicht autorisiert');
    }

    // Erstelle Nachricht
    const [result] = await db.promise().query<ResultSetHeader>(
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
    const [message] = await db.promise().query<Message[]>(
      `SELECT m.*, u.username, u.first_name, u.last_name, NULL as profile_image_url
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [result.insertId]
    );

    return message[0];
  }

  /**
   * Markiert Nachrichten als gelesen
   */
  async markAsRead(messageId: number, userId: number): Promise<void> {
    await db.promise().query(
      `INSERT INTO message_status (message_id, user_id, is_read, read_at)
       VALUES (?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE is_read = 1, read_at = NOW()`,
      [messageId, userId]
    );
  }

  /**
   * Löscht eine Nachricht
   */
  async deleteMessage(messageId: number, userId: number): Promise<boolean> {
    const [result] = await db
      .promise()
      .query<ResultSetHeader>(
        'UPDATE messages SET deleted_at = NOW() WHERE id = ? AND sender_id = ?',
        [messageId, userId]
      );

    return result.affectedRows > 0;
  }

  /**
   * Holt die Anzahl ungelesener Nachrichten
   */
  async getUnreadCount(
    _tenantDb: Pool,
    tenantId: string | number,
    userId: number
  ): Promise<number> {
    try {
      // Chat-Daten sind in der Hauptdatenbank, nicht in der Tenant-DB
      // Temporarily return 0 since message_status table doesn't exist
      // TODO: Create message_status table and restore proper unread counting
      const [result] = await db.promise().query<CountResult[]>(
        `SELECT COUNT(DISTINCT m.id) as count
       FROM messages m
       INNER JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
       WHERE cp.user_id = ? 
         AND m.tenant_id = ?
         AND m.sender_id != ?
         AND m.deleted_at IS NULL`,
        [userId, tenantId, userId]
      );

      return result[0].count;
    } catch (error) {
      console.error('Error in getUnreadCount:', error);
      return 0;
    }
  }

  /**
   * Archiviert eine Nachricht
   */
  async archiveMessage(messageId: number, userId: number): Promise<boolean> {
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
   */
  async deleteConversation(
    conversationId: number,
    userId: number
  ): Promise<boolean> {
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
      const [conversation] = await connection.query<RowDataPacket[]>(
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

// Export singleton instance
const chatService = new ChatService();
export default chatService;

// Named export for the class
export { ChatService };

// CommonJS compatibility
