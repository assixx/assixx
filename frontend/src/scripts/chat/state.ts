/**
 * Chat Module - State Management
 * Centralized state for the chat system
 */

import type { ChatUser, Conversation, Message, PendingConversation, ScheduledMessage } from './types';
import type { JWTPayload } from '../../types/api.types';
import { getAuthToken } from '../auth/index';

/**
 * Centralized chat state management
 */
export class ChatState {
  // WebSocket
  ws: WebSocket | null = null;
  isConnected = false;
  reconnectAttempts = 0;
  readonly maxReconnectAttempts = 5;
  reconnectDelay = 1000;

  // Authentication
  token: string | null;
  currentUser: ChatUser;
  currentUserId: number | null;

  // Data
  conversations: Conversation[] = [];
  availableUsers: ChatUser[] = [];
  currentConversationId: number | null = null;
  scheduledMessages = new Map<number, ScheduledMessage[]>();

  // Message handling
  pendingFiles: File[] = [];
  messageQueue: Message[] = [];
  typingTimer: NodeJS.Timeout | null = null;

  // UI state
  initialized = false;
  isCreatingConversation = false;

  /**
   * Pending conversation for lazy creation
   * When set, UI shows a chat window but no DB entry exists yet
   * Conversation is only created when first message is sent
   */
  pendingConversation: PendingConversation | null = null;

  constructor() {
    this.token = getAuthToken();
    this.currentUser = this.initializeCurrentUser();
    // Type assertion needed because initializeCurrentUser may not always populate id at runtime
    this.currentUserId = (this.currentUser.id as number | undefined) ?? null;
  }

  /**
   * Initialize current user from localStorage or token
   */
  private initializeCurrentUser(): ChatUser {
    const storedUser = localStorage.getItem('user');
    const parsedUser: Partial<ChatUser> = storedUser !== null ? (JSON.parse(storedUser) as Partial<ChatUser>) : {};

    // Enrich user data from JWT token (most authoritative source)
    if (this.token !== null && this.token !== '' && this.token !== 'test-mode') {
      this.enrichUserFromToken(parsedUser);
    }

    return parsedUser as ChatUser;
  }

  /**
   * Enrich user data from JWT token payload
   * Extracts role, id, and username from token
   */
  private enrichUserFromToken(parsedUser: Partial<ChatUser>): void {
    try {
      const tokenPart = this.token?.split('.')[1];
      if (tokenPart === undefined) return;

      const payload = JSON.parse(atob(tokenPart)) as JWTPayload;

      // Always use role from token (authoritative source for permissions)
      // JWT role is validated server-side, safe to cast
      if (payload.role !== '') {
        parsedUser.role = payload.role as ChatUser['role'];
      }

      // Fill in missing id and username using nullish coalescing assignment
      parsedUser.id ??= payload.id;
      parsedUser.username ??= payload.username;
    } catch (error) {
      console.error('Error parsing token:', error);
    }
  }

  /**
   * Reset state for a new session
   */
  reset(): void {
    this.conversations = [];
    this.availableUsers = [];
    this.currentConversationId = null;
    this.pendingConversation = null;
    this.scheduledMessages = new Map();
    this.pendingFiles = [];
    this.messageQueue = [];
    this.isConnected = false;
    this.reconnectAttempts = 0;
  }

  /**
   * Set pending conversation for lazy creation
   * UI will show chat window, but no DB entry is created yet
   */
  setPendingConversation(targetUser: ChatUser): void {
    this.pendingConversation = {
      targetUser,
      isGroup: false,
    };
    // Clear current conversation since we're in pending mode
    this.currentConversationId = null;
  }

  /**
   * Clear pending conversation (after successful creation or cancel)
   */
  clearPendingConversation(): void {
    this.pendingConversation = null;
  }

  /**
   * Check if we have a pending (unsaved) conversation
   */
  hasPendingConversation(): boolean {
    return this.pendingConversation !== null;
  }

  /**
   * Get current conversation
   */
  getCurrentConversation(): Conversation | undefined {
    if (this.currentConversationId === null) return undefined;
    return this.conversations.find((c) => c.id === this.currentConversationId);
  }

  /**
   * Update conversation with new message
   */
  updateConversationWithMessage(conversationId: number, message: Message): void {
    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (!conversation) return;

    conversation.lastMessage = message;
    conversation.updatedAt = message.createdAt;

    if (conversationId !== this.currentConversationId) {
      conversation.unreadCount = (conversation.unreadCount ?? 0) + 1;
    }

    // Sort conversations by last update
    this.conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Clear unread count for conversation
   */
  clearUnreadCount(conversationId: number): void {
    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (conversation) {
      conversation.unreadCount = 0;
    }
  }

  /**
   * Add typing user to conversation
   */
  addTypingUser(conversationId: number, userId: number): void {
    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (!conversation) return;

    conversation.typingUsers ??= [];
    if (!conversation.typingUsers.includes(userId)) {
      conversation.typingUsers.push(userId);
    }
  }

  /**
   * Remove typing user from conversation
   */
  removeTypingUser(conversationId: number, userId: number): void {
    const conversation = this.conversations.find((c) => c.id === conversationId);
    if (!conversation?.typingUsers) return;

    conversation.typingUsers = conversation.typingUsers.filter((id) => id !== userId);
  }

  /**
   * Update user status
   */
  updateUserStatus(userId: number, status: 'online' | 'offline' | 'away'): void {
    // Update in available users
    const user = this.availableUsers.find((u) => u.id === userId);
    if (user) {
      user.status = status;
    }

    // Update in all conversations
    this.conversations.forEach((conv) => {
      const participant = conv.participants.find((p) => p.id === userId);
      if (participant) {
        participant.status = status;
      }
    });
  }

  /**
   * Check if user can delete conversations
   */
  canDelete(): boolean {
    return this.currentUser.role === 'admin' || this.currentUser.role === 'root';
  }

  /**
   * Check if user can start new conversations
   * Only root and admin can start new chats
   * Employees can ONLY reply to existing conversations
   */
  canStartChat(): boolean {
    return this.currentUser.role === 'admin' || this.currentUser.role === 'root';
  }

  /**
   * Get scheduled messages for a conversation
   */
  getScheduledMessages(conversationId: number): ScheduledMessage[] {
    return this.scheduledMessages.get(conversationId) ?? [];
  }

  /**
   * Set scheduled messages for a conversation
   */
  setScheduledMessages(conversationId: number, messages: ScheduledMessage[]): void {
    this.scheduledMessages.set(conversationId, messages);
  }

  /**
   * Add a scheduled message to a conversation
   */
  addScheduledMessage(conversationId: number, message: ScheduledMessage): void {
    const existing = this.scheduledMessages.get(conversationId) ?? [];
    existing.push(message);
    // Sort by scheduled time
    existing.sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
    this.scheduledMessages.set(conversationId, existing);
  }

  /**
   * Remove a scheduled message from a conversation
   */
  removeScheduledMessage(conversationId: number, messageId: string): void {
    const existing = this.scheduledMessages.get(conversationId) ?? [];
    const filtered = existing.filter((m) => m.id !== messageId);
    this.scheduledMessages.set(conversationId, filtered);
  }
}

// Singleton instance
let stateInstance: ChatState | null = null;

/**
 * Get chat state singleton
 */
export function getChatState(): ChatState {
  stateInstance ??= new ChatState();
  return stateInstance;
}

/**
 * Reset chat state (for testing or logout)
 */
export function resetChatState(): void {
  if (stateInstance !== null) {
    stateInstance.reset();
  }
  stateInstance = null;
}
