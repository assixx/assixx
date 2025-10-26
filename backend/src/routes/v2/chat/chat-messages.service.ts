/**
 * Chat Messages Service v2
 * Business logic for messages, read receipts, and unread counts
 */
import { log, error as logError } from 'console';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { execute } from '../../../utils/db.js';
import { ServiceError } from '../users/users.service.js';
import type {
  CountResult,
  Message,
  MessageFilters,
  MessageRow,
  PaginationMeta,
  SendMessageData,
  UnreadCountSummary,
} from './chat.types.js';

/**
 * Verify user is participant of conversation
 */
async function verifyConversationAccess(
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
 * Build WHERE clause for messages query based on filters
 */
function buildMessagesWhereClause(
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
 * Transform message row from database to API format
 */
function transformMessage(msg: MessageRow): Message {
  return {
    id: msg.id,
    conversationId: msg.conversation_id,
    senderId: msg.sender_id,
    senderName: `${msg.sender_first_name ?? ''} ${msg.sender_last_name ?? ''}`.trim() || 'Unknown',
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
 * Get messages from a conversation with pagination and filters
 * @param tenantId - The tenant ID for multi-tenant isolation
 * @param conversationId - The conversation ID to fetch messages from
 * @param userId - The user ID requesting messages (for read status)
 * @param filters - Optional filter criteria (search, date range, attachments, pagination)
 * @returns Paginated list of messages with sender info and read status
 * @throws ServiceError if user not participant or database error
 */
export async function getMessages(
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
    await verifyConversationAccess(conversationId, userId, tenantId);

    // Build WHERE clause
    const { whereClause, params } = buildMessagesWhereClause(filters, conversationId, tenantId);

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM messages m ${whereClause}`;
    const [countResult] = await execute<CountResult[]>(countQuery, params);
    const totalItems = countResult[0]?.total ?? 0;

    // Get messages with sender info and read status
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
    const transformedMessages = messages.map((msg: MessageRow) => transformMessage(msg));

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
 * @param tenantId - The tenant ID for multi-tenant isolation
 * @param conversationId - The conversation ID to send message to
 * @param senderId - The user sending the message
 * @param data - Message data (content and optional attachment)
 * @returns The created message with full details
 * @throws ServiceError if user not participant or send fails
 */
export async function sendMessage(
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

    // Update conversation's updated_at timestamp
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
 * Get unread message count summary across all conversations
 * @param tenantId - The tenant ID for multi-tenant isolation
 * @param userId - The user ID to get unread counts for
 * @returns Summary with total unread count and per-conversation details
 * @throws ServiceError if database error occurs
 */
export async function getUnreadCount(
  tenantId: number,
  userId: number,
): Promise<UnreadCountSummary> {
  try {
    // Get unread messages grouped by conversation
    // Using conversation_participants.last_read_message_id for tracking
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

    const conversations = rows.map((row: UnreadRow) => ({
      conversationId: row.conversationId,
      conversationName: row.conversationName,
      unreadCount: Number(row.unreadCount),
      lastMessageTime: new Date(row.lastMessageTime),
    }));

    const totalUnread = conversations.reduce(
      (
        sum: number,
        conv: {
          conversationId: number;
          conversationName: string | null;
          unreadCount: number;
          lastMessageTime: Date;
        },
      ) => sum + conv.unreadCount,
      0,
    );

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
 * @param conversationId - The conversation ID to mark as read
 * @param userId - The user marking messages as read
 * @returns Count of messages marked as read
 * @throws ServiceError if user not participant or update fails
 */
export async function markConversationAsRead(
  conversationId: number,
  userId: number,
): Promise<{ markedCount: number }> {
  try {
    log('[Chat Service] markConversationAsRead:', { conversationId, userId });

    // First check if user is participant
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
