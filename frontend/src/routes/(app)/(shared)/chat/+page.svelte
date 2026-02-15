<script lang="ts">
  /**
   * Chat Page - Thin Template Shell
   * All business logic lives in chat-page-state.svelte.ts
   * This file: SSR props, factory call, lifecycle hooks, template.
   */

  import { onMount, onDestroy } from 'svelte';

  import { createChatPageState } from './_lib/chat-page-state.svelte';
  import ChatHeader from './_lib/ChatHeader.svelte';
  import ChatSidebar from './_lib/ChatSidebar.svelte';
  import ConfirmDialog from './_lib/ConfirmDialog.svelte';
  import { MESSAGES } from './_lib/constants';
  import ImagePreviewModal from './_lib/ImagePreviewModal.svelte';
  import MessageInputArea from './_lib/MessageInputArea.svelte';
  import MessagesArea from './_lib/MessagesArea.svelte';
  import ScheduleModal from './_lib/ScheduleModal.svelte';

  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  const state = createChatPageState({
    getSsrUser: () => data.currentUser,
    getSsrConversations: () => data.conversations,
    getSsrTenantId: () =>
      (data.currentUser as unknown as { tenantId?: number } | null)?.tenantId ??
      0,
  });

  onMount(() => {
    state.mount();
  });
  onDestroy(() => {
    state.destroy();
  });
</script>

<svelte:head>
  <title>Chat - Assixx</title>
</svelte:head>

