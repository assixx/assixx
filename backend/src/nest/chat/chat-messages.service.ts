/**
 * Chat Messages Service
 *
 * Handles message operations including send, read tracking, and search.
 * Sub-service of ChatService facade.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { PoolClient } from 'pg';
import { v7 as uuidv7 } from 'uuid';

import { eventBus } from '../../utils/event-bus.js';
import { DatabaseService } from '../database/database.service.js';
import { E2eKeysService } from '../e2e-keys/e2e-keys.service.js';
import {
  buildPaginationMeta,
  buildSentMessage,
  mapDocumentAttachments,
  resolveMessageContent,
  transformMessage,
} from './chat.helpers.js';
import type {
  Message,
  MessageAttachmentInput,
  MessageRow,
  PaginationMeta,
  SenderInfo,
  UnreadCountSummary,
} from './chat.types.js';
import { ERROR_NOT_IMPLEMENTED } from './chat.types.js';
import type {
  EditMessageBody,
  GetMessagesQuery,
  SearchMessagesQuery,
  SendMessageBody,
} from './dto/message.dto.js';

@Injectable()
export class ChatMessagesService {
  constructor(
    private readonly cls: ClsService,
    private readonly databaseService: DatabaseService,
    private readonly e2eKeysService: E2eKeysService,
  ) {}

  // ============================================
  // Context Helpers
  // ============================================

  private getTenantId(): number {
    const tenantId = this.cls.get<number | undefined>('tenantId');
    if (tenantId === undefined) {
      throw new ForbiddenException('Tenant context not available');
    }
    return tenantId;
  }

  private getUserId(): number {
    const userId = this.cls.get<number | undefined>('userId');
    if (userId === undefined) {
      throw new ForbiddenException('User context not available');
    }
    return userId;
  }

  // ============================================
  // Public Methods
  // ============================================

  /**
   * Get messages from a conversation
   * WhatsApp-style: Only shows messages after user's deleted_at timestamp
   */
  async getMessages(
    conversationId: number,
    query: GetMessagesQuery,
    verifyAccess: (conversationId: number, userId: number, tenantId: number) => Promise<void>,
  ): Promise<{ data: Message[]; pagination: PaginationMeta }> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();
    await verifyAccess(conversationId, userId, tenantId);

    const page = query.page ?? 1;
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const offset = (page - 1) * limit;

    // Get user's deleted_at timestamp for this conversation
    const participantInfo = await this.databaseService.query<{
      deleted_at: Date | null;
    }>(
      `SELECT deleted_at FROM chat_conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [conversationId, userId, tenantId],
    );
    const deletedAt = participantInfo[0]?.deleted_at ?? null;

    const { whereClause, params, paramIndex } = this.buildMessagesWhereClause(
      conversationId,
      tenantId,
      query,
      deletedAt,
    );

    const totalItems = await this.getMessagesCount(whereClause, params);
    const messages = await this.fetchMessages(
      whereClause,
      params,
      paramIndex,
      limit,
      offset,
      userId,
    );
    const data = messages.map((msg: MessageRow) => transformMessage(msg));
    await this.attachDocumentsToMessages(data, tenantId);

    return {
      data,
      pagination: buildPaginationMeta(page, limit, totalItems),
    };
  }

  /**
   * Send a message to a conversation.
   * Supports both plaintext (group) and E2E encrypted (1:1) messages.
   */

  async sendMessage(
    conversationId: number,
    dto: SendMessageBody,
    verifyAccess: (conversationId: number, userId: number, tenantId: number) => Promise<void>,
    getRecipientIds: (conversationId: number, excludeUserId: number) => Promise<number[]>,
    updateTimestamp: (conversationId: number, tenantId: number) => Promise<void>,
    attachment?: MessageAttachmentInput,
  ): Promise<{ message: Message }> {
    const tenantId = this.getTenantId();
    const senderId = this.getUserId();
    await verifyAccess(conversationId, senderId, tenantId);

    const isE2e = dto.encryptedContent !== undefined && dto.e2eNonce !== undefined;

    await this.validateE2eKeyVersionIfNeeded(isE2e, tenantId, senderId, dto);

    const contentResult = resolveMessageContent(dto.message, attachment !== undefined, isE2e);
    if ('error' in contentResult) {
      throw new BadRequestException(contentResult.error);
    }
    const content = contentResult.content;

    const e2eFields =
      isE2e ?
        {
          encryptedContent: dto.encryptedContent as string,
          e2eNonce: dto.e2eNonce as string,
          e2eKeyVersion: dto.e2eKeyVersion as number,
          e2eKeyEpoch: dto.e2eKeyEpoch as number,
        }
      : undefined;

    const { id: messageId, uuid: messageUuid } = await this.insertMessageRecord(
      tenantId,
      conversationId,
      senderId,
      content,
      attachment,
      e2eFields,
    );
    await updateTimestamp(conversationId, tenantId);
    const sender = await this.fetchSenderInfo(senderId, tenantId);
    await this.emitNewMessageEvent(
      tenantId,
      messageId,
      messageUuid,
      conversationId,
      senderId,
      content,
      isE2e,
      getRecipientIds,
    );
    return {
      message: buildSentMessage(
        messageId,
        conversationId,
        senderId,
        content,
        sender,
        attachment,
        e2eFields,
      ),
    };
  }

  /**
   * Edit a message (stub).
   * E2E encrypted messages cannot be edited (HTTP 422).
   * Non-E2E editing is not yet implemented (HTTP 400).
   */
  async editMessage(messageId: number, _dto: EditMessageBody): Promise<never> {
    const rows = await this.databaseService.tenantTransaction(async (client: PoolClient) => {
      const result = await client.query<{ is_e2e: boolean }>(
        `SELECT is_e2e FROM chat_messages WHERE id = $1`,
        [messageId],
      );
      return result.rows;
    });

    const message = rows[0];
    if (message === undefined) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    if (message.is_e2e) {
      throw new UnprocessableEntityException('Editing is not supported for encrypted messages');
    }

    throw new BadRequestException(ERROR_NOT_IMPLEMENTED);
  }

  /**
   * Delete a message (stub)
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Stub method
  async deleteMessage(_messageId: number): Promise<never> {
    throw new BadRequestException(ERROR_NOT_IMPLEMENTED);
  }

  /**
   * Mark conversation as read
   */
  async markAsRead(
    conversationId: number,
    verifyAccess: (conversationId: number, userId: number, tenantId: number) => Promise<void>,
  ): Promise<{ markedCount: number }> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    await verifyAccess(conversationId, userId, tenantId);

    // Find unread messages from OTHER users (for read receipts)
    const unreadMessages = await this.getUnreadMessageEntries(conversationId, userId, tenantId);

    // Get latest message ID
    const latestMessage = await this.databaseService.query<{
      max_id: number | null;
    }>(
      `SELECT MAX(id) as max_id FROM chat_messages WHERE conversation_id = $1 AND tenant_id = $2`,
      [conversationId, tenantId],
    );

    const lastMessageId = latestMessage[0]?.max_id ?? 0;

    // Update last read
    await this.databaseService.query(
      `UPDATE chat_conversation_participants
       SET last_read_message_id = $1, last_read_at = NOW()
       WHERE conversation_id = $2 AND user_id = $3 AND tenant_id = $4`,
      [lastMessageId, conversationId, userId, tenantId],
    );

    // Notify senders their messages were read (real-time read receipts)
    if (unreadMessages.length > 0) {
      eventBus.emitMessagesRead({
        readByUserId: userId,
        entries: unreadMessages,
      });
    }

    return { markedCount: lastMessageId };
  }

  /** Get unread message IDs + sender IDs for read receipt notifications */
  private async getUnreadMessageEntries(
    conversationId: number,
    userId: number,
    tenantId: number,
  ): Promise<{ messageId: number; senderId: number }[]> {
    const lastReadRow = await this.databaseService.query<{
      last_read_message_id: number | null;
    }>(
      `SELECT last_read_message_id FROM chat_conversation_participants
       WHERE conversation_id = $1 AND user_id = $2 AND tenant_id = $3`,
      [conversationId, userId, tenantId],
    );

    const lastReadId = lastReadRow[0]?.last_read_message_id ?? 0;

    return await this.databaseService.query<{
      messageId: number;
      senderId: number;
    }>(
      `SELECT id AS "messageId", sender_id AS "senderId"
       FROM chat_messages
       WHERE conversation_id = $1 AND tenant_id = $2
         AND id > $3 AND sender_id != $4`,
      [conversationId, tenantId, lastReadId, userId],
    );
  }

  /**
   * Get unread count summary
   */
  async getUnreadCount(): Promise<UnreadCountSummary> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();

    interface UnreadRow {
      conversationId: number;
      conversationName: string | null;
      unreadCount: string | number;
      lastMessageTime: Date;
    }

    const rows = await this.databaseService.query<UnreadRow>(
      `SELECT
        c.id as "conversationId",
        c.name as "conversationName",
        COUNT(CASE
          WHEN m.id > COALESCE(cp.last_read_message_id, 0)
          AND m.sender_id != $1
          THEN 1
        END) as "unreadCount",
        MAX(m.created_at) as "lastMessageTime"
       FROM chat_conversations c
       INNER JOIN chat_conversation_participants cp ON c.id = cp.conversation_id
       LEFT JOIN chat_messages m ON m.conversation_id = c.id
       WHERE c.tenant_id = $2
       AND c.is_active = ${IS_ACTIVE.ACTIVE}
       AND cp.user_id = $1
       AND cp.tenant_id = $2
       GROUP BY c.id, c.name
       HAVING COUNT(CASE
         WHEN m.id > COALESCE(cp.last_read_message_id, 0)
         AND m.sender_id != $1
         THEN 1
       END) > 0
       ORDER BY MAX(m.created_at) DESC`,
      [userId, tenantId],
    );

    const conversations = rows.map((row: UnreadRow) => ({
      conversationId: row.conversationId,
      conversationName: row.conversationName,
      unreadCount: Number(row.unreadCount),
      lastMessageTime: new Date(row.lastMessageTime),
    }));

    const totalUnread = conversations.reduce(
      (sum: number, conv: { unreadCount: number }) => sum + conv.unreadCount,
      0,
    );

    return { totalUnread, conversations };
  }

  /**
   * Search messages (stub).
   * E2E messages are excluded from server-side search (server has only ciphertext).
   */
  // eslint-disable-next-line @typescript-eslint/require-await -- Stub method
  async searchMessages(_query: SearchMessagesQuery): Promise<never> {
    throw new BadRequestException(ERROR_NOT_IMPLEMENTED);
  }

  /**
   * Insert a simple message (for conversation creation with initial message)
   */
  async insertMessage(
    tenantId: number,
    conversationId: number,
    senderId: number,
    content: string,
  ): Promise<void> {
    const messageUuid = uuidv7();
    await this.databaseService.query(
      `INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, content, uuid, uuid_created_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [tenantId, conversationId, senderId, content, messageUuid],
    );

    await this.databaseService.query(
      `UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
      [conversationId, tenantId],
    );
  }

  // ============================================
  // Private Helpers
  // ============================================

  /** Emit SSE notification for a new message to all recipients. */
  private async emitNewMessageEvent(
    tenantId: number,
    messageId: number,
    messageUuid: string,
    conversationId: number,
    senderId: number,
    content: string | null,
    isE2e: boolean,
    getRecipientIds: (cid: number, excludeId: number) => Promise<number[]>,
  ): Promise<void> {
    const preview = isE2e ? '' : (content ?? '').substring(0, 50);
    const recipientIds = await getRecipientIds(conversationId, senderId);
    eventBus.emitNewMessage(tenantId, {
      id: messageId,
      uuid: messageUuid,
      conversationId,
      senderId,
      recipientIds,
      preview,
    });
  }

  /**
   * Validate sender's E2E key version before accepting encrypted message.
   * Prevents storing messages encrypted with a stale key version.
   */
  private async validateE2eKeyVersionIfNeeded(
    isE2e: boolean,
    tenantId: number,
    senderId: number,
    dto: SendMessageBody,
  ): Promise<void> {
    if (!isE2e || dto.e2eKeyVersion === undefined) return;
    const isValid = await this.e2eKeysService.validateKeyVersion(
      tenantId,
      senderId,
      dto.e2eKeyVersion,
    );
    if (!isValid) {
      throw new UnprocessableEntityException(
        'E2E key version mismatch. Client must re-fetch key data.',
      );
    }
  }

  /**
   * Build WHERE clause for messages query based on filters
   * WhatsApp-style: Filters messages to only show those after deletedAt timestamp
   */
  private buildMessagesWhereClause(
    conversationId: number,
    tenantId: number,
    query: GetMessagesQuery,
    deletedAt: Date | null,
  ): { whereClause: string; params: unknown[]; paramIndex: number } {
    let whereClause = 'WHERE m.conversation_id = $1 AND m.tenant_id = $2';
    const params: unknown[] = [conversationId, tenantId];
    let paramIndex = 3;

    // WhatsApp-style: Only show messages after user's deleted_at timestamp
    if (deletedAt !== null) {
      whereClause += ` AND m.created_at > $${paramIndex}`;
      params.push(deletedAt);
      paramIndex++;
    }

    if (query.search !== undefined && query.search !== '') {
      // Exclude E2E messages from server-side search (server has only ciphertext)
      whereClause += ` AND m.is_e2e = false AND m.content LIKE $${paramIndex}`;
      params.push(`%${query.search}%`);
      paramIndex++;
    }
    if (query.startDate !== undefined) {
      whereClause += ` AND m.created_at >= $${paramIndex}`;
      params.push(new Date(query.startDate));
      paramIndex++;
    }
    if (query.endDate !== undefined) {
      whereClause += ` AND m.created_at <= $${paramIndex}`;
      params.push(new Date(query.endDate));
      paramIndex++;
    }
    if (query.hasAttachment === true) {
      whereClause += ' AND m.attachment_path IS NOT NULL';
    }

    return { whereClause, params, paramIndex };
  }

  /**
   * Get total count of messages matching the query
   */
  private async getMessagesCount(whereClause: string, params: unknown[]): Promise<number> {
    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM chat_messages m ${whereClause}`,
      params,
    );
    return Number.parseInt(countResult[0]?.count ?? '0', 10);
  }

  /**
   * Fetch messages with pagination
   */
  private async fetchMessages(
    whereClause: string,
    params: unknown[],
    paramIndex: number,
    limit: number,
    offset: number,
    userId: number,
  ): Promise<MessageRow[]> {
    const queryParams = [...params, limit, offset];
    return await this.databaseService.query<MessageRow>(
      `SELECT
        m.id, m.conversation_id, m.sender_id, m.content,
        m.attachment_path, m.attachment_name, m.attachment_type, m.attachment_size,
        m.encrypted_content, m.e2e_nonce, m.is_e2e, m.e2e_key_version, m.e2e_key_epoch,
        m.created_at,
        u.username as sender_username, u.first_name as sender_first_name,
        u.last_name as sender_last_name, u.profile_picture as sender_profile_picture,
        CASE
          WHEN m.sender_id = ${userId} THEN
            CASE WHEN EXISTS (
              SELECT 1 FROM chat_conversation_participants other_cp
              WHERE other_cp.conversation_id = m.conversation_id
              AND other_cp.user_id != ${userId}
              AND other_cp.last_read_message_id >= m.id
            ) THEN 1 ELSE 0 END
          WHEN m.id <= COALESCE(cp.last_read_message_id, 0) THEN 1
          ELSE 0
        END as is_read,
        CASE WHEN m.id <= COALESCE(cp.last_read_message_id, 0) THEN cp.last_read_at ELSE NULL END as read_at
       FROM chat_messages m
       INNER JOIN users u ON m.sender_id = u.id
       LEFT JOIN chat_conversation_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = ${userId}
       ${whereClause}
       ORDER BY m.created_at ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams,
    );
  }

  /**
   * Load and attach document attachments to messages
   */
  private async attachDocumentsToMessages(messages: Message[], tenantId: number): Promise<void> {
    const messageIds = messages.map((m: Message) => m.id);
    if (messageIds.length === 0) {
      return;
    }

    interface DocumentAttachmentRow {
      id: number;
      message_id: number;
      file_uuid: string;
      filename: string;
      original_name: string;
      file_size: number;
      mime_type: string;
      uploaded_at: Date | null;
    }

    const placeholders = messageIds.map((_: number, i: number) => `$${i + 2}`).join(', ');
    const rows = await this.databaseService.query<DocumentAttachmentRow>(
      `SELECT id, message_id, file_uuid, filename, original_name, file_size, mime_type, uploaded_at
       FROM documents
       WHERE message_id IN (${placeholders})
       AND tenant_id = $1
       AND is_active = ${IS_ACTIVE.ACTIVE}
       ORDER BY id ASC`,
      [tenantId, ...messageIds],
    );

    const attachmentMap = mapDocumentAttachments(messageIds, rows);
    for (const message of messages) {
      message.attachments = attachmentMap.get(message.id) ?? [];
    }
  }

  /**
   * Insert a message record and return its ID and UUID.
   * Supports both plaintext and E2E encrypted messages.
   */
  private async insertMessageRecord(
    tenantId: number,
    conversationId: number,
    senderId: number,
    content: string | null,
    attachment?: MessageAttachmentInput,
    e2eFields?: {
      encryptedContent: string;
      e2eNonce: string;
      e2eKeyVersion: number;
      e2eKeyEpoch: number;
    },
  ): Promise<{ id: number; uuid: string }> {
    const messageUuid = uuidv7();
    const isE2e = e2eFields !== undefined;

    const insertResult = await this.databaseService.query<{
      id: number;
      uuid: string;
    }>(
      `INSERT INTO chat_messages (tenant_id, conversation_id, sender_id, content,
         attachment_path, attachment_name, attachment_type, attachment_size,
         encrypted_content, e2e_nonce, is_e2e, e2e_key_version, e2e_key_epoch,
         uuid, uuid_created_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
       RETURNING id, uuid`,
      [
        tenantId,
        conversationId,
        senderId,
        content,
        attachment?.path ?? null,
        attachment?.filename ?? null,
        attachment?.mimeType ?? null,
        attachment?.size ?? null,
        isE2e ? e2eFields.encryptedContent : null,
        isE2e ? e2eFields.e2eNonce : null,
        isE2e,
        isE2e ? e2eFields.e2eKeyVersion : null,
        isE2e ? e2eFields.e2eKeyEpoch : null,
        messageUuid,
      ],
    );
    return {
      id: insertResult[0]?.id ?? 0,
      uuid: insertResult[0]?.uuid ?? messageUuid,
    };
  }

  /**
   * Fetch sender information for message response
   * SECURITY: Only returns info for ACTIVE users (is_active = 1)
   */
  private async fetchSenderInfo(senderId: number, tenantId: number): Promise<SenderInfo> {
    const senderInfo = await this.databaseService.query<SenderInfo>(
      `SELECT username, first_name, last_name, profile_picture FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [senderId, tenantId],
    );
    const sender = senderInfo[0];
    if (sender === undefined) {
      throw new NotFoundException('Sender not found or inactive');
    }
    return sender;
  }
}
