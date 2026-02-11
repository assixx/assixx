// =============================================================================
// CHAT PAGE STATE - Business Logic & State Management
// =============================================================================
//
// Extracted from +page.svelte for maintainability (< 700 LOC per file).
// MUST be called during component initialization (for $effect to register).
//
// Pattern: Svelte 5 factory function with $state/$derived/$effect.
// Returns an object with getters/setters for template binding.

import { browser } from '$app/environment';
import { invalidateAll } from '$app/navigation';

import { notificationStore } from '$lib/stores/notification.store.svelte';
import {
  showAlert,
  showErrorAlert,
  showSuccessAlert,
  showWarningAlert,
} from '$lib/utils';
import { createLogger } from '$lib/utils/logger';
import {
  getNotificationSSE,
  type NotificationEvent,
} from '$lib/utils/notification-sse';

import { markConversationAsRead as apiMarkConversationAsRead } from './api';
import {
  cancelScheduledMessage,
  uploadMessageFiles,
  scheduleMessage,
  sendImmediateMessage,
} from './chat-message-pipeline';
import { MESSAGES } from './constants';
import { decryptLoadedMessages } from './e2e-handlers';
import * as handlers from './handlers';
import {
  getChatPartner,
  getChatPartnerName,
  filterMessagesByQuery,
  formatScheduleTime,
} from './utils';
import {
  addTypingUser,
  removeTypingUser,
  updateConversationsUserStatus,
  markMessageAsRead,
  updateConversationWithMessage,
  buildRequestPresenceMessage,
} from './websocket';

import type { WebSocketCallbacks } from './handlers';
import type {
  ChatUser,
  Conversation,
  FilePreviewItem,
  Message,
  MessagesAreaRef,
  PreviewFile,
  ScheduledMessage,
  UserRole,
  UserStatus,
} from './types';

const log = createLogger('ChatPageState');

/** SSR data access — reactive getters that return current values */
export interface ChatPageDeps {
  getSsrUser: () => { id: number; email: string; role: UserRole } | null;
  getSsrConversations: () => Conversation[];
  getSsrTenantId: () => number;
}

/**
 * Create all chat page state, derived values, effects, and handlers.
 * MUST be called during Svelte component initialization (for $effect registration).
 */
