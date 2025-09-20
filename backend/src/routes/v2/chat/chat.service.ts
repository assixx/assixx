/**
 * Chat Service Layer v2
 * Business logic for real-time messaging, conversations, and file attachments
 * Complete v2 implementation without v1 dependencies
 */
import { log, error as logError } from 'console';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { execute } from '../../../utils/db.js';
import { ServiceError } from '../users/users.service.js';

// Re-export types
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Interfaces for Chat v2
export interface ChatUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
  department_id: number | null;
  department: string | null;
  role: string;
  status: string;
  last_seen: Date | null;
}

export interface ConversationLastMessage {
  content: string;
  created_at: Date;
}

export interface Conversation {
  id: number;
  name: string | null;
  isGroup: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastMessage: ConversationLastMessage | null;
  unreadCount: number;
  participants: ConversationParticipant[];
}

export interface ConversationParticipant {
  id: number;
  userId: number;
  username: string;
  first_name: string;
  last_name: string;
  profile_picture_url: string | null;
  joinedAt: Date;
  isActive: boolean;
}

export interface Message {
  id: number;
  conversationId: number;
  senderId: number | null;
  senderName: string;
  senderUsername: string;
  senderProfilePicture: string | null;
  content: string;
  attachment: MessageAttachment | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageAttachment {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ConversationFilters {
  search?: string;
  isGroup?: boolean;
  hasUnread?: boolean;
  page?: number;
  limit?: number;
}

export interface MessageFilters {
  search?: string;
  startDate?: Date;
  endDate?: Date;
  hasAttachment?: boolean;
  page?: number;
  limit?: number;
}

// Internal interfaces for database rows
interface ParticipantRow extends RowDataPacket {
  conversation_id: number;
  user_id: number;
  joined_at: Date;
  is_admin?: boolean;
  username: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture: string | null;
}

export interface CreateConversationData {
  participantIds: number[];
  name?: string;
  isGroup?: boolean;
}

export interface SendMessageData {
  content: string;
  attachment?: {
    path: string;
    filename: string;
    mimeType: string;
    size: number;
  };
}

export interface UnreadCountSummary {
  totalUnread: number;
  conversations: {
    conversationId: number;
    conversationName: string | null;
    unreadCount: number;
    lastMessageTime: Date;
  }[];
}

// Type definitions for database results
interface ChatUserRow extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture: string | null;
  department_id: number | null;
  department_name: string | null;
  role: string;
}

interface CountResult extends RowDataPacket {
  total: number;
}

interface ConversationRow extends RowDataPacket {
  id: number;
  name: string | null;
  is_group: number;
  created_at: Date;
  updated_at: Date;
  last_message_id: number | null;
  last_message_content: string | null;
  last_message_created_at: Date | null;
  last_message_time: Date | null; // Added for SQL alias
  last_message_sender_id: number | null;
  last_message_sender_username: string | null;
  unread_count: number;
}

interface MessageRow extends RowDataPacket {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_username: string;
  sender_first_name: string | null;
  sender_last_name: string | null;
  sender_profile_picture: string | null;
  content: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  is_system: number;
  created_at: Date;
  is_read?: number;
  read_at?: Date | null;
}

/**
 *
 */
export class ChatService {
  /**
   * Get list of users available for chat
   * @param tenantId - The tenant ID
   * @param currentUserId - The currentUserId parameter
   * @param search - The search parameter
   */
  async getChatUsers(
    tenantId: number,
    currentUserId: number,
    search?: string,
  ): Promise<ChatUser[]> {
    try {
      // Get current user's role and department
      const [userRows] = await execute<RowDataPacket[]>(
        'SELECT role, department_id FROM users WHERE id = ? AND tenant_id = ?',
        [currentUserId, tenantId],
      );

      if (!userRows.length) {
        throw new ServiceError('USER_NOT_FOUND', 'Current user not found', 404);
      }

      const currentUser = userRows[0];
      let query: string;
      let params: unknown[];

      // Admins and roots can see all users in tenant
      if (currentUser.role === 'admin' || currentUser.role === 'root') {
        query = `
          SELECT
            u.id,
            u.username,
            u.email,
            u.first_name,
            u.last_name,
            u.profile_picture,
            u.department_id,
            d.name as department_name,
            u.role
          FROM users u
          LEFT JOIN departments d ON u.department_id = d.id
          WHERE u.tenant_id = ? AND u.id != ?
        `;
        params = [tenantId, currentUserId];
      } else {
        // Employees can only see users in their department + all admins
        query = `
          SELECT
            u.id,
            u.username,
            u.email,
            u.first_name,
            u.last_name,
            u.profile_picture,
            u.department_id,
            d.name as department_name,
            u.role
          FROM users u
          LEFT JOIN departments d ON u.department_id = d.id
          WHERE u.tenant_id = ?
            AND u.id != ?
            AND (u.department_id = ? OR u.role IN ('admin', 'root'))
        `;
        params = [tenantId, currentUserId, currentUser.department_id];
      }

      const [users] = await execute<ChatUserRow[]>(query, params);

      // Apply search filter if provided
      let filteredUsers = users;
      if (search !== undefined && search !== '') {
        const searchLower = search.toLowerCase();
        filteredUsers = users.filter((user) => {
          const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.toLowerCase();
          return (
            user.username.toLowerCase().includes(searchLower) ||
            user.email.toLowerCase().includes(searchLower) ||
            fullName.includes(searchLower)
          );
        });
      }

      // Transform to v2 format - using snake_case to match frontend expectations
      return filteredUsers.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
        profile_picture: user.profile_picture,
        department_id: user.department_id,
        department: user.department_name,
        role: user.role, // Include role for frontend filtering
        status: 'offline', // TODO: Implement online status
        last_seen: null, // TODO: Implement last seen
      }));
    } catch {
      throw new ServiceError('CHAT_USERS_ERROR', 'Failed to fetch chat users', 500);
    }
  }

  /**
   * Build WHERE clause for conversations query
   */
  private buildConversationWhereClause(
    filters: ConversationFilters,
    tenantId: number,
    userId: number,
  ): { whereClause: string; params: unknown[] } {
    let whereClause = `
      WHERE c.tenant_id = ?
      AND cp.user_id = ?
    `;
    const params: unknown[] = [tenantId, userId];

    if (filters.search) {
      whereClause += ` AND (c.name LIKE ? OR m.content LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.isGroup !== undefined) {
      whereClause += ` AND c.is_group = ?`;
      params.push(filters.isGroup ? 1 : 0);
    }

    return { whereClause, params };
  }

  /**
   * Get conversation participants with user details
   */
  private async getConversationParticipants(conversationIds: number[]): Promise<ParticipantRow[]> {
    if (conversationIds.length === 0) {
      return [];
    }

    const query = `
      SELECT
        cp.conversation_id,
        cp.user_id,
        cp.joined_at,
        cp.is_admin,
        u.username,
        u.first_name,
        u.last_name,
        u.profile_picture
      FROM conversation_participants cp
      INNER JOIN users u ON cp.user_id = u.id
      WHERE cp.conversation_id IN (${conversationIds.map(() => '?').join(',')})
    `;

    const [rows] = await execute<ParticipantRow[]>(query, conversationIds);
    return rows;
  }

  /**
   * Get unread message counts for conversations
   */
  private async getUnreadCounts(
    conversationIds: number[],
    userId: number,
  ): Promise<Map<number, number>> {
    const unreadCounts = new Map<number, number>();

    if (conversationIds.length === 0) {
      return unreadCounts;
    }

    const query = `
      SELECT
        m.conversation_id,
        COUNT(*) as unread_count
      FROM messages m
      LEFT JOIN conversation_participants cp
        ON cp.conversation_id = m.conversation_id
        AND cp.user_id = ${userId}
      WHERE m.conversation_id IN (${conversationIds.map(() => '?').join(',')})
        AND m.sender_id != ${userId}
        AND m.id > COALESCE(cp.last_read_message_id, 0)
      GROUP BY m.conversation_id
    `;

    interface UnreadCountRow extends RowDataPacket {
      conversation_id: number;
      unread_count: number;
    }

    const [rows] = await execute<UnreadCountRow[]>(query, conversationIds);

    for (const row of rows) {
      unreadCounts.set(row.conversation_id, row.unread_count);
    }

    return unreadCounts;
  }

  /**
   * Transform conversation data to API format
   */
  private transformConversation(
    conv: ConversationRow,
    participants: ParticipantRow[],
    unreadCount: number,
  ): Conversation {
    const convParticipants = participants
      .filter((p) => p.conversation_id === conv.id)
      .map((p) => ({
        id: p.user_id,
        userId: p.user_id,
        username: p.username,
        first_name: p.first_name ?? '',
        last_name: p.last_name ?? '',
        profile_picture_url: p.profile_picture,
        joinedAt: new Date(p.joined_at),
        isActive: true,
      }));

    let lastMessage = null;
    if (conv.last_message_content && conv.last_message_time) {
      lastMessage = {
        content: conv.last_message_content,
        created_at: new Date(conv.last_message_time),
      };
    }

    return {
      id: conv.id,
      name: conv.name,
      isGroup: conv.is_group === 1,
      createdAt: new Date(conv.created_at),
      updatedAt: new Date(conv.updated_at),
      lastMessage,
      unreadCount,
      participants: convParticipants,
      // Frontend compatibility fields (will be removed in future)
      ...({} as { last_message?: unknown; is_group?: boolean; unread_count?: number }),
    };
  }

  /**
   * Get user's conversations with pagination
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   * @param filters - The filter criteria
   */
  async getConversations(
    tenantId: number,
    userId: number,
    filters: ConversationFilters = {},
  ): Promise<{ data: Conversation[]; pagination: PaginationMeta }> {
    try {
      log('[Chat Service] getConversations called with:', { tenantId, userId, filters });

      // Calculate pagination
      const page = Math.max(1, Number.isNaN(filters.page) ? 1 : (filters.page ?? 1));
      const limit = Math.min(
        100,
        Math.max(1, Number.isNaN(filters.limit) ? 20 : (filters.limit ?? 20)),
      );
      const offset = (page - 1) * limit;

      // Build WHERE clause
      const { whereClause, params } = this.buildConversationWhereClause(filters, tenantId, userId);

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT c.id) as total
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        LEFT JOIN messages m ON c.id = m.conversation_id
        ${whereClause}
      `;
      const [countResult] = await execute<CountResult[]>(countQuery, params);
      const totalItems = countResult[0]?.total ?? 0;

      // Get conversations
      const query = `
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at,
          (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_content,
          (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_time
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = ${tenantId} AND cp.user_id = ${userId}
        ORDER BY c.updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      log('[Chat Service] Full query:', query);
      const [conversations] = await execute<ConversationRow[]>(query);
      const conversationIds = conversations.map((c) => c.id);

      // Get participants and unread counts in parallel
      const [participants, unreadCounts] = await Promise.all([
        this.getConversationParticipants(conversationIds),
        this.getUnreadCounts(conversationIds, userId),
      ]);

      // Transform conversations
      const transformedConversations = conversations.map((conv) => {
        const unreadCount = unreadCounts.get(conv.id) ?? 0;
        return this.transformConversation(conv, participants, unreadCount);
      });

      // Calculate pagination
      const totalPages = Math.ceil(totalItems / limit);

      return {
        data: transformedConversations,
        pagination: {
          currentPage: page,
          totalPages,
          pageSize: limit,
          totalItems,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error: unknown) {
      logError('[Chat Service] getConversations error:', error);
      throw new ServiceError('CONVERSATIONS_ERROR', 'Failed to fetch conversations', 500);
    }
  }

  /**
   * Create a new conversation
   * @param tenantId - The tenant ID
   * @param creatorId - The creatorId parameter
   * @param data - The data object
   */
  async createConversation(
    tenantId: number,
    creatorId: number,
    data: CreateConversationData,
  ): Promise<{ conversation: Conversation }> {
    try {
      log('[Chat Service] createConversation called with:', {
        tenantId,
        creatorId,
        data,
      });

      // Critical debug: Log actual tenant_id being used
      logError('[CRITICAL DEBUG] Creating conversation with tenantId:', tenantId);

      // Check if it's a 1:1 conversation and if it already exists
      const isGroup = data.isGroup ?? data.participantIds.length > 1;

      if (!isGroup && data.participantIds.length === 1) {
        // Check if 1:1 conversation already exists
        const [existing] = await execute<RowDataPacket[]>(
          `SELECT c.id
           FROM conversations c
           WHERE c.tenant_id = ?
           AND c.is_group = 0
           AND EXISTS (
             SELECT 1 FROM conversation_participants cp1
             WHERE cp1.conversation_id = c.id AND cp1.user_id = ?
           )
           AND EXISTS (
             SELECT 1 FROM conversation_participants cp2
             WHERE cp2.conversation_id = c.id AND cp2.user_id = ?
           )
           AND (
             SELECT COUNT(*) FROM conversation_participants cp3
             WHERE cp3.conversation_id = c.id
           ) = 2`,
          [tenantId, creatorId, data.participantIds[0]],
        );

        if (existing.length > 0) {
          // Return existing conversation
          const conversations = await this.getConversations(tenantId, creatorId, {
            limit: 100,
          });
          const conversation = conversations.data.find((c) => c.id === existing[0].id);
          if (!conversation) {
            throw new ServiceError(
              'CONVERSATION_NOT_FOUND',
              'Failed to retrieve existing conversation',
              404,
            );
          }
          return { conversation };
        }
      }

      // Create new conversation
      log('[Chat Service] Creating new conversation with isGroup:', isGroup);
      const [conversationResult] = await execute<ResultSetHeader>(
        `INSERT INTO conversations (tenant_id, name, is_group, created_at, updated_at)
         VALUES (?, ?, ?, NOW(), NOW())`,
        [tenantId, data.name ?? null, isGroup ? 1 : 0],
      );

      const conversationId = conversationResult.insertId;
      log('[Chat Service] Created conversation with ID:', conversationId);

      // Add creator as participant
      await execute(
        `INSERT INTO conversation_participants (tenant_id, conversation_id, user_id, is_admin, joined_at)
         VALUES (?, ?, ?, 1, NOW())`,
        [tenantId, conversationId, creatorId],
      );

      // Add other participants
      for (const participantId of data.participantIds) {
        await execute(
          `INSERT INTO conversation_participants (tenant_id, conversation_id, user_id, is_admin, joined_at)
           VALUES (?, ?, ?, 0, NOW())`,
          [tenantId, conversationId, participantId],
        );
      }

      // Get the created conversation details
      const conversations = await this.getConversations(tenantId, creatorId, {
        limit: 100,
      });
      const conversation = conversations.data.find((c) => c.id === conversationId);

      if (!conversation) {
        throw new ServiceError(
          'CREATE_CONVERSATION_ERROR',
          'Failed to retrieve created conversation',
          500,
        );
      }

      return { conversation };
    } catch (error: unknown) {
      logError('[Chat Service] createConversation error:', error);
      throw error instanceof ServiceError ? error : (
          new ServiceError('CREATE_CONVERSATION_ERROR', 'Failed to create conversation', 500)
        );
    }
  }

  /**
   * Verify user is participant of conversation
   */
  private async verifyConversationAccess(
    conversationId: number,
    userId: number,
    tenantId: number,
  ): Promise<void> {
    const [participant] = await execute<RowDataPacket[]>(
      `SELECT 1 FROM conversation_participants
       WHERE conversation_id = ? AND user_id = ? AND tenant_id = ?`,
      [conversationId, userId, tenantId],
    );

    if (!participant.length) {
      throw new ServiceError(
        'CONVERSATION_ACCESS_DENIED',
        'You are not a participant of this conversation',
        403,
      );
    }
  }

  /**
   * Build WHERE clause for messages query
   */
  private buildMessagesWhereClause(
    filters: MessageFilters,
    conversationId: number,
    tenantId: number,
  ): { whereClause: string; params: unknown[] } {
    let whereClause = 'WHERE m.conversation_id = ? AND m.tenant_id = ?';
    const params: unknown[] = [conversationId, tenantId];

    if (filters.search) {
      whereClause += ' AND m.content LIKE ?';
      params.push(`%${filters.search}%`);
    }

    if (filters.startDate) {
      whereClause += ' AND m.created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClause += ' AND m.created_at <= ?';
      params.push(filters.endDate);
    }

    if (filters.hasAttachment) {
      whereClause += ' AND m.attachment_path IS NOT NULL';
    }

    return { whereClause, params };
  }

  /**
   * Transform message row to API format
   */
  private transformMessage(msg: MessageRow): Message {
    return {
      id: msg.id,
      conversationId: msg.conversation_id,
      senderId: msg.sender_id,
      senderName:
        `${msg.sender_first_name ?? ''} ${msg.sender_last_name ?? ''}`.trim() || 'Unknown',
      senderUsername: msg.sender_username || 'unknown',
      senderProfilePicture: msg.sender_profile_picture,
      content: msg.content,
      attachment:
        msg.attachment_path ?
          {
            url: msg.attachment_path,
            filename: msg.attachment_name ?? 'attachment',
            mimeType: msg.attachment_type ?? 'application/octet-stream',
            size: 0, // TODO: Add file size to DB
          }
        : null,
      isRead: !!msg.is_read,
      readAt: msg.read_at ? new Date(msg.read_at) : null,
      createdAt: new Date(msg.created_at),
      updatedAt: new Date(msg.created_at), // Messages don't have updated_at
    };
  }

  /**
   * Get messages from a conversation with pagination
   * @param tenantId - The tenant ID
   * @param conversationId - The conversationId parameter
   * @param userId - The user ID
   * @param filters - The filter criteria
   */
  async getMessages(
    tenantId: number,
    conversationId: number,
    userId: number,
    filters: MessageFilters = {},
  ): Promise<{ data: Message[]; pagination: PaginationMeta }> {
    try {
      // Calculate pagination
      const page = Math.max(1, Number.isNaN(filters.page) ? 1 : (filters.page ?? 1));
      const limit = Math.min(
        100,
        Math.max(1, Number.isNaN(filters.limit) ? 50 : (filters.limit ?? 50)),
      );
      const offset = (page - 1) * limit;

      // Verify access
      await this.verifyConversationAccess(conversationId, userId, tenantId);

      // Build WHERE clause
      const { whereClause, params } = this.buildMessagesWhereClause(
        filters,
        conversationId,
        tenantId,
      );

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM messages m ${whereClause}`;
      const [countResult] = await execute<CountResult[]>(countQuery, params);
      const totalItems = countResult[0]?.total ?? 0;

      // Get messages
      const messagesQuery = `
        SELECT
          m.id,
          m.conversation_id,
          m.sender_id,
          m.content,
          m.attachment_path,
          m.attachment_name,
          m.attachment_type,
          m.created_at,
          m.deleted_at,
          u.username as sender_username,
          u.first_name as sender_first_name,
          u.last_name as sender_last_name,
          u.profile_picture as sender_profile_picture,
          CASE
            WHEN m.sender_id = ${userId} THEN 1
            WHEN m.id <= COALESCE(cp.last_read_message_id, 0) THEN 1
            ELSE 0
          END as is_read,
          CASE
            WHEN m.id <= COALESCE(cp.last_read_message_id, 0)
            THEN cp.last_read_at
            ELSE NULL
          END as read_at
        FROM messages m
        INNER JOIN users u ON m.sender_id = u.id
        LEFT JOIN conversation_participants cp
          ON cp.conversation_id = m.conversation_id AND cp.user_id = ${userId}
        WHERE m.conversation_id = ${conversationId} AND m.tenant_id = ${tenantId}
        ORDER BY m.created_at ASC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const [messages] = await execute<MessageRow[]>(messagesQuery);

      // Transform messages
      const transformedMessages = messages.map((msg) => this.transformMessage(msg));

      // Return with pagination
      const totalPages = Math.ceil(totalItems / limit);
      return {
        data: transformedMessages,
        pagination: {
          currentPage: page,
          totalPages,
          pageSize: limit,
          totalItems,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error: unknown) {
      throw error instanceof ServiceError ? error : (
          new ServiceError('GET_MESSAGES_ERROR', 'Failed to fetch messages', 500)
        );
    }
  }

  /**
   * Send a message to a conversation
   * @param tenantId - The tenant ID
   * @param conversationId - The conversationId parameter
   * @param senderId - The senderId parameter
   * @param data - The data object
   */
  async sendMessage(
    tenantId: number,
    conversationId: number,
    senderId: number,
    data: SendMessageData,
  ): Promise<{ message: Message }> {
    try {
      // First check if sender is participant of the conversation
      const [participant] = await execute<RowDataPacket[]>(
        `SELECT 1 FROM conversation_participants
         WHERE conversation_id = ? AND user_id = ? AND tenant_id = ?`,
        [conversationId, senderId, tenantId],
      );

      if (!participant.length) {
        throw new ServiceError(
          'CONVERSATION_ACCESS_DENIED',
          'You are not a participant of this conversation',
          403,
        );
      }

      // Insert message
      const [messageResult] = await execute<ResultSetHeader>(
        `INSERT INTO messages (tenant_id, conversation_id, sender_id, content,
           attachment_path, attachment_name, attachment_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          tenantId,
          conversationId,
          senderId,
          data.content,
          data.attachment?.path ?? null,
          data.attachment?.filename ?? null,
          data.attachment?.mimeType ?? null,
        ],
      );

      const messageId = messageResult.insertId;

      // Update conversation's updated_at
      await execute(`UPDATE conversations SET updated_at = NOW() WHERE id = ?`, [conversationId]);

      // Get sender info
      interface SenderRow extends RowDataPacket {
        username: string;
        first_name: string | null;
        last_name: string | null;
        profile_picture: string | null;
      }

      const [senderRows] = await execute<SenderRow[]>(
        `SELECT username, first_name, last_name, profile_picture
         FROM users WHERE id = ?`,
        [senderId],
      );

      const sender = senderRows[0];

      // Return message in v2 format
      const message: Message = {
        id: messageId,
        conversationId,
        senderId,
        senderName: `${sender.first_name ?? ''} ${sender.last_name ?? ''}`.trim() || 'Unknown',
        senderUsername: sender.username,
        senderProfilePicture: sender.profile_picture,
        content: data.content,
        attachment:
          data.attachment ?
            {
              url: data.attachment.path,
              filename: data.attachment.filename,
              mimeType: data.attachment.mimeType,
              size: data.attachment.size,
            }
          : null,
        isRead: false,
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return { message };
    } catch (error: unknown) {
      throw error instanceof ServiceError ? error : (
          new ServiceError('SEND_MESSAGE_ERROR', 'Failed to send message', 500)
        );
    }
  }

  /**
   * Get unread message count
   * @param tenantId - The tenant ID
   * @param userId - The user ID
   */
  async getUnreadCount(tenantId: number, userId: number): Promise<UnreadCountSummary> {
    try {
      // Get unread messages grouped by conversation
      // Using conversation_participants.last_read_message_id instead of message_read_receipts
      const query = `
        SELECT
          c.id as conversationId,
          c.name as conversationName,
          COUNT(CASE
            WHEN m.id > COALESCE(cp.last_read_message_id, 0)
            AND m.sender_id != ${userId}
            THEN 1
          END) as unreadCount,
          MAX(m.created_at) as lastMessageTime
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        LEFT JOIN messages m ON m.conversation_id = c.id
        WHERE c.tenant_id = ${tenantId}
        AND cp.user_id = ${userId}
        AND cp.tenant_id = ${tenantId}
        GROUP BY c.id, c.name
        HAVING unreadCount > 0
        ORDER BY lastMessageTime DESC
      `;

      interface UnreadRow extends RowDataPacket {
        conversationId: number;
        conversationName: string | null;
        unreadCount: string | number;
        lastMessageTime: string | Date;
      }

      const [rows] = await execute<UnreadRow[]>(query);

      const conversations = rows.map((row) => ({
        conversationId: row.conversationId,
        conversationName: row.conversationName,
        unreadCount: Number(row.unreadCount),
        lastMessageTime: new Date(row.lastMessageTime),
      }));

      const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

      return {
        totalUnread,
        conversations,
      };
    } catch (error: unknown) {
      logError('[Chat Service] getUnreadCount error:', error);
      throw new ServiceError('UNREAD_COUNT_ERROR', 'Failed to get unread count', 500);
    }
  }

  /**
   * Mark all messages in a conversation as read
   * @param conversationId - The conversationId parameter
   * @param userId - The user ID
   */
  async markConversationAsRead(
    conversationId: number,
    userId: number,
  ): Promise<{ markedCount: number }> {
    try {
      log('[Chat Service] markConversationAsRead:', { conversationId, userId });

      // First check if user is participant - using string interpolation
      const [participant] = await execute<RowDataPacket[]>(
        `SELECT 1 FROM conversation_participants
         WHERE conversation_id = ${conversationId} AND user_id = ${userId}`,
      );

      if (!participant.length) {
        throw new ServiceError(
          'CONVERSATION_ACCESS_DENIED',
          'You are not a participant of this conversation',
          403,
        );
      }

      log('[Chat Service] User is participant, updating last read message');

      // Get the latest message id in the conversation
      interface LatestMessageRow extends RowDataPacket {
        lastMessageId: number | null;
      }
      const [latestMessage] = await execute<LatestMessageRow[]>(
        `SELECT MAX(id) as lastMessageId
         FROM messages
         WHERE conversation_id = ${conversationId}`,
      );

      const lastMessageId = latestMessage[0]?.lastMessageId ?? 0;

      // Update last_read_message_id in conversation_participants
      await execute(
        `UPDATE conversation_participants
         SET last_read_message_id = ?, last_read_at = NOW()
         WHERE conversation_id = ? AND user_id = ?`,
        [lastMessageId, conversationId, userId],
      );

      // Count how many messages were marked as read
      interface CountRow extends RowDataPacket {
        count: number;
      }

      const [unreadCount] = await execute<CountRow[]>(
        `SELECT COUNT(*) as count
         FROM messages m
         JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
         WHERE m.conversation_id = ${conversationId}
         AND m.sender_id != ${userId}
         AND m.id > COALESCE(cp.last_read_message_id, 0)
         AND cp.user_id = ${userId}`,
      );

      return { markedCount: unreadCount[0]?.count ?? 0 };
    } catch (error: unknown) {
      logError('[Chat Service] markConversationAsRead error:', error);
      throw error instanceof ServiceError ? error : (
          new ServiceError('MARK_READ_ERROR', 'Failed to mark messages as read', 500)
        );
    }
  }

  /**
   * Delete a conversation (admin only or single participant)
   * @param conversationId - The conversationId parameter
   * @param userId - The user ID
   * @param userRole - The userRole parameter
   */
  async deleteConversation(
    conversationId: number,
    userId: number,
    userRole: string,
  ): Promise<void> {
    try {
      // Check if user is participant
      const [participant] = await execute<RowDataPacket[]>(
        `SELECT is_admin FROM conversation_participants
         WHERE conversation_id = ? AND user_id = ?`,
        [conversationId, userId],
      );

      if (!participant.length) {
        throw new ServiceError(
          'CONVERSATION_ACCESS_DENIED',
          'You are not a participant of this conversation',
          403,
        );
      }

      // Check permissions: must be admin or the only participant
      const [participantCount] = await execute<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM conversation_participants
         WHERE conversation_id = ?`,
        [conversationId],
      );

      const canDelete =
        userRole === 'root' ||
        userRole === 'admin' ||
        participant[0].is_admin === 1 ||
        participantCount[0].count === 1;

      if (!canDelete) {
        throw new ServiceError(
          'DELETE_CONVERSATION_FORBIDDEN',
          "You don't have permission to delete this conversation",
          403,
        );
      }

      // Delete in correct order to avoid FK constraints
      await execute(`DELETE FROM messages WHERE conversation_id = ?`, [conversationId]);

      await execute(`DELETE FROM conversation_participants WHERE conversation_id = ?`, [
        conversationId,
      ]);

      await execute(`DELETE FROM conversations WHERE id = ?`, [conversationId]);
    } catch (error: unknown) {
      throw error instanceof ServiceError ? error : (
          new ServiceError('DELETE_CONVERSATION_ERROR', 'Failed to delete conversation', 500)
        );
    }
  }

  /**
   * Get single conversation details
   * @param tenantId - The tenant ID
   * @param conversationId - The conversationId parameter
   * @param userId - The user ID
   */
  async getConversation(
    tenantId: number,
    conversationId: number,
    userId: number,
  ): Promise<Conversation | null> {
    try {
      // Check if user is participant
      const [participant] = await execute<RowDataPacket[]>(
        `SELECT 1 FROM conversation_participants
         WHERE conversation_id = ${conversationId} AND user_id = ${userId}`,
      );

      if (!participant.length) {
        return null;
      }

      // Get conversation details
      const [conversations] = await execute<ConversationRow[]>(
        `SELECT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        WHERE c.id = ${conversationId} AND c.tenant_id = ${tenantId}`,
      );

      if (!conversations.length) {
        return null;
      }

      const conv = conversations[0];

      // Get participants
      interface ConvParticipantRow extends RowDataPacket {
        user_id: number;
        is_admin: number;
        joined_at: string | Date;
        username: string;
        first_name: string | null;
        last_name: string | null;
        profile_picture: string | null;
      }
      const [participants] = await execute<ConvParticipantRow[]>(
        `SELECT
          cp.user_id,
          cp.is_admin,
          cp.joined_at,
          u.username,
          u.first_name,
          u.last_name,
          u.profile_picture
        FROM conversation_participants cp
        INNER JOIN users u ON cp.user_id = u.id
        WHERE cp.conversation_id = ${conversationId}`,
      );

      const convParticipants = participants.map((p) => ({
        id: p.user_id, // Add id field for frontend
        userId: p.user_id,
        username: p.username,
        first_name: p.first_name ?? '', // Use snake_case to match frontend
        last_name: p.last_name ?? '', // Use snake_case to match frontend
        profile_picture_url: p.profile_picture, // Use snake_case to match frontend
        joinedAt: new Date(p.joined_at),
        isActive: true,
      }));

      return {
        id: conv.id,
        name: conv.name,
        isGroup: conv.is_group === 1,
        createdAt: new Date(conv.created_at),
        updatedAt: new Date(conv.updated_at),
        lastMessage: null,
        unreadCount: 0,
        participants: convParticipants,
      };
    } catch (error: unknown) {
      logError('[Chat Service] getConversation error:', error);
      throw new ServiceError('CONVERSATION_ERROR', 'Failed to get conversation', 500);
    }
  }
}

// Export singleton instance
export default new ChatService();
