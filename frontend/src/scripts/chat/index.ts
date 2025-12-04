/**
 * Chat Module - Main Orchestrator
 * Entry point and initialization for the chat system
 *
 * PERMISSIONS:
 * - root/admin: Can search all users and start new conversations
 * - employee: Can ONLY reply to existing conversations (no new chat)
 */

import type { Conversation } from './types';
import { getChatState } from './state';
import { $$ } from '../../utils/dom-utils';
import {
  loadConversations,
  loadAvailableUsers,
  loadMessages,
  deleteConversation as apiDeleteConversation,
  markConversationAsRead,
  getConversationScheduledMessages,
} from './api';
import { connectWebSocket, setWebSocketCallbacks, startPeriodicPing } from './websocket';
import {
  renderConversationList,
  renderChatHeader,
  renderPendingChatHeader,
  showChatArea,
  setActiveConversation,
  updateTypingIndicator,
  updateMessageReadIndicator,
} from './ui';
import { displayMessages, displayScheduledMessages, handleNewMessage } from './messages';
import { initUserSearch, initMessageSearch } from './search';
import { sendMessage, setupMessageInput, setupSendButton, setupFileUpload } from './input';
import { setupScheduleHandlers } from './schedule';
import { showNotification, showConfirmDialog } from './utils';

// ============================================================================
// URL Routing Helpers (for /chat/:uuid)
// ============================================================================

/**
 * Extract UUID from URL path (/chat/:uuid)
 * Returns null if on /chat without UUID
 */
function getUuidFromUrl(): string | null {
  const path = window.location.pathname;
  const match = /^\/chat\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(path);
  return match?.[1] ?? null;
}

/**
 * Update URL to include conversation UUID
 * Uses history.pushState for seamless navigation without reload
 */
function updateUrlWithUuid(uuid: string): void {
  const newUrl = `/chat/${uuid}`;
  if (window.location.pathname !== newUrl) {
    window.history.pushState({ conversationUuid: uuid }, '', newUrl);
  }
}

/**
 * Clear UUID from URL (go back to /chat)
 */
function clearUrlUuid(): void {
  if (window.location.pathname !== '/chat') {
    window.history.pushState({}, '', '/chat');
  }
}

// ============================================================================
// ChatClient Class (Thin Orchestrator)
// ============================================================================

/**
 * Main ChatClient class - orchestrates all chat functionality
 */
class ChatClient {
  private initialized = false;

  /**
   * Initialize the chat client
   */
  async init(): Promise<void> {
    const state = getChatState();

    // Prevent multiple initializations
    if (this.initialized) {
      console.warn('ChatClient already initialized');
      return;
    }

    // Check authentication
    if (state.token === null || state.token === '') {
      console.error('No authentication token found');
      window.location.href = '/login';
      return;
    }

    this.initialized = true;

    // Setup WebSocket callbacks
    this.setupWebSocketCallbacks();

    // Load initial data
    await this.loadInitialData();

    // Connect WebSocket
    connectWebSocket();

    // Initialize event listeners
    this.initializeEventListeners();

    // Initialize user search (checks permissions internally)
    initUserSearch((userId) => this.startConversationWithUser(userId));

    // Initialize message search (Ctrl+F style)
    initMessageSearch();

    // Start periodic ping
    startPeriodicPing();

    console.info('ChatClient initialized');
  }

  /**
   * Setup WebSocket event callbacks
   */
  private setupWebSocketCallbacks(): void {
    const state = getChatState();

    setWebSocketCallbacks({
      onConnectionEstablished: () => {
        renderConversationList();
      },

      onNewMessage: (data) => {
        handleNewMessage(data);
        renderConversationList();
      },

      onTypingStart: (data) => {
        if (data.conversationId === state.currentConversationId) {
          state.addTypingUser(data.conversationId, data.userId);
          updateTypingIndicator();
        }
      },

      onTypingStop: (data) => {
        if (data.conversationId === state.currentConversationId) {
          state.removeTypingUser(data.conversationId, data.userId);
          updateTypingIndicator();
        }
      },

      onUserStatus: (data) => {
        state.updateUserStatus(data.userId, data.status as 'online' | 'offline' | 'away');
        if (state.getCurrentConversation()?.participants.some((p) => p.id === data.userId) === true) {
          renderChatHeader();
        }
      },

      onMessageRead: (data) => {
        updateMessageReadIndicator(data.messageId);
      },

      onError: (error) => {
        console.error('WebSocket error:', error);
      },
    });
  }

