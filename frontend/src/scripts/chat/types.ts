/**
 * Chat Module - Type Definitions
 * All interfaces and types for the chat system
 */

import type { User } from '../../types/api.types';

// ============================================================================
// User Types
// ============================================================================

/**
 * Extended user type for chat with status information
 */
export interface ChatUser extends User {
  status?: 'online' | 'offline' | 'away';
  lastSeen?: string;
  profileImageUrl?: string;
}

// ============================================================================
// Message Types
// ============================================================================

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
  attachment?: string | null;
  type?: 'text' | 'file' | 'system';
}

/**
 * Extended message with extra fields from WebSocket
 */
export interface MessageWithExtra extends Message {
  username?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

/**
 * File attachment (Document-based system)
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
 * Scheduled message (pending, not yet sent)
 */
export interface ScheduledMessage {
  id: string;
  conversationId: number;
  senderId: number;
  content: string;
  scheduledFor: string;
  status: 'pending' | 'sent' | 'cancelled';
  createdAt: string;
  sentAt: string | null;
}

// ============================================================================
// Conversation Types
// ============================================================================

/**
 * Minimal participant info in conversation list
 * Subset of ChatUser with only fields returned by conversation API
 * Status is optional - populated by WebSocket presence updates
 */
export interface ConversationParticipant {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  /** Online/offline status - updated via WebSocket presence events */
  status?: 'online' | 'offline' | 'away';
}

/**
 * Last message preview in conversation list
 */
export interface ConversationLastMessage {
  content: string;
  createdAt: string;
}

/**
 * Chat conversation
 */
export interface Conversation {
  id: number;
  uuid: string; // UUIDv7 for URL routing (/chat/:uuid)
  name?: string;
  isGroup: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessage?: ConversationLastMessage;
  participants: ConversationParticipant[];
  unreadCount?: number;
  typingUsers?: number[];
  displayName?: string;
}

/**
 * Request body for creating a conversation
 * Supports lazy creation: conversation is only created when initialMessage is provided
 */
export interface CreateConversationRequest {
  participantIds: number[];
  isGroup: boolean;
  name?: string;
  /** Initial message content - triggers actual conversation creation */
  initialMessage?: string;
}

/**
 * Pending conversation (not yet created in DB)
 * Used for lazy conversation creation - only create when first message is sent
 */
export interface PendingConversation {
  /** Target user for the pending 1:1 conversation */
  targetUser: ChatUser;
  /** Whether this is a group conversation */
  isGroup: boolean;
  /** Optional group name */
  name?: string;
}

// ============================================================================
// WebSocket Types
// ============================================================================

/**
 * WebSocket message structure
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
 * User status data
 */
export interface UserStatusData {
  userId: number;
  status: string;
}

/**
 * Message read data
 */
export interface MessageReadData {
  messageId: number;
  userId: number;
}

// ============================================================================
// UI Types
// ============================================================================

/**
 * Notification types
 */
export type NotificationType = 'success' | 'error' | 'info' | 'warning';

/**
 * Department option
 */
export interface DepartmentOption {
  id: number;
  name: string;
}

// ============================================================================
// Window Extensions
// ============================================================================

declare global {
  interface Window {
    chatClient?: unknown;
    // unifiedNav is already typed as UnifiedNavigation in global.d.ts
  }
}
