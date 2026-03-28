import { IS_ACTIVE } from '@assixx/shared/constants';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';

import { DatabaseService } from './nest/database/database.service.js';
import { logger } from './utils/logger.js';

// ============================================================================
// Shared Types (used by both handler and ChatWebSocketServer)
// ============================================================================

export const SendMessageDataSchema = z.object({
  conversationId: z.number(),
  content: z.string().optional(),
  /** Document IDs from frontend upload */
  attachments: z.array(z.number()).optional(),
  /** E2E: base64-encoded ciphertext */
  encryptedContent: z.string().optional(),
  /** E2E: base64-encoded XChaCha20-Poly1305 nonce */
  e2eNonce: z.string().optional(),
  /** E2E: sender's key version at time of encryption */
  e2eKeyVersion: z.number().optional(),
  /** E2E: HKDF epoch for decryption key derivation */
  e2eKeyEpoch: z.number().optional(),
});
export type SendMessageData = z.infer<typeof SendMessageDataSchema>;

export interface E2eFields {
  encryptedContent: string;
  e2eNonce: string;
  e2eKeyVersion: number;
  e2eKeyEpoch: number;
}

export type E2eResolutionResult =
  | { isE2e: false; fields: undefined; error: undefined }
  | { isE2e: true; fields: E2eFields; error: undefined }
  | { isE2e: true; fields: undefined; error: string };

export interface ProcessedMessageResult {
  messageId: number;
  messageUuid: string;
  messageData: unknown;
  preview: string;
}

export interface MarkReadResult {
  senderId: number;
  conversationId: number;
}

// ============================================================================
// Internal DB Query Result Types
// ============================================================================

interface ConversationParticipantResult {
  user_id: number;
}

interface UserInfoResult {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
}

interface MessageInfoResult {
  sender_id: number;
  conversation_id: number;
}

interface SenderInfo {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
}

interface AttachmentInfo {
  id: number;
  fileUuid: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl: string;
}

// ============================================================================
// WebSocketMessageHandler - DB operations for chat messages
// ============================================================================

/**
 * Handles all database operations for chat message processing.
 * Pure data layer — no WebSocket transport or broadcast logic.
 */
export class WebSocketMessageHandler {
  constructor(private readonly db: DatabaseService) {}

  /** Verify that a conversation exists within a tenant and return participant IDs */
  async verifyConversationAccess(conversationId: number, tenantId: number): Promise<number[]> {
    const participantQuery = `
      SELECT cp.user_id
      FROM chat_conversation_participants cp
      JOIN chat_conversations c ON cp.conversation_id = c.id
      WHERE cp.conversation_id = $1
      AND c.tenant_id = $2
      AND cp.tenant_id = $3
    `;
    const participants = await this.db.query<ConversationParticipantResult>(participantQuery, [
      conversationId,
      tenantId,
      tenantId,
    ]);
    return participants.map((p: ConversationParticipantResult) => p.user_id);
  }

  /** Get participant IDs for a conversation, excluding a specific user */
  async getOtherParticipantIds(
    conversationId: number,
    tenantId: number,
    excludeUserId: number,
  ): Promise<number[]> {
    const participants = await this.db.query<ConversationParticipantResult>(
      `SELECT cp.user_id
       FROM chat_conversation_participants cp
       JOIN chat_conversations c ON cp.conversation_id = c.id
       WHERE cp.conversation_id = $1
       AND c.tenant_id = $2
       AND cp.tenant_id = $3
       AND cp.user_id != $4`,
      [conversationId, tenantId, tenantId, excludeUserId],
    );
    return participants.map((p: ConversationParticipantResult) => p.user_id);
  }

  /**
   * Get all distinct conversation partner IDs for a user across all conversations.
   * Used for presence broadcasts and snapshots.
   */
  async getConversationPartnerIds(userId: number, tenantId: number): Promise<number[]> {
    const partners = await this.db.query<ConversationParticipantResult>(
      `SELECT DISTINCT cp2.user_id
       FROM chat_conversation_participants cp1
       JOIN chat_conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
       JOIN chat_conversations c ON cp1.conversation_id = c.id
       WHERE cp1.user_id = $1 AND c.tenant_id = $2 AND cp2.user_id != $3`,
      [userId, tenantId, userId],
    );
    return partners.map((p: ConversationParticipantResult) => p.user_id);
  }

