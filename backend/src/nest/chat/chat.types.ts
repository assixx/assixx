/**
 * Chat Module Internal Types
 *
 * Shared interfaces for chat sub-services.
 * DB row types and API response types.
 */

// ============================================
// User Types
// ============================================

/**
 * User permissions for chat access control
 */
export interface UserPermissions {
  role: string;
  department_id: number | null;
}

/**
 * Database row for chat user
 */
export interface ChatUserRow {
  id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  employee_number: string | null;
  profile_picture: string | null;
  department_id: number | null;
  department_name: string | null;
  area_id: number | null;
  area_name: string | null;
  role: string;
}

/**
 * API response for chat user
 */
export interface ChatUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeNumber: string | null;
  profilePicture: string | null;
  departmentId: number | null;
  departmentName: string | null;
  teamAreaId: number | null;
  teamAreaName: string | null;
  role: string;
  status: string;
  lastSeen: Date | null;
}

// ============================================
// Conversation Types
// ============================================

/**
 * Database row for conversation
 */
export interface ConversationRow {
  id: number;
  uuid: string;
  name: string | null;
  is_group: boolean;
  created_at: Date;
  updated_at: Date;
  last_message_content: string | null;
  last_message_time: Date | null;
  /** Whether the last message is end-to-end encrypted */
  last_message_is_e2e: boolean | null;
}

/**
 * Database row for participant
 */
export interface ParticipantRow {
  conversation_id: number;
  user_id: number;
  joined_at: Date;
  is_admin: boolean;
  username: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture: string | null;
}

/**
 * API response for participant
 */
export interface ConversationParticipant {
  id: number;
  userId: number;
  username: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | undefined;
  joinedAt: Date;
  isActive: boolean;
}

/**
 * API response for conversation
 */
export interface Conversation {
  id: number;
  uuid: string;
  name: string | null;
  isGroup: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastMessage: { content: string; createdAt: string; isE2e?: boolean } | null;
  unreadCount: number;
  participants: ConversationParticipant[];
}

// ============================================
// Message Types
// ============================================

/**
 * Input for message attachment
 */
export interface MessageAttachmentInput {
  path: string;
  filename: string;
  mimeType: string;
  size: number;
}

/**
 * Sender info from database
 */
export interface SenderInfo {
  username: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture: string | null;
}

/**
 * Database row for message
 */
export interface MessageRow {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_username: string;
  sender_first_name: string | null;
  sender_last_name: string | null;
  sender_profile_picture: string | null;
  content: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  created_at: Date;
  is_read: number;
  read_at: Date | null;
  /** E2E: base64 ciphertext (NULL for plaintext messages) */
  encrypted_content: string | null;
  /** E2E: base64 XChaCha20-Poly1305 nonce */
  e2e_nonce: string | null;
  /** E2E: whether this message is end-to-end encrypted */
  is_e2e: boolean;
  /** E2E: sender's key version at time of encryption */
  e2e_key_version: number | null;
  /** E2E: HKDF epoch for decryption key derivation */
  e2e_key_epoch: number | null;
}

/**
 * API response for message attachment
 */
export interface MessageAttachment {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

/**
 * API response for message
 */
export interface Message {
  id: number;
  conversationId: number;
  senderId: number | null;
  senderName: string;
  senderUsername: string;
  senderProfilePicture: string | null;
  content: string | null;
  attachment: MessageAttachment | null;
  attachments: DocumentAttachment[];
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** E2E: base64 ciphertext (null for plaintext messages) */
  encryptedContent: string | null;
  /** E2E: base64 XChaCha20-Poly1305 nonce */
  e2eNonce: string | null;
  /** E2E: whether this message is end-to-end encrypted */
  isE2e: boolean;
  /** E2E: sender's key version at time of encryption */
  e2eKeyVersion: number | null;
  /** E2E: HKDF epoch for decryption key derivation */
  e2eKeyEpoch: number | null;
}

/**
 * Document-based attachment
 */
export interface DocumentAttachment {
  id: number;
  fileUuid: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  downloadUrl: string;
  createdAt?: string | undefined;
}

// ============================================
// Scheduled Message Types
// ============================================

/**
 * Database row for scheduled message
 */
export interface ScheduledMessageRow {
  id: string;
  tenant_id: number;
  conversation_id: number;
  sender_id: number;
  content: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  attachment_size: number | null;
  scheduled_for: Date;
  is_active: number;
  created_at: Date;
  sent_at: Date | null;
  /** E2E: base64 ciphertext (NULL for plaintext messages) */
  encrypted_content: string | null;
  /** E2E: base64 XChaCha20-Poly1305 nonce */
  e2e_nonce: string | null;
  /** E2E: whether this scheduled message is end-to-end encrypted */
  is_e2e: boolean;
  /** E2E: sender's key version at time of encryption */
  e2e_key_version: number | null;
  /** E2E: HKDF epoch for decryption key derivation */
  e2e_key_epoch: number | null;
}

/**
 * API response for scheduled message
 */
export interface ScheduledMessage {
  id: string;
  conversationId: number;
  senderId: number;
  content: string | null;
  scheduledFor: string;
  status: 'pending' | 'sent' | 'cancelled';
  createdAt: string;
  sentAt: string | null;
  attachment: { path: string; name: string; type: string; size: number } | null;
  /** E2E: base64 ciphertext (null for plaintext messages) */
  encryptedContent: string | null;
  /** E2E: base64 XChaCha20-Poly1305 nonce */
  e2eNonce: string | null;
  /** E2E: whether this scheduled message is end-to-end encrypted */
  isE2e: boolean;
  /** E2E: sender's key version at time of encryption */
  e2eKeyVersion: number | null;
  /** E2E: HKDF epoch for decryption key derivation */
  e2eKeyEpoch: number | null;
}

// ============================================
// Pagination & Summary Types
// ============================================

/**
 * Pagination meta
 */
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Unread count summary
 */
export interface UnreadCountSummary {
  totalUnread: number;
  conversations: {
    conversationId: number;
    conversationName: string | null;
    unreadCount: number;
    lastMessageTime: Date;
  }[];
}

// ============================================
// Constants
// ============================================

export const SCHEDULED_STATUS = {
  CANCELLED: 0,
  PENDING: 1,
  SENT: 4,
} as const;

export const MIN_SCHEDULE_MINUTES = 5;
export const MAX_SCHEDULE_DAYS = 60;

export const ERROR_FEATURE_NOT_IMPLEMENTED = 'Feature not yet implemented';
