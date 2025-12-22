<script lang="ts">
  /**
   * Chat Page - SvelteKit Migration (Refactored)
   * 1:1 Port from frontend/src/pages/chat.html + chat/*.ts
   * Uses Svelte 5 Runes ($state, $derived, $effect)
   *
   * @see frontend/src/scripts/chat/ for original implementation
   */

  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { getTokenManager } from '$lib/utils/token-manager';
  import { parseJwt } from '$lib/utils/jwt-utils';
  import { getAvatarColorClass, getInitials } from '$lib/utils';

  // Page-specific CSS
  import '../../../styles/chat.css';

  // Local modules
  import type {
    ChatUser,
    Conversation,
    Message,
    ScheduledMessage,
    FilePreviewItem,
    RawWebSocketMessage,
    UserStatus,
  } from './_lib/types';
  import {
    WEBSOCKET_CONFIG,
    SCHEDULE_CONSTRAINTS,
    MESSAGES,
    WS_MESSAGE_TYPES,
  } from './_lib/constants';
  import {
    loadConversations as apiLoadConversations,
    loadMessages as apiLoadMessages,
    loadScheduledMessages as apiLoadScheduledMessages,
    markConversationAsRead as apiMarkConversationAsRead,
    searchUsers as apiSearchUsers,
    createConversation,
    deleteConversation,
    createScheduledMessage,
    cancelScheduledMessage as apiCancelScheduledMessage,
    uploadAttachment,
    findExistingConversation,
    buildNewConversation,
  } from './_lib/api';
  import {
    formatFileSize,
    getFileIcon,
    isImageFile,
    linkify,
    highlightSearchTerm,
    highlightSearchInMessage,
    formatMessageTime,
    formatConversationTime,
    formatScheduleTime,
    formatDateSeparator,
    shouldShowDateSeparator,
    getConversationDisplayName,
    getConversationAvatar,
    getChatPartner,
    getChatPartnerName,
    getStatusLabel,
    getRoleLabel,
    getRoleBadgeClass,
    filterMessagesByQuery,
    messageMatchesQuery,
    validateScheduleTime,
    getMinScheduleDateTime,
  } from './_lib/utils';
  import {
    buildWebSocketUrl,
    transformRawMessage,
    extractTypingData,
    extractStatusData,
    extractReadData,
    addTypingUser,
    removeTypingUser,
    updateConversationsUserStatus,
    markMessageAsRead,
    updateConversationWithMessage,
    buildJoinMessage,
    buildSendMessage,
    buildTypingStartMessage,
    buildTypingStopMessage,
    buildPingMessage,
    calculateReconnectDelay,
    shouldReconnect,
  } from './_lib/websocket';

  // ==========================================================================
  // State (Svelte 5 Runes)
  // ==========================================================================

  const tokenManager = getTokenManager();

  // Current user
  let currentUser = $state<ChatUser | null>(null);

  // Conversations
  let conversations: Conversation[] = $state([]);
  let activeConversation: Conversation | null = $state(null);

  // Messages
  let messages: Message[] = $state([]);
  let scheduledMessages: ScheduledMessage[] = $state([]);

  // UI State
  let isLoading = $state(true);
  let isLoadingMessages = $state(false);
  let messageInput = $state('');
  let showSearchBar = $state(false);
  let searchQuery = $state('');
  let currentSearchIndex = $state(0);

  // User search (admin/root only)
  let userSearchQuery = $state('');
  let userSearchResults: ChatUser[] = $state([]);
  let showUserSearch = $state(false);
  let isSearchingUsers = $state(false);

  // File handling
  let selectedFiles: FilePreviewItem[] = $state([]);
  let fileInputRef: HTMLInputElement | null = $state(null);

  // Schedule modal
  let showScheduleModal = $state(false);
  let scheduleDate = $state('');
  let scheduleTime = $state('');
  let scheduledFor: Date | null = $state(null);

  // Confirm dialog
  let showConfirmDialog = $state(false);
  let confirmMessage = $state('');
  let confirmCallback = $state<(() => void) | null>(null);

  // WebSocket
  let ws: WebSocket | null = $state(null);
  let isConnected = $state(false);
  let reconnectAttempts = $state(0);
  let pingIntervalId: number | null = $state(null);
  let typingUsers: number[] = $state([]);
  let typingTimeoutId: number | undefined;

  // Messages container ref
  let messagesContainerRef: HTMLDivElement | null = $state(null);

  // ==========================================================================
  // Derived State
  // ==========================================================================

  const isAdmin = $derived(currentUser?.role === 'admin' || currentUser?.role === 'root');
  const canStartNewConversation = $derived(isAdmin);

  const chatPartner = $derived(() => getChatPartner(activeConversation, currentUser?.id ?? 0));

  const chatPartnerName = $derived(() =>
    getChatPartnerName(chatPartner(), activeConversation?.name),
  );

  const chatPartnerStatus = $derived(() => chatPartner()?.status ?? 'offline');

  const hasSchedule = $derived(scheduledFor !== null);

  const filteredMessages = $derived(() => filterMessagesByQuery(messages, searchQuery));

  const searchResultCount = $derived(filteredMessages().length);

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  onMount(async () => {
    if (!browser) return;

    try {
      const accessToken = tokenManager.getAccessToken();
      if (!accessToken) {
        window.location.href = '/login';
        return;
      }

      const jwtPayload = parseJwt(accessToken);
      if (!jwtPayload) {
        window.location.href = '/login';
        return;
      }

      currentUser = {
        id: jwtPayload.id,
        username: jwtPayload.email,
        email: jwtPayload.email,
        role: jwtPayload.role,
      };

      await loadConversations();
      connectWebSocket();
      startPeriodicPing();
      isLoading = false;
    } catch (error) {
      console.error('Error initializing chat:', error);
      isLoading = false;
    }
  });

  onDestroy(() => {
    disconnectWebSocket();
    stopPeriodicPing();
  });

  $effect(() => {
    if (messages.length > 0 && messagesContainerRef) {
      setTimeout(() => {
        if (messagesContainerRef) {
          messagesContainerRef.scrollTop = messagesContainerRef.scrollHeight;
        }
      }, 50);
    }
  });

  // ==========================================================================
  // API Wrapper Functions
  // ==========================================================================

  async function loadConversations(): Promise<void> {
    try {
      conversations = await apiLoadConversations();
    } catch (error) {
      console.error('Error loading conversations:', error);
      showNotification(MESSAGES.errorLoadConversations, 'error');
    }
  }

  async function loadMessages(conversationId: number): Promise<void> {
    isLoadingMessages = true;
    try {
      messages = await apiLoadMessages(conversationId);
      scheduledMessages = await apiLoadScheduledMessages(conversationId);
      await apiMarkConversationAsRead(conversationId);

      const conv = conversations.find((c) => c.id === conversationId);
      if (conv) {
        conv.unreadCount = 0;
      }

      setTimeout(() => {
        if (messagesContainerRef) {
          messagesContainerRef.scrollTop = messagesContainerRef.scrollHeight;
          messagesContainerRef.classList.add('loaded');
        }
      }, 50);
    } catch (error) {
      console.error('Error loading messages:', error);
      showNotification(MESSAGES.errorLoadMessages, 'error');
    } finally {
      isLoadingMessages = false;
    }
  }

  async function searchUsers(query: string): Promise<void> {
    if (!query.trim()) {
      userSearchResults = [];
      isSearchingUsers = false;
      return;
    }

    isSearchingUsers = true;
    try {
      userSearchResults = await apiSearchUsers(query);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      isSearchingUsers = false;
    }
  }

  async function startConversationWith(user: ChatUser): Promise<void> {
    const existing = findExistingConversation(conversations, user.id);

    if (existing) {
      await selectConversation(existing);
      userSearchQuery = '';
      userSearchResults = [];
      return;
    }

    try {
      const apiConversation = await createConversation([user.id], false);
      const newConv = buildNewConversation(apiConversation);
      conversations = [newConv, ...conversations];
      await selectConversation(newConv);
      userSearchQuery = '';
      userSearchResults = [];
    } catch (error) {
      console.error('Error creating conversation:', error);
      showNotification(MESSAGES.errorCreateConversation, 'error');
    }
  }

  // ==========================================================================
  // WebSocket Functions
  // ==========================================================================

  function connectWebSocket(): void {
    if (!browser) return;

    const token = tokenManager.getAccessToken();
    if (!token) return;

    if (ws) {
      ws.onclose = null;
      ws.close();
    }

    const wsUrl = buildWebSocketUrl(token);

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.info('WebSocket connected');
        isConnected = true;
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        isConnected = false;
      };

      ws.onclose = () => {
        console.info('WebSocket disconnected');
        isConnected = false;
        attemptReconnect();
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }
  }

  function handleWebSocketMessage(message: { type: string; data: unknown }): void {
    switch (message.type) {
      case WS_MESSAGE_TYPES.CONNECTION_ESTABLISHED:
        conversations.forEach((conv) => {
          sendWebSocketMessage(buildJoinMessage(conv.id));
        });
        break;

      case WS_MESSAGE_TYPES.AUTH_ERROR:
        console.error('Authentication failed:', message.data);
        ws?.close();
        window.location.href = '/login';
        break;

      case WS_MESSAGE_TYPES.NEW_MESSAGE: {
        const newMessage = transformRawMessage(message.data as RawWebSocketMessage);
        handleNewMessage(newMessage);
        break;
      }

      case WS_MESSAGE_TYPES.TYPING_START:
      case WS_MESSAGE_TYPES.USER_TYPING: {
        const typingData = extractTypingData(message.data as RawWebSocketMessage);
        if (activeConversation?.id === typingData.conversationId) {
          typingUsers = addTypingUser(typingUsers, typingData.userId);
        }
        break;
      }

      case WS_MESSAGE_TYPES.TYPING_STOP:
      case WS_MESSAGE_TYPES.USER_STOPPED_TYPING: {
        const stopData = extractTypingData(message.data as RawWebSocketMessage);
        typingUsers = removeTypingUser(typingUsers, stopData.userId);
        break;
      }

      case WS_MESSAGE_TYPES.USER_STATUS:
      case WS_MESSAGE_TYPES.USER_STATUS_CHANGED: {
        const statusData = extractStatusData(message.data as RawWebSocketMessage);
        conversations = updateConversationsUserStatus(
          conversations,
          statusData.userId,
          statusData.status,
        );
        break;
      }

      case WS_MESSAGE_TYPES.MESSAGE_READ: {
        const readData = extractReadData(message.data as RawWebSocketMessage);
        messages = markMessageAsRead(messages, readData.messageId);
        break;
      }

      case WS_MESSAGE_TYPES.PONG:
      case WS_MESSAGE_TYPES.MESSAGE_SENT:
        break;

      case WS_MESSAGE_TYPES.ERROR:
        console.error('WebSocket Error:', message.data);
        showNotification(MESSAGES.errorWebSocket, 'error');
        break;

      default:
        console.info('Unknown message type:', message.type);
    }
  }

  function handleNewMessage(newMessage: Message): void {
    if (activeConversation?.id === newMessage.conversationId) {
      messages = [...messages, newMessage];

      if (newMessage.senderId !== currentUser?.id) {
        apiMarkConversationAsRead(newMessage.conversationId);
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
  }

  function attemptReconnect(): void {
    if (!shouldReconnect(reconnectAttempts)) {
      console.error('Max reconnection attempts reached');
      showNotification(MESSAGES.errorConnectionLost, 'error');
      return;
    }

    reconnectAttempts++;
    console.info(
      `Attempting to reconnect (${reconnectAttempts}/${WEBSOCKET_CONFIG.maxReconnectAttempts})...`,
    );

    setTimeout(() => {
      connectWebSocket();
    }, calculateReconnectDelay(reconnectAttempts));
  }

  function sendWebSocketMessage(message: { type: string; data: unknown }): boolean {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    ws.send(JSON.stringify(message));
    return true;
  }

  function startPeriodicPing(): void {
    pingIntervalId = window.setInterval(() => {
      if (isConnected && ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(buildPingMessage()));
      }
    }, WEBSOCKET_CONFIG.pingInterval);
  }

  function stopPeriodicPing(): void {
    if (pingIntervalId !== null) {
      window.clearInterval(pingIntervalId);
      pingIntervalId = null;
    }
  }

  function disconnectWebSocket(): void {
    stopPeriodicPing();
    if (ws) {
      ws.onclose = null;
      ws.close();
      ws = null;
    }
    isConnected = false;
  }

  // ==========================================================================
  // UI Handlers
  // ==========================================================================

  async function selectConversation(conversation: Conversation): Promise<void> {
    activeConversation = conversation;
    messages = [];
    scheduledMessages = [];
    await loadMessages(conversation.id);
    sendWebSocketMessage(buildJoinMessage(conversation.id));
  }

  async function sendMessage(): Promise<void> {
    if (!activeConversation) return;

    const content = messageInput.trim();
    if (!content && selectedFiles.length === 0) return;

    let attachmentIds: number[] = [];
    if (selectedFiles.length > 0) {
      attachmentIds = await uploadSelectedFiles();
      if (attachmentIds.length === 0 && selectedFiles.length > 0) {
        showNotification(MESSAGES.errorUploadFiles, 'error');
        return;
      }
    }

    if (scheduledFor) {
      await sendScheduledMessage(content, attachmentIds);
    } else {
      const sent = sendWebSocketMessage(
        buildSendMessage(activeConversation.id, content, attachmentIds),
      );

      if (!sent) {
        showNotification(MESSAGES.errorConnectionRetry, 'error');
        return;
      }
    }

    messageInput = '';
    selectedFiles = [];
    clearSchedule();
  }

  async function sendScheduledMessage(content: string, attachmentIds: number[]): Promise<void> {
    if (!activeConversation || !scheduledFor) return;

    try {
      await createScheduledMessage(
        activeConversation.id,
        content,
        scheduledFor.toISOString(),
        attachmentIds,
      );

      showNotification(MESSAGES.successScheduled, 'success');
      scheduledMessages = await apiLoadScheduledMessages(activeConversation.id);
    } catch (error) {
      console.error('Error scheduling message:', error);
      showNotification(MESSAGES.errorScheduleMessage, 'error');
    }
  }

  async function uploadSelectedFiles(): Promise<number[]> {
    if (!activeConversation) return [];

    const uploadedIds: number[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const fileItem = selectedFiles[i];
      fileItem.status = 'uploading';

      try {
        const result = await uploadAttachment(activeConversation.id, fileItem.file);
        fileItem.status = 'uploaded';
        fileItem.documentId = result.id;
        uploadedIds.push(result.id);
      } catch (error) {
        console.error('Error uploading file:', error);
        fileItem.status = 'error';
      }

      selectedFiles = [...selectedFiles];
    }

    return uploadedIds;
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }

    if (event.ctrlKey && event.key === 'f') {
      event.preventDefault();
      showSearchBar = true;
    }
  }

  function handleTyping(): void {
    if (!activeConversation) return;
    sendWebSocketMessage(buildTypingStartMessage(activeConversation.id));

    if (typingTimeoutId) clearTimeout(typingTimeoutId);
    const convId = activeConversation.id;
    typingTimeoutId = window.setTimeout(() => {
      sendWebSocketMessage(buildTypingStopMessage(convId));
    }, WEBSOCKET_CONFIG.typingTimeout);
  }

  function openFileDialog(): void {
    fileInputRef?.click();
  }

  function handleFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input || !input.files) return;

    for (const file of input.files) {
      const isImage = isImageFile(file);
      const previewUrl = isImage ? URL.createObjectURL(file) : '';

      selectedFiles = [
        ...selectedFiles,
        {
          file,
          previewUrl,
          isImage,
          status: 'pending',
          progress: 0,
          documentId: null,
        },
      ];
    }

    input.value = '';
  }

  function removeFile(index: number): void {
    const item = selectedFiles[index];
    if (item?.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
    selectedFiles = selectedFiles.filter((_, i) => i !== index);
  }

  // ==========================================================================
  // Schedule Modal
  // ==========================================================================

  function openScheduleModal(): void {
    const { date, time } = getMinScheduleDateTime(SCHEDULE_CONSTRAINTS.minFutureTime);
    scheduleDate = date;
    scheduleTime = time;
    showScheduleModal = true;
  }

  function confirmSchedule(): void {
    if (!scheduleDate || !scheduleTime) {
      showNotification(MESSAGES.warningSelectDateTime, 'warning');
      return;
    }

    const selectedDate = new Date(`${scheduleDate}T${scheduleTime}`);
    const validation = validateScheduleTime(
      selectedDate,
      SCHEDULE_CONSTRAINTS.minFutureTime,
      SCHEDULE_CONSTRAINTS.maxFutureTime,
    );

    if (!validation.isValid) {
      showNotification(validation.error!, 'warning');
      return;
    }

    scheduledFor = selectedDate;
    showScheduleModal = false;
    showNotification(`${MESSAGES.infoScheduledAt} ${formatScheduleTime(selectedDate)}`, 'info');
  }

  function clearSchedule(): void {
    scheduledFor = null;
  }

  async function cancelScheduled(scheduled: ScheduledMessage): Promise<void> {
    try {
      await apiCancelScheduledMessage(scheduled.id);
      scheduledMessages = scheduledMessages.filter((s) => s.id !== scheduled.id);
      showNotification(MESSAGES.successCancelScheduled, 'success');
    } catch (error) {
      console.error('Error cancelling scheduled message:', error);
      showNotification(MESSAGES.errorCancelScheduled, 'error');
    }
  }

  // ==========================================================================
  // Search Functions
  // ==========================================================================

  function toggleSearchBar(): void {
    showSearchBar = !showSearchBar;
    if (!showSearchBar) {
      searchQuery = '';
      currentSearchIndex = 0;
    }
  }

  function navigateSearch(direction: 'next' | 'prev'): void {
    const results = filteredMessages();
    if (results.length === 0) return;

    if (direction === 'next') {
      currentSearchIndex = (currentSearchIndex + 1) % results.length;
    } else {
      currentSearchIndex = (currentSearchIndex - 1 + results.length) % results.length;
    }

    const messageId = results[currentSearchIndex]?.id;
    if (messageId) {
      const element = document.querySelector(`[data-message-id="${messageId}"]`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ==========================================================================
  // Delete Conversation
  // ==========================================================================

  async function deleteCurrentConversation(): Promise<void> {
    if (!activeConversation) return;

    const conversationId = activeConversation.id;

    confirmMessage = MESSAGES.confirmDeleteConversation;
    confirmCallback = async () => {
      try {
        await deleteConversation(conversationId);
        conversations = conversations.filter((c) => c.id !== conversationId);
        activeConversation = null;
        messages = [];
        showNotification(MESSAGES.successDeleteConversation, 'success');
      } catch (error) {
        console.error('Error deleting conversation:', error);
        showNotification(MESSAGES.errorDeleteConversation, 'error');
      }
    };
    showConfirmDialog = true;
  }

  // ==========================================================================
  // Utility Functions
  // ==========================================================================

  function showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
    console.info(`[${type}] ${message}`);
    // TODO: Integrate with toast store from ToastContainer
  }
</script>

<svelte:head>
  <title>Chat - Assixx</title>
</svelte:head>

<main class="chat-page-main">
  <div class="chat-container">
    <!-- Chat Sidebar -->
    <div class="chat-sidebar">
      <div class="chat-sidebar-header">
        <h2 class="chat-title">
          <i class="fas fa-comments"></i>
          {MESSAGES.labelMessages}
        </h2>
        {#if canStartNewConversation}
          <button
            class="btn btn-icon btn-secondary"
            title={MESSAGES.labelNewConversation}
            aria-label={MESSAGES.labelNewConversation}
            onclick={() => {
              showUserSearch = !showUserSearch;
            }}
          >
            <i class="fas fa-plus"></i>
          </button>
        {/if}
      </div>

      <!-- User Search (admin/root only) -->
      {#if canStartNewConversation && showUserSearch}
        <div
          class="search-input-wrapper"
          class:search-input-wrapper--open={userSearchResults.length > 0}
        >
          <div
            class="search-input"
            class:search-input--has-value={userSearchQuery.length > 0}
            class:search-input--loading={isSearchingUsers}
          >
            <i class="search-input__icon fas fa-search"></i>
            <input
              type="search"
              class="search-input__field"
              placeholder={MESSAGES.labelSearchUsers}
              autocomplete="off"
              bind:value={userSearchQuery}
              oninput={() => searchUsers(userSearchQuery)}
            />
            <button
              class="search-input__clear"
              type="button"
              aria-label={MESSAGES.labelClearSearch}
              onclick={() => {
                userSearchQuery = '';
                userSearchResults = [];
              }}
            >
              <i class="fas fa-times"></i>
            </button>
            <div class="search-input__spinner"></div>
          </div>
          {#if userSearchResults.length > 0}
            <div class="search-input__results" id="chatUserSearchResults">
              {#each userSearchResults as user (user.id)}
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div
                  class="search-input__result-item"
                  data-user-id={user.id}
                  onclick={() => startConversationWith(user)}
                >
                  <div class="flex items-center gap-3 w-full">
                    <div class="avatar avatar--sm {getAvatarColorClass(user.id)}">
                      {#if user.profileImageUrl}
                        <img src={user.profileImageUrl} alt={user.username} class="avatar__image" />
                      {:else}
                        <span class="avatar__initials"
                          >{getInitials(user.firstName, user.lastName)}</span
                        >
                      {/if}
                      <span class="avatar__status avatar__status--{user.status ?? 'offline'}"
                      ></span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div style="font-weight: 500; color: var(--text-primary);">
                        <!-- eslint-disable svelte/no-at-html-tags -- Highlighting search term in name -->
                        {@html highlightSearchTerm(
                          `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
                          userSearchQuery,
                        )}
                        <!-- eslint-enable svelte/no-at-html-tags -->
                      </div>
                      <div style="font-size: 0.75rem; color: var(--text-secondary);">
                        {#if user.employeeNumber}#{user.employeeNumber} ·
                        {/if}{user.email ?? user.username}
                      </div>
                      <div
                        style="font-size: 0.7rem; color: var(--text-muted); display: flex; gap: 6px; align-items: center; margin-top: 2px;"
                      >
                        {#if user.role}
                          <span
                            class="badge {getRoleBadgeClass(user.role)}"
                            style="font-size: 0.6rem; padding: 1px 5px;"
                          >
                            {getRoleLabel(user.role)}
                          </span>
                        {/if}
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Conversations List -->
      <div class="conversations-list">
        {#if isLoading}
          <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
          </div>
        {:else if conversations.length === 0}
          <div class="conversations-empty">
            <i class="fas fa-inbox"></i>
            <span>{MESSAGES.emptyNoConversations}</span>
          </div>
        {:else}
          {#each conversations as conv (conv.id)}
            {@const partner = conv.participants.find((p) => p.id !== currentUser?.id)}
            <button
              class="conversation-item"
              class:active={activeConversation?.id === conv.id}
              class:unread={conv.unreadCount && conv.unreadCount > 0}
              onclick={() => selectConversation(conv)}
            >
              <div class="avatar {getAvatarColorClass(partner?.id)}">
                {#if getConversationAvatar(conv, currentUser?.id ?? 0)}
                  <img
                    src={getConversationAvatar(conv, currentUser?.id ?? 0)}
                    alt=""
                    class="avatar__image"
                  />
                {:else}
                  <span class="avatar__initials">
                    {getInitials(partner?.firstName, partner?.lastName)}
                  </span>
                {/if}
                {#if !conv.isGroup && partner}
                  <span class="avatar__status avatar__status--{partner.status ?? 'offline'}"></span>
                {/if}
              </div>
              <div class="conversation-info">
                <h4 class="conversation-name">
                  {getConversationDisplayName(conv, currentUser?.id ?? 0)}
                </h4>
                {#if conv.lastMessage}
                  <p class="conversation-preview">{conv.lastMessage.content}</p>
                {/if}
              </div>
              <div class="conversation-meta">
                {#if conv.lastMessage}
                  <span class="conversation-time">
                    {formatConversationTime(conv.lastMessage.createdAt)}
                  </span>
                {/if}
                {#if conv.unreadCount && conv.unreadCount > 0}
                  <span class="badge badge--count">{conv.unreadCount}</span>
                {/if}
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Main Chat Area -->
    <div class="chat-main">
      {#if activeConversation}
        <!-- Chat Header -->
        <div class="chat-header">
          <div class="chat-header-info">
            <div class="avatar {getAvatarColorClass(chatPartner()?.id)}">
              {#if getConversationAvatar(activeConversation, currentUser?.id ?? 0)}
                <img
                  src={getConversationAvatar(activeConversation, currentUser?.id ?? 0)}
                  alt=""
                  class="avatar__image"
                />
              {:else}
                <span class="avatar__initials">
                  {getInitials(chatPartner()?.firstName, chatPartner()?.lastName)}
                </span>
              {/if}
            </div>
            <div class="chat-header-details">
              <h3>{chatPartnerName()}</h3>
              <div class="status">
                {getStatusLabel(chatPartnerStatus() as UserStatus)}
              </div>
            </div>
          </div>
          <div class="chat-actions">
            <button
              class="btn btn-icon btn-secondary"
              title={MESSAGES.labelSearchCtrlF}
              aria-label={MESSAGES.labelSearchCtrlF}
              onclick={toggleSearchBar}
            >
              <i class="fas fa-search"></i>
            </button>
            {#if isAdmin}
              <button
                class="btn btn-icon btn-danger"
                title={MESSAGES.labelDeleteChat}
                aria-label={MESSAGES.labelDeleteChat}
                onclick={deleteCurrentConversation}
              >
                <i class="fas fa-trash"></i>
              </button>
            {/if}
          </div>
        </div>

        <!-- Search Bar -->
        {#if showSearchBar}
          <div class="chat-search-bar">
            <div class="chat-search-input-wrapper">
              <i class="fas fa-search chat-search-icon"></i>
              <input
                type="search"
                class="chat-search-input"
                placeholder={MESSAGES.labelSearchChat}
                autocomplete="off"
                bind:value={searchQuery}
              />
              {#if searchResultCount > 0}
                <span class="chat-search-counter">
                  {currentSearchIndex + 1}/{searchResultCount}
                </span>
              {/if}
              <button
                class="btn btn-icon btn-sm"
                title={MESSAGES.labelPreviousResult}
                aria-label={MESSAGES.labelPreviousResult}
                onclick={() => navigateSearch('prev')}
              >
                <i class="fas fa-chevron-up"></i>
              </button>
              <button
                class="btn btn-icon btn-sm"
                title={MESSAGES.labelNextResult}
                aria-label={MESSAGES.labelNextResult}
                onclick={() => navigateSearch('next')}
              >
                <i class="fas fa-chevron-down"></i>
              </button>
              <button
                class="btn btn-icon btn-sm"
                title={MESSAGES.labelCloseSearch}
                aria-label={MESSAGES.labelCloseSearch}
                onclick={toggleSearchBar}
              >
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
        {/if}

        <!-- Messages Container -->
        <div class="messages-container" bind:this={messagesContainerRef}>
          {#if isLoadingMessages}
            <div class="loading-spinner">
              <i class="fas fa-spinner fa-spin"></i>
            </div>
          {:else if messages.length === 0 && scheduledMessages.length === 0}
            <div class="empty-chat">
              <div class="empty-chat-icon">
                <i class="fas fa-comments"></i>
              </div>
              <h3>{MESSAGES.emptyNewConversation}</h3>
              <p>{MESSAGES.emptyFirstMessage}</p>
            </div>
          {:else}
            <!-- Scheduled Messages First -->
            {#each scheduledMessages as scheduled (scheduled.id)}
              <div class="message own message--scheduled" data-scheduled-id={scheduled.id}>
                <div class="message-bubble">
                  <div class="message-content">
                    <p class="message-text">{scheduled.content}</p>
                    <div class="message--scheduled-info">
                      <i class="far fa-clock"></i>
                      <span
                        >{MESSAGES.labelScheduledFor}
                        {formatScheduleTime(new Date(scheduled.scheduledFor))}</span
                      >
                      <button
                        class="message--scheduled-cancel"
                        title={MESSAGES.labelCancelScheduled}
                        aria-label={MESSAGES.labelCancelScheduled}
                        onclick={() => cancelScheduled(scheduled)}
                      >
                        <i class="fas fa-times"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            {/each}

            <!-- Regular Messages -->
            {#each messages as message, i (message.id)}
              {@const prevMessage = messages[i - 1]}
              {@const isOwn = message.senderId === currentUser?.id}

              {#if shouldShowDateSeparator(prevMessage, message)}
                <div class="date-separator">
                  <span>{formatDateSeparator(message.createdAt)}</span>
                </div>
              {/if}

              <div class="message" class:own={isOwn} data-message-id={message.id}>
                {#if !isOwn}
                  <div class="avatar avatar--sm {getAvatarColorClass(message.senderId)}">
                    {#if message.senderProfilePicture}
                      <img src={message.senderProfilePicture} alt="" class="avatar__image" />
                    {:else}
                      <span class="avatar__initials">
                        {getInitials(message.sender?.firstName, message.sender?.lastName)}
                      </span>
                    {/if}
                  </div>
                {/if}

                <div class="message-bubble">
                  {#if !isOwn}
                    <div class="message-header">
                      <span class="message-sender">
                        {message.senderName ?? message.senderUsername ?? MESSAGES.labelUnknown}
                      </span>
                    </div>
                  {/if}

                  <div class="message-content">
                    <!-- eslint-disable svelte/no-at-html-tags -- Content from API is trusted, linkify only adds anchor tags for URLs -->
                    <p class="message-text">
                      {#if messageMatchesQuery(message.content, searchQuery)}
                        {@html highlightSearchInMessage(message.content, searchQuery)}
                      {:else}
                        {@html linkify(message.content)}
                      {/if}
                    </p>
                    <!-- eslint-enable svelte/no-at-html-tags -->

                    <!-- Attachments -->
                    {#if message.attachments && message.attachments.length > 0}
                      {#each message.attachments as att (att.id)}
                        {#if att.mimeType.startsWith('image/')}
                          <div class="attachment image-attachment">
                            <div class="attachment-image-wrapper">
                              <img
                                src={att.downloadUrl ??
                                  `/api/v2/chat/attachments/${att.fileUuid}/download?inline=true`}
                                alt={att.fileName}
                              />
                              <div class="attachment-overlay">
                                <i class="fas fa-search-plus"></i>
                              </div>
                            </div>
                          </div>
                        {:else}
                          <a
                            class="attachment file-attachment"
                            href={att.downloadUrl ??
                              `/api/v2/chat/attachments/${att.fileUuid}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <i class="fas {getFileIcon(att.mimeType)}"></i>
                            <div class="file-info">
                              <span class="file-name">{att.fileName}</span>
                              <span class="file-size">{formatFileSize(att.fileSize)}</span>
                            </div>
                            <div class="attachment-actions">
                              <button
                                class="btn btn-icon btn-sm"
                                aria-label={MESSAGES.labelDownloadFile}
                              >
                                <i class="fas fa-download"></i>
                              </button>
                            </div>
                          </a>
                        {/if}
                      {/each}
                    {/if}

                    <!-- Legacy attachment support -->
                    {#if message.attachment}
                      <a
                        class="attachment file-attachment"
                        href={message.attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <i class="fas {getFileIcon(message.attachment.mimeType)}"></i>
                        <div class="file-info">
                          <span class="file-name">{message.attachment.filename}</span>
                          <span class="file-size">{formatFileSize(message.attachment.size)}</span>
                        </div>
                      </a>
                    {/if}

                    <!-- Time + Read Indicator -->
                    <div class="message-time">
                      {formatMessageTime(message.createdAt)}{#if isOwn}<span
                          class="read-indicator"
                          class:read={message.isRead}
                          >{#if message.isRead}✓✓{:else}✓{/if}</span
                        >{/if}
                    </div>
                  </div>
                </div>
              </div>
            {/each}

            <!-- Typing Indicator -->
            {#if typingUsers.length > 0}
              <div class="typing-indicator">
                <span class="typing-dots">
                  <span></span><span></span><span></span>
                </span>
                <span class="typing-text">{MESSAGES.labelTyping}</span>
              </div>
            {/if}
          {/if}
        </div>

        <!-- Message Input -->
        <div class="message-input-container">
          <!-- File Preview -->
          {#if selectedFiles.length > 0}
            <div class="file-preview">
              {#each selectedFiles as item, i (i)}
                <div class="file-preview-item" class:uploading={item.status === 'uploading'}>
                  <div class="file-icon">
                    {#if item.isImage && item.previewUrl}
                      <img src={item.previewUrl} alt="" />
                    {:else}
                      <i class="fas {getFileIcon(item.file.type)}"></i>
                    {/if}
                  </div>
                  <div class="file-info">
                    <span class="file-name">{item.file.name}</span>
                    <span class="file-size">{formatFileSize(item.file.size)}</span>
                  </div>
                  <button
                    class="remove-file"
                    aria-label={MESSAGES.labelRemoveFile}
                    onclick={() => removeFile(i)}
                    disabled={item.status === 'uploading'}
                  >
                    <i class="fas fa-times"></i>
                  </button>
                  {#if item.status === 'uploading'}
                    <div class="upload-progress">
                      <div class="progress-bar" style="width: {item.progress}%"></div>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}

          <div class="message-input-wrapper">
            <textarea
              class="message-input"
              placeholder={MESSAGES.labelMessagePlaceholder}
              rows="1"
              bind:value={messageInput}
              onkeydown={handleKeyDown}
              oninput={handleTyping}
            ></textarea>
            <div class="input-actions">
              <!-- Schedule Button / Badge -->
              {#if hasSchedule && scheduledFor}
                <div class="schedule-badge">
                  <i class="far fa-clock"></i>
                  <span class="schedule-badge__time">{formatScheduleTime(scheduledFor)}</span>
                  <button
                    type="button"
                    class="schedule-badge__clear"
                    title={MESSAGES.labelClearSchedule}
                    aria-label={MESSAGES.labelClearSchedule}
                    onclick={clearSchedule}
                  >
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              {:else}
                <button
                  class="btn btn-icon btn-secondary"
                  title={MESSAGES.labelScheduleMessage}
                  aria-label={MESSAGES.labelScheduleMessage}
                  onclick={openScheduleModal}
                >
                  <i class="far fa-clock"></i>
                </button>
              {/if}

              <button
                class="btn btn-icon btn-secondary"
                title={MESSAGES.labelAttachFile}
                aria-label={MESSAGES.labelAttachFile}
                onclick={openFileDialog}
              >
                <i class="fas fa-paperclip"></i>
              </button>
              <button
                class="btn btn-icon btn-upload"
                aria-label={MESSAGES.labelSendMessage}
                onclick={sendMessage}
                disabled={!messageInput.trim() && selectedFiles.length === 0}
              >
                <i class="fas fa-paper-plane"></i>
              </button>
            </div>
          </div>
        </div>
      {:else}
        <!-- No Chat Selected -->
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

<!-- File Input (hidden) -->
<input type="file" class="hidden" multiple bind:this={fileInputRef} onchange={handleFileSelect} />

<!-- Schedule Modal -->
<div class="modal-overlay" class:modal-overlay--active={showScheduleModal}>
  <div class="ds-modal ds-modal--sm">
    <div class="ds-modal__header">
      <h2 class="ds-modal__title">
        <i class="far fa-clock"></i>
        &nbsp; {MESSAGES.labelScheduleTitle}
      </h2>
      <button
        class="ds-modal__close"
        aria-label={MESSAGES.labelCloseModal}
        onclick={() => {
          showScheduleModal = false;
        }}
      >
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ds-modal__body">
      <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-4)">
        {MESSAGES.labelScheduleDescription}
      </p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4)">
        <div class="form-field">
          <label class="form-field__label form-field__label--required" for="scheduleDate"
            >{MESSAGES.labelDate}</label
          >
          <input
            type="date"
            id="scheduleDate"
            class="form-field__control"
            required
            bind:value={scheduleDate}
          />
        </div>
        <div class="form-field">
          <label class="form-field__label form-field__label--required" for="scheduleTime"
            >{MESSAGES.labelTime}</label
          >
          <input
            type="time"
            id="scheduleTime"
            class="form-field__control"
            required
            bind:value={scheduleTime}
          />
        </div>
      </div>
      <small class="form-field__message" style="margin-top: var(--spacing-3)">
        <i class="fas fa-info-circle"></i>
        &nbsp; {MESSAGES.labelScheduleHint}
      </small>
    </div>
    <div class="ds-modal__footer ds-modal__footer--spaced">
      <button
        class="btn btn-cancel"
        onclick={() => {
          showScheduleModal = false;
        }}>{MESSAGES.labelCancel}</button
      >
      <button class="btn btn-modal" onclick={confirmSchedule}>
        <i class="far fa-clock"></i>
        {MESSAGES.labelSchedule}
      </button>
    </div>
  </div>
</div>

<!-- Confirm Dialog -->
<div class="modal-overlay" class:modal-overlay--active={showConfirmDialog}>
  <div class="confirm-modal confirm-modal--danger">
    <div class="confirm-modal__icon">
      <i class="fas fa-exclamation-triangle"></i>
    </div>
    <h3 class="confirm-modal__title">{MESSAGES.labelConfirmDelete}</h3>
    <p class="confirm-modal__message">{confirmMessage}</p>
    <div class="confirm-modal__actions">
      <button
        class="confirm-modal__btn confirm-modal__btn--cancel"
        onclick={() => {
          showConfirmDialog = false;
          confirmCallback = null;
        }}
      >
        {MESSAGES.labelCancel}
      </button>
      <button
        class="confirm-modal__btn confirm-modal__btn--danger"
        onclick={() => {
          if (confirmCallback) confirmCallback();
          showConfirmDialog = false;
          confirmCallback = null;
        }}
      >
        {MESSAGES.labelDelete}
      </button>
    </div>
  </div>
</div>

<style>
  .hidden {
    display: none !important;
  }

  .u-hidden {
    visibility: hidden;
    opacity: 0;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    visibility: hidden;
    background: rgb(0 0 0 / 50%);
    opacity: 0;
    transition: all 0.2s ease;
  }

  .modal-overlay--active {
    visibility: visible;
    opacity: 1;
  }

  .loading-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-8, 2rem);
    font-size: 2rem;
    color: var(--primary-color, #2196f3);
  }

  .conversations-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2, 0.5rem);
    padding: var(--spacing-6, 1.5rem);
    color: var(--text-muted, #999);
    text-align: center;
    font-size: 0.875rem;
  }

  .conversations-empty i {
    font-size: 1.5rem;
    opacity: 0.5;
  }

  .search-result-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-3, 0.75rem);
    width: 100%;
    padding: var(--spacing-2, 0.5rem) var(--spacing-3, 0.75rem);
    border: none;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background 0.2s ease;
  }

  .search-result-item:hover {
    background: rgb(255 255 255 / 10%);
  }

  .search-result-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .search-result-name {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .search-result-username {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .typing-indicator {
    display: flex;
    align-items: center;
    gap: var(--spacing-2, 0.5rem);
    padding: var(--spacing-2, 0.5rem) var(--spacing-4, 1rem);
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .typing-dots {
    display: flex;
    gap: 4px;
  }

  .typing-dots span {
    width: 6px;
    height: 6px;
    background: var(--text-secondary);
    border-radius: 50%;
    animation: typingBounce 1.4s infinite ease-in-out;
  }

  .typing-dots span:nth-child(1) {
    animation-delay: 0s;
  }
  .typing-dots span:nth-child(2) {
    animation-delay: 0.2s;
  }
  .typing-dots span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typingBounce {
    0%,
    80%,
    100% {
      transform: scale(0.8);
      opacity: 0.5;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1, 0.25rem);
  }

  .form-field__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-field__label--required::after {
    content: ' *';
    color: var(--color-danger, #f44336);
  }

  .form-field__control {
    padding: var(--spacing-2, 0.5rem) var(--spacing-3, 0.75rem);
    border: 1px solid var(--border-color, rgb(255 255 255 / 20%));
    border-radius: var(--radius-md, 8px);
    background: var(--background-secondary, rgb(255 255 255 / 5%));
    color: var(--text-primary);
    font-size: 0.9rem;
  }

  .form-field__control:focus {
    outline: none;
    border-color: var(--primary-color, #2196f3);
  }

  .form-field__message {
    font-size: 0.75rem;
    color: var(--text-tertiary);
  }
</style>
