/**
 * Chat Service Layer v2
 * Business logic for real-time messaging, conversations, and file attachments
 * Complete v2 implementation without v1 dependencies
 */

import { log, error as logError } from "console";

import { RowDataPacket, ResultSetHeader } from "mysql2/promise";

import { execute } from "../../../utils/db.js";
import { ServiceError } from "../users/users.service.js";

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
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  departmentId: number | null;
  departmentName: string | null;
  isOnline: boolean;
  lastSeen: Date | null;
}

export interface Conversation {
  id: number;
  name: string | null;
  isGroup: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastMessage: Message | null;
  unreadCount: number;
  participants: ConversationParticipant[];
}

export interface ConversationParticipant {
  userId: number;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
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
  conversations: Array<{
    conversationId: number;
    conversationName: string | null;
    unreadCount: number;
    lastMessageTime: Date;
  }>;
}

// Type definitions for database results
interface ChatUserRow extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_picture: string | null;
  department_id: number | null;
  department_name: string | null;
  role: string;
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
  last_message_sender_id: number | null;
  last_message_sender_username: string | null;
  unread_count: number;
}

interface MessageRow extends RowDataPacket {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_username: string;
  sender_first_name: string;
  sender_last_name: string;
  sender_profile_picture: string | null;
  content: string;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  is_system: number;
  created_at: Date;
}

