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

  const log = createLogger('ChatPage');

  import '../../../styles/chat.css';

  import { markConversationAsRead as apiMarkConversationAsRead } from './_lib/api';
  import ChatHeader from './_lib/ChatHeader.svelte';
  import ChatSidebar from './_lib/ChatSidebar.svelte';
  import ConfirmDialog from './_lib/ConfirmDialog.svelte';
  import { MESSAGES } from './_lib/constants';
  import * as handlers from './_lib/handlers';
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
  let scheduledFor: Date | null = $state(null);

  // Confirm dialog
  let showConfirmDialog = $state(false);
  let confirmMessage = $state('');
  let confirmCallback = $state<(() => void | Promise<void>) | null>(null);

  // WebSocket
  let typingUsers: number[] = $state([]);

  // Refs - typed by expected interface, not component type
  interface MessagesAreaRef {
    scrollToBottom: () => void;
  }
  let messagesAreaRef = $state<MessagesAreaRef | null>(null);

  // ==========================================================================
  // DERIVED - Using $derived.by() for function calls (Svelte 5 best practice)
  // ==========================================================================

  const isAdmin = $derived(currentUser?.role === 'admin' || currentUser?.role === 'root');
  const canStartNewConversation = $derived(isAdmin);

  // $derived.by() for expressions that call functions
  const chatPartner = $derived.by(() => getChatPartner(activeConversation, currentUser?.id ?? 0));
  const chatPartnerName = $derived.by(() =>
    getChatPartnerName(chatPartner, activeConversation?.name),
  );
  const chatPartnerStatus = $derived.by(() => chatPartner?.status ?? 'offline');
  // Use debounced query for filtering (prevents re-render on every keystroke)
  const filteredMessages = $derived.by(() => filterMessagesByQuery(messages, debouncedSearchQuery));
  const searchResultCount = $derived(filteredMessages.length);

  // ==========================================================================
  // LIFECYCLE - SSR: User and conversations loaded server-side
  // ==========================================================================

  onMount(() => {
    if (!browser) return;

    // Reset chat notification count when visiting the chat page
    notificationStore.resetCount('chat');

    // Initialize local state from SSR data (one-time, browser-only)
    // Best practice: Do state initialization in onMount, not $effect
    if (ssrConversations.length > 0) {
      conversations = [...ssrConversations];
    }

    // SSR already loaded conversations and user data
    // Just need to connect WebSocket for real-time updates
    // Auth handled by connection ticket (fetched inside connectWebSocket)
    void connectWebSocket();
    handlers.startPeriodicPing();
  });

  onDestroy(() => {
    handlers.disconnectWebSocket();
  });

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
   * Connect to WebSocket using connection ticket
   * SECURITY: Uses short-lived, single-use ticket instead of JWT to prevent token leakage
   * @see docs/TOKEN-SECURITY-REFACTORING-PLAN.md
   */
  async function connectWebSocket(): Promise<void> {
    await handlers.connectWebSocket({
      onConnected: () => {
        conversations.forEach((conv) => {
          handlers.sendWebSocketMessage(buildJoinMessage(conv.id));
        });
      },
      onNewMessage: (newMessage: Message) => {
        if (activeConversation?.id === newMessage.conversationId) {
          messages = [...messages, newMessage];
          if (newMessage.senderId !== currentUser?.id) {
            void apiMarkConversationAsRead(newMessage.conversationId);
          }
        }
        conversations = updateConversationWithMessage(
          conversations,
          newMessage.conversationId,
          newMessage,
          activeConversation?.id === newMessage.conversationId,
          currentUser?.id ?? 0,
        );
        typingUsers = removeTypingUser(typingUsers, newMessage.senderId);
      },
      onTypingStart: (conversationId: number, userId: number) => {
        if (activeConversation?.id === conversationId) {
          typingUsers = addTypingUser(typingUsers, userId);
        }
      },
      onTypingStop: (userId: number) => {
        typingUsers = removeTypingUser(typingUsers, userId);
      },
      onUserStatus: (userId: number, status: string) => {
        conversations = updateConversationsUserStatus(conversations, userId, status as UserStatus);
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
    });
  }

  // ==========================================================================
  // API HANDLERS
  // ==========================================================================

  async function selectConversation(conversation: Conversation): Promise<void> {
    activeConversation = conversation;
    messages = [];
    scheduledMessages = [];
    isLoadingMessages = true;

    try {
      const result = await handlers.loadMessages(conversation.id);
      messages = result.messages;
      scheduledMessages = result.scheduled;

      const conv = conversations.find((c) => c.id === conversation.id);
      if (conv) conv.unreadCount = 0;

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
    try {
      const result = await handlers.startConversationWith(user, conversations);
      if (result.isNew) {
        // New conversation created - reload SSR data and update local state
        await invalidateAll();
        conversations = [result.conversation, ...conversations];
      }
      await selectConversation(result.conversation);
      userSearchQuery = '';
      userSearchResults = [];
    } catch {
      showNotification(MESSAGES.errorCreateConversation, 'error');
    }
  }

  // ==========================================================================
  // MESSAGE HANDLERS
  // ==========================================================================

  /** Upload files and return attachment IDs, or null on failure */
  async function uploadFiles(
    conversationId: number,
    files: FilePreviewItem[],
  ): Promise<number[] | null> {
    if (files.length === 0) return [];

    const attachmentIds = await handlers.uploadFiles(
      conversationId,
      files.map((f) => f.file),
    );

    if (attachmentIds.length === 0) {
      showNotification(MESSAGES.errorUploadFiles, 'error');
      return null;
    }

    return attachmentIds;
  }

  async function sendMessage(): Promise<void> {
    if (activeConversation === null) return;

    // Capture values before any async operations to prevent race conditions
    const content = messageInput.trim();
    const filesToSend = [...selectedFiles];
    const scheduleTime = scheduledFor;
    const conversationId = activeConversation.id;

    if (content === '' && filesToSend.length === 0) return;

    // Clear inputs immediately to prevent double-sends
    messageInput = '';
    selectedFiles = [];
    scheduledFor = null;

    const attachmentIds = await uploadFiles(conversationId, filesToSend);
    if (attachmentIds === null) return;

    if (scheduleTime !== null) {
      try {
        scheduledMessages = await handlers.sendScheduledMessage(
          conversationId,
          content,
          scheduleTime,
          attachmentIds,
        );
        showNotification(MESSAGES.successScheduled, 'success');
      } catch {
        showNotification(MESSAGES.errorScheduleMessage, 'error');
      }
    } else {
      const sent = handlers.sendWebSocketMessage(
        buildSendMessage(conversationId, content, attachmentIds),
      );
      if (!sent) {
        showNotification(MESSAGES.errorConnectionRetry, 'error');
      }
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
    showScheduleModal = true;
  }

  function confirmSchedule(): void {
    const result = handlers.validateAndSetSchedule(scheduleDate, scheduleTime);
    if (!result.isValid) {
      showNotification(result.error ?? MESSAGES.errorScheduleMessage, 'warning');
      return;
    }
    if (result.date === undefined) return;
    scheduledFor = result.date;
    showScheduleModal = false;
    showNotification(`${MESSAGES.infoScheduledAt} ${formatScheduleTime(scheduledFor)}`, 'info');
  }

  async function cancelScheduled(scheduled: ScheduledMessage): Promise<void> {
    try {
      await handlers.cancelScheduledMessage(scheduled.id);
      scheduledMessages = scheduledMessages.filter((s) => s.id !== scheduled.id);
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
      direction === 'next'
        ? (currentSearchIndex + 1) % results.length
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
    confirmMessage = MESSAGES.confirmDeleteConversation;
    confirmCallback = async () => {
      try {
        await handlers.deleteConversation(conversationId);
        // Reload SSR data after structural change
        await invalidateAll();
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
  // UTILITIES
  // ==========================================================================

  function showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
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
          {typingUsers}
          isLoading={isLoadingMessages}
          oncancelscheduled={cancelScheduled}
        />

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

<input type="file" class="hidden" multiple bind:this={fileInputRef} onchange={handleFileSelect} />

<ScheduleModal
  show={showScheduleModal}
  bind:date={scheduleDate}
  bind:time={scheduleTime}
  onclose={() => (showScheduleModal = false)}
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

<style>
  .hidden {
    display: none !important;
  }
</style>
