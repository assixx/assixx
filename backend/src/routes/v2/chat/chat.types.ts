/**
 * Chat Domain Types v2
 * All type definitions and interfaces for chat features
 * Extracted from chat.service.ts for better maintainability
 */
import type { RowDataPacket } from 'mysql2/promise';

// ============================================================
// PUBLIC API TYPES (Exported to Controllers)
// ============================================================

/**
 * Pagination metadata for list responses
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
 * Chat user with profile and department info
 */
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

/**
 * Last message preview in conversation list
 */
export interface ConversationLastMessage {
  content: string;
  created_at: Date;
}

/**
 * Conversation with participants and metadata
 */
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

/**
 * Participant in a conversation
 */
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

/**
 * Chat message with sender info and optional attachment
 */
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

/**
 * File attachment metadata
 */
export interface MessageAttachment {
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

/**
 * Filter options for conversation listing
 */
export interface ConversationFilters {
  search?: string;
  isGroup?: boolean;
  hasUnread?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Filter options for message listing
 */
export interface MessageFilters {
  search?: string;
  startDate?: Date;
  endDate?: Date;
  hasAttachment?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Data required to create a new conversation
 */
export interface CreateConversationData {
  participantIds: number[];
  name?: string;
  isGroup?: boolean;
}

/**
 * Data required to send a message
 */
export interface SendMessageData {
  content: string;
  attachment?: {
    path: string;
    filename: string;
    mimeType: string;
    size: number;
  };
}

/**
 * Unread message count summary across conversations
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

// ============================================================
// INTERNAL DATABASE ROW TYPES (Used within services)
// ============================================================

/**
 * Chat user row from database
 * @internal
 */
export interface ChatUserRow extends RowDataPacket {
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

/**
 * Generic count result from database
 * @internal
 */
export interface CountResult extends RowDataPacket {
  total: number;
}

/**
 * Conversation row from database
 * @internal
 */
export interface ConversationRow extends RowDataPacket {
  id: number;
  name: string | null;
  is_group: number;
  created_at: Date;
  updated_at: Date;
  last_message_id: number | null;
  last_message_content: string | null;
  last_message_created_at: Date | null;
  last_message_time: Date | null;
  last_message_sender_id: number | null;
  last_message_sender_username: string | null;
  unread_count: number;
}

/**
 * Message row from database
 * @internal
 */
export interface MessageRow extends RowDataPacket {
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
  attachment_size: number | null;
  is_system: number;
  created_at: Date;
  is_read?: number;
  read_at?: Date | null;
}

/**
 * Participant row from database with user details
 * @internal
 */
export interface ParticipantRow extends RowDataPacket {
  conversation_id: number;
  user_id: number;
  joined_at: Date;
  is_admin?: boolean;
  username: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture: string | null;
}
