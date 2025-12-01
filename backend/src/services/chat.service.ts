/**
 * Chat Service
 * Handles chat-related business logic
 */
import {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
  execute,
  getConnection,
  query,
} from '../utils/db.js';

// Type for unused tenantDb parameter (kept for backward compatibility)
type TenantDbPool = unknown;

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
  updated_at?: Date;
  display_name?: string;
  last_message?: {
    id: number;
    content: string;
    created_at: Date;
    sender_id: number;
    conversation_id: number;
    is_read: boolean;
    sender?: {
      id: number;
      username: string;
    };
  } | null;
  profile_image_url?: string | null;
  unread_count: number;
  participants?: Participant[];
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

// Query result interfaces for type safety
interface UserRoleDeptResult extends RowDataPacket {
  role: string;
  department_id: number | null;
}

interface UserRoleResult extends RowDataPacket {
  role: string;
}

interface IdResult extends RowDataPacket {
  id: number;
}

interface ConversationWithLastMessage extends RowDataPacket {
  id: number;
  name?: string | null;
  is_group: boolean | number;
  created_at: Date;
  updated_at?: Date;
  display_name?: string;
  unread_count: number;
  profile_image_url?: string | null;
  // Flattened last message fields
  last_message_id?: number | null;
  last_message_content?: string | null;
  last_message_created_at?: Date | null;
  last_message_sender_id?: number | null;
  last_message_sender_username?: string | null;
}

interface ConversationGroupInfo extends RowDataPacket {
  is_group: boolean | number;
  participant_count: number;
}

interface UserUsernameResult extends RowDataPacket {
  username: string;
}

/**
 *
 */
class ChatService {
  /** Common SELECT fields for user queries - N:M REFACTORING: department_id from user_departments */
  private readonly userSelectFields = `u.id, u.username, u.first_name, u.last_name, u.email, u.role, ud.department_id, d.name as department, NULL as employee_number, NULL as position, u.profile_picture as profile_image_url, 0 AS is_online, NULL as shift_type, NULL as start_time, NULL as end_time, NULL as location`;

  /** Build query for fetching users based on role - N:M REFACTORING: uses user_departments table */
  private buildUsersQuery(
    userRole: string,
    userDepartmentId: number | null,
  ): { query: string; params: number[] } {
    if (userRole === 'root' || userRole === 'admin') {
      return {
        query: `SELECT ${this.userSelectFields} FROM users u
          LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
          LEFT JOIN departments d ON ud.department_id = d.id
          WHERE u.tenant_id = $1 AND u.id != $2 ORDER BY u.role DESC, d.name, u.last_name, u.first_name`,
        params: [],
      };
    }
    if (userDepartmentId == null) {
      return {
        query: `SELECT ${this.userSelectFields} FROM users u
          LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
          LEFT JOIN departments d ON ud.department_id = d.id
          WHERE u.tenant_id = $1 AND u.id != $2 AND u.role IN ('admin', 'root') ORDER BY u.role DESC, u.last_name, u.first_name`,
        params: [],
      };
    }
    return {
      query: `SELECT ${this.userSelectFields} FROM users u
        LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
        LEFT JOIN departments d ON ud.department_id = d.id
        WHERE u.tenant_id = $1 AND u.id != $2 AND (ud.department_id = $3 OR u.role IN ('admin', 'root')) ORDER BY u.role DESC, u.last_name, u.first_name`,
      params: [userDepartmentId],
    };
  }

