// =============================================================================
// CHAT PAGE - TYPE DEFINITIONS
// =============================================================================

/**
 * User online status
 */
export type UserStatus = 'online' | 'offline' | 'away';

/**
 * User role types
 */
export type UserRole = 'root' | 'admin' | 'employee';

/**
 * Notification types for UI feedback
 */
export type NotificationType = 'success' | 'error' | 'info' | 'warning';

/**
 * File upload status
 */
export type FileUploadStatus = 'pending' | 'uploading' | 'uploaded' | 'error';

/**
 * Scheduled message status
 */
export type ScheduledMessageStatus = 'pending' | 'sent' | 'cancelled';

/**
 * Message content type
 */
export type MessageType = 'text' | 'file' | 'system';

/**
 * Chat user representation
 */
export interface ChatUser {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
  profilePicture?: string;
  profileImageUrl?: string;
  status?: UserStatus;
  lastSeen?: string;
  employeeNumber?: string;
}

/**
 * Conversation participant
 */
export interface ConversationParticipant {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  status?: UserStatus;
}

/**
 * Last message preview in conversation list
 */
export interface ConversationLastMessage {
  content: string;
  createdAt: string;
}

/**
 * Conversation (1:1 or group)
 */
export interface Conversation {
  id: number;
  uuid: string;
  name?: string;
  isGroup: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessage?: ConversationLastMessage;
  participants: ConversationParticipant[];
  unreadCount?: number;
  typingUsers?: number[];
  displayName?: string;
  /**
   * Indicates this is a pending (not yet persisted) conversation.
   * Used for lazy creation - conversation is only created in DB when first message is sent.
   */
  isPending?: boolean;
  /**
   * Target user ID for pending 1:1 conversations.
   * Used to create the conversation when first message is sent.
   */
  pendingTargetUserId?: number;
}

/**
 * File attachment (new format)
 */
export interface Attachment {
  id: number;
  messageId?: number;
  fileUuid: string;
  fileName: string;
  originalName?: string;
  filePath?: string;
  fileSize: number;
  mimeType: string;
  category?: string;
  downloadUrl?: string;
  previewUrl?: string;
  createdAt: string;
}

/**
 * Legacy attachment format (backward compatibility)
 */
export interface LegacyAttachment {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

/**
 * Chat message
 */
export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  senderName?: string;
  senderUsername?: string;
  senderProfilePicture?: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  readAt?: string;
  updatedAt?: string;
  sender?: ChatUser;
  attachments?: Attachment[];
  attachment?: LegacyAttachment | null;
  type?: MessageType;
}

/**
 * Scheduled message attachment info
 */
export interface ScheduledAttachment {
  path: string;
  name: string;
  type: string;
  size: number;
}

/**
 * Scheduled message
 */
export interface ScheduledMessage {
  id: string;
  conversationId: number;
  senderId: number;
  content: string;
  scheduledFor: string;
  status: ScheduledMessageStatus;
  createdAt: string;
  sentAt: string | null;
  /** Attachment info (nested object from backend) */
  attachment: ScheduledAttachment | null;
}

/**
 * File preview item for upload queue
 */
export interface FilePreviewItem {
  file: File;
  previewUrl: string;
  isImage: boolean;
  status: FileUploadStatus;
  progress: number;
  documentId: number | null;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * API response for conversations list
 */
export interface ConversationsResponse {
  data: Conversation[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * API response for messages list
 */
export interface MessagesResponse {
  data: Message[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * API response for scheduled messages
 */
export interface ScheduledMessagesResponse {
  scheduledMessages: ScheduledMessage[];
  total: number;
}

/**
 * API response for users search
 */
export interface UsersResponse {
  users: ChatUser[];
  total: number;
}

/**
 * API response for creating conversation
 */
export interface CreateConversationResponse {
  conversation: {
    id: number;
    uuid: string;
    participants: ConversationParticipant[];
  };
}

/**
 * API response for file upload
 */
export interface UploadResponse {
  id: number;
  fileUuid: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
}

// =============================================================================
// WEBSOCKET MESSAGE TYPES
// =============================================================================

/**
 * WebSocket message wrapper
 */
export interface WebSocketMessage {
  type: string;
  data: unknown;
}

/**
 * Typing indicator data
 */
export interface TypingData {
  userId: number;
  conversationId: number;
}

/**
 * User status change data
 */
export interface StatusChangeData {
  userId: number;
  status: UserStatus;
}

/**
 * Message read confirmation data
 */
export interface MessageReadData {
  messageId: number;
  userId: number;
}

/**
 * Raw message from WebSocket (API v2 camelCase)
 */
export interface RawWebSocketMessage {
  id?: number;
  conversationId?: number;
  senderId?: number;
  content?: string;
  createdAt?: string;
  isRead?: boolean;
  type?: string;
  attachments?: Attachment[];
  senderName?: string;
  senderUsername?: string;
  senderProfilePicture?: string;
  firstName?: string;
  lastName?: string;
  userId?: number;
  messageId?: number;
  status?: string;
}
