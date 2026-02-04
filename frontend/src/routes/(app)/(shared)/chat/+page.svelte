<script lang="ts">
  /**
   * Chat Page - SvelteKit Migration
   * Level 3 Hybrid: SSR initial + WebSocket real-time updates
   * Uses Svelte 5 Runes ($state, $derived, $effect)
   */

  import { onMount, onDestroy } from 'svelte';

  import { browser } from '$app/environment';
  import { invalidateAll } from '$app/navigation';

  import { notificationStore } from '$lib/stores/notification.store.svelte';
  import { createLogger } from '$lib/utils/logger';
  import {
    getNotificationSSE,
    type NotificationEvent,
  } from '$lib/utils/notification-sse';

  const log = createLogger('ChatPage');

  import '../../../../styles/chat.css';

  import { markConversationAsRead as apiMarkConversationAsRead } from './_lib/api';
  import ChatHeader from './_lib/ChatHeader.svelte';
  import ChatSidebar from './_lib/ChatSidebar.svelte';
  import ConfirmDialog from './_lib/ConfirmDialog.svelte';
  import { MESSAGES } from './_lib/constants';
  import * as handlers from './_lib/handlers';
  import ImagePreviewModal from './_lib/ImagePreviewModal.svelte';
  import MessageInputArea from './_lib/MessageInputArea.svelte';
  import MessagesArea from './_lib/MessagesArea.svelte';
  import ScheduleModal from './_lib/ScheduleModal.svelte';
  import {
    getChatPartner,
    getChatPartnerName,
    filterMessagesByQuery,
    formatScheduleTime,
  } from './_lib/utils';
  import {
    addTypingUser,
    removeTypingUser,
    updateConversationsUserStatus,
    markMessageAsRead,
    updateConversationWithMessage,
    buildJoinMessage,
    buildSendMessage,
  } from './_lib/websocket';

  import type { PageData } from './$types';
  import type { WebSocketCallbacks } from './_lib/handlers';
  import type {
    ChatUser,
    Conversation,
    Message,
    ScheduledMessage,
    FilePreviewItem,
    UserStatus,
  } from './_lib/types';

  // SSR Data
  const { data }: { data: PageData } = $props();

  // ==========================================================================
  // SSR DATA (single source of truth for initial load)
  // ==========================================================================

  // Derived from SSR data
  const ssrUser = $derived(data.currentUser);
  const ssrConversations = $derived(data.conversations);

  // Current user derived from SSR
  const currentUser = $derived.by<ChatUser | null>(() => {
    if (ssrUser === null) return null;
    return {
      id: ssrUser.id,
      username: ssrUser.email,
      email: ssrUser.email,
      role: ssrUser.role,
    };
  });

  // ==========================================================================
  // HYBRID STATE - SSR initial + WebSocket updates
  // ==========================================================================

  // Conversations: initialized from SSR, updated via WebSocket
  let conversations: Conversation[] = $state([]);
  let activeConversation: Conversation | null = $state(null);
  let messages: Message[] = $state([]);
  let scheduledMessages: ScheduledMessage[] = $state([]);

  // NOTE: SSR conversations sync moved to onMount (best practice per Svelte 5 docs)
  // Reason: Avoid state mutation inside $effect - can cause infinite loops

  // UI State - No loading needed, data from SSR
  const isLoading = $state(false);
  let isLoadingMessages = $state(false);
  let messageInput = $state('');
  let showSearchBar = $state(false);

  // ==========================================================================
  // PERFORMANCE: Debounced search - prevents re-render on every keystroke
  // ==========================================================================
  let searchQuery = $state(''); // Raw input (bound to input field)
  let debouncedSearchQuery = $state(''); // Actual query used for filtering
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Debounce search query changes (300ms delay)
  $effect(() => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);

    searchDebounceTimer = setTimeout(() => {
      debouncedSearchQuery = searchQuery;
    }, 300);

    return () => {
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    };
  });

  let currentSearchIndex = $state(0);

  // User search
  let userSearchQuery = $state('');
  let userSearchResults: ChatUser[] = $state([]);
  let showUserSearch = $state(false);
  let isSearchingUsers = $state(false);

  // Files
  let selectedFiles: FilePreviewItem[] = $state([]);
  let fileInputRef: HTMLInputElement | null = $state(null);

  // Schedule
  let showScheduleModal = $state(false);
  let scheduleDate = $state('');
  let scheduleTime = $state('');
  let scheduleError = $state('');
  let scheduledFor: Date | null = $state(null);

  // Confirm dialog
  let showConfirmDialog = $state(false);
  let confirmMessage = $state('');
  let confirmCallback = $state<(() => void | Promise<void>) | null>(null);

  // Image/PDF preview modal
  interface PreviewFile {
    src: string;
    alt: string;
    /** MIME type for determining preview method (image vs pdf) */
    mimeType?: string;
  }
  let previewImage: PreviewFile | null = $state(null);

  // WebSocket
  let typingUsers: number[] = $state([]);
  let isDisconnected = $state(false);

  // SSE subscription for scheduled messages
  let sseUnsubscribe: (() => void) | null = null;

  // Refs - typed by expected interface, not component type
  interface MessagesAreaRef {
    scrollToBottom: () => void;
  }
  let messagesAreaRef = $state<MessagesAreaRef | null>(null);

  // ==========================================================================
  // DERIVED - Using $derived.by() for function calls (Svelte 5 best practice)
  // ==========================================================================

  const isAdmin = $derived(
    currentUser?.role === 'admin' || currentUser?.role === 'root',
  );
  const canStartNewConversation = $derived(isAdmin);

  // $derived.by() for expressions that call functions
  const chatPartner = $derived.by(() =>
    getChatPartner(activeConversation, currentUser?.id ?? 0),
  );
  const chatPartnerName = $derived.by(() =>
    getChatPartnerName(chatPartner, activeConversation?.name),
  );
  const chatPartnerStatus = $derived.by(() => chatPartner?.status ?? 'offline');
  // Use debounced query for filtering (prevents re-render on every keystroke)
  const filteredMessages = $derived.by(() =>
    filterMessagesByQuery(messages, debouncedSearchQuery),
  );
  const searchResultCount = $derived(filteredMessages.length);

  // ==========================================================================
  // LIFECYCLE - SSR: User and conversations loaded server-side
  // ==========================================================================

  onMount(() => {
    if (!browser) return;

    // Initialize local state from SSR data (one-time, browser-only)
    // Best practice: Do state initialization in onMount, not $effect
    if (ssrConversations.length > 0) {
      conversations = [...ssrConversations];
    }

    // Suppress SSE NEW_MESSAGE in notification store while chat page is mounted.
    // The chat page handles badge updates directly from WebSocket (prevents double-counting).
    notificationStore.suppressSSEType('NEW_MESSAGE');

    // WebSocket is already connected from app layout for presence tracking.
    // Upgrade callbacks to include chat-specific handlers (messages, typing, etc.).
    const chatCallbacks = getChatCallbacks();
    const existingWs = handlers.getWebSocket();

    if (existingWs !== null && existingWs.readyState === WebSocket.OPEN) {
      // WS already connected from layout — just upgrade callbacks and join conversations
      handlers.updateCallbacks(chatCallbacks);
      conversations.forEach((conv) => {
        handlers.sendWebSocketMessage(buildJoinMessage(conv.id));
      });
    } else {
      // Race condition: layout WS not ready yet — update callbacks so they're
      // used when the connection completes. The layout's connectWebSocket will
      // use activeCallbacks (which we just set) for onopen/onmessage.
      handlers.updateCallbacks(chatCallbacks);
    }

    // Subscribe to SSE for scheduled message notifications
    // Scheduled messages are sent via eventBus → SSE (not WebSocket)
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

      // If this is for the active conversation, reload messages to show the new one
      if (activeConversation?.id === messageData.conversationId) {
        void reloadActiveConversationMessages();
      } else {
        // Update unread count for non-active conversation
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
          // Move to top
          conversations = [
            conv,
            ...conversations.filter((_, i) => i !== convIndex),
          ];
        }
      }
    });
  });

  onDestroy(() => {
    // DON'T disconnect WebSocket — it stays alive for presence ("online" status).
    // Just restore presence-only callbacks (removes chat-specific handlers).
    handlers.restorePresenceCallbacks();
    // Re-enable SSE NEW_MESSAGE handling in notification store
    notificationStore.unsuppressSSEType('NEW_MESSAGE');
    // Cleanup SSE subscription
    if (sseUnsubscribe !== null) {
      sseUnsubscribe();
      sseUnsubscribe = null;
    }
  });

  /**
   * Reload messages for the active conversation (used for SSE scheduled message updates)
   */
  async function reloadActiveConversationMessages(): Promise<void> {
    if (activeConversation === null || activeConversation.isPending === true)
      return;

    try {
      const result = await handlers.loadMessages(activeConversation.id);
      messages = result.messages;
      scheduledMessages = result.scheduled;
      setTimeout(() => messagesAreaRef?.scrollToBottom(), 50);
      log.debug(
        { conversationId: activeConversation.id },
        'Reloaded messages after SSE notification',
      );
    } catch (error) {
      log.error(
        { err: error },
        'Failed to reload messages after SSE notification',
      );
    }
  }

  // ==========================================================================
  // PERFORMANCE: Smart scroll - only scroll on NEW messages, not isRead updates
  // ==========================================================================
  let previousMessageCount = $state(0);
  let lastMessageId = $state<number | null>(null);

  $effect(() => {
    const currentCount = messages.length;
    const lastMessage = messages[messages.length - 1] as Message | undefined;
    const currentLastId = lastMessage !== undefined ? lastMessage.id : null;

    // Only scroll if:
    // 1. New message added (count increased AND last message ID changed)
    // 2. Initial load (previousCount was 0)
    const hasNewMessage =
      currentCount > previousMessageCount ||
      (currentCount > 0 && previousMessageCount === 0) ||
      (currentLastId !== null && currentLastId !== lastMessageId);

    if (hasNewMessage && messagesAreaRef !== null) {
      // Capture ref value for async callback (state may change between check and execution)
      const ref = messagesAreaRef;
      requestAnimationFrame(() => {
        ref.scrollToBottom();
      });
    }

    // Update tracking state (must be after the check)
    previousMessageCount = currentCount;
    lastMessageId = currentLastId;
  });

  // ==========================================================================
  // WEBSOCKET
  // ==========================================================================

  /**
   * Build chat-specific WebSocket callbacks.
   * Used by both initial upgrade (from presence) and reconnection.
   */
  function getChatCallbacks(): WebSocketCallbacks {
    return {
      onConnected: () => {
        isDisconnected = false;
        conversations.forEach((conv) => {
          handlers.sendWebSocketMessage(buildJoinMessage(conv.id));
        });
      },
      onDisconnect: (permanent: boolean) => {
        isDisconnected = true;
        if (permanent) {
          showNotification(MESSAGES.errorConnectionLost, 'error');
        }
      },
      onNewMessage: (newMessage: Message) => {
        const isActiveConv =
          activeConversation?.id === newMessage.conversationId;
        const isOwnMessage = newMessage.senderId === currentUser?.id;

        if (isActiveConv) {
          messages = [...messages, newMessage];
          if (!isOwnMessage) {
            void apiMarkConversationAsRead(newMessage.conversationId);
          }
        } else if (!isOwnMessage) {
          // Non-active conversation, not own message → increment sidebar badge
          // (SSE NEW_MESSAGE is suppressed while chat page is mounted)
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
      },
      onTypingStart: (conversationId: number, userId: number) => {
        if (activeConversation?.id === conversationId) {
          typingUsers = addTypingUser(typingUsers, userId);
        }
      },
      onTypingStop: (conversationId: number, userId: number) => {
        if (activeConversation?.id === conversationId) {
          typingUsers = removeTypingUser(typingUsers, userId);
        }
      },
      onUserStatus: (userId: number, status: string) => {
        conversations = updateConversationsUserStatus(
          conversations,
          userId,
          status as UserStatus,
        );
        // Sync activeConversation so ChatHeader status text updates too
        if (activeConversation !== null) {
          activeConversation = {
            ...activeConversation,
            participants: activeConversation.participants.map((p) =>
              p.id === userId ? { ...p, status: status as UserStatus } : p,
            ),
          };
        }
      },
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
      getConversations: () => conversations,
    };
  }

  // ==========================================================================
  // API HANDLERS
  // ==========================================================================

  async function selectConversation(conversation: Conversation): Promise<void> {
    activeConversation = conversation;
    messages = [];
    scheduledMessages = [];

    // LAZY CREATION: Pending conversations have no messages to load
    // They only exist locally until first message is sent
    if (conversation.isPending === true) {
      isLoadingMessages = false;
      return;
    }

    isLoadingMessages = true;

    try {
      const result = await handlers.loadMessages(conversation.id);
      messages = result.messages;
      scheduledMessages = result.scheduled;

      const conv = conversations.find((c) => c.id === conversation.id);
      if (conv) {
        // Decrement notification badge by number of unread messages in this conversation
        const unreadToDecrement = conv.unreadCount ?? 0;
        for (let i = 0; i < unreadToDecrement; i++) {
          notificationStore.decrementCount('chat');
        }
        conv.unreadCount = 0;
      }

      handlers.sendWebSocketMessage(buildJoinMessage(conversation.id));
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
    if (result.isNew) {
      // LAZY CREATION: Only add to local state, NOT persisted to DB yet
      // Conversation will be created when first message is sent
      conversations = [result.conversation, ...conversations];
    }
    await selectConversation(result.conversation);
    userSearchQuery = '';
    userSearchResults = [];
  }

  // ==========================================================================
  // MESSAGE HANDLERS
  // ==========================================================================

  /** Upload files and return attachment info, or null on failure */
  async function uploadFiles(
    conversationId: number,
    files: FilePreviewItem[],
  ): Promise<handlers.UploadedAttachmentInfo[] | null> {
    if (files.length === 0) return [];

    const uploaded = await handlers.uploadFiles(
      conversationId,
      files.map((f) => f.file),
    );

    if (uploaded.length === 0 && files.length > 0) {
      showNotification(MESSAGES.errorUploadFiles, 'error');
      return null;
    }

    return uploaded;
  }

  /**
   * Persist a pending conversation to the database and update local state.
   * @returns The persisted conversation ID, or null if failed
   */
  async function persistPendingIfNeeded(): Promise<number | null> {
    if (activeConversation?.isPending !== true) {
      return activeConversation?.id ?? null;
    }

    const persistedConversation =
      await handlers.persistPendingConversation(activeConversation);
    const pendingId = activeConversation.id;

    // Update local state with persisted conversation
    activeConversation = persistedConversation;

    // Replace pending conversation in list with persisted one
    conversations = conversations.map((c) =>
      c.id === pendingId ? persistedConversation : c,
    );

    // Reload SSR data to sync with server
    await invalidateAll();

    // Join the new conversation's WebSocket room
    handlers.sendWebSocketMessage(buildJoinMessage(persistedConversation.id));

    log.info(
      { conversationId: persistedConversation.id },
      'Pending conversation persisted on first message',
    );
    return persistedConversation.id;
  }

  /** Send a scheduled message */
  async function sendScheduledMsg(
    conversationId: number,
    content: string,
    scheduleTime: Date,
    attachments: handlers.UploadedAttachmentInfo[],
  ): Promise<void> {
    try {
      scheduledMessages = await handlers.sendScheduledMessage(
        conversationId,
        content,
        scheduleTime,
        attachments,
      );
      showNotification(MESSAGES.successScheduled, 'success');
    } catch {
      showNotification(MESSAGES.errorScheduleMessage, 'error');
    }
  }

  /** Send an immediate message via WebSocket */
  function sendImmediateMsg(
    conversationId: number,
    content: string,
    attachments: handlers.UploadedAttachmentInfo[],
  ): void {
    const attachmentIds = attachments.map((a) => a.id);
    const sent = handlers.sendWebSocketMessage(
      buildSendMessage(conversationId, content, attachmentIds),
    );
    if (!sent) {
      showNotification(MESSAGES.errorConnectionRetry, 'error');
    }
  }

  async function sendMessage(): Promise<void> {
    if (activeConversation === null) return;

    // Capture values before any async operations to prevent race conditions
    const content = messageInput.trim();
    const filesToSend = [...selectedFiles];
    const scheduleTime = scheduledFor;

    if (content === '' && filesToSend.length === 0) return;

    // Stop typing indicator immediately when sending a message
    handlers.sendTypingStop(activeConversation.id);

    // Clear inputs immediately to prevent double-sends
    messageInput = '';
    selectedFiles = [];
    scheduledFor = null;

    // LAZY CREATION: Persist pending conversation first if needed
    let conversationId: number | null;
    try {
      conversationId = await persistPendingIfNeeded();
    } catch {
      showNotification(MESSAGES.errorCreateConversation, 'error');
      return;
    }
    if (conversationId === null) return;

    const uploadedAttachments = await uploadFiles(conversationId, filesToSend);
    if (uploadedAttachments === null) return;

    if (scheduleTime !== null) {
      await sendScheduledMsg(
        conversationId,
        content,
        scheduleTime,
        uploadedAttachments,
      );
    } else {
      sendImmediateMsg(conversationId, content, uploadedAttachments);
    }
  }

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
    if (activeConversation) {
      handlers.sendTypingStart(activeConversation.id);
    }
  }

  // ==========================================================================
  // FILE HANDLERS
  // ==========================================================================

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

  // ==========================================================================
  // SCHEDULE HANDLERS
  // ==========================================================================

  function openScheduleModal(): void {
    const defaults = handlers.getDefaultScheduleDateTime();
    scheduleDate = defaults.date;
    scheduleTime = defaults.time;
    scheduleError = '';
    showScheduleModal = true;
  }

  function confirmSchedule(): void {
    const result = handlers.validateAndSetSchedule(scheduleDate, scheduleTime);
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
    try {
      await handlers.cancelScheduledMessage(scheduled.id);
      scheduledMessages = scheduledMessages.filter(
        (s) => s.id !== scheduled.id,
      );
      showNotification(MESSAGES.successCancelScheduled, 'success');
    } catch {
      showNotification(MESSAGES.errorCancelScheduled, 'error');
    }
  }

  // ==========================================================================
  // SEARCH & DELETE
  // ==========================================================================

  function toggleSearchBar(): void {
    showSearchBar = !showSearchBar;
    if (!showSearchBar) {
      searchQuery = '';
      currentSearchIndex = 0;
    }
  }

  function navigateSearch(direction: 'next' | 'prev'): void {
    const results = filteredMessages;
    if (results.length === 0) return;

    currentSearchIndex =
      direction === 'next' ?
        (currentSearchIndex + 1) % results.length
      : (currentSearchIndex - 1 + results.length) % results.length;

    const messageId = results[currentSearchIndex]?.id;
    if (messageId) {
      document
        .querySelector(`[data-message-id="${messageId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function deleteCurrentConversation(): void {
    if (activeConversation === null) return;

    const conversationId = activeConversation.id;
    const isPending = activeConversation.isPending === true;

    confirmMessage = MESSAGES.confirmDeleteConversation;
    confirmCallback = async () => {
      try {
        // LAZY CREATION: Pending conversations only exist locally, no API call needed
        if (!isPending) {
          await handlers.deleteConversation(conversationId);
          // Reload SSR data after structural change
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

  // ==========================================================================
  // IMAGE PREVIEW
  // ==========================================================================

  function openImagePreview(file: PreviewFile): void {
    previewImage = file;
  }

  function closeImagePreview(): void {
    previewImage = null;
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  function showNotification(
    message: string,
    type: 'success' | 'error' | 'info' | 'warning',
  ): void {
    log.warn({ type }, message);
    // TODO: Integrate with toast store
  }
</script>

<svelte:head>
  <title>Chat - Assixx</title>
</svelte:head>

<main class="chat-page-main">
  <div class="chat-container">
    <ChatSidebar
      {conversations}
      activeConversationId={activeConversation?.id ?? null}
      currentUserId={currentUser?.id ?? 0}
      {canStartNewConversation}
      {showUserSearch}
      bind:userSearchQuery
      {userSearchResults}
      {isSearchingUsers}
      {isLoading}
      ontoggleusersearch={() => (showUserSearch = !showUserSearch)}
      onsearchusers={searchUsers}
      onclearusersearch={() => {
        userSearchQuery = '';
        userSearchResults = [];
      }}
      onstartconversation={startConversationWith}
      onselectconversation={selectConversation}
    />

    <div class="chat-main">
      {#if isDisconnected}
        <div
          class="connection-lost-banner"
          role="alert"
        >
          <i class="fas fa-exclamation-triangle"></i>
          <span>{MESSAGES.reconnecting}</span>
        </div>
      {/if}
      {#if activeConversation}
        <ChatHeader
          conversation={activeConversation}
          partner={chatPartner ?? undefined}
          partnerName={chatPartnerName}
          partnerStatus={chatPartnerStatus}
          currentUserId={currentUser?.id ?? 0}
          {isAdmin}
          {showSearchBar}
          bind:searchQuery
          {searchResultCount}
          {currentSearchIndex}
          ontogglesearch={toggleSearchBar}
          onnavigateprev={() => {
            navigateSearch('prev');
          }}
          onnavigatenext={() => {
            navigateSearch('next');
          }}
          ondelete={deleteCurrentConversation}
        />

        <MessagesArea
          bind:this={messagesAreaRef}
          {messages}
          {scheduledMessages}
          currentUserId={currentUser?.id ?? 0}
          searchQuery={debouncedSearchQuery}
          isLoading={isLoadingMessages}
          oncancelscheduled={cancelScheduled}
          onimageclick={openImagePreview}
        />

        {#if typingUsers.length > 0}
          <div class="typing-indicator">
            <span class="typing-dots"
              ><span></span><span></span><span></span></span
            >
            <span class="typing-text">{MESSAGES.labelTyping}</span>
          </div>
        {/if}
        <MessageInputArea
          bind:messageInput
          {selectedFiles}
          {scheduledFor}
          onsend={sendMessage}
          onkeydown={handleKeyDown}
          oninput={handleTyping}
          onopenfilepicker={() => fileInputRef?.click()}
          onremovefile={removeFile}
          onopenschedule={openScheduleModal}
          onclearschedule={() => (scheduledFor = null)}
        />
      {:else}
        <div class="messages-container loaded">
          <div class="empty-chat">
            <div class="empty-chat-icon">
              <i class="fas fa-comments"></i>
            </div>
            <h3>{MESSAGES.emptyWelcome}</h3>
            <p>{MESSAGES.emptySelectConversation}</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
</main>

<input
  type="file"
  class="hidden"
  multiple
  bind:this={fileInputRef}
  onchange={handleFileSelect}
/>

<ScheduleModal
  show={showScheduleModal}
  bind:date={scheduleDate}
  bind:time={scheduleTime}
  errorMessage={scheduleError}
  onclose={() => {
    scheduleError = '';
    showScheduleModal = false;
  }}
  onconfirm={confirmSchedule}
/>

<ConfirmDialog
  show={showConfirmDialog}
  message={confirmMessage}
  onclose={() => {
    showConfirmDialog = false;
    confirmCallback = null;
  }}
  onconfirm={() => {
    if (confirmCallback !== null) void confirmCallback();
    showConfirmDialog = false;
    confirmCallback = null;
  }}
/>

<ImagePreviewModal
  show={previewImage !== null}
  image={previewImage}
  onclose={closeImagePreview}
/>

<style>
  .hidden {
    display: none !important;
  }
</style>