export class ChatService {
  /**
   * Get list of users available for chat
   */
  async getChatUsers(
    tenantId: number,
    currentUserId: number,
    search?: string,
  ): Promise<ChatUser[]> {
    try {
      // Get current user's role and department
      const [userRows] = await execute<RowDataPacket[]>(
        "SELECT role, department_id FROM users WHERE id = ? AND tenant_id = ?",
        [currentUserId, tenantId],
      );

      if (!userRows.length) {
        throw new ServiceError("USER_NOT_FOUND", "Current user not found", 404);
      }

      const currentUser = userRows[0];
      let query: string;
      let params: unknown[];

      // Admins and roots can see all users in tenant
      if (currentUser.role === "admin" || currentUser.role === "root") {
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
      if (search) {
        const searchLower = search.toLowerCase();
        filteredUsers = users.filter((user) => {
          const fullName =
            `${user.first_name ?? ""} ${user.last_name ?? ""}`.toLowerCase();
          return (
            user.username.toLowerCase().includes(searchLower) ||
            user.email.toLowerCase().includes(searchLower) ||
            fullName.includes(searchLower)
          );
        });
      }

      // Transform to v2 format
      return filteredUsers.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name ?? "",
        lastName: user.last_name ?? "",
        profilePicture: user.profile_picture,
        departmentId: user.department_id,
        departmentName: user.department_name,
        isOnline: false, // TODO: Implement online status
        lastSeen: null, // TODO: Implement last seen
      }));
    } catch {
      throw new ServiceError(
        "CHAT_USERS_ERROR",
        "Failed to fetch chat users",
        500,
      );
    }
  }

  /**
   * Get user's conversations with pagination
   */
  async getConversations(
    tenantId: number,
    userId: number,
    filters: ConversationFilters = {},
  ): Promise<{ data: Conversation[]; pagination: PaginationMeta }> {
    try {
      log("[Chat Service] getConversations called with:", {
        tenantId,
        userId,
        filters,
      });
      const page = Math.max(
        1,
        Number.isNaN(filters.page) ? 1 : (filters.page ?? 1),
      );
      const limit = Math.min(
        100,
        Math.max(1, Number.isNaN(filters.limit) ? 20 : (filters.limit ?? 20)),
      );
      const offset = (page - 1) * limit;

      // Build query with filters
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

      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(DISTINCT c.id) as total
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        LEFT JOIN messages m ON c.id = m.conversation_id
        ${whereClause}
      `;

      const [countResult] = await execute<RowDataPacket[]>(countQuery, params);
      const totalItems = countResult[0]?.total ?? 0;

      // Get conversations - test with hardcoded values first
      const query = `
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = ${tenantId}
        AND cp.user_id = ${userId}
        ORDER BY c.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      // No parameters needed - using string interpolation
      log("[Chat Service] Full query:", query);

      const [conversations] = await execute<ConversationRow[]>(query);

      // Get participants for each conversation
      const conversationIds = conversations.map((c) => c.id);
      let participants: RowDataPacket[] = [];

      if (conversationIds.length > 0) {
        const participantsQuery = `
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
          WHERE cp.conversation_id IN (${conversationIds.map(() => "?").join(",")})
        `;

        const [participantRows] = await execute<RowDataPacket[]>(
          participantsQuery,
          conversationIds,
        );
        participants = participantRows;
      }

      // Calculate pagination
      const totalPages = Math.ceil(totalItems / limit);

      // Transform to v2 format
      const transformedConversations: Conversation[] = conversations.map(
        (conv) => {
          const convParticipants = participants
            .filter((p) => p.conversation_id === conv.id)
            .map((p) => ({
              userId: p.user_id,
              username: p.username,
              firstName: p.first_name ?? "",
              lastName: p.last_name ?? "",
              profilePicture: p.profile_picture,
              joinedAt: new Date(p.joined_at),
              isActive: true,
            }));

          return {
            id: conv.id,
            name: conv.name,
            isGroup: conv.is_group === 1,
            createdAt: new Date(conv.created_at),
            updatedAt: new Date(conv.updated_at),
            lastMessage: null, // Simplified - no last message in this query
            unreadCount: 0, // Simplified - no unread count in this query
            participants: convParticipants,
          };
        },
      );

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
    } catch (error) {
      logError("[Chat Service] getConversations error:", error);
      throw new ServiceError(
        "CONVERSATIONS_ERROR",
        "Failed to fetch conversations",
        500,
      );
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    tenantId: number,
    creatorId: number,
    data: CreateConversationData,
  ): Promise<{ conversation: Conversation }> {
    try {
      log("[Chat Service] createConversation called with:", {
        tenantId,
        creatorId,
        data,
      });
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
          const conversations = await this.getConversations(
            tenantId,
            creatorId,
            {
              limit: 100,
            },
          );
          const conversation = conversations.data.find(
            (c) => c.id === existing[0].id,
          );
          if (!conversation) {
            throw new ServiceError(
              "CONVERSATION_NOT_FOUND",
              "Failed to retrieve existing conversation",
              404,
            );
          }
          return { conversation };
        }
      }

      // Create new conversation
      log("[Chat Service] Creating new conversation with isGroup:", isGroup);
      const [conversationResult] = await execute<ResultSetHeader>(
        `INSERT INTO conversations (tenant_id, name, is_group, created_at, updated_at)
         VALUES (?, ?, ?, NOW(), NOW())`,
        [tenantId, data.name ?? null, isGroup ? 1 : 0],
      );

      const conversationId = conversationResult.insertId;
      log("[Chat Service] Created conversation with ID:", conversationId);

      // Add creator as participant
      await execute(
        `INSERT INTO conversation_participants (conversation_id, user_id, is_admin, joined_at)
         VALUES (?, ?, 1, NOW())`,
        [conversationId, creatorId],
      );

      // Add other participants
      for (const participantId of data.participantIds) {
        await execute(
          `INSERT INTO conversation_participants (conversation_id, user_id, is_admin, joined_at)
           VALUES (?, ?, 0, NOW())`,
          [conversationId, participantId],
        );
      }

      // Get the created conversation details
      const conversations = await this.getConversations(tenantId, creatorId, {
        limit: 100,
      });
      const conversation = conversations.data.find(
        (c) => c.id === conversationId,
      );

      if (!conversation) {
        throw new ServiceError(
          "CREATE_CONVERSATION_ERROR",
          "Failed to retrieve created conversation",
          500,
        );
      }

      return { conversation };
    } catch (error) {
      logError("[Chat Service] createConversation error:", error);
      throw error instanceof ServiceError
        ? error
        : new ServiceError(
            "CREATE_CONVERSATION_ERROR",
            "Failed to create conversation",
            500,
          );
    }
  }

  /**
   * Get messages from a conversation with pagination
   */
  async getMessages(
    tenantId: number,
    conversationId: number,
    userId: number,
    filters: MessageFilters = {},
  ): Promise<{ data: Message[]; pagination: PaginationMeta }> {
    try {
      const page = Math.max(
        1,
        Number.isNaN(filters.page) ? 1 : (filters.page ?? 1),
      );
      const limit = Math.min(
        100,
        Math.max(1, Number.isNaN(filters.limit) ? 50 : (filters.limit ?? 50)),
      );
      const offset = (page - 1) * limit;

      // First check if user is participant of the conversation
      const [participant] = await execute<RowDataPacket[]>(
        `SELECT 1 FROM conversation_participants 
         WHERE conversation_id = ? AND user_id = ?`,
        [conversationId, userId],
      );

      if (!participant.length) {
        throw new ServiceError(
          "CONVERSATION_ACCESS_DENIED",
          "You are not a participant of this conversation",
          403,
        );
      }

      // Build query with filters
      let whereClause = "WHERE m.conversation_id = ? AND m.tenant_id = ?";
      const params: unknown[] = [conversationId, tenantId];

      if (filters.search) {
        whereClause += " AND m.content LIKE ?";
        params.push(`%${filters.search}%`);
      }

      if (filters.startDate) {
        whereClause += " AND m.created_at >= ?";
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        whereClause += " AND m.created_at <= ?";
        params.push(filters.endDate);
      }

      if (filters.hasAttachment) {
        whereClause += " AND m.attachment_path IS NOT NULL";
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM messages m
        ${whereClause}
      `;

      const [countResult] = await execute<RowDataPacket[]>(countQuery, params);
      const totalItems = countResult[0]?.total ?? 0;
      const totalPages = Math.ceil(totalItems / limit);

      // Get messages with sender info - using string interpolation
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
          (
            SELECT COUNT(*) > 0 
            FROM message_read_receipts r 
            WHERE r.message_id = m.id AND r.user_id = ${userId}
          ) as is_read,
          (
            SELECT r.read_at 
            FROM message_read_receipts r 
            WHERE r.message_id = m.id AND r.user_id = ${userId}
            LIMIT 1
          ) as read_at
        FROM messages m
        INNER JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ${conversationId} AND m.tenant_id = ${tenantId}
        ORDER BY m.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const [messages] = await execute<MessageRow[]>(messagesQuery);

      // Transform messages to v2 format
      const transformedMessages: Message[] = messages.map((msg) => ({
        id: msg.id,
        conversationId: msg.conversation_id,
        senderId: msg.sender_id,
        senderName:
          `${msg.sender_first_name ?? ""} ${msg.sender_last_name ?? ""}`.trim() ??
          "Unknown",
        senderUsername: msg.sender_username ?? "unknown",
        senderProfilePicture: msg.sender_profile_picture,
        content: msg.content,
        attachment: msg.attachment_path
          ? {
              url: msg.attachment_path,
              filename: msg.attachment_name ?? "attachment",
              mimeType: msg.attachment_type ?? "application/octet-stream",
              size: 0, // TODO: Add file size to DB
            }
          : null,
        isRead: !!msg.is_read,
        readAt: msg.read_at ? new Date(msg.read_at) : null,
        createdAt: new Date(msg.created_at),
        updatedAt: new Date(msg.created_at), // Messages don't have updated_at
      }));

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
    } catch (error) {
      throw error instanceof ServiceError
        ? error
        : new ServiceError(
            "GET_MESSAGES_ERROR",
            "Failed to fetch messages",
            500,
          );
    }
  }

  /**
   * Send a message to a conversation
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
         WHERE conversation_id = ? AND user_id = ?`,
        [conversationId, senderId],
      );

      if (!participant.length) {
        throw new ServiceError(
          "CONVERSATION_ACCESS_DENIED",
          "You are not a participant of this conversation",
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
      await execute(
        `UPDATE conversations SET updated_at = NOW() WHERE id = ?`,
        [conversationId],
      );

      // Get sender info
      const [senderRows] = await execute<RowDataPacket[]>(
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
        senderName:
          `${sender.first_name ?? ""} ${sender.last_name ?? ""}`.trim() ??
          "Unknown",
        senderUsername: sender.username,
        senderProfilePicture: sender.profile_picture,
        content: data.content,
        attachment: data.attachment
          ? {
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
    } catch (error) {
      throw error instanceof ServiceError
        ? error
        : new ServiceError("SEND_MESSAGE_ERROR", "Failed to send message", 500);
    }
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(
    tenantId: number,
    userId: number,
  ): Promise<UnreadCountSummary> {
    try {
      // Get unread messages grouped by conversation
      const query = `
        SELECT 
          c.id as conversationId,
          c.name as conversationName,
          COUNT(m.id) as unreadCount,
          MAX(m.created_at) as lastMessageTime
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        INNER JOIN messages m ON m.conversation_id = c.id
        WHERE c.tenant_id = ${tenantId}
        AND cp.user_id = ${userId}
        AND m.sender_id != ${userId}
        AND NOT EXISTS (
          SELECT 1 FROM message_read_receipts r
          WHERE r.message_id = m.id AND r.user_id = ${userId}
        )
        GROUP BY c.id, c.name
        ORDER BY lastMessageTime DESC
      `;

      const [rows] = await execute<RowDataPacket[]>(query);

      const conversations = rows.map((row) => ({
        conversationId: row.conversationId,
        conversationName: row.conversationName,
        unreadCount: Number(row.unreadCount),
        lastMessageTime: new Date(row.lastMessageTime),
      }));

      const totalUnread = conversations.reduce(
        (sum, conv) => sum + conv.unreadCount,
        0,
      );

      return {
        totalUnread,
        conversations,
      };
    } catch (error) {
      logError("[Chat Service] getUnreadCount error:", error);
      throw new ServiceError(
        "UNREAD_COUNT_ERROR",
        "Failed to get unread count",
        500,
      );
    }
  }

  /**
   * Mark all messages in a conversation as read
   */
  async markConversationAsRead(
    conversationId: number,
    userId: number,
  ): Promise<{ markedCount: number }> {
    try {
      log("[Chat Service] markConversationAsRead:", { conversationId, userId });

      // First check if user is participant - using string interpolation
      const [participant] = await execute<RowDataPacket[]>(
        `SELECT 1 FROM conversation_participants 
         WHERE conversation_id = ${conversationId} AND user_id = ${userId}`,
      );

      if (!participant.length) {
        throw new ServiceError(
          "CONVERSATION_ACCESS_DENIED",
          "You are not a participant of this conversation",
          403,
        );
      }

      log("[Chat Service] User is participant, getting unread messages");

      // Get unread messages with tenant_id - using string interpolation
      const [unreadMessages] = await execute<RowDataPacket[]>(
        `SELECT m.id, m.tenant_id FROM messages m
         WHERE m.conversation_id = ${conversationId}
         AND m.sender_id != ${userId}
         AND NOT EXISTS (
           SELECT 1 FROM message_read_receipts r
           WHERE r.message_id = m.id AND r.user_id = ${userId}
         )`,
      );

      // Mark messages as read
      if (unreadMessages.length > 0) {
        const values = unreadMessages
          .map((msg) => `(${msg.tenant_id}, ${msg.id}, ${userId}, NOW())`)
          .join(",");
        await execute(
          `INSERT INTO message_read_receipts (tenant_id, message_id, user_id, read_at)
           VALUES ${values}`,
        );
      }

      return { markedCount: unreadMessages.length };
    } catch (error) {
      logError("[Chat Service] markConversationAsRead error:", error);
      throw error instanceof ServiceError
        ? error
        : new ServiceError(
            "MARK_READ_ERROR",
            "Failed to mark messages as read",
            500,
          );
    }
  }

  /**
   * Delete a conversation (admin only or single participant)
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
          "CONVERSATION_ACCESS_DENIED",
          "You are not a participant of this conversation",
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
        userRole === "root" ||
        userRole === "admin" ||
        participant[0].is_admin === 1 ||
        participantCount[0].count === 1;

      if (!canDelete) {
        throw new ServiceError(
          "DELETE_CONVERSATION_FORBIDDEN",
          "You don't have permission to delete this conversation",
          403,
        );
      }

      // Delete in correct order to avoid FK constraints
      await execute(
        `DELETE FROM message_read_receipts WHERE message_id IN 
         (SELECT id FROM messages WHERE conversation_id = ?)`,
        [conversationId],
      );

      await execute(`DELETE FROM messages WHERE conversation_id = ?`, [
        conversationId,
      ]);

      await execute(
        `DELETE FROM conversation_participants WHERE conversation_id = ?`,
        [conversationId],
      );

      await execute(`DELETE FROM conversations WHERE id = ?`, [conversationId]);
    } catch (error) {
      throw error instanceof ServiceError
        ? error
        : new ServiceError(
            "DELETE_CONVERSATION_ERROR",
            "Failed to delete conversation",
            500,
          );
    }
  }

  /**
   * Get single conversation details
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
      const [participants] = await execute<RowDataPacket[]>(
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
        userId: p.user_id,
        username: p.username,
        firstName: p.first_name ?? "",
        lastName: p.last_name ?? "",
        profilePicture: p.profile_picture,
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
    } catch (error) {
      logError("[Chat Service] getConversation error:", error);
      throw new ServiceError(
        "CONVERSATION_ERROR",
        "Failed to get conversation",
        500,
      );
    }
  }
}

// Export singleton instance
export default new ChatService();