  /**
   * Load initial data (conversations and users)
   * Checks URL for UUID and auto-selects that conversation
   */
  async loadInitialData(): Promise<void> {
    const state = getChatState();

    try {
      // Load conversations
      state.conversations = await loadConversations();
      renderConversationList();

      // Load available users (needed for search)
      state.availableUsers = await loadAvailableUsers();

      // Check URL for UUID and auto-select conversation
      const urlUuid = getUuidFromUrl();
      if (urlUuid !== null) {
        const conversation = state.conversations.find((c: Conversation) => c.uuid === urlUuid);
        if (conversation !== undefined) {
          // Auto-select the conversation from URL
          void this.selectConversation(conversation.id);
        } else {
          // UUID not found - clear URL
          console.warn('Conversation UUID not found:', urlUuid);
          clearUrlUuid();
        }
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      showNotification('Fehler beim Laden der Daten', 'error');
    }
  }

  /**
   * Initialize all event listeners
   */
  private initializeEventListeners(): void {
    // Message input
    setupMessageInput(() => sendMessage());
    setupSendButton(() => sendMessage());

    // File upload
    setupFileUpload();

    // Schedule message handlers
    setupScheduleHandlers();

    // Delete conversation button
    this.setupDeleteButton();

    // Conversation list click delegation
    this.setupConversationListClicks();

    // Handle browser back/forward navigation
    this.setupPopstateHandler();
  }

  /**
   * Setup handler for browser back/forward navigation
   * Syncs chat view with URL when user navigates history
   */
  private setupPopstateHandler(): void {
    window.addEventListener('popstate', () => {
      const state = getChatState();
      const urlUuid = getUuidFromUrl();

      if (urlUuid !== null) {
        // Find and select the conversation
        const conversation = state.conversations.find((c: Conversation) => c.uuid === urlUuid);
        if (conversation !== undefined && conversation.id !== state.currentConversationId) {
          void this.selectConversationWithoutUrlUpdate(conversation.id);
        }
      } else {
        // No UUID in URL - deselect current conversation
        state.currentConversationId = null;
        renderConversationList();
      }
    });
  }

  /**
   * Select conversation without updating URL (for popstate handling)
   */
  private async selectConversationWithoutUrlUpdate(conversationId: number): Promise<void> {
    const state = getChatState();
    state.currentConversationId = conversationId;

    // Update UI
    setActiveConversation(conversationId);

    // Clear unread count
    state.clearUnreadCount(conversationId);
    renderConversationList();

    // Mark as read
    await markConversationAsRead(conversationId);

    // Load messages
    try {
      const messages = await loadMessages(conversationId);
      displayMessages(messages);

      // Load and display scheduled messages
      const scheduled = await getConversationScheduledMessages(conversationId);
      state.setScheduledMessages(conversationId, scheduled);
      displayScheduledMessages(scheduled);
    } catch (error) {
      console.error('Error loading messages:', error);
      showNotification('Fehler beim Laden der Nachrichten', 'error');
    }

    // Update header
    renderChatHeader();

    // Show chat area
    showChatArea();

    // Update navigation badge
    if (window.unifiedNav !== undefined && typeof window.unifiedNav.updateUnreadMessages === 'function') {
      void window.unifiedNav.updateUnreadMessages();
    }
  }

  /**
   * Setup conversation list click handlers
   */
  private setupConversationListClicks(): void {
    const conversationsList = $$('#conversationsList');
    if (conversationsList === null) return;

    conversationsList.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.conversation-item');
      if (item !== null) {
        const conversationId = Number.parseInt(item.getAttribute('data-conversation-id') ?? '0', 10);
        if (conversationId !== 0) {
          void this.selectConversation(conversationId);
        }
      }
    });
  }

  /**
   * Setup delete button (admin/root only)
   * Employees cannot delete conversations - button stays hidden
   */
  private setupDeleteButton(): void {
    const state = getChatState();
    const deleteBtn = $$('#deleteConversationBtn');

    if (deleteBtn === null) return;

    // Button is hidden by default in HTML
    // Only show for admin/root who can delete
    if (!state.canDelete()) return;

    // Show button and add click handler for admin/root
    deleteBtn.classList.remove('hidden');
    deleteBtn.addEventListener('click', () => {
      void this.deleteCurrentConversation();
    });
  }

  /**
   * Select a conversation
   * Updates URL with conversation UUID for shareable links
   */
  async selectConversation(conversationId: number): Promise<void> {
    const state = getChatState();
    state.currentConversationId = conversationId;

    // Update URL with conversation UUID
    const conversation = state.conversations.find((c: Conversation) => c.id === conversationId);
    if (conversation?.uuid !== undefined) {
      updateUrlWithUuid(conversation.uuid);
    }

    // Update UI
    setActiveConversation(conversationId);

    // Clear unread count
    state.clearUnreadCount(conversationId);
    renderConversationList();

    // Mark as read
    await markConversationAsRead(conversationId);

    // Load messages
    try {
      const messages = await loadMessages(conversationId);
      displayMessages(messages);

      // Load and display scheduled messages
      const scheduled = await getConversationScheduledMessages(conversationId);
      state.setScheduledMessages(conversationId, scheduled);
      displayScheduledMessages(scheduled);
    } catch (error) {
      console.error('Error loading messages:', error);
      showNotification('Fehler beim Laden der Nachrichten', 'error');
    }

    // Update header
    renderChatHeader();

    // Show chat area
    showChatArea();

    // Update navigation badge
    if (window.unifiedNav !== undefined && typeof window.unifiedNav.updateUnreadMessages === 'function') {
      void window.unifiedNav.updateUnreadMessages();
    }
  }

  /**
   * Start conversation with a specific user
   * Called from search.ts when user is selected
   *
   * LAZY CREATION: Does NOT create conversation in DB immediately.
   * Instead, sets a pending conversation state and shows the chat UI.
   * The actual conversation is created when the first message is sent.
   */
  async startConversationWithUser(userId: number): Promise<void> {
    const state = getChatState();

    // Check permission
    if (!state.canStartChat()) {
      showNotification('Sie haben keine Berechtigung, neue Chats zu starten', 'error');
      return;
    }

    // Check if conversation already exists with this user
    const existingConv = state.conversations.find(
      (conv) => !conv.isGroup && conv.participants.some((p) => p.id === userId),
    );

    if (existingConv !== undefined) {
      // Select existing conversation - no need to create
      await this.selectConversation(existingConv.id);
      return;
    }

    // Find the target user from available users
    const targetUser = state.availableUsers.find((u) => u.id === userId);
    if (targetUser === undefined) {
      showNotification('Benutzer nicht gefunden', 'error');
      return;
    }

    // LAZY CREATION: Set pending conversation state instead of creating in DB
    // Conversation will be created when first message is sent
    state.setPendingConversation(targetUser);

    // Show pending chat UI
    this.showPendingConversation();
  }

  /**
   * Show UI for pending conversation (not yet created in DB)
   * Displays chat area with target user info, ready to send first message
   */
  private showPendingConversation(): void {
    const state = getChatState();

    if (state.pendingConversation === null) return;

    // Clear any active conversation selection
    renderConversationList();

    // Render pending chat header
    renderPendingChatHeader(state.pendingConversation.targetUser);

    // Clear messages area (empty for new conversation)
    const messagesContainer = document.querySelector('#chatArea .messages-list, #messagesContainer');
    if (messagesContainer !== null) {
      messagesContainer.innerHTML = '';
    }

    // Show chat area
    showChatArea();

    // Clear URL (no UUID yet since conversation doesn't exist)
    clearUrlUuid();
  }

  /**
   * Delete current conversation
   */
  async deleteCurrentConversation(): Promise<void> {
    const state = getChatState();

    console.log('[DEBUG] deleteCurrentConversation called');
    console.log('[DEBUG] currentConversationId:', state.currentConversationId);

    if (state.currentConversationId === null) {
      console.log('[DEBUG] currentConversationId is NULL - aborting');
      return;
    }

    console.log('[DEBUG] Calling showConfirmDialog...');
    const confirmed = await showConfirmDialog('Möchten Sie diese Unterhaltung wirklich löschen?');
    console.log('[DEBUG] showConfirmDialog returned:', confirmed);
    if (!confirmed) return;

    try {
      await apiDeleteConversation(state.currentConversationId);
      showNotification('Unterhaltung gelöscht', 'success');

      // Reload page
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      showNotification('Fehler beim Löschen der Unterhaltung', 'error');
    }
  }
}

// ============================================================================
// Initialize on DOM Ready
// ============================================================================

let chatClient: ChatClient | null = null;

document.addEventListener('DOMContentLoaded', () => {
  // Only create if not already created
  if (window.chatClient === undefined) {
    chatClient = new ChatClient();

    // Initialize
    void chatClient.init();

    // Export to window for backwards compatibility
    window.chatClient = chatClient;
  }
});

export { ChatClient };