// eslint-disable-next-line max-lines-per-function -- factory owns all page state and handlers
export function createChatPageState(deps: ChatPageDeps) {
  // ==========================================================================
  // STATE
  // ==========================================================================

  let conversations: Conversation[] = $state([]);
  let activeConversation: Conversation | null = $state(null);
  let messages: Message[] = $state([]);
  let scheduledMessages: ScheduledMessage[] = $state([]);
  let isLoadingMessages = $state(false);
  let messageInput = $state('');
  let showSearchBar = $state(false);
  let searchQuery = $state('');
  let debouncedSearchQuery = $state('');
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let currentSearchIndex = $state(0);
  let userSearchQuery = $state('');
  let userSearchResults: ChatUser[] = $state([]);
  let showUserSearch = $state(false);
  let isSearchingUsers = $state(false);
  let selectedFiles: FilePreviewItem[] = $state([]);
  let fileInputRef: HTMLInputElement | null = $state(null);
  let showScheduleModal = $state(false);
  let scheduleDate = $state('');
  let scheduleTimeInput = $state('');
  let scheduleError = $state('');
  let scheduledFor: Date | null = $state(null);
  let showConfirmDialog = $state(false);
  let confirmMessage = $state('');
  let confirmCallback = $state<(() => void | Promise<void>) | null>(null);
  let previewImage: PreviewFile | null = $state(null);
  let typingUsers: number[] = $state([]);
  let isDisconnected = $state(false);
  let sseUnsubscribe: (() => void) | null = null;
  let messagesAreaRef = $state<MessagesAreaRef | null>(null);
  let previousMessageCount = $state(0);
  let lastMessageId = $state<number | null>(null);

  // ==========================================================================
  // DERIVED
  // ==========================================================================

  const currentUser = $derived.by<ChatUser | null>(() => {
    const user = deps.getSsrUser();
    if (user === null || (user as unknown) === undefined) return null;
    return {
      id: user.id,
      username: user.email,
      email: user.email,
      role: user.role,
    };
  });

  const isAdmin = $derived(
    currentUser?.role === 'admin' || currentUser?.role === 'root',
  );
  const canStartNewConversation = $derived(isAdmin);
  const chatPartner = $derived.by(() =>
    getChatPartner(activeConversation, currentUser?.id ?? 0),
  );
  const chatPartnerName = $derived.by(() =>
    getChatPartnerName(chatPartner, activeConversation?.name),
  );
  const chatPartnerStatus = $derived.by(() => chatPartner?.status ?? 'offline');
  const filteredMessages = $derived.by(() =>
    filterMessagesByQuery(messages, debouncedSearchQuery),
  );
  const searchResultCount = $derived(filteredMessages.length);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Debounce search query (300ms)
  $effect(() => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      debouncedSearchQuery = searchQuery;
    }, 300);
    return () => {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    };
  });

  // Smart scroll: only scroll on NEW messages, not isRead updates
  $effect(() => {
    const currentCount = messages.length;
    const lastMsg = messages[messages.length - 1] as Message | undefined;
    const currentLastId = lastMsg !== undefined ? lastMsg.id : null;
    const hasNewMessage =
      currentCount > previousMessageCount ||
      (currentCount > 0 && previousMessageCount === 0) ||
      (currentLastId !== null && currentLastId !== lastMessageId);
    if (hasNewMessage && messagesAreaRef !== null) {
      const ref = messagesAreaRef;
      requestAnimationFrame(() => {
        ref.scrollToBottom();
      });
    }
    previousMessageCount = currentCount;
    lastMessageId = currentLastId;
  });

  // ==========================================================================
  // WEBSOCKET CALLBACKS
  // ==========================================================================

  /** Handle incoming message from WebSocket — updates messages + sidebar */
  function handleNewMessage(newMessage: Message): void {
    const isActiveConv = activeConversation?.id === newMessage.conversationId;
    const isOwnMessage = newMessage.senderId === currentUser?.id;
    if (isActiveConv) {
      messages = [...messages, newMessage];
      if (!isOwnMessage)
        void apiMarkConversationAsRead(newMessage.conversationId);
    } else if (!isOwnMessage) {
      notificationStore.incrementCount('chat');
    }
    conversations = updateConversationWithMessage(
      conversations,
      newMessage.conversationId,
      newMessage,
      isActiveConv,
      currentUser?.id ?? 0,
    );
    typingUsers = removeTypingUser(typingUsers, newMessage.senderId);
  }

  /** Handle user status change — updates sidebar + active conversation */
  function handleUserStatus(userId: number, status: string): void {
    conversations = updateConversationsUserStatus(
      conversations,
      userId,
      status as UserStatus,
    );
    if (activeConversation !== null) {
      activeConversation = {
        ...activeConversation,
        participants: activeConversation.participants.map((p) =>
          p.id === userId ? { ...p, status: status as UserStatus } : p,
        ),
      };
    }
  }

  function getChatCallbacks(): WebSocketCallbacks {
    return {
      onConnected: () => {
        isDisconnected = false;
        handlers.sendWebSocketMessage(buildRequestPresenceMessage());
      },
      onDisconnect: (permanent: boolean) => {
        isDisconnected = true;
        if (permanent) showNotification(MESSAGES.errorConnectionLost, 'error');
      },
      onNewMessage: handleNewMessage,
      onTypingStart: (conversationId: number, userId: number) => {
        if (activeConversation?.id === conversationId)
          typingUsers = addTypingUser(typingUsers, userId);
      },
      onTypingStop: (conversationId: number, userId: number) => {
        if (activeConversation?.id === conversationId)
          typingUsers = removeTypingUser(typingUsers, userId);
      },
      onUserStatus: handleUserStatus,
      onMessageRead: (messageId: number) => {
        messages = markMessageAsRead(messages, messageId);
      },
      onError: (error: string) => {
        showNotification(error, 'error');
      },
      onAuthError: () => {
        window.location.href = '/login';
      },
      getActiveConversationId: () => activeConversation?.id ?? null,
      getCurrentUserId: () => currentUser?.id ?? 0,
      getTenantId: () => deps.getSsrTenantId(),
      getConversations: () => conversations,
    };
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  function mount(): void {
    if (!browser) return;
    if (deps.getSsrConversations().length > 0) {
      conversations = [...deps.getSsrConversations()];
    }
    notificationStore.suppressSSEType('NEW_MESSAGE');
    const chatCallbacks = getChatCallbacks();
    const existingWs = handlers.getWebSocket();
    if (existingWs !== null && existingWs.readyState === WebSocket.OPEN) {
      handlers.updateCallbacks(chatCallbacks);
      log.info('Requesting presence snapshot from backend');
      handlers.sendWebSocketMessage(buildRequestPresenceMessage());
    } else {
      handlers.updateCallbacks(chatCallbacks);
    }
    const sse = getNotificationSSE();
    sseUnsubscribe = sse.subscribe((event: NotificationEvent) => {
      if (event.type !== 'NEW_MESSAGE') return;
      const messageData = event.data as
        | { conversationId: number; senderId: number; preview?: string }
        | undefined;
      if (messageData === undefined) return;
      log.info(
        {
          conversationId: messageData.conversationId,
          senderId: messageData.senderId,
        },
        'Received scheduled message via SSE',
      );
      if (activeConversation?.id === messageData.conversationId) {
        void reloadActiveConversationMessages();
      } else {
        const convIndex = conversations.findIndex(
          (c) => c.id === messageData.conversationId,
        );
        if (convIndex >= 0) {
          const conv = { ...conversations[convIndex] };
          conv.unreadCount = (conv.unreadCount ?? 0) + 1;
          conv.lastMessage = {
            content: messageData.preview ?? '',
            createdAt: new Date().toISOString(),
          };
          conversations = [
            conv,
            ...conversations.filter((_, i) => i !== convIndex),
          ];
        }
      }
    });
  }

  function destroy(): void {
    handlers.restorePresenceCallbacks();
    notificationStore.unsuppressSSEType('NEW_MESSAGE');
    if (sseUnsubscribe !== null) {
      sseUnsubscribe();
      sseUnsubscribe = null;
    }
  }

  // ==========================================================================
  // CONVERSATION HANDLERS
  // ==========================================================================

  async function reloadActiveConversationMessages(): Promise<void> {
    if (activeConversation === null || activeConversation.isPending === true)
      return;
    try {
      const result = await handlers.loadMessages(activeConversation.id);
      messages = await decryptLoadedMessages(
        result.messages,
        currentUser?.id ?? 0,
        deps.getSsrTenantId(),
        conversations,
      );
      scheduledMessages = result.scheduled;
      updateSidebarPreviewFromMessages(activeConversation.id, messages);
      setTimeout(() => messagesAreaRef?.scrollToBottom(), 50);
    } catch (error) {
      log.error(
        { err: error },
        'Failed to reload messages after SSE notification',
      );
    }
  }

  /**
   * After decrypting loaded messages, update the sidebar conversation preview
   * with the decrypted content of the last E2E message.
   * Without this, the sidebar keeps showing "🔒 Verschlüsselte Nachricht"
   * until a new WebSocket message arrives.
   */
  function updateSidebarPreviewFromMessages(
    conversationId: number,
    decryptedMessages: Message[],
  ): void {
    if (decryptedMessages.length === 0) return;
    const lastMsg = decryptedMessages[decryptedMessages.length - 1];
    if (lastMsg.isE2e !== true) return;
    if (lastMsg.decryptedContent === undefined) return;

    conversations = conversations.map((c) => {
      if (c.id !== conversationId || c.lastMessage === undefined) return c;
      return {
        ...c,
        lastMessage: {
          ...c.lastMessage,
          content: lastMsg.decryptedContent ?? c.lastMessage.content,
        },
      };
    });
  }

  async function selectConversation(conversation: Conversation): Promise<void> {
    activeConversation = conversation;
    messages = [];
    scheduledMessages = [];
    if (conversation.isPending === true) {
      isLoadingMessages = false;
      return;
    }
    isLoadingMessages = true;
    try {
      const result = await handlers.loadMessages(conversation.id);
      messages = await decryptLoadedMessages(
        result.messages,
        currentUser?.id ?? 0,
        deps.getSsrTenantId(),
        conversations,
      );
      scheduledMessages = result.scheduled;
      updateSidebarPreviewFromMessages(conversation.id, messages);
      const conv = conversations.find((c) => c.id === conversation.id);
      if (conv) {
        const unreadToDecrement = conv.unreadCount ?? 0;
        for (let i = 0; i < unreadToDecrement; i++)
          notificationStore.decrementCount('chat');
        conv.unreadCount = 0;
      }
      setTimeout(() => messagesAreaRef?.scrollToBottom(), 50);
    } catch (error) {
      log.error({ err: error }, 'Error loading messages');
      showNotification(MESSAGES.errorLoadMessages, 'error');
    } finally {
      isLoadingMessages = false;
    }
  }

  async function searchUsers(query: string): Promise<void> {
    if (!query.trim()) {
      userSearchResults = [];
      return;
    }
    isSearchingUsers = true;
    try {
      userSearchResults = await handlers.searchUsers(query);
    } finally {
      isSearchingUsers = false;
    }
  }

  async function startConversationWith(user: ChatUser): Promise<void> {
    const result = handlers.startConversationWith(user, conversations);
    if (result.isNew) conversations = [result.conversation, ...conversations];
    await selectConversation(result.conversation);
    userSearchQuery = '';
    userSearchResults = [];
  }

  // ==========================================================================
  // MESSAGE HANDLERS
  // ==========================================================================

  async function persistPendingIfNeeded(): Promise<number | null> {
    if (activeConversation?.isPending !== true)
      return activeConversation?.id ?? null;
    const persistedConversation =
      await handlers.persistPendingConversation(activeConversation);
    const pendingId = activeConversation.id;
    activeConversation = persistedConversation;
    conversations = conversations.map((c) =>
      c.id === pendingId ? persistedConversation : c,
    );
    await invalidateAll();
    log.info(
      { conversationId: persistedConversation.id },
      'Pending conversation persisted on first message',
    );
    return persistedConversation.id;
  }

  /** Route message to schedule or immediate send (extracted for cyclomatic complexity) */
  async function dispatchMessage(
    conversationId: number,
    content: string,
    uploaded: handlers.UploadedAttachmentInfo[],
    schedule: Date | null,
  ): Promise<{ sent: boolean; scheduled?: ScheduledMessage[] }> {
    if (schedule !== null) {
      const result = await scheduleMessage(
        conversationId,
        content,
        schedule,
        uploaded,
        showNotification,
      );
      return { sent: true, scheduled: result ?? undefined };
    }
    return {
      sent: await sendImmediateMessage(
        {
          conversationId,
          content,
          attachments: uploaded,
          isGroup: activeConversation?.isGroup ?? false,
          recipientId: chatPartner?.id ?? null,
          currentUserId: currentUser?.id ?? 0,
          tenantId: deps.getSsrTenantId(),
        },
        showNotification,
      ),
    };
  }

  async function sendMessage(): Promise<void> {
    if (activeConversation === null) return;
    const content = messageInput.trim();
    const filesToSend = [...selectedFiles];
    const capturedSchedule = scheduledFor;
    if (content === '' && filesToSend.length === 0) return;
    handlers.sendTypingStop(activeConversation.id);
    messageInput = '';
    selectedFiles = [];
    scheduledFor = null;
    let conversationId: number | null;
    try {
      conversationId = await persistPendingIfNeeded();
    } catch {
      showNotification(MESSAGES.errorCreateConversation, 'error');
      return;
    }
    if (conversationId === null) return;
    const uploaded = await uploadMessageFiles(
      conversationId,
      filesToSend,
      showNotification,
    );
    if (uploaded === null) return;
    const result = await dispatchMessage(
      conversationId,
      content,
      uploaded,
      capturedSchedule,
    );
    if (result.scheduled !== undefined) scheduledMessages = result.scheduled;
    // eslint-disable-next-line require-atomic-updates -- intentional: restore captured content on E2E failure
    if (!result.sent) messageInput = content;
  }

  // ==========================================================================
  // UI HANDLERS
  // ==========================================================================

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
    if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
      showSearchBar = true;
    }
  }

  function handleTyping(): void {
    if (activeConversation) handlers.sendTypingStart(activeConversation.id);
  }

  function handleFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files === null) return;
    for (const file of input.files) {
      const preview = handlers.createFilePreview(file);
      selectedFiles = [
        ...selectedFiles,
        { ...preview, status: 'pending', progress: 0, documentId: null },
      ];
    }
    input.value = '';
  }

  function removeFile(index: number): void {
    const item = selectedFiles[index];
    if (item.previewUrl !== '') URL.revokeObjectURL(item.previewUrl);
    selectedFiles = selectedFiles.filter((_, i) => i !== index);
  }

  function openScheduleModal(): void {
    const defaults = handlers.getDefaultScheduleDateTime();
    scheduleDate = defaults.date;
    scheduleTimeInput = defaults.time;
    scheduleError = '';
    showScheduleModal = true;
  }

  function confirmSchedule(): void {
    const result = handlers.validateAndSetSchedule(
      scheduleDate,
      scheduleTimeInput,
    );
    if (!result.isValid) {
      scheduleError = result.error ?? MESSAGES.errorScheduleMessage;
      return;
    }
    if (result.date === undefined) return;
    scheduledFor = result.date;
    scheduleError = '';
    showScheduleModal = false;
    showNotification(
      `${MESSAGES.infoScheduledAt} ${formatScheduleTime(scheduledFor)}`,
      'info',
    );
  }

  async function cancelScheduled(scheduled: ScheduledMessage): Promise<void> {
    const result = await cancelScheduledMessage(
      scheduled.id,
      scheduledMessages,
      showNotification,
    );
    // eslint-disable-next-line require-atomic-updates -- intentional: Svelte reactive state, no real race
    if (result !== null) scheduledMessages = result;
  }

  function toggleSearchBar(): void {
    showSearchBar = !showSearchBar;
    if (!showSearchBar) {
      searchQuery = '';
      currentSearchIndex = 0;
    }
  }

  function navigateSearch(direction: 'next' | 'prev'): void {
    if (filteredMessages.length === 0) return;
    const len = filteredMessages.length;
    currentSearchIndex =
      direction === 'next' ?
        (currentSearchIndex + 1) % len
      : (currentSearchIndex - 1 + len) % len;
    document
      .querySelector(
        `[data-message-id="${filteredMessages[currentSearchIndex]?.id}"]`,
      )
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function deleteCurrentConversation(): void {
    if (activeConversation === null) return;
    const conversationId = activeConversation.id;
    const isPending = activeConversation.isPending === true;
    confirmMessage = MESSAGES.confirmDeleteConversation;
    confirmCallback = async () => {
      try {
        if (!isPending) {
          await handlers.deleteConversation(conversationId);
          await invalidateAll();
        }
        conversations = conversations.filter((c) => c.id !== conversationId);
        activeConversation = null;
        messages = [];
        showNotification(MESSAGES.successDeleteConversation, 'success');
      } catch {
        showNotification(MESSAGES.errorDeleteConversation, 'error');
      }
    };
    showConfirmDialog = true;
  }

  function showNotification(
    msg: string,
    type: 'success' | 'error' | 'info' | 'warning',
  ): void {
    log.warn({ type }, msg);
    switch (type) {
      case 'success':
        showSuccessAlert(msg);
        break;
      case 'error':
        showErrorAlert(msg);
        break;
      case 'warning':
        showWarningAlert(msg);
        break;
      case 'info':
        showAlert(msg);
        break;
    }
  }

  // ==========================================================================
  // RETURN — Public API
  // ==========================================================================

  return {
    // Bindable state (template uses bind:)
    get messageInput() {
      return messageInput;
    },
    set messageInput(v: string) {
      messageInput = v;
    },
    get userSearchQuery() {
      return userSearchQuery;
    },
    set userSearchQuery(v: string) {
      userSearchQuery = v;
    },
    get searchQuery() {
      return searchQuery;
    },
    set searchQuery(v: string) {
      searchQuery = v;
    },
    get scheduleDate() {
      return scheduleDate;
    },
    set scheduleDate(v: string) {
      scheduleDate = v;
    },
    get scheduleTimeInput() {
      return scheduleTimeInput;
    },
    set scheduleTimeInput(v: string) {
      scheduleTimeInput = v;
    },
    get fileInputRef() {
      return fileInputRef;
    },
    set fileInputRef(v: HTMLInputElement | null) {
      fileInputRef = v;
    },
    get messagesAreaRef() {
      return messagesAreaRef;
    },
    set messagesAreaRef(v: MessagesAreaRef | null) {
      messagesAreaRef = v;
    },

    // Read-only state
    get conversations() {
      return conversations;
    },
    get activeConversation() {
      return activeConversation;
    },
    get messages() {
      return messages;
    },
    get scheduledMessages() {
      return scheduledMessages;
    },
    get isLoadingMessages() {
      return isLoadingMessages;
    },
    get showSearchBar() {
      return showSearchBar;
    },
    get debouncedSearchQuery() {
      return debouncedSearchQuery;
    },
    get currentSearchIndex() {
      return currentSearchIndex;
    },
    get userSearchResults() {
      return userSearchResults;
    },
    get isSearchingUsers() {
      return isSearchingUsers;
    },
    get showUserSearch() {
      return showUserSearch;
    },
    get selectedFiles() {
      return selectedFiles;
    },
    get showScheduleModal() {
      return showScheduleModal;
    },
    get scheduleError() {
      return scheduleError;
    },
    get scheduledFor() {
      return scheduledFor;
    },
    get showConfirmDialog() {
      return showConfirmDialog;
    },
    get confirmMessage() {
      return confirmMessage;
    },
    get previewImage() {
      return previewImage;
    },
    get typingUsers() {
      return typingUsers;
    },
    get isDisconnected() {
      return isDisconnected;
    },
    get currentUser() {
      return currentUser;
    },
    get isAdmin() {
      return isAdmin;
    },
    get canStartNewConversation() {
      return canStartNewConversation;
    },
    get chatPartner() {
      return chatPartner;
    },
    get chatPartnerName() {
      return chatPartnerName;
    },
    get chatPartnerStatus() {
      return chatPartnerStatus;
    },
    get searchResultCount() {
      return searchResultCount;
    },
    isLoading: false,

    // Lifecycle
    mount,
    destroy,

    // Conversation actions
    selectConversation,
    searchUsers,
    startConversationWith,

    // Message actions
    sendMessage,
    cancelScheduled,

    // UI actions
    handleKeyDown,
    handleTyping,
    handleFileSelect,
    removeFile,
    openScheduleModal,
    confirmSchedule,
    toggleSearchBar,
    navigateSearch,
    deleteCurrentConversation,
    toggleUserSearch: () => {
      showUserSearch = !showUserSearch;
    },
    clearUserSearch: () => {
      userSearchQuery = '';
      userSearchResults = [];
    },
    openImagePreview: (file: PreviewFile) => {
      previewImage = file;
    },
    closeImagePreview: () => {
      previewImage = null;
    },
    clearSchedule: () => {
      scheduledFor = null;
    },
    closeScheduleModal: () => {
      scheduleError = '';
      showScheduleModal = false;
    },
    closeConfirmDialog: () => {
      showConfirmDialog = false;
      confirmCallback = null;
    },
    executeConfirm: () => {
      if (confirmCallback !== null) void confirmCallback();
      showConfirmDialog = false;
      confirmCallback = null;
    },
    openFilePicker: () => {
      fileInputRef?.click();
    },
  };
}