  /** Resolve E2E fields from message data, validating key version if applicable. */
  async resolveE2eFields(
    data: SendMessageData,
    tenantId: number,
    userId: number,
  ): Promise<E2eResolutionResult> {
    const { encryptedContent, e2eNonce, e2eKeyVersion, e2eKeyEpoch } = data;
    if (encryptedContent === undefined || e2eNonce === undefined) {
      return { isE2e: false, fields: undefined, error: undefined };
    }
    if (e2eKeyVersion !== undefined) {
      const isValid = await this.validateE2eKeyVersion(tenantId, userId, e2eKeyVersion);
      if (!isValid) {
        return {
          isE2e: true,
          fields: undefined,
          error: 'E2E key version mismatch. Re-fetch key data.',
        };
      }
    }
    return {
      isE2e: true,
      error: undefined,
      fields: {
        encryptedContent,
        e2eNonce,
        e2eKeyVersion: e2eKeyVersion ?? 1,
        e2eKeyEpoch: e2eKeyEpoch ?? 0,
      },
    };
  }

  /**
   * Process a message: save to DB, link attachments, build response data.
   * Returns all data needed for broadcasting — caller handles transport.
   */
  async processMessage(
    userId: number,
    tenantId: number,
    conversationId: number,
    content: string | null,
    attachmentIds: number[],
    e2eFields?: E2eFields,
  ): Promise<ProcessedMessageResult> {
    const { id: messageId, uuid: messageUuid } = await this.saveMessage(
      conversationId,
      userId,
      content,
      tenantId,
      e2eFields,
    );

    if (attachmentIds.length > 0) {
      await this.linkAttachmentsToMessage(messageId, attachmentIds, tenantId);
    }

    const attachments = await this.getMessageAttachments(attachmentIds, tenantId);
    const sender = await this.getSenderInfo(userId, tenantId);
    const messageData = this.buildMessageData(
      messageId,
      conversationId,
      content,
      userId,
      sender,
      attachments,
      e2eFields,
    );

    // SSE preview: use lock icon for E2E messages (server cannot read ciphertext)
    const preview = e2eFields !== undefined ? '' : (content ?? '').substring(0, 50);

    return { messageId, messageUuid, messageData, preview };
  }

