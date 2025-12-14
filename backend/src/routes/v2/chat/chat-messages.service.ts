/* eslint-disable max-lines-per-function */
/**
 * Chat Messages Service v2
 * Business logic for messages, read receipts, and unread counts
 */
import { log, error as logError } from 'console';

import type { PoolConnection, RowDataPacket } from '../../../utils/db.js';
import { execute, transaction } from '../../../utils/db.js';
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
     WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3`,
    [conversationId, userId, tenantId],
  );

  if (participant.length === 0) {
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
  let whereClause = 'WHERE m.conversation_id = $1 AND m.tenant_id = $2';
  const params: unknown[] = [conversationId, tenantId];

  if (filters.search !== undefined && filters.search !== '') {
    const nextIndex = params.length + 1;
    whereClause += ` AND m.content LIKE $${nextIndex}`;
    params.push(`%${filters.search}%`);
  }

  if (filters.startDate) {
    const nextIndex = params.length + 1;
    whereClause += ` AND m.created_at >= $${nextIndex}`;
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    const nextIndex = params.length + 1;
    whereClause += ` AND m.created_at <= $${nextIndex}`;
    params.push(filters.endDate);
  }

  if (filters.hasAttachment === true) {
    whereClause += ' AND m.attachment_path IS NOT NULL';
  }

  return { whereClause, params };
}

/**
 * Calculate pagination values from filters
 */
function calculatePagination(filters: MessageFilters): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, Number.isNaN(filters.page) ? 1 : (filters.page ?? 1));
  const limit = Math.min(
    100,
    Math.max(1, Number.isNaN(filters.limit) ? 50 : (filters.limit ?? 50)),
  );
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Build pagination metadata
 */
function buildPaginationMeta(page: number, limit: number, totalItems: number): PaginationMeta {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    currentPage: page,
    totalPages,
    pageSize: limit,
    totalItems,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Build messages query with user context
 */
function buildMessagesQuery(
  conversationId: number,
  tenantId: number,
  userId: number,
  limit: number,
  offset: number,
): string {
  return `
    SELECT
      m.id, m.conversation_id, m.sender_id, m.content,
      m.attachment_path, m.attachment_name, m.attachment_type, m.attachment_size,
      m.created_at, m.deleted_at,
      u.username as sender_username, u.first_name as sender_first_name,
      u.last_name as sender_last_name, u.profile_picture as sender_profile_picture,
      CASE WHEN m.sender_id = ${userId} THEN 1
           WHEN m.id <= COALESCE(cp.last_read_message_id, 0) THEN 1 ELSE 0 END as is_read,
      CASE WHEN m.id <= COALESCE(cp.last_read_message_id, 0) THEN cp.last_read_at ELSE NULL END as read_at
    FROM messages m
    INNER JOIN users u ON m.sender_id = u.id
    LEFT JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = ${userId}
    WHERE m.conversation_id = ${conversationId} AND m.tenant_id = ${tenantId}
    ORDER BY m.created_at ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

/**
 * Sender row type for user info queries
 */
interface SenderRow extends RowDataPacket {
  username: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture: string | null;
}

/**
 * Insert a new message into database
 */
async function insertMessage(
  tenantId: number,
  conversationId: number,
  senderId: number,
  data: SendMessageData,
): Promise<number> {
  const [rows] = await execute<{ id: number }[]>(
    `INSERT INTO messages (tenant_id, conversation_id, sender_id, content,
       attachment_path, attachment_name, attachment_type, attachment_size, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     RETURNING id`,
    [
      tenantId,
      conversationId,
      senderId,
      data.content,
      data.attachment?.path ?? null,
      data.attachment?.filename ?? null,
      data.attachment?.mimeType ?? null,
      data.attachment?.size ?? null,
    ],
  );
  return rows[0]?.id ?? 0;
}

/**
 * Fetch sender info from database
 */
async function getSenderInfo(senderId: number, tenantId: number): Promise<SenderRow> {
  const [rows] = await execute<SenderRow[]>(
    `SELECT username, first_name, last_name, profile_picture FROM users WHERE id = $1 AND tenant_id = $2`,
    [senderId, tenantId],
  );
  const sender = rows[0];
  if (sender === undefined) {
    throw new ServiceError('SENDER_NOT_FOUND', 'Sender user not found', 404);
  }
  return sender;
}