  /**
   * Holt alle verfügbaren Chat-Benutzer für einen Tenant
   * Berücksichtigt Department-Zugehörigkeit und Chat-Berechtigungen
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async getUsers(tenantId: string | number, userId: string | number): Promise<ChatUser[]> {
    try {
      console.info('ChatService.getUsers - tenantId:', tenantId, 'type:', typeof tenantId);
      console.info('ChatService.getUsers - userId:', userId, 'type:', typeof userId);

      // Ensure parameters are numbers
      const numericTenantId = Number.parseInt(tenantId.toString());
      const numericUserId = Number.parseInt(userId.toString());

      if (Number.isNaN(numericTenantId) || Number.isNaN(numericUserId)) {
        throw new Error(`Invalid parameters: tenantId=${tenantId}, userId=${userId}`);
      }

      // Hole die Rolle und Department des aktuellen Users
      // Note: department_id is now in user_departments table (many-to-many)
      const [currentUserInfo] = await query<UserRoleDeptResult[]>(
        `SELECT u.role, ud.department_id
         FROM users u
         LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.tenant_id = u.tenant_id AND ud.is_primary = true
         WHERE u.id = $1 AND u.tenant_id = $2`,
        [numericUserId, numericTenantId],
      );

      if (currentUserInfo.length === 0) {
        throw new Error('Current user not found');
      }

      const firstUser = currentUserInfo[0];
      if (firstUser == null) {
        throw new Error('Current user data is null');
      }

      const userRole = firstUser.role;
      const userDepartmentId = firstUser.department_id;

      // Build query based on user role and department
      const { query: sqlQuery, params: additionalParams } = this.buildUsersQuery(
        userRole,
        userDepartmentId,
      );
      const params = [numericTenantId, numericUserId, ...additionalParams];

      console.info('ChatService.getUsers - Executing query with params:', params);
      const [users] = await query<ChatUser[]>(sqlQuery, params);

      console.info('ChatService.getUsers - Found users:', users.length);
      return users;
    } catch (error: unknown) {
      console.error('ChatService.getUsers - Error:', error);
      throw error;
    }
  }

  /**
   * Build the conversations query
   */
  private buildConversationsQuery(): string {
    return `
      SELECT
        c.id,
        c.name,
        c.is_group,
        c.created_at,
        c.updated_at,
        CASE
          WHEN c.is_group = true THEN c.name
          ELSE CONCAT(
            COALESCE(u.first_name, ''),
            ' ',
            COALESCE(u.last_name, '')
          )
        END AS display_name,
        m.id AS last_message_id,
        m.content AS last_message_content,
        m.created_at AS last_message_created_at,
        m.sender_id AS last_message_sender_id,
        sender.username AS last_message_sender_username,
        u.profile_picture as profile_image_url,
        COALESCE(unread.count, 0) AS unread_count
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      LEFT JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
        AND cp2.user_id != $3
        AND c.is_group = 0
      LEFT JOIN users u ON cp2.user_id = u.id
      LEFT JOIN (
        SELECT conversation_id, MAX(id) AS max_id
        FROM messages
        WHERE tenant_id = $4
        GROUP BY conversation_id
      ) latest ON c.id = latest.conversation_id
      LEFT JOIN messages m ON latest.max_id = m.id
      LEFT JOIN users sender ON m.sender_id = sender.id
      LEFT JOIN (
        SELECT m.conversation_id, COUNT(*) AS count
        FROM messages m
        WHERE m.tenant_id = $5
          AND m.sender_id != $6
          AND m.deleted_at IS NULL
        GROUP BY m.conversation_id
      ) unread ON c.id = unread.conversation_id
      WHERE cp.user_id = $7 AND c.tenant_id = $2
      GROUP BY c.id, c.name, c.is_group, c.created_at, c.updated_at, u.first_name, u.last_name,
               m.id, m.content, m.created_at, m.sender_id, sender.username, unread.count
      ORDER BY COALESCE(m.created_at, c.created_at) DESC
    `;
  }

