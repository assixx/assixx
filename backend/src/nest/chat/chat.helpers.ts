/**
 * Chat Module Helpers
 *
 * Pure functions for mapping and transforming chat data.
 * No DI dependencies - stateless transformations only.
 */
import { buildFullName } from '../../utils/db-helpers.js';
import type {
  ChatUser,
  ChatUserRow,
  Conversation,
  ConversationRow,
  DocumentAttachment,
  Message,
  MessageAttachmentInput,
  MessageRow,
  PaginationMeta,
  ParticipantRow,
  SCHEDULED_STATUS,
  ScheduledMessage,
  ScheduledMessageRow,
  SenderInfo,
} from './chat.types.js';

// ============================================
// User Mappers
// ============================================

/**
 * Transform database row to API response format for chat user
 */
export function mapRowToChatUser(user: ChatUserRow): ChatUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.first_name ?? '',
    lastName: user.last_name ?? '',
    employeeNumber: user.employee_number,
    profilePicture: user.profile_picture,
    departmentId: user.department_id,
    departmentName: user.department_name,
    teamAreaId: user.area_id,
    teamAreaName: user.area_name,
    role: user.role,
    status: 'offline',
    lastSeen: null,
  };
}

// ============================================
// Conversation Mappers
// ============================================

/**
 * Transform conversation row to API format with participants and unread counts
 */
export function mapConversationToApiFormat(
  conv: ConversationRow,
  participants: ParticipantRow[],
  unreadCounts: Map<number, number>,
): Conversation {
  const convParticipants = participants
    .filter((p: ParticipantRow) => p.conversation_id === conv.id)
    .map((p: ParticipantRow) => ({
      id: p.user_id,
      userId: p.user_id,
      username: p.username,
      firstName: p.first_name ?? '',
      lastName: p.last_name ?? '',
      profileImageUrl: p.profile_picture ?? undefined,
      joinedAt: new Date(p.joined_at),
      isActive: true,
    }));

  let lastMessage: {
    content: string;
    createdAt: string;
    isE2e?: boolean;
  } | null = null;
  if (conv.last_message_time !== null) {
    lastMessage = {
      content: conv.last_message_content ?? '',
      createdAt: new Date(conv.last_message_time).toISOString(),
      ...(conv.last_message_is_e2e === true ? { isE2e: true } : {}),
    };
  }

  return {
    id: conv.id,
    uuid: conv.uuid.trim(),
    name: conv.name,
    isGroup: conv.is_group,
    createdAt: new Date(conv.created_at),
    updatedAt: new Date(conv.updated_at),
    lastMessage,
    unreadCount: unreadCounts.get(conv.id) ?? 0,
    participants: convParticipants,
  };
}

// ============================================
// Message Mappers
// ============================================

/**
 * Transform database message row to API response format
 */
export function transformMessage(msg: MessageRow): Message {
  return {
    id: msg.id,
    conversationId: msg.conversation_id,
    senderId: msg.sender_id,
    senderName: buildFullName(msg.sender_first_name, msg.sender_last_name),
    senderUsername: msg.sender_username !== '' ? msg.sender_username : 'unknown',
    senderProfilePicture: msg.sender_profile_picture,
    content: msg.content,
    attachment:
      msg.attachment_path !== null ?
        {
          url: `/api/v2/chat/attachments/${msg.attachment_path}/download`,
          filename: msg.attachment_name ?? 'attachment',
          mimeType: msg.attachment_type ?? 'application/octet-stream',
          size: typeof msg.attachment_size === 'number' ? msg.attachment_size : 0,
        }
      : null,
    attachments: [],
    isRead: msg.is_read !== 0,
    readAt: msg.read_at !== null ? new Date(msg.read_at) : null,
    createdAt: new Date(msg.created_at),
    updatedAt: new Date(msg.created_at),
    encryptedContent: msg.encrypted_content ?? null,
    e2eNonce: msg.e2e_nonce ?? null,
    isE2e: msg.is_e2e,
    e2eKeyVersion: msg.e2e_key_version ?? null,
    e2eKeyEpoch: msg.e2e_key_epoch ?? null,
  };
}

/**
 * E2E fields for building sent message response
 */
export interface SentMessageE2eFields {
  encryptedContent: string;
  e2eNonce: string;
  e2eKeyVersion: number;
  e2eKeyEpoch: number;
}

/**
 * Build Message response object for sent message
 */
