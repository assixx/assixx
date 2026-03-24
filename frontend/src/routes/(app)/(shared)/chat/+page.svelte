<script lang="ts">
  /**
   * Chat Page - Thin Template Shell
   * All business logic lives in chat-page-state.svelte.ts
   * This file: SSR props, factory call, lifecycle hooks, template.
   */

  import { onMount, onDestroy } from 'svelte';

  import PermissionDenied from '$lib/components/PermissionDenied.svelte';

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
  const permissionDenied = $derived(data.permissionDenied);

  const state = createChatPageState({
    getSsrUser: () => data.currentUser,
    getSsrConversations: () => data.conversations,
    getSsrTenantId: () =>
      (data.currentUser as unknown as { tenantId?: number } | null)?.tenantId ?? 0,
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

{#if permissionDenied}
  <PermissionDenied addonName="den Chat" />
{:else}
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
              <span class="typing-dots"><span></span><span></span><span></span></span>
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
          <div class="messages-container">
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
{/if}

<style>
  /* stylelint-disable declaration-block-no-redundant-longhand-properties -- Need individual props for left override */
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

  .chat-page-main:global(.sidebar-collapsed) {
    left: var(--sidebar-width-collapsed);
  }
  /* stylelint-enable declaration-block-no-redundant-longhand-properties */

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

  .chat-main {
    display: flex;
    position: relative;
    flex: 1;
    flex-direction: column;
    background: var(--glass-bg);
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
    animation: pulse-banner 2s ease-in-out infinite;
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
    animation: typing-bounce 1.4s infinite ease-in-out;
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

  /* Empty state when no conversation is selected */
  .messages-container {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

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

  /* Utility: hidden file input */
  .hidden {
    display: none !important;
  }

  /* Mobile: full-width chat, no sidebar offset */
  @media (width < 768px) {
    .chat-page-main,
    .chat-page-main:global(.sidebar-collapsed) {
      left: 0;
      top: var(--header-height-mobile);
      height: calc(100vh - var(--header-height-mobile));
    }

    .chat-main {
      width: 100%;
    }
  }

  /* Tablet: sidebar always collapsed width */
  @media (width >= 768px) and (width < 1024px) {
    .chat-page-main,
    .chat-page-main:global(.sidebar-collapsed) {
      left: var(--sidebar-width-collapsed);
    }
  }

  @keyframes pulse-banner {
    0%,
    100% {
      opacity: 100%;
    }

    50% {
      opacity: 60%;
    }
  }

  @keyframes typing-bounce {
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