  /**
   * Transform conversation data with participants and last message
   */
  private async transformConversation(
    conv: ConversationWithLastMessage,
    tenantId: number,
  ): Promise<Conversation> {
    const participants = await this.getConversationParticipants(conv.id, tenantId);

    // Transform last_message fields into proper object
    const lastMessage =
      conv.last_message_id != null ?
        {
          id: conv.last_message_id,
          content: conv.last_message_content ?? '',
          created_at: conv.last_message_created_at ?? new Date(),
          sender_id: conv.last_message_sender_id ?? 0,
          conversation_id: conv.id,
          is_read: false,
          sender: {
            id: conv.last_message_sender_id ?? 0,
            username: conv.last_message_sender_username ?? '',
          },
        }
      : null;

    // Create new conversation object that extends RowDataPacket
    return Object.assign(Object.create(Object.getPrototypeOf(conv) as object) as Conversation, {
      id: conv.id,
      name: conv.name,
      is_group: conv.is_group,
      created_at: conv.created_at,
      updated_at: conv.updated_at ?? conv.created_at,
      display_name: conv.display_name,
      last_message: lastMessage,
      unread_count: conv.unread_count,
      participants: participants,
    });
  }

  /**
   * Holt alle Konversationen für einen Benutzer
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async getConversations(
    tenantId: string | number,
    userId: string | number,
  ): Promise<Conversation[]> {
    try {
      console.info('ChatService.getConversations called with:', { tenantId, userId });
      console.info('DB pool status:', 'exists');

      // Ensure parameters are numbers
      const numericTenantId = Number.parseInt(tenantId.toString());
      const numericUserId = Number.parseInt(userId.toString());

      if (Number.isNaN(numericTenantId) || Number.isNaN(numericUserId)) {
        throw new Error(`Invalid parameters: tenantId=${tenantId}, userId=${userId}`);
      }

      const sqlQuery = this.buildConversationsQuery();
      const params = [
        numericUserId,
        numericTenantId,
        numericTenantId,
        numericUserId,
        numericUserId,
        numericTenantId,
      ];

      const [conversations] = await query<Conversation[]>(sqlQuery, params);

      // Transform the results to match the expected format
      return await Promise.all(
        conversations.map((conv: Conversation) =>
          this.transformConversation(conv, numericTenantId),
        ),
      );
    } catch (error: unknown) {
      console.error('Error in ChatService.getConversations:', error);
      if (error instanceof Error) {
        console.error('Query error details:', error.message);
      }
      throw error;
    }
  }

  /**
   * Check if user has permission to create conversation with target
   */
  private async validateEmployeePermission(
    connection: PoolConnection,
    tenantId: string | number,
    userId: number,
    participantIds: number[],
    isGroup: boolean,
  ): Promise<void> {
    const [currentUserInfo] = await connection.query<UserRoleResult[]>(
      `SELECT role FROM users WHERE id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    if (currentUserInfo.length === 0) {
      throw new Error('Current user not found');
    }

    const firstUser = currentUserInfo[0];
    if (firstUser == null) {
      throw new Error('Current user data is null');
    }

    const userRole = firstUser.role;

    // Employee permission check for non-group conversations
    if (userRole === 'employee' && !isGroup) {
      const [targetUserInfo] = await connection.query<UserRoleResult[]>(
        `SELECT role FROM users WHERE id = $1 AND tenant_id = $2`,
        [participantIds[0], tenantId],
      );

      const firstTarget = targetUserInfo[0];
      if (targetUserInfo.length > 0 && firstTarget?.role === 'employee') {
        throw new Error('Mitarbeiter können keine Nachrichten an andere Mitarbeiter initiieren');
      }
    }
  }

  /**
   * Check if 1:1 conversation already exists
   */
  private async findExistingConversation(
    connection: PoolConnection,
    tenantId: string | number,
    userId: number,
    targetUserId: number,
  ): Promise<number | null> {
    const [existing] = await connection.query<IdResult[]>(
      `SELECT c.id
       FROM conversations c
       INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
       INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
       WHERE c.tenant_id = $1
         AND c.is_group = 0
         AND cp1.user_id = $2
         AND cp2.user_id = $3
         AND c.id IN (
           SELECT conversation_id
           FROM conversation_participants
           GROUP BY conversation_id
           HAVING COUNT(*) = 2
         )`,
      [tenantId, userId, targetUserId],
    );

    const firstExisting = existing[0];
    return existing.length > 0 && firstExisting != null ? firstExisting.id : null;
  }

  /**
   * Add participants to conversation
   */
  private async addParticipants(
    connection: PoolConnection,
    conversationId: number,
    userId: number,
    participantIds: number[],
  ): Promise<void> {
    // Add creator as participant
    await connection.query(
      'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)',
      [conversationId, userId],
    );

    // Add other participants
    for (const participantId of participantIds) {
      await connection.query(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)',
        [conversationId, participantId],
      );
    }
  }

  /**
   * Erstellt eine neue Konversation
   * Nur Admins und Root können initial Nachrichten an Employees senden
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param participantIds - The participantIds parameter
   * @param isGroup - The isGroup parameter
   * @param name - The name parameter
   */
  async createConversation(
    tenantId: string | number,
    userId: number,
    participantIds: number[],
    isGroup?: boolean,
    name: string | null = null,
  ): Promise<ConversationCreationResult> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const resolvedIsGroup = isGroup ?? false;

      // Validate employee permissions
      await this.validateEmployeePermission(
        connection,
        tenantId,
        userId,
        participantIds,
        resolvedIsGroup,
      );

      // Check for existing 1:1 conversation
      if (!resolvedIsGroup && participantIds.length === 1) {
        const firstParticipant = participantIds[0];
        if (firstParticipant == null) {
          throw new Error('First participant ID is null');
        }

        const existingId = await this.findExistingConversation(
          connection,
          tenantId,
          userId,
          firstParticipant,
        );

        if (existingId !== null) {
          await connection.commit();
          return { id: existingId, existing: true };
        }
      }

      // Create new conversation
      const [result] = await connection.query<ResultSetHeader>(
        'INSERT INTO conversations (tenant_id, is_group, name) VALUES ($1, $2, $3)',
        [tenantId, resolvedIsGroup, name],
      );

      const conversationId = result.insertId;

      // Add all participants
      await this.addParticipants(connection, conversationId, userId, participantIds);

      await connection.commit();
      return { id: conversationId, existing: false };
    } catch (error: unknown) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /** Check if user is participant in conversation */
  private async checkParticipant(conversationId: number, userId: number): Promise<void> {
    const [participant] = await query<RowDataPacket[]>(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId],
    );
    if (participant.length === 0) throw new Error('Nicht autorisiert');
  }

  /** Get group conversation participants */
  private async getGroupParticipants(conversationId: number): Promise<Participant[]> {
    const [data] = await query<Participant[]>(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.profile_picture as profile_image_url
       FROM conversation_participants cp JOIN users u ON cp.user_id = u.id WHERE cp.conversation_id = $1`,
      [conversationId],
    );
    return data;
  }