export function buildSentMessage(
  messageId: number,
  conversationId: number,
  senderId: number,
  content: string | null,
  sender: SenderInfo,
  attachment?: MessageAttachmentInput,
  e2eFields?: SentMessageE2eFields,
): Message {
  return {
    id: messageId,
    conversationId,
    senderId,
    senderName: buildFullName(sender.first_name, sender.last_name),
    senderUsername: sender.username,
    senderProfilePicture: sender.profile_picture,
    content,
    attachment:
      attachment !== undefined ?
        {
          url: attachment.path,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          size: attachment.size,
        }
      : null,
    attachments: [],
    isRead: false,
    readAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    encryptedContent: e2eFields?.encryptedContent ?? null,
    e2eNonce: e2eFields?.e2eNonce ?? null,
    isE2e: e2eFields !== undefined,
    e2eKeyVersion: e2eFields?.e2eKeyVersion ?? null,
    e2eKeyEpoch: e2eFields?.e2eKeyEpoch ?? null,
  };
}

/**
 * Map document attachments to message attachment array
 */
export function mapDocumentAttachments(
  messageIds: number[],
  rows: {
    id: number;
    message_id: number;
    file_uuid: string;
    filename: string;
    original_name: string;
    file_size: number;
    mime_type: string;
    uploaded_at: Date | null;
  }[],
): Map<number, DocumentAttachment[]> {
  const attachmentMap = new Map<number, DocumentAttachment[]>();

  for (const id of messageIds) {
    attachmentMap.set(id, []);
  }

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

// ============================================
// Scheduled Message Mappers
// ============================================

/**
 * Map scheduled message row to API response format
 */
export function mapScheduledMessage(
  row: ScheduledMessageRow,
  scheduledStatus: typeof SCHEDULED_STATUS,
): ScheduledMessage {
  let status: 'pending' | 'sent' | 'cancelled';
  switch (row.is_active) {
    case scheduledStatus.CANCELLED:
      status = 'cancelled';
      break;
    case scheduledStatus.SENT:
      status = 'sent';
      break;
    default:
      status = 'pending';
  }

  let attachment: {
    path: string;
    name: string;
    type: string;
    size: number;
  } | null = null;
  if (
    row.attachment_path !== null &&
    row.attachment_name !== null &&
    row.attachment_type !== null &&
    row.attachment_size !== null
  ) {
    attachment = {
      path: row.attachment_path,
      name: row.attachment_name,
      type: row.attachment_type,
      size: row.attachment_size,
    };
  }

  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    scheduledFor: row.scheduled_for.toISOString(),
    status,
    createdAt: row.created_at.toISOString(),
    sentAt: row.sent_at?.toISOString() ?? null,
    attachment,
    encryptedContent: row.encrypted_content ?? null,
    e2eNonce: row.e2e_nonce ?? null,
    isE2e: row.is_e2e,
    e2eKeyVersion: row.e2e_key_version ?? null,
    e2eKeyEpoch: row.e2e_key_epoch ?? null,
  };
}

// ============================================
// Pagination Helpers
// ============================================

/**
 * Build pagination metadata
 */
export function buildPaginationMeta(
  page: number,
  limit: number,
  totalItems: number,
): PaginationMeta {
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

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate scheduled time is within allowed range
 * Returns error message if invalid, null if valid
 */
export function validateScheduledTime(
  scheduledFor: Date,
  minMinutes: number,
  maxDays: number,
): string | null {
  const now = new Date();
  const minTime = new Date(now.getTime() + minMinutes * 60 * 1000);
  const maxTime = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);

  if (scheduledFor <= minTime) {
    return `Scheduled time must be at least ${minMinutes} minutes in the future`;
  }

  if (scheduledFor > maxTime) {
    return `Scheduled time cannot be more than ${maxDays} days in the future`;
  }

  return null;
}

/**
 * Resolve message content, using placeholder for attachment-only messages.
 * For E2E messages, content is NULL (server stores only ciphertext).
 * Returns error message if both content and attachment are missing AND not E2E.
 */
export function resolveMessageContent(
  message: string | undefined,
  hasAttachment: boolean,
  isE2e: boolean = false,
): { content: string | null } | { error: string } {
  // E2E messages: content is NULL on server (ciphertext stored separately)
  if (isE2e) {
    return { content: null };
  }
  let content = message ?? '';
  if (hasAttachment && content === '') {
    content = '📎 Attachment';
  }
  if (content === '' && !hasAttachment) {
    return { error: 'Message content or attachment is required' };
  }
  return { content };
}

/**
 * Filter users by search term (username, email, or full name)
 */
export function filterUsersBySearch(
  users: ChatUserRow[],
  search: string | undefined,
): ChatUserRow[] {
  if (search === undefined || search === '') {
    return users;
  }
  const searchLower = search.toLowerCase();
  return users.filter((user: ChatUserRow) => {
    return (
      user.username.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      buildFullName(user.first_name, user.last_name, '').toLowerCase().includes(searchLower)
    );
  });
}
