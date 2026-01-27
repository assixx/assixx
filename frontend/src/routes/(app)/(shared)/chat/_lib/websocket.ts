// =============================================================================
// CHAT PAGE - WEBSOCKET UTILITIES
// =============================================================================

import { WS_MESSAGE_TYPES, WEBSOCKET_CONFIG } from './constants';

import type {
  Message,
  RawWebSocketMessage,
  WebSocketMessage,
  TypingData,
  StatusChangeData,
  MessageReadData,
  Conversation,
  UserStatus,
} from './types';

// =============================================================================
// WEBSOCKET URL BUILDER
// =============================================================================

/**
 * Build WebSocket URL with connection ticket
 * SECURITY: Uses short-lived ticket instead of JWT to prevent token leakage in logs
 * @param ticket - Connection ticket from /api/v2/auth/connection-ticket
 * @returns WebSocket URL string
 * @see docs/TOKEN-SECURITY-REFACTORING-PLAN.md
 */
export function buildWebSocketUrl(ticket: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/chat-ws?ticket=${encodeURIComponent(ticket)}`;
}

// =============================================================================
// MESSAGE TRANSFORMATION
// =============================================================================

/**
 * Extract base message fields with defaults
 */
function extractBaseMessageFields(raw: RawWebSocketMessage) {
  return {
    id: raw.id ?? 0,
    conversationId: raw.conversationId ?? 0,
    senderId: raw.senderId ?? 0,
    content: raw.content ?? '',
    createdAt: raw.createdAt ?? new Date().toISOString(),
    isRead: raw.isRead ?? false,
    type: (raw.type as Message['type']) ?? 'text',
    attachments: raw.attachments ?? [],
  };
}

/**
 * Extract sender object from raw message
 */
function extractSender(raw: RawWebSocketMessage) {
  return {
    id: raw.senderId ?? 0,
    firstName: raw.firstName ?? '',
    lastName: raw.lastName ?? '',
    username: raw.senderUsername ?? '',
  };
}

/**
 * Transform raw WebSocket message (snake_case) to camelCase Message
 * @param raw - Raw message from WebSocket
 * @returns Normalized Message object
 */
export function transformRawMessage(raw: RawWebSocketMessage): Message {
  return {
    ...extractBaseMessageFields(raw),
    senderName: raw.senderName,
    senderUsername: raw.senderUsername,
    senderProfilePicture: raw.senderProfilePicture,
    sender: extractSender(raw),
  };
}

/**
 * Extract typing data from raw WebSocket message
 * @param raw - Raw message data
 * @returns Normalized TypingData
 */
export function extractTypingData(raw: RawWebSocketMessage): TypingData {
  return {
    userId: raw.userId ?? 0,
    conversationId: raw.conversationId ?? 0,
  };
}

/**
 * Extract status change data from raw WebSocket message
 * @param raw - Raw message data
 * @returns Normalized StatusChangeData
 */
export function extractStatusData(raw: RawWebSocketMessage): StatusChangeData {
  return {
    userId: raw.userId ?? 0,
    status: (raw.status ?? 'offline') as UserStatus,
  };
}

/**
 * Extract message read data from raw WebSocket message
 * @param raw - Raw message data
 * @returns Normalized MessageReadData
 */
export function extractReadData(raw: RawWebSocketMessage): MessageReadData {
  return {
    messageId: raw.messageId ?? 0,
    userId: raw.userId ?? 0,
  };
}

// =============================================================================
// STATE UPDATE HELPERS
// =============================================================================

/**
 * Add typing user to list if not already present
 * @param typingUsers - Current typing users array
 * @param userId - User ID to add
 * @returns New typing users array
 */
export function addTypingUser(typingUsers: number[], userId: number): number[] {
  if (typingUsers.includes(userId)) {
    return typingUsers;
  }
  return [...typingUsers, userId];
}

/**
 * Remove typing user from list
 * @param typingUsers - Current typing users array
 * @param userId - User ID to remove
 * @returns New typing users array
 */
export function removeTypingUser(
  typingUsers: number[],
  userId: number,
): number[] {
  return typingUsers.filter((id) => id !== userId);
}

/**
 * Update user status in conversations
 * @param conversations - Current conversations array
 * @param userId - User ID to update
 * @param status - New status
 * @returns New conversations array with updated status
 */
export function updateConversationsUserStatus(
  conversations: Conversation[],
  userId: number,
  status: UserStatus,
): Conversation[] {
  return conversations.map((conv) => ({
    ...conv,
    participants: conv.participants.map((p) =>
      p.id === userId ? { ...p, status } : p,
    ),
  }));
}

/**
 * Mark message as read in messages array
 * @param messages - Current messages array
 * @param messageId - Message ID to mark as read
 * @returns New messages array with updated message
 */
export function markMessageAsRead(
  messages: Message[],
  messageId: number,
): Message[] {
  return messages.map((m) =>
    m.id === messageId ?
      { ...m, isRead: true, readAt: new Date().toISOString() }
    : m,
  );
}

/**
 * Update conversation with new message
 * @param conversations - Current conversations array
 * @param conversationId - Conversation ID
 * @param newMessage - New message
 * @param isActiveConversation - Whether this is the active conversation
 * @param currentUserId - Current user's ID
 * @returns New conversations array with updated conversation at top
 */
export function updateConversationWithMessage(
  conversations: Conversation[],
  conversationId: number,
  newMessage: Message,
  isActiveConversation: boolean,
  currentUserId: number,
): Conversation[] {
  const convIndex = conversations.findIndex((c) => c.id === conversationId);
  if (convIndex < 0) return conversations;

  const conv = { ...conversations[convIndex] };
  conv.lastMessage = {
    content: newMessage.content,
    createdAt: newMessage.createdAt,
  };

  // Increment unread count if not active and not own message
  if (!isActiveConversation && newMessage.senderId !== currentUserId) {
    conv.unreadCount = (conv.unreadCount ?? 0) + 1;
  }

  // Move to top
  return [conv, ...conversations.filter((_, i) => i !== convIndex)];
}

// =============================================================================
// WEBSOCKET MESSAGE BUILDERS
// =============================================================================

/**
 * Build join conversation message
 * @param conversationId - Conversation ID to join
 * @returns WebSocket message object
 */
export function buildJoinMessage(conversationId: number): WebSocketMessage {
  return {
    type: WS_MESSAGE_TYPES.JOIN_CONVERSATION,
    data: { conversationId },
  };
}

/**
 * Build send message payload
 * @param conversationId - Conversation ID
 * @param content - Message content
 * @param attachments - Attachment IDs
 * @returns WebSocket message object
 */
export function buildSendMessage(
  conversationId: number,
  content: string,
  attachments: number[],
): WebSocketMessage {
  return {
    type: WS_MESSAGE_TYPES.SEND_MESSAGE,
    data: { conversationId, content, attachments },
  };
}

/**
 * Build typing start message
 * @param conversationId - Conversation ID
 * @returns WebSocket message object
 */
export function buildTypingStartMessage(
  conversationId: number,
): WebSocketMessage {
  return {
    type: WS_MESSAGE_TYPES.TYPING_START,
    data: { conversationId },
  };
}

/**
 * Build typing stop message
 * @param conversationId - Conversation ID
 * @returns WebSocket message object
 */
export function buildTypingStopMessage(
  conversationId: number,
): WebSocketMessage {
  return {
    type: WS_MESSAGE_TYPES.TYPING_STOP,
    data: { conversationId },
  };
}

/**
 * Build ping message
 * @returns WebSocket message object
 */
export function buildPingMessage(): WebSocketMessage {
  return {
    type: WS_MESSAGE_TYPES.PING,
    data: { timestamp: new Date().toISOString() },
  };
}

// =============================================================================
// RECONNECTION LOGIC
// =============================================================================

/**
 * Calculate reconnection delay with exponential backoff
 * @param attempt - Current attempt number (1-based)
 * @returns Delay in milliseconds
 */
export function calculateReconnectDelay(attempt: number): number {
  return WEBSOCKET_CONFIG.reconnectDelay * attempt;
}

/**
 * Check if should attempt reconnection
 * @param attempts - Current attempt count
 * @returns true if should retry
 */
export function shouldReconnect(attempts: number): boolean {
  return attempts < WEBSOCKET_CONFIG.maxReconnectAttempts;
}

// =============================================================================
// WEBSOCKET MESSAGE TYPE CHECKS
// =============================================================================

/**
 * Check if message type is a typing indicator
 * @param type - Message type string
 * @returns true if typing-related
 */
export function isTypingMessage(type: string): boolean {
  return (
    type === WS_MESSAGE_TYPES.TYPING_START ||
    type === WS_MESSAGE_TYPES.USER_TYPING ||
    type === WS_MESSAGE_TYPES.TYPING_STOP ||
    type === WS_MESSAGE_TYPES.USER_STOPPED_TYPING
  );
}

/**
 * Check if message type indicates typing started
 * @param type - Message type string
 * @returns true if typing started
 */
export function isTypingStartMessage(type: string): boolean {
  return (
    type === WS_MESSAGE_TYPES.TYPING_START ||
    type === WS_MESSAGE_TYPES.USER_TYPING
  );
}

/**
 * Check if message type is a status change
 * @param type - Message type string
 * @returns true if status-related
 */
export function isStatusMessage(type: string): boolean {
  return (
    type === WS_MESSAGE_TYPES.USER_STATUS ||
    type === WS_MESSAGE_TYPES.USER_STATUS_CHANGED
  );
}

/**
 * Check if message type is ignorable (pong, confirmations)
 * @param type - Message type string
 * @returns true if can be ignored
 */
export function isIgnorableMessage(type: string): boolean {
  return (
    type === WS_MESSAGE_TYPES.PONG || type === WS_MESSAGE_TYPES.MESSAGE_SENT
  );
}