  /** Get messages for conversation */
  async getMessages(
    tenantId: string | number,
    conversationId: number,
    userId: number,
    limit?: number,
    offset?: number,
  ): Promise<MessagesResponse> {
    await this.checkParticipant(conversationId, userId);

    const [conversationData] = await query<ConversationDetails[]>(
      `SELECT c.*, CASE WHEN c.is_group = true THEN c.name ELSE CONCAT(u.first_name, ' ', u.last_name) END AS display_name, u.profile_picture as profile_image_url
       FROM conversations c LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id AND cp.user_id != $1 AND c.is_group = 0
       LEFT JOIN users u ON cp.user_id = u.id WHERE c.id = $2 AND c.tenant_id = $3`,
      [userId, conversationId, tenantId],
    );

    const [messages] = await query<Message[]>(
      `SELECT m.*, u.username, u.first_name, u.last_name, u.profile_picture as profile_image_url, 0 AS is_read
       FROM messages m LEFT JOIN users u ON m.sender_id = u.id WHERE m.conversation_id = $1 AND m.tenant_id = $2
       ORDER BY m.created_at DESC LIMIT $3 OFFSET $4`,
      [conversationId, tenantId, limit ?? 50, offset ?? 0],
    );

    const firstConversation = conversationData[0];
    if (firstConversation == null) throw new Error('Conversation not found');

    const participants =
      firstConversation.is_group === true ? await this.getGroupParticipants(conversationId) : [];
    return { conversation: firstConversation, messages: messages.reverse(), participants };
  }