/**
 * Build message response object
 */
function buildMessageResponse(
  messageId: number,
  conversationId: number,
  senderId: number,
  sender: SenderRow,
  data: SendMessageData,
): Message {
  const fullName = `${sender.first_name ?? ''} ${sender.last_name ?? ''}`.trim();
  return {
    id: messageId,
    conversationId,
    senderId,
    senderName: fullName !== '' ? fullName : 'Unknown',
    senderUsername: sender.username,
    senderProfilePicture: sender.profile_picture,
    content: data.content,
    attachment:
      data.attachment !== undefined ?
        {
          url: data.attachment.path,
          filename: data.attachment.filename,
          mimeType: data.attachment.mimeType,
          size: data.attachment.size,
        }
      : null,
    attachments: [], // New attachments are linked via WebSocket
    isRead: false,
    readAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Transform message row from database to API format
 */
function transformMessage(msg: MessageRow): Message {
  const fullName = `${msg.sender_first_name ?? ''} ${msg.sender_last_name ?? ''}`.trim();
  return {
    id: msg.id,
    conversationId: msg.conversation_id,
    senderId: msg.sender_id,
    senderName: fullName !== '' ? fullName : 'Unknown',
    senderUsername: msg.sender_username !== '' ? msg.sender_username : 'unknown',
    senderProfilePicture: msg.sender_profile_picture,
    content: msg.content,
    attachment:
      msg.attachment_path !== null ?
        {
          url: msg.attachment_path,
          filename: msg.attachment_name ?? 'attachment',
          mimeType: msg.attachment_type ?? 'application/octet-stream',
          size: typeof msg.attachment_size === 'number' ? msg.attachment_size : 0,
        }
      : null,
    attachments: [], // Will be populated after query
    isRead: msg.is_read !== undefined && msg.is_read !== 0,
    readAt: msg.read_at ? new Date(msg.read_at) : null,
    createdAt: new Date(msg.created_at),
    updatedAt: new Date(msg.created_at), // Messages don't have updated_at
  };
}

/**
 * Document attachment row from database
 */
interface DocumentAttachmentRow extends RowDataPacket {
  id: number;
  message_id: number;
  file_uuid: string;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: Date | null;
}

/**
 * Load attachments using existing connection (for RLS context)
 */
async function loadAttachmentsWithConn(
  conn: PoolConnection,
  messageIds: number[],
  tenantId: number,
): Promise<Map<number, Message['attachments']>> {
  const attachmentMap = new Map<number, Message['attachments']>();

  if (messageIds.length === 0) return attachmentMap;

  for (const id of messageIds) {
    attachmentMap.set(id, []);
  }

  const placeholders = messageIds.map((_: number, i: number) => `$${i + 2}`).join(', ');
  const [rows] = await conn.execute<DocumentAttachmentRow[]>(
    `SELECT id, message_id, file_uuid, filename, original_name, file_size, mime_type, uploaded_at
     FROM documents
     WHERE message_id IN (${placeholders})
     AND tenant_id = $1
     AND is_active = 1
     ORDER BY id ASC`,
    [tenantId, ...messageIds],
  );

  for (const row of rows) {
    const attachments = attachmentMap.get(row.message_id) ?? [];
    attachments.push({
      id: row.id,
      fileUuid: row.file_uuid,
      fileName: row.filename,
      originalName: row.original_name,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      downloadUrl: `/api/v2/documents/${row.id}/download`,
      ...(row.uploaded_at !== null ? { createdAt: new Date(row.uploaded_at).toISOString() } : {}),
    });
    attachmentMap.set(row.message_id, attachments);
  }

  return attachmentMap;
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
    const { page, limit, offset } = calculatePagination(filters);

    // App-level participant check (runs before transaction)
    await verifyConversationAccess(conversationId, userId, tenantId);

    // Execute message queries with RLS context (tenantId + userId)
    // IMPORTANT: Sets app.user_id for participant_isolation RESTRICTIVE policy
    return await transaction(
      async (conn: PoolConnection) => {
        // Get total count with RLS enforced
        const { whereClause, params } = buildMessagesWhereClause(filters, conversationId, tenantId);
        const [countResult] = await conn.execute<CountResult[]>(
          `SELECT COUNT(*) as total FROM messages m ${whereClause}`,
          params,
        );
        const totalItems = countResult[0]?.total ?? 0;

        // Fetch and transform messages with RLS enforced
        const messagesQuery = buildMessagesQuery(conversationId, tenantId, userId, limit, offset);
        const [messages] = await conn.execute<MessageRow[]>(messagesQuery);
        const data = messages.map((msg: MessageRow) => transformMessage(msg));

        // Load attachments (documents table has tenant RLS)
        const messageIds = data.map((m: Message) => m.id);
        const attachmentMap = await loadAttachmentsWithConn(conn, messageIds, tenantId);

        // Assign attachments to messages
        for (const message of data) {
          message.attachments = attachmentMap.get(message.id) ?? [];
        }

        return { data, pagination: buildPaginationMeta(page, limit, totalItems) };
      },
      { tenantId, userId }, // RLS context - enables participant_isolation
    );
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
    // Verify sender is participant
    await verifyConversationAccess(conversationId, senderId, tenantId);

    // Insert message and update conversation (with tenant isolation)
    const messageId = await insertMessage(tenantId, conversationId, senderId, data);
    await execute(`UPDATE conversations SET updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, [
      conversationId,
      tenantId,
    ]);

    // Build response with sender info
    const sender = await getSenderInfo(senderId, tenantId);
    const message = buildMessageResponse(messageId, conversationId, senderId, sender, data);

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
    // PostgreSQL: Can't use column alias in HAVING clause - repeat the COUNT expression
    const query = `
      SELECT
        c.id as "conversationId",
        c.name as "conversationName",
        COUNT(CASE
          WHEN m.id > COALESCE(cp.last_read_message_id, 0)
          AND m.sender_id != ${userId}
          THEN 1
        END) as "unreadCount",
        MAX(m.created_at) as "lastMessageTime"
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.tenant_id = ${tenantId}
      AND c.is_active = 1
      AND cp.user_id = ${userId}
      AND cp.tenant_id = ${tenantId}
      GROUP BY c.id, c.name
      HAVING COUNT(CASE
        WHEN m.id > COALESCE(cp.last_read_message_id, 0)
        AND m.sender_id != ${userId}
        THEN 1
      END) > 0
      ORDER BY MAX(m.created_at) DESC
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
 * @param tenantId - The tenant ID for multi-tenant isolation
 * @param conversationId - The conversation ID to mark as read
 * @param userId - The user marking messages as read
 * @returns Count of messages marked as read
 * @throws ServiceError if user not participant or update fails
 */
export async function markConversationAsRead(
  tenantId: number,
  conversationId: number,
  userId: number,
): Promise<{ markedCount: number }> {
  try {
    log('[Chat Service] markConversationAsRead:', { tenantId, conversationId, userId });

    // First check if user is participant (with tenant isolation)
    const [participant] = await execute<RowDataPacket[]>(
      `SELECT 1 FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [conversationId, userId, tenantId],
    );

    if (participant.length === 0) {
      throw new ServiceError(
        'CONVERSATION_ACCESS_DENIED',
        'You are not a participant of this conversation',
        403,
      );
    }

    log('[Chat Service] User is participant, updating last read message');

    // Get the latest message id in the conversation (with tenant isolation)
    interface LatestMessageRow extends RowDataPacket {
      lastMessageId: number | null;
    }
    const [latestMessage] = await execute<LatestMessageRow[]>(
      `SELECT MAX(id) as "lastMessageId"
       FROM messages
       WHERE conversation_id = $1 AND tenant_id = $2`,
      [conversationId, tenantId],
    );

    const lastMessageId = latestMessage[0]?.lastMessageId ?? 0;
    log('[Chat Service] Latest message ID:', lastMessageId);

    // Update last_read_message_id in conversation_participants (with tenant isolation)
    await execute(
      `UPDATE conversation_participants
       SET last_read_message_id = $1, last_read_at = NOW()
       WHERE conversation_id = $2 AND user_id = $3 AND tenant_id = $4`,
      [lastMessageId, conversationId, userId, tenantId],
    );

    log('[Chat Service] Updated last_read_message_id to:', lastMessageId);

    // Return the message ID that was marked as last read
    return { markedCount: lastMessageId };
  } catch (error: unknown) {
    logError('[Chat Service] markConversationAsRead error:', error);
    throw error instanceof ServiceError ? error : (
        new ServiceError('MARK_READ_ERROR', 'Failed to mark messages as read', 500)
      );
  }
}