<main class="chat-page-main">
  <div class="chat-container">
    <ChatSidebar
      conversations={state.conversations}
      activeConversationId={state.activeConversation?.id ?? null}
      currentUserId={state.currentUser?.id ?? 0}
      canStartNewConversation={state.canStartNewConversation}
      showUserSearch={state.showUserSearch}
      bind:userSearchQuery={state.userSearchQuery}
      userSearchResults={state.userSearchResults}
      isSearchingUsers={state.isSearchingUsers}
      isLoading={state.isLoading}
      ontoggleusersearch={state.toggleUserSearch}
      onsearchusers={state.searchUsers}
      onclearusersearch={state.clearUserSearch}
      onstartconversation={state.startConversationWith}
      onselectconversation={state.selectConversation}
    />

    <div class="chat-main">
      {#if state.isDisconnected}
        <div
          class="connection-lost-banner"
          role="alert"
        >
          <i class="fas fa-exclamation-triangle"></i>
          <span>{MESSAGES.reconnecting}</span>
        </div>
      {/if}
      {#if state.activeConversation}
        <ChatHeader
          conversation={state.activeConversation}
          partner={state.chatPartner ?? undefined}
          partnerName={state.chatPartnerName}
          partnerStatus={state.chatPartnerStatus}
          currentUserId={state.currentUser?.id ?? 0}
          isAdmin={state.isAdmin}
          showSearchBar={state.showSearchBar}
          bind:searchQuery={state.searchQuery}
          searchResultCount={state.searchResultCount}
          currentSearchIndex={state.currentSearchIndex}
          ontogglesearch={state.toggleSearchBar}
          onnavigateprev={() => {
            state.navigateSearch('prev');
          }}
          onnavigatenext={() => {
            state.navigateSearch('next');
          }}
          ondelete={state.deleteCurrentConversation}
        />

        <MessagesArea
          bind:this={state.messagesAreaRef}
          messages={state.messages}
          scheduledMessages={state.scheduledMessages}
          currentUserId={state.currentUser?.id ?? 0}
          searchQuery={state.debouncedSearchQuery}
          isLoading={state.isLoadingMessages}
          oncancelscheduled={state.cancelScheduled}
          onimageclick={state.openImagePreview}
        />

        {#if state.typingUsers.length > 0}
          <div class="typing-indicator">
            <span class="typing-dots"
              ><span></span><span></span><span></span></span
            >
            <span class="typing-text">{MESSAGES.labelTyping}</span>
          </div>
        {/if}
        <MessageInputArea
          bind:messageInput={state.messageInput}
          selectedFiles={state.selectedFiles}
          scheduledFor={state.scheduledFor}
          onsend={state.sendMessage}
          onkeydown={state.handleKeyDown}
          oninput={state.handleTyping}
          onopenfilepicker={state.openFilePicker}
          onremovefile={state.removeFile}
          onopenschedule={state.openScheduleModal}
          onclearschedule={state.clearSchedule}
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
  bind:this={state.fileInputRef}
  onchange={state.handleFileSelect}
/>

<ScheduleModal
  show={state.showScheduleModal}
  bind:date={state.scheduleDate}
  bind:time={state.scheduleTimeInput}
  errorMessage={state.scheduleError}
  onclose={state.closeScheduleModal}
  onconfirm={state.confirmSchedule}
/>

<ConfirmDialog
  show={state.showConfirmDialog}
  message={state.confirmMessage}
  onclose={state.closeConfirmDialog}
  onconfirm={state.executeConfirm}
/>

<ImagePreviewModal
  show={state.previewImage !== null}
  image={state.previewImage}
  onclose={state.closeImagePreview}
/>

<style>
  /* stylelint-disable declaration-block-no-redundant-longhand-properties -- Need individual props for left override */
  :global {
    .chat-page-main {
      position: fixed;
      top: var(--header-height);
      right: 0;
      bottom: 0;
      left: var(--sidebar-width-expanded);

      transition: left 0.3s ease;
      margin: 0 !important;
      padding: 0 !important;

      height: calc(100vh - var(--header-height));

      overflow: hidden;
    }

    .chat-page-main.sidebar-collapsed {
      left: var(--sidebar-width-collapsed);
    }
  }

  :global {
    .chat-container {
      display: flex;
      position: relative;
      margin: 0;

      background: var(--background-primary);
      padding: 0;

      width: 100%;
      height: 100%;

      overflow: hidden;
    }

    /* Sidebar mit Conversations */
    .chat-sidebar {
      display: flex;
      position: relative;
      flex-shrink: 0;
      flex-direction: column;
      border-bottom: 1px solid var(--color-glass-border);
      border-left: 1px solid var(--color-glass-border);
      border-right: 1px solid var(--color-glass-border);

      background: var(--glass-bg);

      width: 300px;

      overflow: hidden;
    }

    .chat-sidebar-header {
      display: flex;
      align-items: center;

      background: rgb(0 98 183 / 32%);

      padding: 15px 10px 12px;
    }

    .chat-title {
      display: flex;
      flex: 1;
      align-items: center;
      gap: var(--spacing-1);

      margin: 0;
      color: var(--text-primary);
      font-weight: 600;

      font-size: 1.3rem;
    }

    /* Chat sidebar search input - flush edges */
    .chat-sidebar .search-input-wrapper,
    .chat-sidebar .search-input,
    .chat-sidebar .search-input__field {
      border-radius: 0;
    }

    .conversations-list {
      flex: 1;
      overflow-y: auto;
    }

    .conversation-item {
      display: flex;
      position: relative;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      border: none;
      border-bottom: 1px solid var(--border-color);

      background: transparent;
      padding: 20px 0;

      width: 100%;

      font: inherit;
      text-align: left;

      overflow: hidden;
    }

    .conversation-item:hover {
      border-color: rgb(33 150 243 / 20%);
      background: rgb(33 150 243 / 10%);
    }

    .conversation-item.active {
      box-shadow: 0 2px 10px rgb(33 150 243 / 20%);
      border-color: rgb(33 150 243 / 30%);
      background: rgb(33 150 243 / 15%);
    }

    .conversation-item .avatar {
      flex-shrink: 0;
      margin-left: 10px;
    }

    .conversation-info {
      flex: 1;
      min-width: 0;
    }

    .conversation-name {
      margin: 0 0 2px;
      color: var(--text-primary);
      font-weight: 600;

      font-size: 0.85rem;
      white-space: nowrap;
    }

    .conversation-preview {
      overflow: hidden;
      color: var(--text-secondary);

      font-size: 0.75rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .conversation-last-message {
      max-width: 200px;
      overflow: hidden;
      color: var(--text-secondary);

      font-size: 0.75rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .conversation-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }

    .conversation-time {
      margin-right: 10px;
      color: var(--text-secondary);
      font-size: 0.7rem;
      white-space: nowrap;
    }

    .conversation-meta .badge--count {
      margin-right: 10px;
    }

    /* Unread conversation styling */
    .conversation-item.unread {
      border-left: 3px solid var(--primary-color);
      background: #00f3ff0d;
      padding-left: 7px;
    }

    .conversation-item.unread:hover {
      background: linear-gradient(
        90deg,
        rgb(33 150 243 / 15%) 0%,
        rgb(33 150 243 / 8%) 100%
      );
    }

    /* Main Chat Area */
    .chat-main {
      display: flex;
      position: relative;
      flex: 1;
      flex-direction: column;
      background: var(--glass-bg);
    }

    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--color-glass-border);

      background: var(--glass-bg-hover);

      padding: 7px 16px;
    }

    .chat-header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    #chat-avatar {
      flex-shrink: 0;
    }

    .chat-header-details h3 {
      margin: 0;
      color: var(--text-primary);
      font-size: 1.3rem;
    }

    .chat-header-details .status {
      color: var(--text-secondary);
      font-size: 0.75rem;
    }

    .chat-actions {
      display: flex;
      gap: var(--spacing-2);
    }

    /* Chat Search Bar */
    .chat-search-bar {
      display: flex;
      align-items: center;
      border-bottom: 1px solid var(--border-color);

      background: var(--background-secondary);

      padding: var(--spacing-2) var(--spacing-4);
    }

    .chat-search-bar.hidden {
      display: none;
    }

    .chat-search-input-wrapper {
      display: flex;
      align-items: center;
      gap: var(--spacing-2);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);

      background: var(--background-primary);
      padding: var(--spacing-1) var(--spacing-3);

      width: 100%;
      max-width: 500px;
    }

    .chat-search-icon {
      color: var(--text-secondary);
    }

    .chat-search-input {
      flex: 1;
      outline: none;
      border: none;

      background: transparent;
      padding: var(--spacing-1) 0;

      min-width: 0;
      color: var(--text-primary);

      font-size: var(--font-size-sm);
    }

    .chat-search-input::placeholder {
      color: var(--text-tertiary);
    }

    .chat-search-counter {
      padding: 0 var(--spacing-2);
      color: var(--text-secondary);
      font-size: var(--font-size-xs);
      white-space: nowrap;
    }

    /* Search highlight in messages */
    .message-text mark,
    .search-highlight {
      border-radius: 2px;
      background: #b4fe8a66;
      padding: 1px 2px;
      color: var(--text-primary);
    }

    .search-highlight.current {
      box-shadow: 0 0 0 2px var(--warning, #facc15);
      background: var(--warning, #facc15);
    }

    /* Messages Area */
    .messages-container {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 12px;

      opacity: 0%;
      padding: 16px 16px 40px;

      min-height: 0;
      max-height: 100%;

      overflow-y: auto;
      scroll-behavior: auto;
    }

    .messages-container.loaded {
      opacity: 100%;
    }

    .message {
      display: flex;
      gap: 10px;
      margin-bottom: 12px;
      width: 100%;
    }

    .message.own {
      justify-content: flex-end;
    }

    /* Date Separator */
    .date-separator {
      display: flex;
      position: relative;
      justify-content: center;
      align-items: center;

      margin: 20px 0;
    }

    .date-separator span {
      backdrop-filter: blur(10px);
      border: var(--glass-border);
      border-radius: 20px;

      background: var(--accent-color);
      padding: 6px 16px;
      color: var(--color-text-secondary);
      font-weight: 500;

      font-size: 0.85rem;
    }

    .date-separator::before,
    .date-separator::after {
      flex: 1;
      background: var(--color-glass-border);
      height: 1px;
      content: '';
    }

    .date-separator::before {
      margin-right: 16px;
    }

    .date-separator::after {
      margin-left: 16px;
    }

    .message:not(.own) {
      justify-content: flex-start;
    }

    .message.own .message-bubble {
      align-items: flex-end;
      max-width: 65%;
    }

    .message:not(.own) .message-bubble {
      align-items: flex-start;
      max-width: 65%;
    }

    .message-bubble {
      display: flex;
      flex: 1;
      flex-direction: column;
    }

    .message-avatar {
      flex-shrink: 0;
      border-radius: 50%;

      width: 28px;
      height: 28px;

      object-fit: cover;
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 6px;

      margin-bottom: 4px;
      color: var(--text-secondary);

      font-size: 0.75rem;
    }

    .message-sender {
      color: var(--text-primary);
      font-weight: 600;
      font-size: 0.8rem;
    }

    .message-time {
      opacity: 70%;
      margin-left: auto;
      font-size: 0.7rem;
    }

    .message.own .message-avatar {
      display: none;
    }

    .message:not(.own) .message-avatar {
      display: block;
    }

    .message-content {
      position: relative;
      backdrop-filter: blur(10px);
      border: 1px solid var(--color-glass-border-hover);
      border-radius: var(--radius-xl);

      background: var(--glass-bg-active);

      padding: 10px 14px;
      color: var(--text-primary);

      font-size: 0.85rem;
      line-height: 1.4;
      overflow-wrap: break-word;
    }

    .message.own .message-content {
      border-color: hsl(188.6deg 100% 23.3% / 50%);
      background: hsl(188.6deg 100% 23.3% / 36%);
    }

    .message-content a {
      color: var(--primary-light);
      text-decoration: underline;
    }

    .message-content a:hover {
      color: var(--primary-color);
    }

    .message-text {
      margin: 0;
      color: var(--text-primary);

      line-height: 1.5;
      white-space: pre-wrap;
      word-break: normal;
    }

    .message-meta {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);

      margin-top: var(--spacing-1);
      padding: 0 var(--spacing-2);
      color: var(--text-secondary);

      font-size: 0.75rem;
    }

    .message-status {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .message.archived {
      opacity: 50%;
    }

    /* Connection Lost Banner */
    .connection-lost-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--color-warning-text, #92400e);
      background-color: var(--color-warning-bg, #fef3c7);
      border-bottom: 1px solid var(--color-warning-border, #fcd34d);
      animation: -global-pulse-banner 2s ease-in-out infinite;
    }

    /* Typing Indicator */
    .typing-indicator {
      display: flex;
      position: absolute;
      bottom: 75px;
      left: 0;
      right: 0;
      z-index: 15;
      align-items: center;
      gap: var(--spacing-2, 0.5rem);
      padding: 4px var(--spacing-4, 1rem);
      font-size: 0.8rem;
      color: var(--text-secondary);
      pointer-events: none;
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
      animation: -global-typing-bounce 1.4s infinite ease-in-out;
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

    /* Message Input Area */
    .message-input-container {
      position: relative;
      z-index: 10;
      backdrop-filter: blur(10px);
      border-top: 1px solid var(--color-glass-border);

      background: var(--glass-bg-hover);

      padding: 10px 16px;
    }

    .message-input-wrapper {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      border: 1px solid var(--color-glass-border-hover);
      border-radius: 20px;

      background: var(--glass-bg-active);

      padding: 6px;
    }

    .message-input-wrapper:focus-within {
      box-shadow: 0 0 0 2px rgb(33 150 243 / 10%);
      border-color: var(--primary-color);
    }

    .message-input {
      flex: 1;
      border: none;

      background: transparent;
      padding: 8px 12px;

      min-height: 18px;
      max-height: 100px;
      resize: none;
      color: var(--text-primary);
      font-size: 0.85rem;
      line-height: 1.4;

      font-family: inherit;
    }

    .message-input:focus {
      outline: none;
    }

    .message-input::placeholder {
      opacity: 100%;
      color: var(--color-text-placeholder);
    }

    .input-actions {
      display: flex;
      align-items: center;
      gap: var(--spacing-1);
    }

    /* Schedule Message Badge */
    .schedule-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--color-primary);
      border-radius: var(--radius-xl);

      background: rgb(33 150 243 / 15%);

      padding: 4px 10px;
      color: var(--color-primary);

      font-size: 0.75rem;
    }

    .schedule-badge i {
      font-size: 0.8rem;
    }

    .schedule-badge__time {
      font-weight: 500;
    }

    .schedule-badge__clear {
      display: flex;
      justify-content: center;
      align-items: center;

      transition: all 0.15s ease;
      cursor: pointer;
      margin-left: 2px;
      border: none;
      border-radius: 50%;

      background: var(--glass-bg-active);
      padding: 0;

      width: 16px;
      height: 16px;
      color: var(--color-text-secondary);

      font-size: 0.6rem;
    }

    .schedule-badge__clear:hover {
      background: rgb(244 67 54 / 20%);
      color: var(--color-danger);
    }

    /* Hide schedule button when badge is visible */
    .input-actions:has(.schedule-badge:not(.u-hidden)) #scheduleBtn {
      display: none;
    }

    /* Empty State */
    .empty-chat {
      display: flex;
      flex: 1;
      flex-direction: column;
      justify-content: center;
      align-items: center;

      color: var(--text-secondary);
      text-align: center;
    }

    .empty-chat-icon {
      opacity: 50%;
      margin-bottom: var(--spacing-6);
      font-size: 4rem;
    }

    .empty-chat h3 {
      margin: 0 0 var(--spacing-4) 0;
      color: var(--text-primary);
      font-size: 1.5rem;
    }

    .empty-chat p {
      max-width: 400px;
      line-height: 1.6;
    }

    /* Message Attachments */
    .attachment {
      display: flex;
      align-items: center;
      gap: var(--spacing-4);

      transition: all 0.2s ease;
      cursor: pointer;

      margin-top: var(--spacing-2);
      border: 1px solid var(--color-glass-border-hover);
      border-radius: var(--radius-xl);

      background: var(--glass-bg-active);
      padding: var(--spacing-3);
    }

    .attachment:hover {
      background: var(--glass-bg-active);
    }

    .attachment.image-attachment {
      border: none;
      background: transparent;
      padding: 0;
    }

    .attachment-image-wrapper {
      position: relative;
      border-radius: var(--radius-xl);
      overflow: hidden;
    }

    .attachment-image-wrapper img {
      display: block;
      border-radius: var(--radius-xl);

      max-width: 300px;
      max-height: 200px;

      object-fit: cover;
    }

    .attachment-overlay {
      display: flex;
      position: absolute;
      justify-content: center;
      align-items: center;

      opacity: 0%;

      transition: opacity 0.2s ease;
      inset: 0;

      border-radius: var(--radius-xl);
      background: rgb(0 0 0 / 50%);
    }

    .attachment-overlay i {
      color: rgb(255 255 255);
      font-size: 2rem;
    }

    .attachment-image-wrapper:hover .attachment-overlay {
      opacity: 100%;
    }

    .attachment.file-attachment {
      gap: var(--spacing-3);
    }

    .attachment.file-attachment > i {
      font-size: 1.5rem;
    }

    .attachment-actions {
      display: flex;
      gap: var(--spacing-2);
      margin-left: auto;
    }

    .attachment-actions .btn {
      padding: var(--spacing-1) var(--spacing-2);
    }

    .file-info {
      flex: 1;
      min-width: 0;
    }

    .file-name {
      margin-bottom: 2px;
      overflow: hidden;
      color: var(--text-primary);

      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-size {
      color: var(--text-secondary);
      font-size: 0.8rem;
    }

    /* File Preview Container (before sending) */
    .file-preview {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-2);
      backdrop-filter: blur(10px);

      margin-bottom: var(--spacing-2);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);

      background: var(--glass-bg);
      padding: var(--spacing-3);
    }

    .file-preview.hidden {
      display: none;
    }

    .file-preview-item {
      display: flex;
      position: relative;
      align-items: center;
      gap: var(--spacing-3);

      transition: opacity var(--duration-fast) var(--ease-standard);
      border-radius: var(--radius-md);

      background: var(--glass-bg-active);

      padding: var(--spacing-2) var(--spacing-3);
    }

    .file-preview-item .file-icon {
      display: flex;
      flex-shrink: 0;
      justify-content: center;
      align-items: center;
      border-radius: var(--radius-md);

      background: var(--glass-bg-active);

      width: 48px;
      height: 48px;

      color: var(--text-secondary);
    }

    .file-preview-item .file-icon img {
      border-radius: var(--radius-md);
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .file-preview-item .file-icon i {
      font-size: 1.25rem;
    }

    .file-preview-item .remove-file {
      display: flex;
      flex-shrink: 0;
      justify-content: center;
      align-items: center;

      transition: all var(--duration-fast) var(--ease-standard);
      cursor: pointer;
      border: none;
      border-radius: 50%;

      background: transparent;
      padding: 0;

      width: 28px;
      height: 28px;
      color: var(--text-secondary);

      font-size: 0.875rem;
    }

    .file-preview-item .remove-file:hover {
      background: rgb(244 67 54 / 15%);
      color: var(--color-danger);
    }

    /* Upload Progress States */
    .file-preview-item.uploading {
      opacity: 70%;
    }

    .file-preview-item.uploaded {
      opacity: 100%;
    }

    .file-preview-item .upload-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      border-radius: 0 0 var(--radius-md) var(--radius-md);

      background: var(--glass-bg-active);

      width: 100%;
      height: 4px;

      overflow: hidden;
    }

    .file-preview-item .upload-progress .progress-bar {
      transition: width 0.3s ease;
      background: var(--primary-500);
      width: 0;
      height: 100%;
    }

    /* Status Indicators */
    .status-indicator {
      position: absolute;
      right: 0;
      bottom: 0;
      border: 2px solid var(--background-primary);
      border-radius: 50%;

      width: 12px;
      height: 12px;
    }

    .status-indicator.online {
      box-shadow: 0 0 8px rgb(76 175 80 / 60%);
      background-color: #4caf50;
    }

    .status-indicator.offline {
      background-color: #9e9e9e;
    }

    .status-indicator.away {
      background-color: #ff9800;
    }

    .status-indicator.busy {
      background-color: #f44336;
    }

    /* Scheduled Message Preview */
    .message--scheduled .message-content {
      border-color: hsl(40deg 100% 40% / 50%);
      background: hsl(40deg 100% 30% / 25%);
    }

    .message--scheduled-info {
      display: flex;
      align-items: center;
      gap: 6px;

      margin-top: 8px;
      border-top: 1px solid var(--color-glass-border);
      padding-top: 8px;
      color: hsl(40deg 100% 70%);

      font-size: 0.7rem;
    }

    .message--scheduled-info i {
      font-size: 0.75rem;
    }

    .message--scheduled-info span {
      flex: 1;
    }

    .message--scheduled-cancel {
      display: flex;
      justify-content: center;
      align-items: center;

      transition: all 0.15s ease;
      cursor: pointer;
      margin-left: auto;
      border: none;
      border-radius: 50%;

      background: var(--glass-bg-active);
      padding: 0;

      width: 20px;
      height: 20px;
      color: var(--color-text-secondary);

      font-size: 0.65rem;
    }

    .message--scheduled-cancel:hover {
      background: rgb(244 67 54 / 20%);
      color: var(--color-danger);
    }

    /* Utility: hidden file input */
    .hidden {
      display: none !important;
    }
  }
  /* stylelint-enable declaration-block-no-redundant-longhand-properties */

  /* Mobile: full-width chat, no sidebar offset */
  @media (width < 768px) {
    :global {
      .chat-page-main,
      .chat-page-main.sidebar-collapsed {
        left: 0;
        top: var(--header-height-mobile);
        height: calc(100vh - var(--header-height-mobile));
      }
    }
  }

  /* Tablet: sidebar always collapsed width */
  @media (width >= 768px) and (width < 1024px) {
    :global {
      .chat-page-main,
      .chat-page-main.sidebar-collapsed {
        left: var(--sidebar-width-collapsed);
      }
    }
  }

  /* Responsive: Mobile */
  @media (width < 768px) {
    :global {
      .chat-sidebar {
        position: absolute;
        top: 0;
        left: 0;
        transform: translateX(-100%);
        z-index: 1000;

        width: 100%;
      }

      .chat-sidebar.mobile-open {
        transform: translateX(0);
      }

      .chat-main {
        width: 100%;
      }

      .message {
        max-width: 85%;
      }

      .message-input-container {
        padding: var(--spacing-3);
      }

      .chat-header {
        padding: var(--spacing-3);
      }

      .messages-container {
        padding: var(--spacing-3);
      }
    }
  }

  /* Keyframes — use -global- prefix so Svelte doesn't scope the name */
  /* stylelint-disable keyframes-name-pattern -- Svelte requires -global- prefix for unscoped keyframes */
  @keyframes -global-pulse-banner {
    0%,
    100% {
      opacity: 100%;
    }

    50% {
      opacity: 60%;
    }
  }

  @keyframes -global-typing-bounce {
    0%,
    80%,
    100% {
      transform: scale(0.8);
      opacity: 50%;
    }

    40% {
      transform: scale(1);
      opacity: 100%;
    }
  }
</style>