  /** Get user role for permission check */
  private async getUserRole(senderId: number, tenantId: string | number): Promise<string> {
    const [info] = await query<UserRoleResult[]>(
      'SELECT role FROM users WHERE id = $1 AND tenant_id = $2',
      [senderId, tenantId],
    );
    if (info.length === 0 || info[0] == null) throw new Error('Sender not found');
    return info[0].role;
  }

  /** Check if employee can send (needs admin message first) */
  private async checkEmployeeSendPermission(
    conversationId: number,
    tenantId: string | number,
  ): Promise<void> {
    const [adminMessages] = await query<CountResult[]>(
      `SELECT COUNT(*) as count FROM messages m JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1 AND u.role IN ('admin', 'root') AND m.tenant_id = $2`,
      [conversationId, tenantId],
    );
    if (adminMessages[0] == null || adminMessages[0].count === 0) {
      throw new Error('Mitarbeiter können nur antworten, wenn ein Admin bereits geschrieben hat');
    }
  }

  /** Send a message */
  async sendMessage(
    tenantId: string | number,
    conversationId: number,
    senderId: number,
    content: string,
    attachment: AttachmentData | null = null,
  ): Promise<Message> {
    await this.checkParticipant(conversationId, senderId);
    const senderRole = await this.getUserRole(senderId, tenantId);
    if (senderRole === 'employee') await this.checkEmployeeSendPermission(conversationId, tenantId);

    const [result] = await query<ResultSetHeader>(
      `INSERT INTO messages (tenant_id, conversation_id, sender_id, content, attachment_path, attachment_name, attachment_type) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        tenantId,
        conversationId,
        senderId,
        content,
        attachment?.path ?? null,
        attachment?.name ?? null,
        attachment?.type ?? null,
      ],
    );

    await query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [
      conversationId,
    ]);

    const [message] = await query<Message[]>(
      `SELECT m.*, u.username, u.first_name, u.last_name, u.profile_picture as profile_image_url FROM messages m LEFT JOIN users u ON m.sender_id = u.id WHERE m.id = $1`,
      [result.insertId],
    );
    if (message[0] == null) throw new Error('Created message not found');
    return message[0];
  }

  /**
   * Markiert Nachrichten als gelesen
   * @param messageId - The messageId parameter
   * @param userId - The user ID
   */
  async markAsRead(messageId: number, userId: number): Promise<void> {
    await query(
      `INSERT INTO message_status (message_id, user_id, is_read, read_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (message_id, user_id) DO UPDATE SET is_read = true, read_at = NOW()`,
      [messageId, userId],
    );
  }

  /**
   * Löscht eine Nachricht
   * @param messageId - The messageId parameter
   * @param userId - The user ID
   */
  async deleteMessage(messageId: number, userId: number): Promise<boolean> {
    const [result] = await query<ResultSetHeader>(
      'UPDATE messages SET deleted_at = NOW() WHERE id = $1 AND sender_id = $2',
      [messageId, userId],
    );

    return result.affectedRows > 0;
  }

  /**
   * Holt die Anzahl ungelesener Nachrichten
   * @param _tenantDb - The _tenantDb parameter (kept for backward compatibility)
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async getUnreadCount(
    _tenantDb: TenantDbPool,
    tenantId: string | number,
    userId: number,
  ): Promise<number> {
    try {
      // Count messages that don't have a read status for this user
      const [result] = await query<CountResult[]>(
        `SELECT COUNT(DISTINCT m.id) as count
         FROM messages m
         INNER JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
         LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.user_id = $1
         WHERE cp.user_id = $2
           AND m.tenant_id = $3
           AND m.sender_id != $4
           AND m.deleted_at IS NULL
           AND (ms.id IS NULL OR ms.is_read = false)`,
        [userId, userId, tenantId, userId],
      );

      const firstResult = result[0];
      if (firstResult == null) {
        return 0;
      }

      return firstResult.count;
    } catch (error: unknown) {
      console.error('Error in getUnreadCount:', error);
      return 0;
    }
  }

  /**
   * Mark all messages in a conversation as read for a user
   * @param conversationId - The conversationId parameter
   * @param userId - The user ID
   */
  async markConversationAsRead(conversationId: number, userId: number): Promise<void> {
    try {
      // First, get all unread messages in this conversation for this user
      const [messages] = await query<IdResult[]>(
        `SELECT m.id
         FROM messages m
         LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.user_id = $1
         WHERE m.conversation_id = $2
           AND m.sender_id != $3
           AND (ms.id IS NULL OR ms.is_read = false)`,
        [userId, conversationId, userId],
      );

      // Insert or update message_status for each unread message
      for (const message of messages) {
        await query(
          `INSERT INTO message_status (message_id, user_id, is_read, read_at)
           VALUES ($1, $2, 1, NOW())
           ON CONFLICT (message_id, user_id) DO UPDATE SET is_read = true, read_at = NOW()`,
          [message.id, userId],
        );
      }
    } catch (error: unknown) {
      console.error('Error marking conversation as read:', error);
      throw error;
    }
  }

  /**
   * Archiviert eine Nachricht
   * @param messageId - The messageId parameter
   * @param userId - The user ID
   */
  async archiveMessage(messageId: number, userId: number): Promise<boolean> {
    await query(
      `INSERT INTO message_status (message_id, user_id, is_archived, archived_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (message_id, user_id) DO UPDATE SET is_archived = true, archived_at = NOW()`,
      [messageId, userId],
    );

    return true;
  }

  /**
   * Löscht eine Konversation für einen Benutzer
   * @param conversationId - The conversationId parameter
   * @param userId - The user ID
   */
  async deleteConversation(conversationId: number, userId: number): Promise<boolean> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      // Check if conversation exists and if user is participant
      const [conversation] = await connection.query<ConversationGroupInfo[]>(
        `SELECT c.is_group,
                COUNT(DISTINCT cp.user_id) as participant_count
         FROM conversations c
         JOIN conversation_participants cp ON c.id = cp.conversation_id
         WHERE c.id = $3 AND EXISTS (
           SELECT 1 FROM conversation_participants
           WHERE conversation_id = $4 AND user_id = $2
         )
         GROUP BY c.id`,
        [conversationId, conversationId, userId],
      );

      if (conversation.length === 0) {
        throw new Error('Conversation not found or access denied');
      }

      const firstConversation = conversation[0];
      if (firstConversation == null) {
        throw new Error('Conversation data is null');
      }

      const isGroup = Boolean(firstConversation.is_group);
      const participantCount = firstConversation.participant_count;

      if (!isGroup || participantCount <= 2) {
        // For 1:1 chats or groups with only 2 participants left, delete everything

        // Delete message status entries
        await connection.query(
          'DELETE FROM message_status WHERE message_id IN (SELECT id FROM messages WHERE conversation_id = $1)',
          [conversationId],
        );

        // Delete messages
        await connection.query('DELETE FROM messages WHERE conversation_id = $1', [conversationId]);

        // Delete participants
        await connection.query('DELETE FROM conversation_participants WHERE conversation_id = $1', [
          conversationId,
        ]);

        // Delete conversation
        await connection.query('DELETE FROM conversations WHERE id = $1', [conversationId]);
      } else {
        // For groups with more than 2 participants, just remove the user
        await connection.query(
          'DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
          [conversationId, userId],
        );

        // Archive messages for this user
        await connection.query(
          `INSERT INTO message_status (message_id, user_id, is_archived, archived_at)
           SELECT m.id, $1, 1, NOW()
           FROM messages m
           WHERE m.conversation_id = $2
           ON CONFLICT (message_id, user_id) DO UPDATE SET is_archived = true, archived_at = NOW()`,
          [userId, conversationId],
        );
      }

      await connection.commit();
      return true;
    } catch (error: unknown) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get participants of a conversation
  /**
   *
   * @param conversationId - The conversationId parameter
   * @param tenantId - The tenant ID
   */
  async getConversationParticipants(
    conversationId: number,
    tenantId: number,
  ): Promise<Participant[]> {
    const sqlQuery = `
      SELECT u.id, u.username, u.first_name, u.last_name, u.email,
             u.profile_picture as profile_image_url, cp.joined_at, cp.is_admin
      FROM conversation_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.conversation_id = $1 AND u.tenant_id = $2
      ORDER BY u.username
    `;

    const [participants] = await execute<Participant[]>(sqlQuery, [conversationId, tenantId]);
    return participants;
  }

  // Add participant to conversation
  /**
   *
   * @param conversationId - The conversationId parameter
   * @param userId - The user ID
   * @param addedBy - The addedBy parameter
   * @param tenantId - The tenant ID for multi-tenant isolation
   */
  async addParticipant(
    conversationId: number,
    userId: number,
    addedBy: number,
    tenantId: number,
  ): Promise<void> {
    // Check if user is already in conversation
    const [existing] = await execute<RowDataPacket[]>(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId],
    );

    if (existing.length > 0) {
      throw new Error('User is already a participant');
    }

    // Add participant
    await execute(
      'INSERT INTO conversation_participants (conversation_id, user_id, joined_at) VALUES ($1, $2, NOW())',
      [conversationId, userId],
    );

    // Add system message about new participant
    const [userInfo] = await execute<UserUsernameResult[]>(
      'SELECT username FROM users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId],
    );

    const firstUser = userInfo[0];
    if (userInfo.length > 0 && firstUser != null) {
      await execute(
        'INSERT INTO messages (conversation_id, user_id, content, is_system, created_at) VALUES ($1, $2, $3, 1, NOW())',
        [conversationId, addedBy, `${firstUser.username} wurde zur Unterhaltung hinzugefügt`],
      );
    }
  }

  // Remove participant from conversation
  /**
   *
   * @param conversationId - The conversationId parameter
   * @param userId - The user ID
   * @param removedBy - The removedBy parameter
   * @param tenantId - The tenant ID for multi-tenant isolation
   */
  async removeParticipant(
    conversationId: number,
    userId: number,
    removedBy: number,
    tenantId: number,
  ): Promise<void> {
    // Check if user is in conversation
    const [existing] = await execute<RowDataPacket[]>(
      'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId],
    );

    if (existing.length === 0) {
      throw new Error('User is not a participant');
    }

    // Remove participant
    await execute(
      'DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId],
    );

    // Add system message about removed participant
    const [userInfo] = await execute<UserUsernameResult[]>(
      'SELECT username FROM users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId],
    );

    const firstUser = userInfo[0];
    if (userInfo.length > 0 && firstUser != null) {
      await execute(
        'INSERT INTO messages (conversation_id, user_id, content, is_system, created_at) VALUES ($1, $2, $3, 1, NOW())',
        [conversationId, removedBy, `${firstUser.username} hat die Unterhaltung verlassen`],
      );
    }
  }

  // Update conversation name
  /**
   *
   * @param conversationId - The conversationId parameter
   * @param name - The name parameter
   * @param updatedBy - The updatedBy parameter
   * @param _tenantId - The _tenantId parameter
   */
  async updateConversationName(
    conversationId: number,
    name: string,
    updatedBy: number,
    _tenantId: number,
  ): Promise<void> {
    // Update name
    await execute('UPDATE conversations SET name = $3 WHERE id = $2', [name, conversationId]);

    // Add system message about name change
    await execute(
      'INSERT INTO messages (conversation_id, user_id, content, is_system, created_at) VALUES ($1, $2, $3, 1, NOW())',
      [conversationId, updatedBy, `Gruppenname geändert zu "${name}"`],
    );
  }
}

// Export singleton instance
const chatService = new ChatService();
export default chatService;

// Named export for the class
export { ChatService };

// CommonJS compatibility