  /**
   * Mark a message as read and return the sender info for read receipt notification.
   * Returns null if message not found.
   */
  async markAsRead(
    messageId: number,
    tenantId: number,
    userId: number,
  ): Promise<MarkReadResult | null> {
    await this.db.query(
      `UPDATE chat_messages
       SET is_read = true
       WHERE id = $1
       AND tenant_id = $2
       AND EXISTS (
         SELECT 1 FROM chat_conversation_participants cp
         WHERE cp.conversation_id = chat_messages.conversation_id
         AND cp.user_id = $3
       )`,
      [messageId, tenantId, userId],
    );

    const messageInfo = await this.db.query<MessageInfoResult>(
      'SELECT sender_id, conversation_id FROM chat_messages WHERE id = $1',
      [messageId],
    );

    if (messageInfo.length > 0 && messageInfo[0] !== undefined) {
      return {
        senderId: messageInfo[0].sender_id,
        conversationId: messageInfo[0].conversation_id,
      };
    }
    return null;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Validate sender's E2E key version against server's record.
   * Prevents storing messages encrypted with a stale key version.
   */
  private async validateE2eKeyVersion(
    tenantId: number,
    userId: number,
    claimedVersion: number,
  ): Promise<boolean> {
    interface KeyVersionRow {
      key_version: number;
    }
    const rows = await this.db.query<KeyVersionRow>(
      `SELECT key_version FROM e2e_user_keys
       WHERE tenant_id = $1 AND user_id = $2 AND is_active = ${IS_ACTIVE.ACTIVE}`,
      [tenantId, userId],
    );
    return rows[0]?.key_version === claimedVersion;
  }

  private async saveMessage(
    conversationId: number,
    senderId: number,
    content: string | null,
    tenantId: number,
    e2eFields?: E2eFields,
  ): Promise<{ id: number; uuid: string }> {
    const messageUuid = uuidv7();
    const isE2e = e2eFields !== undefined;

    const messageQuery = `
      INSERT INTO chat_messages (conversation_id, sender_id, content, tenant_id,
        encrypted_content, e2e_nonce, is_e2e, e2e_key_version, e2e_key_epoch,
        uuid, uuid_created_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING id
    `;
    interface InsertResult {
      id: number;
    }
    const rows = await this.db.query<InsertResult>(messageQuery, [
      conversationId,
      senderId,
      content,
      tenantId,
      isE2e ? e2eFields.encryptedContent : null,
      isE2e ? e2eFields.e2eNonce : null,
      isE2e,
      isE2e ? e2eFields.e2eKeyVersion : null,
      isE2e ? e2eFields.e2eKeyEpoch : null,
      messageUuid,
    ]);

    const insertedRow = rows[0];
    if (insertedRow === undefined) {
      throw new Error('Failed to insert message - no row returned');
    }
    return { id: insertedRow.id, uuid: messageUuid };
  }

  /** Link uploaded documents to a message */
  private async linkAttachmentsToMessage(
    messageId: number,
    attachmentIds: number[],
    tenantId: number,
  ): Promise<void> {
    if (attachmentIds.length === 0) return;

    const placeholders = attachmentIds.map((_: number, i: number) => `$${i + 3}`).join(', ');
    const updateQuery = `
      UPDATE documents
      SET message_id = $1
      WHERE id IN (${placeholders})
      AND tenant_id = $2
      AND message_id IS NULL
    `;
    await this.db.query(updateQuery, [messageId, tenantId, ...attachmentIds]);
    logger.info(`Linked ${attachmentIds.length} attachments to message ${messageId}`);
  }

  /** Get attachment details for a message */
  private async getMessageAttachments(
    attachmentIds: number[],
    tenantId: number,
  ): Promise<AttachmentInfo[]> {
    if (attachmentIds.length === 0) return [];

    const placeholders = attachmentIds.map((_: number, i: number) => `$${i + 2}`).join(', ');
    const attachmentQuery = `
      SELECT id, file_uuid, filename, original_name, file_size, mime_type
      FROM documents
      WHERE id IN (${placeholders})
      AND tenant_id = $1
    `;
    interface AttachmentRow {
      id: number;
      file_uuid: string;
      filename: string;
      original_name: string;
      file_size: number;
      mime_type: string;
    }
    const rows = await this.db.query<AttachmentRow>(attachmentQuery, [tenantId, ...attachmentIds]);

    return rows.map((row: AttachmentRow) => ({
      id: row.id,
      fileUuid: row.file_uuid,
      fileName: row.filename,
      originalName: row.original_name,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      downloadUrl: `/api/v2/documents/${row.id}/download`,
    }));
  }

  private async getSenderInfo(userId: number, tenantId: number): Promise<SenderInfo | undefined> {
    const senderQuery = `
      SELECT id, username, first_name, last_name, profile_picture as profile_picture_url
      FROM users WHERE id = $1 AND tenant_id = $2
    `;
    const senderInfo = await this.db.query<UserInfoResult>(senderQuery, [userId, tenantId]);
    return senderInfo[0];
  }

  /** Get display name from sender info with fallbacks */
  private getSenderDisplayName(sender: SenderInfo | null | undefined, fallback: string): string {
    if (sender === null || sender === undefined) return fallback;

    const fullName = [sender.first_name, sender.last_name]
      .filter(
        (part: string | null | undefined): part is string =>
          part !== undefined && part !== null && part !== '',
      )
      .join(' ');
    if (fullName !== '') return fullName;

    if (sender.username !== '') {
      return sender.username;
    }

    return fallback;
  }

  private buildMessageData(
    messageId: number,
    conversationId: number,
    content: string | null,
    senderId: number,
    sender: SenderInfo | undefined,
    attachments: AttachmentInfo[],
    e2eFields?: E2eFields,
  ): unknown {
    const UNKNOWN_USER = 'Unbekannter Benutzer';
    const isE2e = e2eFields !== undefined;
    // API v2 Standard: camelCase for all fields
    return {
      id: messageId,
      conversationId,
      content,
      senderId,
      senderName: this.getSenderDisplayName(sender, UNKNOWN_USER),
      firstName: sender?.first_name ?? '',
      lastName: sender?.last_name ?? '',
      senderUsername: sender?.username ?? '',
      senderProfilePicture: sender?.profile_picture_url ?? null,
      createdAt: new Date().toISOString(),
      deliveryStatus: 'sent',
      isRead: false,
      attachments,
      // E2E fields (broadcast ciphertext to recipients for client-side decryption)
      encryptedContent: isE2e ? e2eFields.encryptedContent : null,
      e2eNonce: isE2e ? e2eFields.e2eNonce : null,
      isE2e,
      e2eKeyVersion: isE2e ? e2eFields.e2eKeyVersion : null,
      e2eKeyEpoch: isE2e ? e2eFields.e2eKeyEpoch : null,
    };
  }
}
